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
  const server = new LPToolChainerMCPServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });

  // Handle SIGTERM
  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    logger.error(`Failed to start MCP server: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
startServer();
