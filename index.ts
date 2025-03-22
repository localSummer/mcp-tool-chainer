#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from 'fs';
import { JSONPath } from 'jsonpath-plus';

const CHAIN_RESULT = "CHAIN_RESULT";

let config: McpConfig;

let tools: McpTool[] = [];

interface McpToolWithoutInformation {
    name: string;
    version: string;
    serverJsonKey: string;
    clientTransportInitializer: {
        command: string;
        args: string[];
        env: Record<string, string>;
    }
}

interface McpTool extends McpToolWithoutInformation {
    tool: Tool;
}


interface McpConfig {
    mcpServers: McpServers;
}

interface McpServers {
    [key: string]: ServerConfig;
}

interface ServerConfig {
    command: string;
    args: string[];
    env: Record<string, string>;
}

const McpChainRequestSchema = z.object({
    mcpPath: z.array(z.object({
        toolName: z.string().describe("The name of the tool to run .e.g. mcp_fetch_fetch, mcp_figma_figma_get_page_info, web_search, etc."),
        toolArgs: z.string().describe(`The arguments to pass to the tool, use ${CHAIN_RESULT} if you want to pass the result of the previous tool, in a array it must be used as ["${CHAIN_RESULT}"]`),
        inputPath: z.string().optional().describe("JsonPath to select portion of input before passing to tool if result of previous tool is json"),
        outputPath: z.string().optional().describe("JsonPath to select portion of output before passing to next tool if result of tool is json")
    })).describe("The path of MCP servers to chain together")
});

function deepUnescape(str: string, depth: number = 0, maxDepth: number = 10) {
    try {
        // First try parsing directly
        return JSON.parse(str);
    } catch (e) {
        // If that fails, it might be a string with escaped content
        try {
            return JSON.parse(`"${str.replace(/"/g, '\\"')}"`);
        } catch (e2) {
            // For deeply nested escaping, try to recursively unescape
            if (str.includes('\\') && depth < maxDepth) {
                return deepUnescape(str.replace(/\\(.)/g, '$1'), depth + 1, maxDepth);
            }
            return str;
        }
    }
}


