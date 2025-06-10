import { McpChainRequestSchema } from '../schemas/mcp-chain-schema.mjs';
import chainExecutor from '../services/chain-executor.mjs';
import logger from '../logger.mjs';
import { registerTool } from './utils.mjs';

/**
 * 注册MCP工具链工具
 * @param {Object} server - FastMCP server instance
 */
export function registerMcpChainTool(server) {
  registerTool(server, {
    name: 'mcp_chain',
    description: '将多个MCP工具链接在一起执行，支持结果传递和JSONPath数据过滤',
    parameters: McpChainRequestSchema, // 直接使用Zod schema
    annotations: {
      readOnlyHint: false, // 工具链可能包含写操作
      destructiveHint: true, // 工具链可能包含破坏性操作
      idempotentHint: false, // 重复执行可能产生不同结果
      openWorldHint: true // 与外部系统交互
    },
    execute: async (args, { log, reportProgress }) => {
      log.info('开始执行MCP工具链');
      
      // 报告进度：开始验证
      if (reportProgress) {
        await reportProgress({
          progress: 0,
          total: 100
        });
      }
      
      // 验证请求参数（Zod会自动验证，这里是额外验证）
      const { mcpPath } = args;

      // 验证工具链配置
      chainExecutor.validateChainConfig(mcpPath);
      
      // 报告进度：验证完成，开始执行
      if (reportProgress) {
        await reportProgress({
          progress: 20,
          total: 100
        });
      }

      // 执行工具链
      const result = await chainExecutor.executeChain(mcpPath);
      
      // 报告进度：完成
      if (reportProgress) {
        await reportProgress({
          progress: 100,
          total: 100
        });
      }
      
      log.info('MCP工具链执行完成');
      return result.content[0].text;
    }
  });

  logger.info('已注册 mcp_chain 工具');
}

export default {
  registerMcpChainTool
}; 