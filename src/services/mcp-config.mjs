import fs from 'fs';
import path from 'path';
import { McpConfigSchema } from '../schemas/mcp-chain-schema.mjs';
import logger from '../logger.mjs';

/**
 * MCP配置管理服务
 */
class McpConfigService {
  constructor() {
    this.config = null;
    this.configPath = null;
  }

  /**
   * 从文件加载MCP配置
   * @param {string} configPath - 配置文件路径
   * @returns {Object} 解析后的配置对象
   */
  loadConfig(configPath) {
    try {
      if (!fs.existsSync(configPath)) {
        throw new Error(`配置文件不存在: ${configPath}`);
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      const rawConfig = JSON.parse(configContent);
      
      // 使用zod验证配置
      this.config = McpConfigSchema.parse(rawConfig);
      this.configPath = configPath;
      
      logger.info(`成功加载MCP配置文件: ${configPath}`);
      logger.info(`发现 ${Object.keys(this.config.mcpServers).length} 个MCP服务器配置`);
      
      return this.config;
    } catch (error) {
      logger.error(`加载MCP配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取当前配置
   * @returns {Object|null} 当前配置对象
   */
  getConfig() {
    return this.config;
  }

  /**
   * 获取配置文件路径
   * @returns {string|null} 配置文件路径
   */
  getConfigPath() {
    return this.configPath;
  }

  /**
   * 获取所有MCP服务器配置
   * @returns {Object} MCP服务器配置对象
   */
  getMcpServers() {
    if (!this.config) {
      throw new Error('配置未加载，请先调用 loadConfig()');
    }
    return this.config.mcpServers;
  }

  /**
   * 获取特定MCP服务器的配置
   * @param {string} serverKey - 服务器键名
   * @returns {Object|null} 服务器配置
   */
  getServerConfig(serverKey) {
    const servers = this.getMcpServers();
    return servers[serverKey] || null;
  }

  /**
   * 获取除当前工具链服务器外的所有服务器配置
   * @param {string} excludeServerKey - 要排除的服务器键名，默认为'mcp_tool_chainer'
   * @returns {Object} 过滤后的服务器配置
   */
  getOtherServers(excludeServerKey = 'mcp_tool_chainer') {
    const servers = this.getMcpServers();
    const filteredServers = {};
    
    for (const [key, value] of Object.entries(servers)) {
      if (key !== excludeServerKey) {
        filteredServers[key] = value;
      }
    }
    
    return filteredServers;
  }

  /**
   * 验证配置是否有效
   * @returns {boolean} 配置是否有效
   */
  isConfigValid() {
    return this.config !== null && Object.keys(this.config.mcpServers).length > 0;
  }

  /**
   * 重新加载配置文件
   * @returns {Object} 重新加载的配置对象
   */
  reloadConfig() {
    if (!this.configPath) {
      throw new Error('没有配置文件路径，无法重新加载');
    }
    return this.loadConfig(this.configPath);
  }

  /**
   * 格式化服务器名称（替换连字符为下划线）
   * @param {string} name - 原始名称
   * @returns {string} 格式化后的名称
   */
  formatServerName(name) {
    return name.replace(/-/g, '_');
  }
}

// 创建单例实例
const mcpConfigService = new McpConfigService();

export default mcpConfigService; 