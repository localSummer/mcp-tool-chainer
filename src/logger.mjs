import chalk from 'chalk';

// Define log levels
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  success: 4,
};

// Get log level from config manager or default to info
const LOG_LEVEL = LOG_LEVELS.info;

/**
 * Logs a message with the specified level
 * @param {string} level - The log level (debug, info, warn, error, success)
 * @param  {...any} args - Arguments to log
 */
function log(level, ...args) {
  // Use text prefixes instead of emojis
  const prefixes = {
    debug: chalk.gray('[DEBUG]'),
    info: chalk.blue('[INFO]'),
    warn: chalk.yellow('[WARN]'),
    error: chalk.red('[ERROR]'),
    success: chalk.green('[SUCCESS]'),
  };

  if (LOG_LEVELS[level] !== undefined && LOG_LEVELS[level] >= LOG_LEVEL) {
    const prefix = prefixes[level] || '';
    let coloredArgs = args;

    try {
      switch (level) {
        case 'error':
          coloredArgs = args.map((arg) =>
            typeof arg === 'string' ? chalk.red(arg) : arg
          );
          break;
        case 'warn':
          coloredArgs = args.map((arg) =>
            typeof arg === 'string' ? chalk.yellow(arg) : arg
          );
          break;
        case 'success':
          coloredArgs = args.map((arg) =>
            typeof arg === 'string' ? chalk.green(arg) : arg
          );
          break;
        case 'info':
          coloredArgs = args.map((arg) =>
            typeof arg === 'string' ? chalk.blue(arg) : arg
          );
          break;
        case 'debug':
          coloredArgs = args.map((arg) =>
            typeof arg === 'string' ? chalk.gray(arg) : arg
          );
          break;
        // default: use original args (no color)
      }
    } catch (colorError) {
      // Fallback if chalk fails on an argument
      // Use console.error here for internal logger errors, separate from normal logging
      console.error('Internal Logger Error applying chalk color:', colorError);
      coloredArgs = args;
    }

    // 根据日志级别选择合适的输出流
    // 错误和警告输出到 stderr，其他输出到 stdout
    if (level === 'error' || level === 'warn') {
      // 错误和警告信息输出到 stderr
      console.error(prefix, ...coloredArgs);
    } else {
      // 信息、调试和成功消息输出到 stdout
      console.log(prefix, ...coloredArgs);
    }
  }
}

/**
 * Create a logger object with methods for different log levels
 * @returns {Object} Logger object with info, error, debug, warn, and success methods
 */
export function createLogger() {
  const createLogMethod =
    (level) =>
    (...args) =>
      log(level, ...args);

  return {
    debug: createLogMethod('debug'),
    info: createLogMethod('info'),
    warn: createLogMethod('warn'),
    error: createLogMethod('error'),
    success: createLogMethod('success'),
    log: log, // Also expose the raw log function
  };
}

// Export a default logger instance
const logger = createLogger();

export default logger;

export { log, LOG_LEVELS };
