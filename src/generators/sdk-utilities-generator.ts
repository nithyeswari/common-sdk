/**
 * SDK Utilities Generator
 * Generates error handling, monitoring, and utility functions for the SDK
 */

import { writeFile } from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { trackPerformance } from '../utils/monitoring';

export async function generateSDKUtilities(
  outputDir: string,
  moduleName: string
): Promise<void> {
  return trackPerformance('SDK Utilities Generation', async () => {
    logger.debug('Generating SDK utilities', { moduleName });

    // Generate error handling utilities
    await generateErrorHandling(outputDir);

    // Generate monitoring utilities
    await generateMonitoring(outputDir);

    // Generate logger
    await generateLogger(outputDir);

    logger.info('SDK utilities generated successfully');
  });
}

async function generateErrorHandling(outputDir: string): Promise<void> {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * Error handling utilities for the SDK');
  lines.push(' * Provides structured error handling and recovery');
  lines.push(' */\n');

  // Error codes
  lines.push('export enum ApiErrorCode {');
  lines.push('  NETWORK_ERROR = "NETWORK_ERROR",');
  lines.push('  TIMEOUT_ERROR = "TIMEOUT_ERROR",');
  lines.push('  VALIDATION_ERROR = "VALIDATION_ERROR",');
  lines.push('  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",');
  lines.push('  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",');
  lines.push('  NOT_FOUND = "NOT_FOUND",');
  lines.push('  SERVER_ERROR = "SERVER_ERROR",');
  lines.push('  UNKNOWN_ERROR = "UNKNOWN_ERROR",');
  lines.push('}\n');

  // Error class
  lines.push('export class ApiError extends Error {');
  lines.push('  public readonly code: ApiErrorCode;');
  lines.push('  public readonly status?: number;');
  lines.push('  public readonly data?: any;');
  lines.push('  public readonly timestamp: Date;');
  lines.push('');
  lines.push('  constructor(');
  lines.push('    message: string,');
  lines.push('    code: ApiErrorCode,');
  lines.push('    status?: number,');
  lines.push('    data?: any');
  lines.push('  ) {');
  lines.push('    super(message);');
  lines.push('    this.name = "ApiError";');
  lines.push('    this.code = code;');
  lines.push('    this.status = status;');
  lines.push('    this.data = data;');
  lines.push('    this.timestamp = new Date();');
  lines.push('    Error.captureStackTrace(this, this.constructor);');
  lines.push('  }');
  lines.push('');
  lines.push('  toJSON() {');
  lines.push('    return {');
  lines.push('      name: this.name,');
  lines.push('      message: this.message,');
  lines.push('      code: this.code,');
  lines.push('      status: this.status,');
  lines.push('      data: this.data,');
  lines.push('      timestamp: this.timestamp.toISOString(),');
  lines.push('      stack: this.stack,');
  lines.push('    };');
  lines.push('  }');
  lines.push('}\n');

  // Error mapper
  lines.push('/**');
  lines.push(' * Map HTTP status codes to error codes');
  lines.push(' */');
  lines.push('export function mapStatusToErrorCode(status: number): ApiErrorCode {');
  lines.push('  if (status === 401) return ApiErrorCode.AUTHENTICATION_ERROR;');
  lines.push('  if (status === 403) return ApiErrorCode.AUTHORIZATION_ERROR;');
  lines.push('  if (status === 404) return ApiErrorCode.NOT_FOUND;');
  lines.push('  if (status === 422) return ApiErrorCode.VALIDATION_ERROR;');
  lines.push('  if (status >= 500) return ApiErrorCode.SERVER_ERROR;');
  lines.push('  return ApiErrorCode.UNKNOWN_ERROR;');
  lines.push('}\n');

  // Error handler
  lines.push('/**');
  lines.push(' * Handle API errors and convert to structured ApiError');
  lines.push(' */');
  lines.push('export function handleApiError(error: any): ApiError {');
  lines.push('  if (error instanceof ApiError) {');
  lines.push('    return error;');
  lines.push('  }');
  lines.push('');
  lines.push('  // Network errors');
  lines.push('  if (error.message?.includes("Network") || error.message?.includes("fetch")) {');
  lines.push('    return new ApiError(');
  lines.push('      "Network error occurred",');
  lines.push('      ApiErrorCode.NETWORK_ERROR,');
  lines.push('      undefined,');
  lines.push('      error');
  lines.push('    );');
  lines.push('  }');
  lines.push('');
  lines.push('  // Timeout errors');
  lines.push('  if (error.message?.includes("timeout")) {');
  lines.push('    return new ApiError(');
  lines.push('      "Request timeout",');
  lines.push('      ApiErrorCode.TIMEOUT_ERROR,');
  lines.push('      undefined,');
  lines.push('      error');
  lines.push('    );');
  lines.push('  }');
  lines.push('');
  lines.push('  // HTTP errors');
  lines.push('  if (error.status) {');
  lines.push('    const code = mapStatusToErrorCode(error.status);');
  lines.push('    return new ApiError(');
  lines.push('      error.data?.message || error.message || "API request failed",');
  lines.push('      code,');
  lines.push('      error.status,');
  lines.push('      error.data');
  lines.push('    );');
  lines.push('  }');
  lines.push('');
  lines.push('  // Unknown errors');
  lines.push('  return new ApiError(');
  lines.push('    error.message || "An unknown error occurred",');
  lines.push('    ApiErrorCode.UNKNOWN_ERROR,');
  lines.push('    undefined,');
  lines.push('    error');
  lines.push('  );');
  lines.push('}\n');

  // Retry logic
  lines.push('/**');
  lines.push(' * Retry configuration');
  lines.push(' */');
  lines.push('export interface RetryConfig {');
  lines.push('  maxRetries: number;');
  lines.push('  initialDelay: number;');
  lines.push('  maxDelay: number;');
  lines.push('  backoffMultiplier: number;');
  lines.push('  retryableErrors: ApiErrorCode[];');
  lines.push('}\n');

  lines.push('export const DEFAULT_RETRY_CONFIG: RetryConfig = {');
  lines.push('  maxRetries: 3,');
  lines.push('  initialDelay: 1000,');
  lines.push('  maxDelay: 10000,');
  lines.push('  backoffMultiplier: 2,');
  lines.push('  retryableErrors: [');
  lines.push('    ApiErrorCode.NETWORK_ERROR,');
  lines.push('    ApiErrorCode.TIMEOUT_ERROR,');
  lines.push('    ApiErrorCode.SERVER_ERROR,');
  lines.push('  ],');
  lines.push('};\n');

  lines.push('/**');
  lines.push(' * Retry function with exponential backoff');
  lines.push(' */');
  lines.push('export async function retryWithBackoff<T>(');
  lines.push('  fn: () => Promise<T>,');
  lines.push('  config: Partial<RetryConfig> = {}');
  lines.push('): Promise<T> {');
  lines.push('  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };');
  lines.push('  let lastError: ApiError;');
  lines.push('  let delay = fullConfig.initialDelay;');
  lines.push('');
  lines.push('  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {');
  lines.push('    try {');
  lines.push('      return await fn();');
  lines.push('    } catch (error) {');
  lines.push('      lastError = handleApiError(error);');
  lines.push('');
  lines.push('      // Check if error is retryable');
  lines.push('      const isRetryable = fullConfig.retryableErrors.includes(lastError.code);');
  lines.push('');
  lines.push('      if (!isRetryable || attempt >= fullConfig.maxRetries) {');
  lines.push('        throw lastError;');
  lines.push('      }');
  lines.push('');
  lines.push('      // Wait before retry');
  lines.push('      await new Promise(resolve => setTimeout(resolve, delay));');
  lines.push('      delay = Math.min(delay * fullConfig.backoffMultiplier, fullConfig.maxDelay);');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  throw lastError!;');
  lines.push('}\n');

  const content = lines.join('\n');
  await writeFile(path.join(outputDir, 'error-handling.ts'), content);
}

