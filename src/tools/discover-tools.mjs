import mcpClientManager from '../services/mcp-client-manager.mjs';
import logger from '../logger.mjs';

/**
 * 注册工具重新发现工具
 * @param {Object} server - FastMCP server instance
 */
export function registerDiscoverToolsTool(server) {
  // 使用fastmcp的tool装饰器注册工具
  server.tool({
    name: 'discover_tools',
    description: '重新发现所有MCP服务器的工具，以便mcp_chain工具可以使用最新的工具列表',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }, async (args) => {
    try {
      logger.info('开始重新发现MCP工具');
      
      // 执行工具发现
      const availableTools = await mcpClientManager.discoverTools();
      
      // 等待3秒确保所有连接都建立完成
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      logger.info(`工具重新发现完成，找到 ${availableTools.length} 个工具`);
      
      // 返回工具列表作为逗号分隔的字符串
      return availableTools.join(', ');
    } catch (error) {
      logger.error(`重新发现工具失败: ${error.message}`);
      
      // 返回错误信息
      return `重新发现工具失败: ${error.message}`;
    }
  });

  logger.info('已注册 discover_tools 工具');
}

export default {
  registerDiscoverToolsTool
}; 