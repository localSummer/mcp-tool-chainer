import { McpChainRequestSchema } from '../schemas/mcp-chain-schema.mjs';
import chainExecutor from '../services/chain-executor.mjs';
import logger from '../logger.mjs';

/**
 * 注册MCP工具链工具
 * @param {Object} server - FastMCP server instance
 */
export function registerMcpChainTool(server) {
  // 使用fastmcp的tool装饰器注册工具
  server.tool({
    name: 'mcp_chain',
    description: '将多个MCP工具链接在一起执行，支持结果传递和JSONPath数据过滤',
    parameters: {
      type: 'object',
      properties: {
        mcpPath: {
          type: 'array',
          description: '有序的工具配置数组，将按顺序执行以形成处理链。每个工具接收来自前一个工具的（可选过滤的）输出。',
          items: {
            type: 'object',
            properties: {
              toolName: {
                type: 'string',
                description: '要在链中执行的工具的完全限定名称（例如，\'browser_mcp_fetch_url\'，\'memory_server_create_entities\'）。必须与可用工具名称完全匹配。'
              },
              toolArgs: {
                type: 'string',
                description: '包含工具参数的JSON字符串。要传递链中上一个工具的结果，请使用占位符"CHAIN_RESULT"。传递给数组参数时，使用["CHAIN_RESULT"]格式。'
              },
              inputPath: {
                type: 'string',
                description: '可选的JSONPath表达式，用于在传递给此工具之前从上一个工具的结果中提取特定数据。例如：\'$.count\'将从JSON响应中仅提取count字段。'
              },
              outputPath: {
                type: 'string',
                description: '可选的JSONPath表达式，用于在传递给链中下一个工具之前从此工具的结果中提取特定数据。例如：\'$.entities[0].name\'将仅提取第一个实体名称。'
              }
            },
            required: ['toolName', 'toolArgs']
          }
        }
      },
      required: ['mcpPath']
    }
  }, async (args) => {
    try {
      logger.info('开始执行MCP工具链');
      
      // 验证请求参数
      const validatedRequest = McpChainRequestSchema.parse(args);
      const { mcpPath } = validatedRequest;

      // 验证工具链配置
      chainExecutor.validateChainConfig(mcpPath);

      // 执行工具链
      const result = await chainExecutor.executeChain(mcpPath);
      
      logger.info('MCP工具链执行完成');
      return result.content[0].text;
    } catch (error) {
      logger.error(`MCP工具链执行失败: ${error.message}`);
      
      // 返回错误信息，而不是抛出异常
      return `MCP工具链执行失败: ${error.message}`;
    }
  });

  logger.info('已注册 mcp_chain 工具');
}

export default {
  registerMcpChainTool
}; 