async function generateMonitoring(outputDir: string): Promise<void> {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * Monitoring and performance tracking utilities');
  lines.push(' */\n');

  lines.push('export interface PerformanceMetric {');
  lines.push('  operation: string;');
  lines.push('  duration: number;');
  lines.push('  timestamp: Date;');
  lines.push('  success: boolean;');
  lines.push('  metadata?: Record<string, any>;');
  lines.push('}\n');

  lines.push('export interface ApiMetrics {');
  lines.push('  totalRequests: number;');
  lines.push('  successfulRequests: number;');
  lines.push('  failedRequests: number;');
  lines.push('  averageResponseTime: number;');
  lines.push('  errorRate: number;');
  lines.push('}\n');

  lines.push('class MetricsCollector {');
  lines.push('  private metrics: PerformanceMetric[] = [];');
  lines.push('  private maxMetrics = 1000;');
  lines.push('');
  lines.push('  record(metric: PerformanceMetric): void {');
  lines.push('    this.metrics.push(metric);');
  lines.push('    if (this.metrics.length > this.maxMetrics) {');
  lines.push('      this.metrics.shift();');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  getMetrics(): ApiMetrics {');
  lines.push('    const total = this.metrics.length;');
  lines.push('    const successful = this.metrics.filter(m => m.success).length;');
  lines.push('    const failed = total - successful;');
  lines.push('    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);');
  lines.push('');
  lines.push('    return {');
  lines.push('      totalRequests: total,');
  lines.push('      successfulRequests: successful,');
  lines.push('      failedRequests: failed,');
  lines.push('      averageResponseTime: total > 0 ? totalDuration / total : 0,');
  lines.push('      errorRate: total > 0 ? (failed / total) * 100 : 0,');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  clear(): void {');
  lines.push('    this.metrics = [];');
  lines.push('  }');
  lines.push('}\n');

  lines.push('export const metricsCollector = new MetricsCollector();\n');

  lines.push('/**');
  lines.push(' * Track API request performance');
  lines.push(' */');
  lines.push('export async function trackRequest<T>(');
  lines.push('  operation: string,');
  lines.push('  fn: () => Promise<T>');
  lines.push('): Promise<T> {');
  lines.push('  const startTime = Date.now();');
  lines.push('');
  lines.push('  try {');
  lines.push('    const result = await fn();');
  lines.push('    const duration = Date.now() - startTime;');
  lines.push('');
  lines.push('    metricsCollector.record({');
  lines.push('      operation,');
  lines.push('      duration,');
  lines.push('      timestamp: new Date(),');
  lines.push('      success: true,');
  lines.push('    });');
  lines.push('');
  lines.push('    return result;');
  lines.push('  } catch (error) {');
  lines.push('    const duration = Date.now() - startTime;');
  lines.push('');
  lines.push('    metricsCollector.record({');
  lines.push('      operation,');
  lines.push('      duration,');
  lines.push('      timestamp: new Date(),');
  lines.push('      success: false,');
  lines.push('    });');
  lines.push('');
  lines.push('    throw error;');
  lines.push('  }');
  lines.push('}\n');

  const content = lines.join('\n');
  await writeFile(path.join(outputDir, 'monitoring.ts'), content);
}

async function generateLogger(outputDir: string): Promise<void> {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * Simple console logger for client-side SDK');
  lines.push(' */\n');

  lines.push('export enum LogLevel {');
  lines.push('  ERROR = "error",');
  lines.push('  WARN = "warn",');
  lines.push('  INFO = "info",');
  lines.push('  DEBUG = "debug",');
  lines.push('}\n');

  lines.push('class Logger {');
  lines.push('  private level: LogLevel = LogLevel.WARN;');
  lines.push('  private enabled = process.env.NODE_ENV !== "production";');
  lines.push('');
  lines.push('  setLevel(level: LogLevel): void {');
  lines.push('    this.level = level;');
  lines.push('  }');
  lines.push('');
  lines.push('  setEnabled(enabled: boolean): void {');
  lines.push('    this.enabled = enabled;');
  lines.push('  }');
  lines.push('');
  lines.push('  private shouldLog(level: LogLevel): boolean {');
  lines.push('    if (!this.enabled) return false;');
  lines.push('');
  lines.push('    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];');
  lines.push('    return levels.indexOf(level) <= levels.indexOf(this.level);');
  lines.push('  }');
  lines.push('');
  lines.push('  error(message: string, ...args: any[]): void {');
  lines.push('    if (this.shouldLog(LogLevel.ERROR)) {');
  lines.push('      console.error(`[SDK Error] ${message}`, ...args);');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  warn(message: string, ...args: any[]): void {');
  lines.push('    if (this.shouldLog(LogLevel.WARN)) {');
  lines.push('      console.warn(`[SDK Warn] ${message}`, ...args);');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  info(message: string, ...args: any[]): void {');
  lines.push('    if (this.shouldLog(LogLevel.INFO)) {');
  lines.push('      console.info(`[SDK Info] ${message}`, ...args);');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  debug(message: string, ...args: any[]): void {');
  lines.push('    if (this.shouldLog(LogLevel.DEBUG)) {');
  lines.push('      console.debug(`[SDK Debug] ${message}`, ...args);');
  lines.push('    }');
  lines.push('  }');
  lines.push('}\n');

  lines.push('export const logger = new Logger();\n');

  const content = lines.join('\n');
  await writeFile(path.join(outputDir, 'logger.ts'), content);
}
