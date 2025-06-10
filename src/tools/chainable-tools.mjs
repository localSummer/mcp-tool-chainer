import mcpClientManager from '../services/mcp-client-manager.mjs';
import logger from '../logger.mjs';

/**
 * 注册可链接工具发现工具
 * @param {Object} server - FastMCP server instance
 */
export function registerChainableToolsTool(server) {
  // 使用fastmcp的tool装饰器注册工具
  server.tool({
    name: 'chainable_tools',
    description: '发现所有MCP服务器的可用工具，以便mcp_chain工具可以使用它们',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }, async (args) => {
    try {
      logger.info('开始获取可链接工具列表');
      
      // 获取所有可用工具
      const availableTools = mcpClientManager.getAvailableTools();
      
      logger.info(`找到 ${availableTools.length} 个可用工具`);
      
      // 返回工具列表作为逗号分隔的字符串
      return availableTools.join(', ');
    } catch (error) {
      logger.error(`获取可链接工具失败: ${error.message}`);
      
      // 返回错误信息
      return `获取可链接工具失败: ${error.message}`;
    }
  });

  logger.info('已注册 chainable_tools 工具');
}

export default {
 