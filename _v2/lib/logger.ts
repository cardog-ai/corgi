// Logger interface defines the methods available on our logger
interface Logger {
  info: (obj: unknown, message?: string) => void;
  error: (obj: unknown, message?: string) => void;
  warn: (obj: unknown, message?: string) => void;
  debug: (obj: unknown, message?: string) => void;
  trace: (obj: unknown, message?: string) => void;
}

// Logger configuration options
export interface LoggerOptions {
  level?: LogLevel;
  enabled?: boolean;
  name?: string;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Default configuration
const DEFAULT_OPTIONS: LoggerOptions = {
  level: 'info',
  enabled: true,
  name: 'app',
};

// Log level priority (lower number = higher priority)
const LOG_LEVELS: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

class CoreLogger {
  private options: LoggerOptions;
  private globalLevel: LogLevel = 'info';

  constructor(options: LoggerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.globalLevel = this.options.level || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.options.enabled) return false;
    return LOG_LEVELS[level] <= LOG_LEVELS[this.globalLevel];
  }

  private formatMessage(
    level: LogLevel,
    component: string = '',
    message: string = '',
    obj?: unknown,
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = component ? `[${component}]` : '';

    if (obj && typeof obj === 'object') {
      try {
        const objStr = JSON.stringify(obj);
        return `${timestamp} ${level.toUpperCase()} ${prefix} ${message} ${objStr}`;
      } catch (e) {
        return `${timestamp} ${level.toUpperCase()} ${prefix} ${message} [Object cannot be stringified]`;
      }
    }

    return `${timestamp} ${level.toUpperCase()} ${prefix} ${message} ${
      obj !== undefined ? obj : ''
    }`;
  }

  // Log methods
  trace(obj: unknown, message: string = ''): void {
    if (this.shouldLog('trace')) {
      console.debug(this.formatMessage('trace', this.options.name, message, obj));
    }
  }

  debug(obj: unknown, message: string = ''): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', this.options.name, message, obj));
    }
  }

  info(obj: unknown, message: string = ''): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', this.options.name, message, obj));
    }
  }

  warn(obj: unknown, message: string = ''): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', this.options.name, message, obj));
    }
  }

  error(obj: unknown, message: string = ''): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', this.options.name, message, obj));
    }
  }

  fatal(obj: unknown, message: string = ''): void {
    if (this.shouldLog('fatal')) {
      console.error(this.formatMessage('fatal', this.options.name, message, obj));
    }
  }

  // Create a child logger with component context
  child(component: string, meta: Record<string, any> = {}): Logger {
    const childLogger = new CoreLogger({
      ...this.options,
      name: component,
    });

    // Add meta data to logger
    const originalMethods = {
      trace: childLogger.trace.bind(childLogger),
      debug: childLogger.debug.bind(childLogger),
      info: childLogger.info.bind(childLogger),
      warn: childLogger.warn.bind(childLogger),
      error: childLogger.error.bind(childLogger),
    };

    // Enhance log methods to include metadata
    Object.keys(originalMethods).forEach(method => {
      const logMethod = method as keyof typeof originalMethods;
      childLogger[logMethod] = (obj: unknown, message: string = '') => {
        originalMethods[logMethod](
          typeof obj === 'object' && obj !== null
            ? { ...meta, ...(obj as object) }
            : { ...meta, value: obj },
          message,
        );
      };
    });

    return childLogger;
  }

  // Set global log level
  setLevel(level: LogLevel): void {
    this.globalLevel = level;
  }
}

// Create base logger instance
export const logger = new CoreLogger();

// Create a child logger with component context
export function createLogger(component: string, meta: Record<string, any> = {}): Logger {
  return logger.child(component, meta);
}

// Convenience function to create traceable request loggers with request ID
export function createRequestLogger(
  component: string,
  requestId: string = Math.random().toString(36).substring(2, 15),
): Logger & { requestId: string } {
  const reqLogger = logger.child(component, { requestId }) as Logger & {
    requestId: string;
  };
  reqLogger.requestId = requestId;
  return reqLogger;
}

// Simple way to enable global debugging
export function setLogLevel(level: LogLevel): void {
  if (level) {
    logger.setLevel(level);
  }
}
