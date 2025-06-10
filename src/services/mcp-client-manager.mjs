import { spawn } from 'child_process';
import logger from '../logger.mjs';
import mcpConfigService from './mcp-config.mjs';
import packageJson from '../../package.json';

/**
 * MCP客户端传输管理器
 */
class McpClientTransport {
  constructor(command, args, env = {}) {
    this.command = command;
    this.args = args;
    this.env = { ...process.env, ...env };
    this.process = null;
    this.messageHandlers = new Map();
    this.nextId = 1;
    this.connected = false;
    // 添加消息缓冲区用于处理多行JSON
    this.messageBuffer = '';
    this.isBuffering = false;
  }

  /**
   * 验证字符串是否为有效的JSON格式
   * @param {string} str - 要验证的字符串
   * @returns {boolean} 是否为有效JSON
   */
  isValidJSON(str) {
    if (!str || typeof str !== 'string') return false;
    
    // 排除明显的错误消息模式
    const errorPatterns = [
      /^\[ERROR\]/,
      /^\[WARN\]/,
      /^\[INFO\]/,
      /^\[DEBUG\]/,
      /^Error:/,
      /^Warning:/,
      /^<!DOCTYPE/,
      /^<html/
    ];
    
    for (const pattern of errorPatterns) {
      if (pattern.test(str.trim())) {
        return false;
      }
    }
    
    // 基本的JSON格式检查
    const trimmed = str.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return false;
    }
    
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安全的JSON解析函数
   * @param {string} str - 要解析的JSON字符串
   * @returns {Object|null} 解析结果或null
   */
  safeJSONParse(str) {
    try {
      return JSON.parse(str);
    } catch (error) {
      logger.debug(`JSON解析失败: ${error.message}, 内容: ${str.substring(0, 100)}...`);
      return null;
    }
  }

  /**
   * 检查JSON字符串是否完整
   * @param {string} str - JSON字符串
   * @returns {boolean} 是否完整
   */
  isCompleteJSON(str) {
    if (!str) return false;
    
    const trimmed = str.trim();
    if (!trimmed) return false;
    
    // 简单的括号平衡检查
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }
    
    return braceCount === 0 && bracketCount === 0;
  }

  /**
   * 启动传输连接
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          env: this.env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.process.on('error', (error) => {
          logger.error(`进程启动失败: ${error.message}`);
          reject(error);
        });

        this.process.stdout.on('data', (data) => {
          this.handleMessage(data.toString());
        });

        this.process.stderr.on('data', (data) => {
          const errorMessage = data.toString();
          // 结构化处理stderr输出
          this.handleStderr(errorMessage);
        });

        this.connected = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(data) {
    try {
      // 将接收到的数据添加到缓冲区
      this.messageBuffer += data;
      
      // 按行分割处理
      const lines = this.messageBuffer.split('\n');
      
      // 保留最后一行（可能不完整）在缓冲区中
      this.messageBuffer = lines.pop() || '';
      
      for (const line of lines) {
        this.processLine(line);
      }
      
      // 检查缓冲区中的内容是否为完整的JSON
      if (this.messageBuffer.trim() && this.isCompleteJSON(this.messageBuffer)) {
        this.processLine(this.messageBuffer);
        this.messageBuffer = '';
      }
      
    } catch (error) {
      logger.error(`处理消息失败: ${error.message}`);
      // 清空缓冲区以防止错误传播
      this.messageBuffer = '';
    }
  }

  /**
   * 处理单行消息
   * @param {string} line - 消息行
   */
  processLine(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    
    // 跳过明显的错误日志
    if (!this.isValidJSON(trimmedLine)) {
      logger.debug(`跳过非JSON消息: ${trimmedLine.substring(0, 100)}...`);
      return;
    }
    
    // 安全解析JSON
    const message = this.safeJSONParse(trimmedLine);
    if (!message) {
      logger.warn(`无法解析JSON消息: ${trimmedLine.substring(0, 100)}...`);
      return;
    }
    
    // 处理有效的JSON消息
    if (message.id && this.messageHandlers.has(message.id)) {
      const handler = this.messageHandlers.get(message.id);
      this.messageHandlers.delete(message.id);
      handler(message);
    } else {
      logger.debug(`收到未匹配的消息: ${JSON.stringify(message).substring(0, 100)}...`);
    }
  }

  /**
   * 处理stderr输出
   * @param {string} errorMessage - 错误消息
   */
  handleStderr(errorMessage) {
    const trimmed = errorMessage.trim();
    if (!trimmed) return;
    
    // 分类处理不同类型的错误消息
    if (trimmed.includes('[ERROR]')) {
      logger.error(`MCP进程错误: ${trimmed}`);
    } else if (trimmed.includes('[WARN]')) {
      logger.warn(`MCP进程警告: ${trimmed}`);
    } else if (trimmed.includes('[INFO]')) {
      logger.info(`MCP进程信息: ${trimmed}`);
    } else if (trimmed.includes('[DEBUG]')) {
      logger.debug(`MCP进程调试: ${trimmed}`);
    } else {
      // 处理其他类型的错误输出
      if (trimmed.toLowerCase().includes('error')) {
        logger.error(`MCP进程未分类错误: ${trimmed}`);
      } else {
        logger.warn(`MCP进程输出: ${trimmed}`);
      }
    }
  }

  /**
   * 发送消息到MCP服务器
   */
  async send(message, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.process) {
        reject(new Error('传输未连接'));
        return;
      }

      const id = this.nextId++;
      message.id = id;

      // 设置超时处理
      const timeoutId = setTimeout(() => {
        if (this.messageHandlers.has(id)) {
          this.messageHandlers.delete(id);
          reject(new Error(`消息发送超时 (${timeout}ms): ${JSON.stringify(message).substring(0, 100)}...`));
        }
      }, timeout);

      this.messageHandlers.set(id, (response) => {
        clearTimeout(timeoutId);
        
        if (response.error) {
          reject(new Error(response.error.message || '未知错误'));
        } else {
          resolve(response);
        }
      });

      try {
        const messageStr = JSON.stringify(message) + '\n';
        this.process.stdin.write(messageStr, (error) => {
          if (error) {
            clearTimeout(timeoutId);
            this.messageHandlers.delete(id);
            reject(new Error(`消息写入失败: ${error.message}`));
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        this.messageHandlers.delete(id);
        reject(new Error(`消息序列化失败: ${error.message}`));
      }
    });
  }

  /**
   * 关闭传输连接
   */
  async close() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.messageHandlers.clear();
    // 清理消息缓冲区
    this.messageBuffer = '';
    this.isBuffering = false;
  }
}

