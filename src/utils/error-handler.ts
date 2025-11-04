/**
 * Global error handler and exception handling middleware
 * Provides centralized error handling for the CLI
 */

import chalk from 'chalk';
import { AppError, ErrorCode, isAppError, createError } from './error-codes';
import { logger } from './logger';
import { monitoring } from './monitoring';

/**
 * Format error for CLI output
 */
export function formatErrorForCLI(error: Error | AppError): string {
  if (isAppError(error)) {
    let output = chalk.red.bold(`\n✖ ${error.userMessage}\n`);

    if (error.suggestedAction) {
      output += chalk.yellow(`\n→ ${error.suggestedAction}\n`);
    }

    if (error.technicalDetails) {
      output += chalk.dim(`\nDetails: ${error.technicalDetails}\n`);
    }

    output += chalk.dim(`\nError Code: ${error.code}\n`);

    return output;
  }

  return chalk.red.bold(`\n✖ An unexpected error occurred\n\n${error.message}\n`);
}

/**
 * Handle error with logging and monitoring
 */
export function handleError(error: Error | AppError, exitProcess: boolean = true): void {
  // Log the error
  if (isAppError(error)) {
    logger.error('Application error occurred', error);
    monitoring.recordError(error);
  } else {
    // Convert unknown errors to AppError
    const appError = createError(
      ErrorCode.UNKNOWN_ERROR,
      error.message,
      error
    );
    logger.error('Unexpected error occurred', appError);
    monitoring.recordError(appError);
  }

  // Output to console
  console.error(formatErrorForCLI(error));

  // Show metrics in debug mode
  if (process.env.DEBUG === 'true') {
    console.log(monitoring.getMetricsSummary());
  }

  // Exit if requested
  if (exitProcess) {
    process.exit(1);
  }
}

/**
 * Async error handler wrapper
 */
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error as Error);
      throw error; // This won't be reached if exitProcess is true
    }
  };
}

/**
 * Sync error handler wrapper
 */
export function syncHandler<T extends any[], R>(
  fn: (...args: T) => R
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      handleError(error as Error);
      throw error; // This won't be reached if exitProcess is true
    }
  };
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error);
    console.error(chalk.red.bold('\n✖ Uncaught Exception\n'));
    console.error(formatErrorForCLI(error));
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled Promise Rejection', error);
    console.error(chalk.red.bold('\n✖ Unhandled Promise Rejection\n'));
    console.error(formatErrorForCLI(error));
    process.exit(1);
  });

  // Handle process warnings
  process.on('warning', (warning: Error) => {
    logger.warn('Process Warning', { warning: warning.message, stack: warning.stack });
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received');
    console.log(chalk.yellow('\nShutting down gracefully...'));
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received');
    console.log(chalk.yellow('\nShutting down gracefully...'));
    process.exit(0);
  });
}

/**
 * Validation helper with error handling
 */
export function validateOrThrow(
  condition: boolean,
  errorCode: ErrorCode,
  technicalDetails?: string,
  context?: Record<string, any>
): void {
  if (!condition) {
    throw createError(errorCode, technicalDetails, undefined, context);
  }
}

/**
 * Try-catch wrapper with error mapping
 */
export async function tryAsync<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode,
  technicalDetails?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw createError(errorCode, technicalDetails, error as Error);
  }
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, {
          error: lastError.message,
          delay,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }
  }

  throw lastError!;
}
