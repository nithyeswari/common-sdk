/**
 * Structured logging infrastructure using Winston
 * Provides comprehensive logging with levels, formatting, and file rotation
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { AppError, ErrorCode } from './error-codes';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

export interface LogContext {
  [key: string]: any;
}

/**
 * Custom log format for console output
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      const filteredMeta = { ...meta };
      delete filteredMeta.timestamp;
      delete filteredMeta.level;
      delete filteredMeta.message;

      if (Object.keys(filteredMeta).length > 0) {
        log += `\n${JSON.stringify(filteredMeta, null, 2)}`;
      }
    }

    return log;
  })
);

/**
 * JSON format for file output
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create Winston logger instance
 */
class Logger {
  private logger: winston.Logger;
  private static instance: Logger;

  private constructor() {
    const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

    // Create transports
    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info',
        format: consoleFormat,
      }),
    ];

    // Add file transports only if not in production or explicitly enabled
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
      // Error logs - daily rotation
      transports.push(
        new DailyRotateFile({
          level: 'error',
          dirname: logDir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: fileFormat,
        })
      );

      // Combined logs - daily rotation
      transports.push(
        new DailyRotateFile({
          level: 'info',
          dirname: logDir,
          filename: 'combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: fileFormat,
        })
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: fileFormat,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log error message
   */
  public error(message: string, error?: Error | AppError, context?: LogContext): void {
    const meta: any = { ...context };

    if (error) {
      if (error instanceof AppError) {
        meta.error = error.toLogFormat();
      } else {
        meta.error = {
          message: error.message,
          stack: error.stack,
          name: error.name,
        };
      }
    }

    this.logger.error(message, meta);
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  /**
   * Log info message
   */
  public info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  /**
   * Log HTTP request/response
   */
  public http(message: string, context?: LogContext): void {
    this.logger.http(message, context);
  }

  /**
   * Log verbose message
   */
  public verbose(message: string, context?: LogContext): void {
    this.logger.verbose(message, context);
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  /**
   * Log performance metrics
   */
  public performance(operation: string, duration: number, context?: LogContext): void {
    this.logger.info(`Performance: ${operation}`, {
      ...context,
      duration: `${duration}ms`,
      type: 'performance',
    });
  }

  /**
   * Log operation start
   */
  public operationStart(operation: string, context?: LogContext): void {
    this.logger.info(`Starting: ${operation}`, {
      ...context,
      type: 'operation-start',
    });
  }

  /**
   * Log operation success
   */
  public operationSuccess(operation: string, context?: LogContext): void {
    this.logger.info(`Success: ${operation}`, {
      ...context,
      type: 'operation-success',
    });
  }

  /**
   * Log operation failure
   */
  public operationFailure(operation: string, error?: Error | AppError, context?: LogContext): void {
    this.error(`Failed: ${operation}`, error, {
      ...context,
      type: 'operation-failure',
    });
  }

  /**
   * Create a child logger with default context
   */
  public child(defaultContext: LogContext): Logger {
    const childLogger = new Logger();
    const originalMethods = {
      error: childLogger.error.bind(childLogger),
      warn: childLogger.warn.bind(childLogger),
      info: childLogger.info.bind(childLogger),
      http: childLogger.http.bind(childLogger),
      verbose: childLogger.verbose.bind(childLogger),
      debug: childLogger.debug.bind(childLogger),
    };

    // Override methods to include default context
    childLogger.error = (message: string, error?: Error | AppError, context?: LogContext) => {
      originalMethods.error(message, error, { ...defaultContext, ...context });
    };

    childLogger.warn = (message: string, context?: LogContext) => {
      originalMethods.warn(message, { ...defaultContext, ...context });
    };

    childLogger.info = (message: string, context?: LogContext) => {
      originalMethods.info(message, { ...defaultContext, ...context });
    };

    childLogger.http = (message: string, context?: LogContext) => {
      originalMethods.http(message, { ...defaultContext, ...context });
    };

    childLogger.verbose = (message: string, context?: LogContext) => {
      originalMethods.verbose(message, { ...defaultContext, ...context });
    };

    childLogger.debug = (message: string, context?: LogContext) => {
      originalMethods.debug(message, { ...defaultContext, ...context });
    };

    return childLogger;
  }

  /**
   * Set log level dynamically
   */
  public setLevel(level: LogLevel): void {
    this.logger.level = level;
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private logger: Logger;
  private context?: LogContext;

  constructor(operation: string, context?: LogContext) {
    this.operation = operation;
    this.startTime = Date.now();
    this.logger = Logger.getInstance();
    this.context = context;
    this.logger.operationStart(operation, context);
  }

  /**
   * End timer and log duration
   */
  public end(success: boolean = true, error?: Error | AppError): void {
    const duration = Date.now() - this.startTime;

    if (success) {
      this.logger.operationSuccess(this.operation, this.context);
      this.logger.performance(this.operation, duration, this.context);
    } else {
      this.logger.operationFailure(this.operation, error, this.context);
    }
  }

  /**
   * Get elapsed time without ending timer
   */
  public elapsed(): number {
    return Date.now() - this.startTime;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export factory for child loggers
export function createLogger(context: LogContext): Logger {
  return logger.child(context);
}
