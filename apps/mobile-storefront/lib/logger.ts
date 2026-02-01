/**
 * Logger Utility - 2026 Best Practice
 *
 * Development-only logging that gets stripped in production builds.
 * Use this instead of console.log/warn/error to prevent console pollution in production.
 */

const isDev = __DEV__;

/**
 * Log levels for categorizing messages
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration
 */
interface LoggerConfig {
  /** Enable/disable all logging */
  enabled: boolean;
  /** Minimum log level to display */
  minLevel: LogLevel;
  /** Show timestamps in logs */
  showTimestamp: boolean;
}

const config: LoggerConfig = {
  enabled: isDev,
  minLevel: 'debug',
  showTimestamp: true,
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Format log prefix with optional timestamp and tag
 * Returns an array of prefix parts to avoid format string injection
 * (nosemgrep: javascript.lang.security.audit.unsafe-formatstring)
 */
function getLogPrefix(tag: string): string[] {
  if (config.showTimestamp) {
    const time = new Date().toISOString().split('T')[1].slice(0, 12);
    return [`[${time}]`, `[${tag}]`];
  }
  return [`[${tag}]`];
}

/**
 * Check if log level should be displayed
 */
function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

/**
 * Development-only logger
 * All methods are no-ops in production builds
 */
export const logger = {
  /**
   * Debug level logging - most verbose
   */
  debug: (tag: string, message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      // usage of ...args is deliberate for logging objects
      // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
      console.log(...getLogPrefix(tag), String(message), ...args);
    }
  },

  /**
   * Info level logging - general information
   */
  info: (tag: string, message: string, ...args: unknown[]) => {
    if (shouldLog('info')) {
      // usage of ...args is deliberate for logging objects
      // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
      console.log(...getLogPrefix(tag), String(message), ...args);
    }
  },

  /**
   * Warning level logging - potential issues
   */
  warn: (tag: string, message: string, ...args: unknown[]) => {
    if (shouldLog('warn')) {
      // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
      console.warn(...getLogPrefix(tag), String(message), ...args);
    }
  },

  /**
   * Error level logging - errors and exceptions
   */
  error: (tag: string, message: string, ...args: unknown[]) => {
    if (shouldLog('error')) {
      // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
      console.error(...getLogPrefix(tag), String(message), ...args);
    }
  },

  /**
   * Configure logger settings
   */
  configure: (newConfig: Partial<LoggerConfig>) => {
    Object.assign(config, newConfig);
  },
};

/**
 * Create a tagged logger for a specific module
 */
export function createLogger(tag: string) {
  return {
    debug: (message: string, ...args: unknown[]) =>
      logger.debug(tag, message, ...args),
    info: (message: string, ...args: unknown[]) =>
      logger.info(tag, message, ...args),
    warn: (message: string, ...args: unknown[]) =>
      logger.warn(tag, message, ...args),
    error: (message: string, ...args: unknown[]) =>
      logger.error(tag, message, ...args),
  };
}

export default logger;
