import { FastMCP } from 'fastmcp';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from './logger.mjs';
import { registerTools } from './tools/index.mjs';
import mcpConfigService from './services/mcp-config.mjs';
import mcpClientManager from './services/mcp-client-manager.mjs';

// Load environment variables
dotenv.config();

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main MCP server class that integrates with LP Tool Chainer
 */
class LPToolChainerMCPServer {
  constructor() {
    // Get version from package.json using synchronous fs
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    this.options = {
      name: 'LP Tool Chainer MCP Server',
      version: packageJson.version,
      // 添加现代FastMCP配置选项
      instructions: '这是一个MCP工具链服务器，提供跨MCP服务器的工具链接和执行功能。可以将多个MCP工具串联执行，支持数据过滤和结果传递。',
      // 启用根路径管理
      roots: {
        enabled: true
      },
      // 配置健康检查（当使用HTTP传输时）
      health: {
        enabled: true,
        path: '/health',
        message: 'MCP Tool Chainer Server is running'
      }
    };

    this.server = new FastMCP(this.options);
    this.initialized = false;
    this.configPath = null;

    // Bind methods
    this.init = this.init.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);

    // Setup logging
    this.logger = logger;
  }

  /**
   * Initialize the MCP server with necessary tools and routes
   */
  async init(configPath = null) {
    if (this.initialized) return;

    try {
      // 如果提供了配置文件路径，加载MCP配置
      if (configPath) {
        this.configPath = configPath;
        logger.info(`正在加载MCP配置文件: ${configPath}`);
        
        // 加载MCP配置
        mcpConfigService.loadConfig(configPath);
        
        // 启动工具发现
        logger.info('开始发现MCP工具...');
        await mcpClientManager.discoverTools();
        logger.info('MCP工具发现完成');
      } else {
        logger.warn('未提供MCP配置文件路径，工具链功能将受限');
      }

      // Pass the manager instance to the tool registration function
      registerTools(this.server);

      this.initialized = true;
      logger.info('MCP Tool Chainer 服务器初始化完成');

      return this;
    } catch (error) {
      logger.error(`服务器初始化失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start the MCP server
   */
  async start(options = {}) {
    if (!this.initialized) {
      // 尝试从命令行参数获取配置文件路径
      const configPath = process.argv[2] || options.configPath;
      await this.init(configPath);
    }

    // Start the FastMCP server with increased timeout
    await this.server.start({
      transportType: 'stdio',
      timeout: 120000, // 2 minutes timeout (in milliseconds)
      ...options
    });

    return this;
  }

  /**
   * Stop the MCP server
   */
  async stop() {
    try {
      // 关闭MCP客户端连接
      await mcpClientManager.close();
      
      if (this.server) {
        await this.server.stop();
      }
      
      logger.info('MCP Tool Chainer 服务器已停止');
    } catch (error) {
      logger.error(`停止服务器时出错: ${error.message}`);
    }
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath() {
    return this.configPath;
  }

  /**
   * 重新初始化服务器（用于配置更改）
   */
  async reinit(configPath = null) {
    const targetConfigPath = configPath || this.configPath;
    if (!targetConfigPath) {
      throw new Error('没有配置文件路径可用于重新初始化');
    }

    logger.info('重新初始化服务器...');
    
    // 重置初始化状态
    this.initialized = false;
    
    // 重新初始化
    await this.init(targetConfigPath);
    
    logger.info('服务器重新初始化完成');
  }
}

export default LPToolChainerMCPServer;
