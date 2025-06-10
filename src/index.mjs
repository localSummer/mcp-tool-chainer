#!/usr/bin/env node
import LPToolChainerMCPServer from './server.mjs';
import dotenv from 'dotenv';
import logger from './logger.mjs';

// Load environment variables
dotenv.config();

/**
 * Start the MCP server
 */
async function startServer() {
  // 获取配置文件路径（从命令行参数）
  const configPath = process.argv[2];
  
  if (!configPath) {
    logger.warn('警告: 未提供MCP配置文件路径');
    logger.info('用法: node src/index.mjs <config-file-path>');
    logger.info('示例: node src/index.mjs ~/.cursor/mcp.json');
    logger.info('将以受限模式启动（无工具链功能）...');
  } else {
    logger.info(`使用配置文件: ${configPath}`);
  }

  const server = new LPToolChainerMCPServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('收到SIGINT信号，正在优雅关闭...');
    await server.stop();
    process.exit(0);
  });

  // Handle SIGTERM
  process.on('SIGTERM', async () => {
    logger.info('收到SIGTERM信号，正在优雅关闭...');
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start({ configPath });
    logger.info('MCP Tool Chainer 服务器启动成功');
  } catch (error) {
    logger.error(`Failed to start MCP server: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
startServer();
