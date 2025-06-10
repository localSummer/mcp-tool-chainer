import { registerMcpChainTool } from './mcp-chain.mjs';
import { registerChainableToolsTool } from './chainable-tools.mjs';
import { registerDiscoverToolsTool } from './discover-tools.mjs';

/**
 * 注册所有LP Tool Chainer工具到MCP服务器
 * @param {Object} server - FastMCP server instance
 */
export function registerTools(server) {
  try {
    // 注册MCP工具链相关工具
    registerMcpChainTool(server);
    registerChainableToolsTool(server);
    registerDiscoverToolsTool(server);
  } catch (error) {
    console.error(`Error registering LP Tool Chainer tools: ${error.message}`);
    throw error;
  }
}

export default {
  registerTools,
};