async function chainTools(mcpPath: { toolName: string; toolArgs: string; inputPath?: string; outputPath?: string; }[]) {
    // Implement MCP chaining
    let result: any = null;

    // Chain each MCP server
    for (let i = 0; i < mcpPath.length; i++) {
        const { toolName, inputPath, outputPath } = mcpPath[i];

        // Create client for the current server
        const { client, tool } = await createToolClient(toolName);
        try {
            // Process the result with inputPath if specified (for all steps except first since no result yet)
            let processedResult = result;
            if (inputPath && i > 0 && result) {
                try {
                    // If the text contains escaped characters that need unescaping
                    if (typeof result === 'string') {
                        try {
                            // Try to parse the result string as JSON
                            result = JSON.parse(result);
                        } catch (e) {
                            // If parsing fails, attempt to extract JSON portion
                            const jsonStart = result.indexOf('{');
                            if (jsonStart >= 0) {
                                result = result.substring(jsonStart);
                                result = JSON.parse(result);
                            }
                        }
                    }

                    // Ensure we have a valid JSON object
                    const jsonResult = typeof result === 'string' ? JSON.parse(result) : result;

                    // Extract the specified path
                    const extractedInput = JSONPath({ path: inputPath, json: jsonResult });

                    // If extractedInput is an array with one item, use that item
                    // This handles the common JSONPath behavior of returning arrays
                    processedResult = extractedInput.length === 1 ? extractedInput[0] : extractedInput;

                    // If processedResult is a primitive value, just use it directly
                    if (typeof processedResult !== 'object' || processedResult === null) {
                        processedResult = processedResult;
                    } else {
                        // Otherwise, stringify the object
                        processedResult = JSON.stringify(processedResult);
                    }
                } catch (error) {
                    console.warn(`Failed to apply inputPath '${inputPath}'. Input may not be valid JSON. Using original result.`);
                    // Keep the original result
                }
            }

            // Define the input to use - either current chain result or the next input from inputs array
            let toolInput;
            if (i === 0) {
                // First tool just uses its args directly
                toolInput = mcpPath[i].toolArgs;
            } else {
                // For subsequent tools, replace CHAIN_RESULT with the processed result
                let isJson = false;
                try {
                    JSON.parse(processedResult);
                    isJson = true;
                } catch (e) {
                    isJson = false;
                    processedResult = JSON.stringify(processedResult).slice(1, -1);
                }
                if (typeof processedResult === 'string') {
                    // Handle string replacements more robustly
                    const jsonSafeResult = processedResult;

                    if (mcpPath[i].toolArgs.includes(`"${CHAIN_RESULT}"`)) {
                        // If CHAIN_RESULT is in quotes, replace the quoted version
                        toolInput = mcpPath[i].toolArgs.replace(`"${CHAIN_RESULT}"`, `"${processedResult}"`);
                    } else {
                        // Otherwise replace just the token
                        toolInput = mcpPath[i].toolArgs.replace(CHAIN_RESULT, jsonSafeResult);
                    }

                } else {
                    // This is a primitive value (number, boolean, etc.) that can be stringified
                    toolInput = mcpPath[i].toolArgs.replace(CHAIN_RESULT, String(processedResult));
                }
            }

            // Call the tool with the input
            const toolResponse = await client.callTool({
                name: tool.name,
                arguments: JSON.parse(toolInput)
            });

            // Update current input for the next MCP in the chain
            if (toolResponse.content) {
                result = JSON.parse(JSON.stringify(toolResponse.content))[0].text;

                // Apply outputPath if specified
                if (outputPath) {
                    try {
                        // Process result similarly to inputPath
                        if (typeof result === 'string') {
                            try {
                                // Try to parse the result string as JSON
                                result = JSON.parse(result);
                            } catch (e) {
                                // If parsing fails, attempt to extract JSON portion
                                const jsonStart = result.indexOf('{');
                                if (jsonStart >= 0) {
                                    result = deepUnescape(result.substring(jsonStart));
                                }
                            }
                        }

                        // Ensure we have a valid JSON object
                        const jsonResult = typeof result === 'string' ? JSON.parse(result) : result;

                        // Extract the specified path
                        const extractedOutput = JSONPath({ path: outputPath, json: jsonResult });

                        // If extractedOutput is an array with one item, use that item
                        // This handles the common JSONPath behavior of returning arrays
                        result = extractedOutput.length === 1 ? extractedOutput[0] : extractedOutput;

                        // If result is a primitive value, stringify it properly
                        result = JSON.stringify(result);
                    } catch (error) {
                        console.warn(`Failed to apply outputPath '${outputPath}'. Output may not be valid JSON. Using original output.`);
                    }
                }
            } else {
                throw new Error(`Empty response from MCP server ${i + 1}`);
            }
        } finally {
            // Close the client transport if it exists
            if (client.transport) {
                await client.transport.close();
            }
            await client.close();
        }
    }

    return { content: [{ type: "text", text: result }] };
}

// Add a utility function to help with conversion
function convertZodToJsonSchema(schema: z.ZodType<any>) {
    const jsonSchema = zodToJsonSchema(schema);
    return {
        ...jsonSchema
    };
}

const serverInfo = {
    name: "mcp_tool_chainer",
    version: "0.6.2"
}

// Create server instance
const server = new Server(
    serverInfo,
    {
        capabilities: {
            tools: {}
        }
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "mcp_chain",
                description: "Chain together multiple MCP servers",
                inputSchema: convertZodToJsonSchema(McpChainRequestSchema)
            },
            {
                name: "chainable_tools",
                description: "Discover tools from all MCP servers so the mcp_chain tool can be used",
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: []
                }
            },
            {
                name: "discover_tools",
                description: "Rediscover tools from all MCP servers so the mcp_chain tool can be used",
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: []
                }
            }
        ]
    };
});

// Function to create a client for a specific MCP server
async function createClientTransport(command: string, args: string[], env: Record<string, string>): Promise<StdioClientTransport> {
    const clientTransport = new StdioClientTransport({
        command: command,
        args: args,
        env: env
    });
    return clientTransport;
}

