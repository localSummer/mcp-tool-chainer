import mcpClientManager from '../services/mcp-client-manager.mjs';
import logger from '../logger.mjs';
import { registerSimpleTool } from './utils.mjs';

/**
 * 注册可链接工具发现工具
 * @param {Object} server - FastMCP server instance
 */
export function registerChainableToolsTool(server) {
  registerSimpleTool(server, {
    name: 'chainable_tools',
    description: '发现所有MCP服务器的可用工具，以便mcp_chain工具可以使用它们',
    annotations: {
      readOnlyHint: true, // 这是只读操作
      idempotentHint: true, // 相同调用返回相同结果
    },
    execute: async (args, { log }) => {
      log.info('开始获取可链接工具列表');

      // 获取所有可用工具
      const availableTools = mcpClientManager.getAvailableTools();

      log.info(`找到 ${availableTools.length} 个可用工具`);

      // 返回工具列表作为逗号分隔的字符串
      return availableTools.join(', ');
    },
  });

  logger.info('已注册 chainable_tools 工具');
}

export default {
  registerChainableToolsTool,
};
