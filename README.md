# MCP Tool Chainer

[![Visit Third Strand Studio](https://img.shields.io/badge/Visit-Third%20Strand%20Studio-blue)](https://thirdstrandstudio.com)

An MCP (Model Context Protocol) server that chains calls to other MCP tools, reducing token usage by allowing sequential tool execution with result passing.

![image](https://github.com/user-attachments/assets/ee8a044a-6922-4656-ba5d-a5c56aceff9a)


## Features

- Chain multiple MCP tools together in sequence
- Pass results from one tool as input to another tool using `CHAIN_RESULT` placeholder
- Automatic tool discovery from configured MCP servers
- Minimal token usage compared to individual tool calls

## Tools

This server implements the following MCP tools:

1. `mcp_chain` - Chain together multiple MCP servers
2. `chainable_tools` - Discover tools from all MCP servers so the mcp_chain tool can be used
3. `discover_tools` - Rediscover tools from all MCP servers

## Installation

### Prerequisites

* Node.js (v16 or later)
* npm or yarn

### Installing the package

```bash
# Clone the repository
git clone https://github.com/JayArrowz/mcp-tool-chainer.git
cd mcp-tool-chainer

# Install dependencies
npm install

# Build the package
npm run build
```

## Usage with Claude Desktop, Cursor etc

ENSURE IT IS THE LAST MCP TO RUN OTHERWISE IT WILL HAVE TO RUN DISCOVERY AGAIN

Add the following to your `claude_desktop_config.json` or `mcp.json`:

```json
{
  "mcpServers": {
    "mcp_tool_chainer": {
      "command": "node",
      "args": ["/path/to/mcp-tool-chainer/index.js", "`claude_desktop_config.json` or `mcp.json`"],
      "env": {}
    }
  }
}
```

Replace `/path/to/mcp-tool-chainer` with the actual path to your repository.

## Examples

### Chain Browser and XPath Tools

```javascript
// Fetch a webpage and then extract specific content with XPath
const result = await callTool("mcp_chain", { 
  "mcpPath": [
    {
      "toolName": "mcp_browser_mcp_fetch_url",
      "toolArgs": "{\"url\": \"https://example.com\"}"
    },
    {
      "toolName": "mcp_xpath_xpath",
      "toolArgs": "{\"xml\": CHAIN_RESULT, \"query\": \"//h1\"}"
    }
  ]
});
```


## Benefits

- **Reduced Token Usage**: By chaining tools together, you avoid sending large intermediate results back to the LLM
- **Simplified Workflows**: Create complex data processing pipelines with a single tool call
- **Improved Performance**: Reduce latency by minimizing round-trips between the LLM and tools

## Development

```bash
# Install dependencies
npm install

# Start the server
node index.js config.json

# List available tools
node index.js config.json discover_tools
```

## License

This MCP server is licensed under the MIT License.

---

Created by [Third Strand Studio](https://thirdstrandstudio.com)
