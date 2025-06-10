import { JSONPath } from 'jsonpath-plus';
import mcpClientManager from './mcp-client-manager.mjs';
import logger from '../logger.mjs';

const CHAIN_RESULT = "CHAIN_RESULT";

/**
 * 工具链执行器
 */
class ChainExecutor {
  constructor() {
    this.maxDepth = 10; // 最大递归深度
  }

  /**
   * 深度解析转义字符串
   * @param {string} str - 要解析的字符串
   * @param {number} depth - 当前递归深度
   * @param {number} maxDepth - 最大递归深度
   * @returns {any} 解析后的结果
   */
  deepUnescape(str, depth = 0, maxDepth = 10) {
    try {
      // 首先尝试直接解析
      return JSON.parse(str);
    } catch (e) {
      // 如果失败，可能是带转义内容的字符串
      try {
        return JSON.parse(`"${str.replace(/"/g, '\\"')}"`);
      } catch (e2) {
        // 对于深度嵌套的转义，尝试递归解转义
        if (str.includes('\\') && depth < maxDepth) {
          return this.deepUnescape(str.replace(/\\(.)/g, '$1'), depth + 1, maxDepth);
        }
        return str;
      }
    }
  }

  /**
   * 应用JSONPath提取数据
   * @param {any} data - 要处理的数据
   * @param {string} jsonPath - JSONPath表达式
   * @returns {any} 提取的数据
   */
  applyJsonPath(data, jsonPath) {
    try {
      // 如果数据是字符串，尝试解析为JSON
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // 如果解析失败，尝试提取JSON部分
          const jsonStart = data.indexOf('{');
          if (jsonStart >= 0) {
            data = data.substring(jsonStart);
            data = this.deepUnescape(data);
          }
        }
      }

      // 确保我们有一个有效的JSON对象
      const jsonData = typeof data === 'string' ? JSON.parse(data) : data;

      // 提取指定路径的数据
      const extracted = JSONPath({ path: jsonPath, json: jsonData });

      // 如果结果是只有一个元素的数组，返回该元素
      return extracted.length === 1 ? extracted[0] : extracted;
    } catch (error) {
      logger.warn(`JSONPath处理失败 ('${jsonPath}'): ${error.message}`);
      return data; // 返回原始数据
    }
  }

  /**
   * 处理工具输入参数
   * @param {string} toolArgs - 工具参数JSON字符串
   * @param {any} chainResult - 链式结果
   * @returns {Object} 处理后的参数对象
   */
  processToolArgs(toolArgs, chainResult) {
    if (chainResult === null || chainResult === undefined) {
      return JSON.parse(toolArgs);
    }

    let processedResult = chainResult;
    
    // 判断结果是否为JSON
    let isJson = false;
    try {
      if (typeof processedResult !== 'string') {
        JSON.stringify(processedResult);
        isJson = true;
      } else {
        JSON.parse(processedResult);
        isJson = true;
      }
    } catch (e) {
      isJson = false;
      // 如果不是JSON，转义字符串
      if (typeof processedResult === 'string') {
        processedResult = processedResult.replace(/"/g, '\\"');
      }
    }

    let finalArgs;
    if (typeof processedResult === 'string') {
      // 处理字符串替换
      if (toolArgs.includes(`"${CHAIN_RESULT}"`)) {
        // 如果CHAIN_RESULT在引号中，替换引号版本
        finalArgs = toolArgs.replace(`"${CHAIN_RESULT}"`, `"${processedResult}"`);
      } else {
        // 否则替换令牌
        finalArgs = toolArgs.replace(CHAIN_RESULT, processedResult);
      }
    } else {
      // 这是一个原始值（数字、布尔值等），可以字符串化
      finalArgs = toolArgs.replace(CHAIN_RESULT, String(processedResult));
    }

    return JSON.parse(finalArgs);
  }

  /**
   * 执行工具链
   * @param {Array} mcpPath - 工具链路径配置
   * @returns {Object} 执行结果
   */
  async executeChain(mcpPath) {
    let result = null;

    for (let i = 0; i < mcpPath.length; i++) {
      const { toolName, toolArgs, inputPath, outputPath } = mcpPath[i];

      try {
        // 处理输入路径（除第一步外，因为还没有结果）
        let processedResult = result;
        if (inputPath && i > 0 && result) {
          processedResult = this.applyJsonPath(result, inputPath);
          
          // 如果结果不是对象，字符串化它
          if (typeof processedResult !== 'object' || processedResult === null) {
            processedResult = processedResult;
          } else {
            processedResult = JSON.stringify(processedResult);
          }
        }

        // 确定要使用的工具参数
        let finalArgs;
        if (i === 0) {
          // 第一个工具直接使用其参数
          finalArgs = JSON.parse(toolArgs);
        } else {
          // 后续工具用处理后的结果替换CHAIN_RESULT
          finalArgs = this.processToolArgs(toolArgs, processedResult);
        }

        logger.info(`执行工具 ${i + 1}/${mcpPath.length}: ${toolName}`);
        logger.debug(`工具参数:`, finalArgs);

        // 调用工具
        const toolResponse = await mcpClientManager.callTool(toolName, finalArgs);

        // 更新当前结果
        if (toolResponse.content && toolResponse.content.length > 0) {
          result = toolResponse.content[0].text;
          
          // 应用输出路径（如果指定）
          if (outputPath) {
            result = this.applyJsonPath(result, outputPath);
            // 如果结果是原始值，字符串化它
            result = JSON.stringify(result);
          }
        } else {
          throw new Error(`工具 ${toolName} 返回空响应`);
        }

        logger.debug(`工具 ${toolName} 执行成功`);
      } catch (error) {
        logger.error(`工具链执行失败在步骤 ${i + 1} (${toolName}): ${error.message}`);
        throw error;
      }
    }

    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  }

  /**
   * 验证工具链配置
   * @param {Array} mcpPath - 工具链路径配置
   * @throws {Error} 如果配置无效
   */
  validateChainConfig(mcpPath) {
    if (!Array.isArray(mcpPath) || mcpPath.length === 0) {
      throw new Error('工具链路径不能为空');
    }

    for (let i = 0; i < mcpPath.length; i++) {
      const step = mcpPath[i];
      
      if (!step.toolName) {
        throw new Error(`步骤 ${i + 1} 缺少工具名称`);
      }
      
      if (!step.toolArgs) {
        throw new Error(`步骤 ${i + 1} 缺少工具参数`);
      }

      // 验证工具参数是有效的JSON
      try {
        JSON.parse(step.toolArgs);
      } catch (error) {
        throw new Error(`步骤 ${i + 1} 的工具参数不是有效的JSON: ${error.message}`);
      }

      // 验证工具是否存在
      const toolInfo = mcpClientManager.findTool(step.toolName);
      if (!toolInfo) {
        throw new Error(`步骤 ${i + 1} 中的工具未找到: ${step.toolName}`);
      }
    }
  }
}

// 创建单例实例
const chainExecutor = new ChainExecutor();

export default chainExecutor; 