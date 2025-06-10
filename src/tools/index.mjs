import { registerInitializeProjectTool } from './initialize-project.mjs';

/**
 * 注册所有LP Tool Chainer工具到MCP服务器
 * @param {Object} server - FastMCP server instance
 */
export function registerTools(server) {
  try {
    // 按逻辑顺序注册每个工具
    registerInitializeProjectTool(server);
  } catch (error) {
    console.error(`Error registering LP Tool Chainer tools: ${error.message}`);
    throw error;
  }
}

export default {
  registerTools,
};
