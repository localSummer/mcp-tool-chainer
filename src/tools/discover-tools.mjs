import mcpClientManager from '../services/mcp-client-manager.mjs';
import logger from '../logger.mjs';
import { registerSimpleTool } from './utils.mjs';

/**
 * 注册工具重新发现工具
 * @param {Object} server - FastMCP server instance
 */
export function registerDiscoverToolsTool(server) {
  registerSimpleTool(server, {
    name: 'discover_tools',
    description:
      '重新发现所有MCP服务器的工具，以便mcp_chain工具可以使用最新的工具列表',
    annotations: {
      readOnlyHint: false, // 这个操作会修改内部状态
      idempotentHint: false, // 每次调用可能返回不同结果
    },
    execute: async (args, { log, reportProgress }) => {
      log.info('开始重新发现MCP工具');

      // 报告进度：开始
      if (reportProgress) {
        await reportProgress({
          progress: 0,
          total: 100,
        });
      }

      // 执行工具发现
      const availableTools = await mcpClientManager.discoverTools();

      // 报告进度：发现完成
      if (reportProgress) {
        await reportProgress({
          progress: 50,
          total: 100,
        });
      }

      // 等待3秒确保所有连接都建立完成
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 报告进度：完成
      if (reportProgress) {
        await reportProgress({
          progress: 100,
          total: 100,
        });
      }

      log.info(`工具重新发现完成，找到 ${availableTools.length} 个工具`);

      // 返回工具列表作为逗号分隔的字符串
      return availableTools.join(', ');
    },
  });

  logger.info('已注册 discover_tools 工具');
}

export default {
  registerDiscoverToolsTool,
};
