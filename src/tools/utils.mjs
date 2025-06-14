import path from 'path';

/**
 * Extracts the raw project root path from the session (without normalization).
 * Used as a fallback within the HOF.
 * @param {Object} session - The MCP session object.
 * @param {Object} log - The MCP logger object.
 * @returns {string|null} The raw path string or null.
 */
function getRawProjectRootFromSession(session, log) {
  try {
    // Check primary location
    if (session?.roots?.[0]?.uri) {
      return session.roots[0].uri;
    }
    // Check alternate location
    else if (session?.roots?.roots?.[0]?.uri) {
      return session.roots.roots[0].uri;
    }
    return null; // Not found in expected session locations
  } catch (e) {
    log.error(`Error accessing session roots: ${e.message}`);
    return null;
  }
}

/**
 * Creates standard content response for tools
 * @param {string|Object} content - Content to include in response
 * @returns {Object} - Content response object in FastMCP format
 */
function createContentResponse(content) {
  // FastMCP requires text type, so we format objects as JSON strings
  return {
    content: [
      {
        type: 'text',
        text:
          typeof content === 'object'
            ? // Format JSON nicely with indentation
              JSON.stringify(content, null, 2)
            : // Keep other content types as-is
              String(content),
      },
    ],
  };
}

/**
 * Creates error response for tools
 * @param {string} errorMessage - Error message to include in response
 * @returns {Object} - Error content response object in FastMCP format
 */