/**
 * MCP客户端管理器
 */
class McpClientManager {
  constructor() {
    this.clients = new Map();
    this.tools = new Map();
    this.serverInfo = {
      name: 'lp-tool-chainer-mcp',
      version: packageJson.version,
    };
  }

  /**
   * 创建客户端传输
   */
  async createClientTransport(command, args, env = {}) {
    const transport = new McpClientTransport(command, args, env);
    await transport.start();
    return transport;
  }

  /**
   * 初始化并连接到指定的MCP服务器
   */
  async connectToServer(serverKey, serverConfig) {
    try {
      const transport = await this.createClientTransport(
        serverConfig.command,
        serverConfig.args,
        serverConfig.env
      );

      // 发送初始化请求
      const initResponse = await transport.send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: 'latest',
          capabilities: {
            tools: {},
          },
          clientInfo: this.serverInfo,
        },
      });

      if (initResponse.result && initResponse.result.serverInfo) {
        const serverInfo = initResponse.result.serverInfo;

        // 跳过自己
        if (
          serverInfo.name === this.serverInfo.name &&
          serverInfo.version === this.serverInfo.version
        ) {
          await transport.close();
          return null;
        }

        // 获取工具列表
        const toolsResponse = await transport.send({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
        });

        if (toolsResponse.result && toolsResponse.result.tools) {
          const client = {
            serverKey,
            serverInfo,
            transport,
            tools: toolsResponse.result.tools,
            config: serverConfig,
          };

          this.clients.set(serverKey, client);

          // 注册工具
          this.registerToolsFromClient(client);

          logger.info(`成功连接到MCP服务器: ${serverInfo.name} (${serverKey})`);
          return client;
        }
      }

      await transport.close();
      throw new Error('服务器初始化失败');
    } catch (error) {
      logger.error(`连接MCP服务器失败 (${serverKey}): ${error.message}`);
      throw error;
    }
  }

  /**
   * 从客户端注册工具
   */
  registerToolsFromClient(client) {
    const formatName = (name) => name.replace(/-/g, '_');

    for (const tool of client.tools) {
      const toolKey = `${formatName(client.serverInfo.name)}_${tool.name}`;
      const altKey = `${formatName(client.serverKey)}_${tool.name}`;

      const toolInfo = {
        name: client.serverInfo.name,
        version: client.serverInfo.version,
        serverJsonKey: client.serverKey,
        tool: tool,
        clientTransportInitializer: {
          command: client.config.command,
          args: client.config.args,
          env: client.config.env,
        },
        client: client,
      };

      this.tools.set(toolKey, toolInfo);
      this.tools.set(altKey, toolInfo);
      this.tools.set(tool.name, toolInfo);
    }
  }

  /**
   * 发现所有可用的工具
   */
  async discoverTools() {
    try {
      // 清除现有工具
      this.tools.clear();

      // 关闭现有连接
      for (const client of this.clients.values()) {
        await client.transport.close();
      }
      this.clients.clear();

      const servers = mcpConfigService.getOtherServers();

      for (const [serverKey, serverConfig] of Object.entries(servers)) {
        try {
          await this.connectToServer(serverKey, serverConfig);
        } catch (error) {
          logger.warn(`跳过服务器 ${serverKey}: ${error.message}`);
        }
      }

      logger.info(`工具发现完成，找到 ${this.tools.size} 个工具`);
      return this.getAvailableTools();
    } catch (error) {
      logger.error(`工具发现失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    const tools = [];
    const seen = new Set();

    for (const toolInfo of this.tools.values()) {
      const toolKey = `${mcpConfigService.formatServerName(toolInfo.name)}_${
        toolInfo.tool.name
      }`;
      if (!seen.has(toolKey)) {
        tools.push(toolKey);
        seen.add(toolKey);
      }
    }

    return tools;
  }

  /**
   * 查找工具信息
   */
  findTool(toolName) {
    return this.tools.get(toolName);
  }

  /**
   * 调用工具
   */
  async callTool(toolName, args) {
    const toolInfo = this.findTool(toolName);
    if (!toolInfo) {
      throw new Error(`工具未找到: ${toolName}`);
    }

    try {
      const response = await toolInfo.client.transport.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolInfo.tool.name,
          arguments: args,
        },
      });

      if (response.result) {
        return response.result;
      } else {
        throw new Error(response.error?.message || '工具调用失败');
      }
    } catch (error) {
      logger.error(`工具调用失败 (${toolName}): ${error.message}`);
      throw error;
    }
  }

  /**
   * 关闭所有连接
   */
  async close() {
    for (const client of this.clients.values()) {
      try {
        await client.transport.close();
      } catch (error) {
        logger.warn(`关闭客户端连接失败: ${error.message}`);
      }
    }
    this.clients.clear();
    this.tools.clear();
  }
}

// 创建单例实例
const mcpClientManager = new McpClientManager();

export default mcpClientManager;