async function createToolClient(toolName: string): Promise<{ tool: Tool, client: Client }> {

    //Server names (t.name) are replaced by underscores?
    const storedTool = tools.find(t => ((formatName(t.name) + "_" + t.tool.name) === toolName) || t.tool.name === toolName || (formatName(t.serverJsonKey) + "_" + t.tool.name) === toolName);

    if (!storedTool) {
        throw new Error(`Tool ${toolName} not found`);
    }

    const client = new Client({
        name: storedTool.name,
        version: storedTool.version,
    });
    const clientTransport = await createClientTransport(storedTool.clientTransportInitializer.command, storedTool.clientTransportInitializer.args, storedTool.clientTransportInitializer.env);
    await client.connect(clientTransport);
    return {
        tool: storedTool.tool,
        client: client
    };
}


// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "chainable_tools":
                return {
                    content: [{ type: "text", text: tools.map(t => formatName(t.name) + "_" + t.tool.name).join(", ") }]
                };
            case "discover_tools":
                await startDiscovery();
                //delay 3s
                await new Promise(resolve => setTimeout(resolve, 3000));
                return {
                    content: [{ type: "text", text: tools.map(t => formatName(t.name) + "_" + t.tool.name).join(", ") }]
                };

                break;
            case "mcp_chain":
                const { mcpPath } = McpChainRequestSchema.parse(args);
                return chainTools(mcpPath);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(
                `Invalid arguments: ${error.errors
                    .map((e) => `${e.path.join(".")}: ${e.message}`)
                    .join(", ")}`
            );
        }

        // Add detailed error logging
        const err = error as any;
        console.error("Error details:", {
            message: err.message,
            stack: err.stack,
            response: err.response?.data || null,
            status: err.response?.status || null,
            headers: err.response?.headers || null,
            name: err.name,
            fullError: JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
        });

        throw new Error(`Error executing tool ${name}: ${err.message}${err.response?.data ? ` - Response: ${JSON.stringify(err.response.data)}` : ''}`);
    }
});

function formatName(name: string) {
    return name.replace("-", "_");
}

async function startDiscovery() {
    tools = [];
    for (const serverKey of Object.keys(config.mcpServers)) {
        if (serverKey === "mcp_tool_chainer") {
            continue;
        }
        const serverData = config.mcpServers[serverKey];
        const clientTransport = await createClientTransport(serverData.command, serverData.args, serverData.env);
        await clientTransport.start();
        try {
            let sk = serverKey;
            clientTransport.onmessage = (message) => {
                let ct = clientTransport;
                ct.close();
                let s = serverData;
                const parsedMessage = JSON.parse(JSON.stringify(message)); //Obviously i don't know how to use ZOD properly

                if (parsedMessage.id === 1) {
                    const name = parsedMessage.result.serverInfo.name;
                    const version = parsedMessage.result.serverInfo.version;

                    if (name === serverInfo.name && version === serverInfo.version) {
                        return;
                    }

                    const mapping = {
                        name: name,
                        version: version,
                        clientTransportInitializer: {
                            command: serverData.command,
                            args: serverData.args,
                            env: serverData.env
                        }
                    };

                    const client = new Client({
                        name: name,
                        version: version,
                    });

                    client.connect(new StdioClientTransport({
                        command: s.command,
                        args: s.args,
                        env: s.env
                    })).then(() => {
                        client.listTools().then((availTools) => {
                            for (const t of availTools.tools) {
                                tools.push({
                                    ...mapping,
                                    tool: t,
                                    serverJsonKey: sk
                                });
                            }
                        }).catch((err) => {
                            console.error("Error sending tools list request:", err);
                        }).finally(() => {
                            client.transport?.close();
                            client.close();
                        });
                    });
                }
            }

            await clientTransport.send({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "latest",
                    capabilities: {
                        tools: {}
                    },
                    clientInfo: serverInfo
                }
            });
        } catch (error) {
            console.error("Error during startup:", error);
        }
    }
}

// Start the server
async function main() {
    try {
        const configFile = process.argv[2];
        config = JSON.parse(fs.readFileSync(configFile, 'utf8')) as McpConfig;
        await startDiscovery();
        console.log("Starting MCP Tool Chainer Server...");
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log("MCP Tool Chainer Server running on stdio");
    } catch (error) {
        console.error("Error during startup:", error);
        process.exit(1);
    }
}


main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
