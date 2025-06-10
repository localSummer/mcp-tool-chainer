import { z } from 'zod';

/**
 * MCP工具链请求的验证模式
 */
export const McpChainRequestSchema = z.object({
  mcpPath: z.array(z.object({
    toolName: z.string().describe("要在链中执行的工具的完全限定名称（例如，'browser_mcp_fetch_url'，'memory_server_create_entities'）。必须与可用工具名称完全匹配。"),
    toolArgs: z.string().describe("包含工具参数的JSON字符串。要传递链中上一个工具的结果，请使用占位符\"CHAIN_RESULT\"。传递给数组参数时，使用[\"CHAIN_RESULT\"]格式。"),
    inputPath: z.string().optional().describe("可选的JSONPath表达式，用于在传递给此工具之前从上一个工具的结果中提取特定数据。例如：'$.count'将从JSON响应中仅提取count字段。"),
    outputPath: z.string().optional().describe("可选的JSONPath表达式，用于在传递给链中下一个工具之前从此工具的结果中提取特定数据。例如：'$.entities[0].name'将仅提取第一个实体名称。")
  })).describe("有序的工具配置数组，将按顺序执行以形成处理链。每个工具接收来自前一个工具的（可选过滤的）输出。")
});

/**
 * MCP服务器配置的验证模式
 */
export const McpServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string()).optional().default({})
});

/**
 * MCP配置文件的验证模式
 */
export const McpConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerConfigSchema)
});

/**
 * 工具信息的模式
 */
export const McpToolSchema = z.object({
  name: z.string(),
  version: z.string(),
  serverJsonKey: z.string(),
  tool: z.object({
    name: z.string(),
    description: z.string().optional(),
    inputSchema: z.record(z.any()).optional()
  }),
  clientTransportInitializer: z.object({
    command: z.string(),
    args: z.array(z.string()),
    env: z.record(z.string())
  })
});

export default {
  McpChainRequestSchema,
  McpServerConfigSchema,
  McpConfigSchema,
  McpToolSchema
}; 