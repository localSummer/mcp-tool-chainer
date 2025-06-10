import { spawn } from 'child_process';
import logger from '../logger.mjs';
import mcpConfigService from './mcp-config.mjs';

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
  }

  /**
   * 启动传输连接
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          env: this.env,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.on('error', (error) => {
          logger.error(`进程启动失败: ${error.message}`);
          reject(error);
        });

        this.process.stdout.on('data', (data) => {
          this.handleMessage(data.toString());
        });

        this.process.stderr.on('data', (data) => {
          logger.warn(`进程stderr: ${data.toString()}`);
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
      const lines = data.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const message = JSON.parse(line);
          if (message.id && this.messageHandlers.has(message.id)) {
            const handler = this.messageHandlers.get(message.id);
            this.messageHandlers.delete(message.id);
            handler(message);
          }
        }
      }
    } catch (error) {
      logger.error(`处理消息失败: ${error.message}`);
    }
  }

  /**
   * 发送消息到MCP服务器
   */
  async send(message) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.process) {
        reject(new Error('传输未连接'));
        return;
      }

      const id = this.nextId++;
      message.id = id;
      
      this.messageHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message || '未知错误'));
        } else {
          resolve(response);
        }
      });

      const messageStr = JSON.stringify(message) + '\n';
      this.process.stdin.write(messageStr);
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
      name: "mcp_tool_chainer",
      version: "1.0.0"
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
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "latest",
          capabilities: {
            tools: {}
          },
          clientInfo: this.serverInfo
        }
      });

      if (initResponse.result && initResponse.result.serverInfo) {
        const serverInfo = initResponse.result.serverInfo;
        
        // 跳过自己
        if (serverInfo.name === this.serverInfo.name && 
            serverInfo.version === this.serverInfo.version) {
          await transport.close();
          return null;
        }

        // 获取工具列表
        const toolsResponse = await transport.send({
          jsonrpc: "2.0",
          method: "tools/list",
          params: {}
        });

        if (toolsResponse.result && toolsResponse.result.tools) {
          const client = {
            serverKey,
            serverInfo,
            transport,
            tools: toolsResponse.result.tools,
            config: serverConfig
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
          env: client.config.env
        },
        client: client
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
      const toolKey = `${mcpConfigService.formatServerName(toolInfo.name)}_${toolInfo.tool.name}`;
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
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: toolInfo.tool.name,
          arguments: args
        }
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