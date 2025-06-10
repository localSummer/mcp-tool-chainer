# MCP Tool Chainer (FastMCP Implementation)

一个基于 [FastMCP](https://github.com/jlowin/fastmcp) 重构的 MCP (Model Context Protocol) 服务器，用于链式调用其他 MCP 工具，通过顺序执行工具并传递结果来减少 token 使用。

![image](https://github.com/user-attachments/assets/3c0336a3-dd24-4dd9-88db-ac4704ee437e)

具有 Step Function 样式的 JSON 路径:

![image](https://github.com/user-attachments/assets/79ef5c3e-6166-4bc4-b571-e7b3176e777c)

## 特性

- 将多个 MCP 工具按顺序链接在一起
- 使用 `CHAIN_RESULT` 占位符将一个工具的结果作为另一个工具的输入传递
- 使用 `inputPath` 和 `outputPath` 参数通过 JsonPath 过滤和提取特定数据
- 从配置的 MCP 服务器自动发现工具
- 相比单独调用工具，最小化 token 使用
- 基于 **FastMCP** 框架重构，提供更好的性能和维护性

## 工具

此服务器实现以下 MCP 工具：

1. `mcp_chain` - 将多个 MCP 服务器链接在一起
2. `chainable_tools` - 发现所有 MCP 服务器的工具，以便 mcp_chain 工具可以使用
3. `discover_tools` - 重新发现所有 MCP 服务器的工具

## 安装

### 前置要求

- Node.js (v16 或更高版本)
- npm 或 uv

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/localSummer/mcp-tool-chainer.git
cd mcp-tool-chainer

# 安装依赖
npm install
# 或使用 uv
uv sync
```

## 使用方法

### 与 Claude Desktop、Cursor 等一起使用

**确保它是最后一个运行的 MCP，否则它将需要重新运行发现**

将以下内容添加到您的 `claude_desktop_config.json` 或 `mcp.json`:

### 配置

```json
{
  "mcpServers": {
    "mcp_tool_chainer": {
      "command": "npx",
      "args": [
        "-y",
        "@tools/lp-tool-chainer-mcp",
        "`claude_desktop_config.json` or `mcp.json`"
      ],
      "env": {
        "MCP_CONFIG_PATH": "/Users/wangxingwen/fe/fe-nlpt-pc/.cursor/mcp.json"
      }
    }
  }
}
```

![image](https://github.com/user-attachments/assets/667468c4-aeba-4ea1-b65a-fd7a5922a23b)

## 示例

### 链接浏览器和 XPath 工具

```javascript
// 获取网页然后用XPath提取特定内容
const result = await callTool('mcp_chain', {
  mcpPath: [
    {
      toolName: 'mcp_browser_mcp_fetch_url',
      toolArgs: '{"url": "https://example.com"}',
    },
    {
      toolName: 'mcp_xpath_xpath',
      toolArgs: '{"xml": CHAIN_RESULT, "query": "//h1"}',
    },
  ],
});
```

### 使用 JsonPath 与 InputPath 和 OutputPath

```javascript
// 获取网页，用XPath提取特定内容，然后提取结果的一部分
const result = await callTool('mcp_chain', {
  mcpPath: [
    {
      toolName: 'mcp_fetch_fetch',
      toolArgs: '{"url": "https://api.example.com/data"}',
    },
    {
      toolName: 'web_search',
      toolArgs: '{"search_term": CHAIN_RESULT}',
      inputPath: '$.results[0].title', // 仅从上一个输出中提取第一个结果的标题
      outputPath: '$.snippets[*].text', // 仅从搜索结果中提取文本片段
    },
    {
      toolName: 'another_tool',
      toolArgs: '{"content": CHAIN_RESULT}',
    },
  ],
});
```

## JsonPath 支持

MCP Tool Chainer 现在支持 AWS Step Functions 样式的 InputPath 和 OutputPath 功能：

- **inputPath**: JsonPath 表达式，在传递给工具之前提取输入的特定部分
- **outputPath**: JsonPath 表达式，在传递给下一个工具之前提取输出的特定部分

这些功能仅在输入/输出为有效 JSON 时起作用。如果 JsonPath 提取失败，将使用原始输入/输出。

有关 JsonPath 语法参考，请参见 [JsonPath 语法](https://goessner.net/articles/JsonPath/)。

## 优势

- **减少 Token 使用**: 通过将工具链接在一起，避免将大的中间结果发送回 LLM
- **简化工作流**: 用单个工具调用创建复杂的数据处理管道
- **提高性能**: 通过最小化 LLM 和工具之间的往返次数来减少延迟
- **精确的数据流控制**: 使用 JsonPath 表达式仅提取所需的数据
- **现代架构**: 基于 FastMCP 框架，提供更好的维护性和性能

## 开发

### 开发模式

```bash
# 使用FastMCP开发模式启动
npm run dev

# 或直接使用fastmcp
fastmcp dev src/index.mjs
```

### 生产模式

```bash
# 使用配置文件启动服务器
npm start <config-file-path>

# 示例
npm start ~/.cursor/mcp.json
```

### 工具发现

```bash
# 列出可用工具
node src/index.mjs <config-file> discover_tools
```

### 测试

使用 FastMCP Inspector 测试您的工具：

```bash
# 启动Inspector
npm run inspector

# 或使用fastmcp dev命令
npm run dev
```

然后在浏览器中访问显示的 URL 来测试您的工具。

## 技术架构

### FastMCP 重构优势

这个版本使用 [FastMCP](https://github.com/jlowin/fastmcp) 重构了原始的 MCP 实现，提供了：

- **声明式工具定义**: 使用 FastMCP 的装饰器模式
- **自动模式生成**: 从参数定义自动生成 JSON 模式
- **更好的错误处理**: 内置的错误处理和验证
- **模块化架构**: 清晰分离的服务和工具层
- **类型安全**: 使用 Zod 进行运行时类型验证
- **更好的开发体验**: 内置的开发模式和测试工具

### 目录结构

```
src/
├── index.mjs                 # 入口点
├── server.mjs                # FastMCP服务器配置
├── schemas/                  # Zod验证模式
│   └── mcp-chain-schema.mjs
├── services/                 # 核心业务逻辑
│   ├── mcp-config.mjs        # 配置管理
│   ├── mcp-client-manager.mjs # MCP客户端管理
│   └── chain-executor.mjs    # 工具链执行
└── tools/                    # MCP工具定义
    ├── index.mjs             # 工具注册
    ├── mcp-chain.mjs         # 主要工具链工具
    ├── chainable-tools.mjs   # 工具发现
    └── discover-tools.mjs    # 工具重新发现
```

## 许可证

此 MCP 服务器采用 MIT 许可证。