function createErrorResponse(errorMessage) {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${errorMessage}`,
      },
    ],
    isError: true,
  };
}

/**
 * Resolves and normalizes a project root path from various formats.
 * Handles URI encoding, Windows paths, and file protocols.
 * @param {string | undefined | null} rawPath - The raw project root path.
 * @param {object} [log] - Optional logger object.
 * @returns {string | null} Normalized absolute path or null if input is invalid/empty.
 */
function normalizeProjectRoot(rawPath, log) {
  if (!rawPath) return null;
  try {
    let pathString = Array.isArray(rawPath) ? rawPath[0] : String(rawPath);
    if (!pathString) return null;

    // 1. Decode URI Encoding
    // Use try-catch for decoding as malformed URIs can throw
    try {
      pathString = decodeURIComponent(pathString);
    } catch (decodeError) {
      if (log)
        log.warn(
          `Could not decode URI component for path "${rawPath}": ${decodeError.message}. Proceeding with raw string.`
        );
      // Proceed with the original string if decoding fails
      pathString = Array.isArray(rawPath) ? rawPath[0] : String(rawPath);
    }

    // 2. Strip file:// prefix (handle 2 or 3 slashes)
    if (pathString.startsWith('file:///')) {
      pathString = pathString.slice(7); // Slice 7 for file:///, may leave leading / on Windows
    } else if (pathString.startsWith('file://')) {
      pathString = pathString.slice(7); // Slice 7 for file://
    }

    // 3. Handle potential Windows leading slash after stripping prefix (e.g., /C:/...)
    // This checks if it starts with / followed by a drive letter C: D: etc.
    if (
      pathString.startsWith('/') &&
      /[A-Za-z]:/.test(pathString.substring(1, 3))
    ) {
      pathString = pathString.substring(1); // Remove the leading slash
    }

    // 4. Normalize backslashes to forward slashes
    pathString = pathString.replace(/\\/g, '/');

    // 5. Resolve to absolute path using server's OS convention
    const resolvedPath = path.resolve(pathString);
    return resolvedPath;
  } catch (error) {
    if (log) {
      log.error(
        `Error normalizing project root path "${rawPath}": ${error.message}`
      );
    }
    return null; // Return null on error
  }
}

/**
 * Handle API result with standardized error handling and response formatting
 * @param {Object} result - Result object from API call with success, data, and error properties
 * @param {Object} log - Logger object
 * @param {string} errorPrefix - Prefix for error messages
 * @returns {Object} - Standardized MCP response object
 */
function handleApiResult(result, log, errorPrefix = 'API error') {
  if (['error', 'fail'].includes(result.status)) {
    const errorMsg =
      typeof result.error === 'object'
        ? result.error.message
        : result.error || `Unknown ${errorPrefix}`;
    // Include cache status in error logs
    log.error(`${errorPrefix}: ${errorMsg}. `); // Keep logging cache status on error
    return createErrorResponse(errorMsg);
  }

  // Log success including cache status
  log.info(`Successfully completed operation. `); // Add success log with cache status

  // Create the response payload
  const responsePayload = {
    data: result.data,
  };

  // Pass this combined payload to createContentResponse
  return createContentResponse(responsePayload);
}

/**
 * Higher-order function to wrap MCP tool execute methods.
 * Ensures args.projectRoot is present and normalized before execution.
 * @param {Function} executeFn - The original async execute(args, context) function.
 * @returns {Function} The wrapped async execute function.
 */
function withNormalizedProjectRoot(executeFn) {
  return async (args, context) => {
    const { log, session } = context;
    let normalizedRoot = null;
    let rootSource = 'unknown';

    try {
      // Determine raw root: prioritize args, then session
      let rawRoot = args.projectRoot;
      if (!rawRoot) {
        rawRoot = getRawProjectRootFromSession(session, log);
        rootSource = 'session';
      } else {
        rootSource = 'args';
      }

      if (!rawRoot) {
        log.error('Could not determine project root from args or session.');
        return createErrorResponse(
          'Could not determine project root. Please provide projectRoot argument or ensure session contains root info.'
        );
      }

      // Normalize the determined raw root
      normalizedRoot = normalizeProjectRoot(rawRoot, log);

      if (!normalizedRoot) {
        log.error(
          `Failed to normalize project root obtained from ${rootSource}: ${rawRoot}`
        );
        return createErrorResponse(
          `Invalid project root provided or derived from ${rootSource}: ${rawRoot}`
        );
      }

      // Inject the normalized root back into args
      const updatedArgs = { ...args, projectRoot: normalizedRoot };

      // Execute the original function with normalized root in args
      return await executeFn(updatedArgs, context);
    } catch (error) {
      log.error(
        `Error within withNormalizedProjectRoot HOF (Normalized Root: ${normalizedRoot}): ${error.message}`
      );
      // Add stack trace if available and debug enabled
      if (error.stack && log.debug) {
        log.debug(error.stack);
      }
      // Return a generic error or re-throw depending on desired behavior
      return createErrorResponse(`Operation failed: ${error.message}`);
    }
  };
}

/**
 * 创建统一的工具注册helper，提供标准化的错误处理和日志记录
 * @param {Object} server - FastMCP server实例
 * @param {Object} toolConfig - 工具配置对象
 * @param {string} toolConfig.name - 工具名称
 * @param {string} toolConfig.description - 工具描述
 * @param {Object} toolConfig.parameters - Zod schema或其他验证schema
 * @param {Function} toolConfig.execute - 工具执行函数
 * @param {Object} [toolConfig.annotations] - 工具注解（可选）
 */
function registerTool(server, toolConfig) {
  const { name, description, parameters, execute, annotations = {} } = toolConfig;
  
  server.addTool({
    name,
    description,
    parameters,
    annotations: {
      // 默认注解
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
      ...annotations // 允许覆盖默认注解
    },
    execute: async (args, context) => {
      const { log } = context;
      
      try {
        log.info(`开始执行工具: ${name}`, { args });
        
        // 执行原始工具逻辑
        const result = await execute(args, context);
        
        log.info(`工具执行完成: ${name}`);
        
        // 确保返回值符合FastMCP格式
        if (typeof result === 'string') {
          return result;
        } else if (result && typeof result === 'object') {
          return result;
        } else {
          return String(result);
        }
        
      } catch (error) {
        log.error(`工具执行失败: ${name}`, { 
          error: error.message, 
          stack: error.stack 
        });
        
        // 根据FastMCP最佳实践，返回错误字符串而不是抛出异常
        return `工具执行失败: ${error.message}`;
      }
    }
  });
  
  // 记录工具注册成功
  console.log(`已注册工具: ${name}`);
}

/**
 * 创建标准的无参数工具注册helper
 * @param {Object} server - FastMCP server实例
 * @param {Object} toolConfig - 工具配置对象
 * @param {string} toolConfig.name - 工具名称
 * @param {string} toolConfig.description - 工具描述
 * @param {Function} toolConfig.execute - 工具执行函数
 * @param {Object} [toolConfig.annotations] - 工具注解（可选）
 */
function registerSimpleTool(server, toolConfig) {
  const { name, description, execute, annotations = {} } = toolConfig;
  
  // 对于无参数工具，使用空对象作为parameters
  registerTool(server, {
    name,
    description,
    parameters: {}, // 空参数对象
    execute,
    annotations: {
      readOnlyHint: true, // 无参数工具通常是只读的
      ...annotations
    }
  });
}

export {
  withNormalizedProjectRoot,
  getRawProjectRootFromSession,
  createErrorResponse,
  normalizeProjectRoot,
  createContentResponse,
  handleApiResult,
  registerTool,
  registerSimpleTool,
};
