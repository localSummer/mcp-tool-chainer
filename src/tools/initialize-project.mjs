import { z } from 'zod';
import { initializeProjectService } from '../services/initialize-project.mjs';
import { handleApiResult } from './utils.mjs';

/**
 * Register the initialize_project tool with the MCP server
 * @param {Object} server - The MCP server instance
 */
export function registerInitializeProjectTool(server) {
  server.addTool({
    name: 'initialize_project',
    description: '初始化项目，创建 figma2code 项目目录结构，添加依赖配置文件。',
    parameters: z.object({
      isReset: z.boolean().optional(false).describe('是否重置项目'),
    }),
    execute: async (args, context) => {
      const { log } = context;
      log.info(
        `Executing initialize_project tool with args: ${JSON.stringify(args)}`
      );
      const response = await initializeProjectService(args.isReset);
      log.info(`initialize_project response: ${JSON.stringify(response)}`);
      return handleApiResult(response, log, 'initialize_project');
    },
  });
}

export default {
  registerInitializeProjectTool,
};
