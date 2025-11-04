/**
 * Monitoring utilities for performance and error tracking
 * Provides instrumentation and metrics collection
 */

import { logger, PerformanceTimer } from './logger';
import { AppError, ErrorCode } from './error-codes';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface ErrorMetric {
  code: ErrorCode;
  message: string;
  timestamp: Date;
  count: number;
  metadata?: Record<string, any>;
}

/**
 * Monitoring service for tracking metrics
 */
class MonitoringService {
  private static instance: MonitoringService;
  private performanceMetrics: PerformanceMetric[] = [];
  private errorMetrics: Map<ErrorCode, ErrorMetric> = new Map();
  private maxMetricsSize = 1000;

  private constructor() {}

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Record performance metric
   */
  public recordPerformance(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);

    // Keep only recent metrics
    if (this.performanceMetrics.length > this.maxMetricsSize) {
      this.performanceMetrics.shift();
    }

    // Log slow operations
    if (metric.duration > 1000) {
      logger.warn(`Slow operation detected: ${metric.operation}`, {
        duration: metric.duration,
        metadata: metric.metadata,
      });
    }
  }

  /**
   * Record error metric
   */
  public recordError(error: AppError): void {
    const existing = this.errorMetrics.get(error.code);

    if (existing) {
      existing.count++;
      existing.timestamp = new Date();
    } else {
      this.errorMetrics.set(error.code, {
        code: error.code,
        message: error.message,
        timestamp: new Date(),
        count: 1,
        metadata: error.context,
      });
    }
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    totalOperations: number;
    averageDuration: number;
    slowestOperation: PerformanceMetric | null;
    fastestOperation: PerformanceMetric | null;
    successRate: number;
  } {
    if (this.performanceMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        slowestOperation: null,
        fastestOperation: null,
        successRate: 0,
      };
    }

    const totalDuration = this.performanceMetrics.reduce((sum, m) => sum + m.duration, 0);
    const successCount = this.performanceMetrics.filter(m => m.success).length;

    return {
      totalOperations: this.performanceMetrics.length,
      averageDuration: totalDuration / this.performanceMetrics.length,
      slowestOperation: this.performanceMetrics.reduce((slowest, current) =>
        current.duration > slowest.duration ? current : slowest
      ),
      fastestOperation: this.performanceMetrics.reduce((fastest, current) =>
        current.duration < fastest.duration ? current : fastest
      ),
      successRate: (successCount / this.performanceMetrics.length) * 100,
    };
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): ErrorMetric[] {
    return Array.from(this.errorMetrics.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Get metrics summary
   */
  public getMetricsSummary(): string {
    const perfStats = this.getPerformanceStats();
    const errorStats = this.getErrorStats();

    let summary = '\n=== Metrics Summary ===\n';
    summary += `\nPerformance:\n`;
    summary += `  Total Operations: ${perfStats.totalOperations}\n`;
    summary += `  Average Duration: ${perfStats.averageDuration.toFixed(2)}ms\n`;
    summary += `  Success Rate: ${perfStats.successRate.toFixed(2)}%\n`;

    if (perfStats.slowestOperation) {
      summary += `  Slowest: ${perfStats.slowestOperation.operation} (${perfStats.slowestOperation.duration}ms)\n`;
    }

    if (errorStats.length > 0) {
      summary += `\nErrors:\n`;
      errorStats.forEach(error => {
        summary += `  [${error.code}] ${error.message}: ${error.count} occurrences\n`;
      });
    }

    return summary;
  }

  /**
   * Clear all metrics
   */
  public clear(): void {
    this.performanceMetrics = [];
    this.errorMetrics.clear();
  }
}

/**
 * Decorator for measuring function execution time
 */
export function measurePerformance(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const timer = new PerformanceTimer(operation);
      const monitoring = MonitoringService.getInstance();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = timer.elapsed();
        timer.end(true);

        monitoring.recordPerformance({
          operation,
          duration,
          timestamp: new Date(),
          success: true,
        });

        return result;
      } catch (error) {
        const duration = timer.elapsed();
        timer.end(false, error as Error);

        monitoring.recordPerformance({
          operation,
          duration,
          timestamp: new Date(),
          success: false,
        });

        if (error instanceof AppError) {
          monitoring.recordError(error);
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Manual performance tracking
 */
export function trackPerformance<T>(
  operation: string,
  fn: () => T | Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const timer = new PerformanceTimer(operation, metadata);
  const monitoring = MonitoringService.getInstance();

  const handleResult = (result: T, duration: number, success: boolean, error?: Error) => {
    timer.end(success, error);

    monitoring.recordPerformance({
      operation,
      duration,
      timestamp: new Date(),
      success,
      metadata,
    });

    if (error instanceof AppError) {
      monitoring.recordError(error);
    }
  };

  try {
    const result = fn();

    if (result instanceof Promise) {
      return result
        .then(res => {
          handleResult(res, timer.elapsed(), true);
          return res;
        })
        .catch(err => {
          handleResult(undefined as any, timer.elapsed(), false, err);
          throw err;
        });
    } else {
      handleResult(result, timer.elapsed(), true);
      return Promise.resolve(result);
    }
  } catch (error) {
    handleResult(undefined as any, timer.elapsed(), false, error as Error);
    throw error;
  }
}

/**
 * Health check utility
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  metrics: {
    performance: ReturnType<MonitoringService['getPerformanceStats']>;
    errors: ErrorMetric[];
  };
}

export function getHealthStatus(): HealthStatus {
  const monitoring = MonitoringService.getInstance();
  const perfStats = monitoring.getPerformanceStats();
  const errorStats = monitoring.getErrorStats();

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Determine health based on metrics
  if (errorStats.length > 0) {
    const totalErrors = errorStats.reduce((sum, e) => sum + e.count, 0);
    if (totalErrors > 10) {
      status = 'unhealthy';
    } else if (totalErrors > 5) {
      status = 'degraded';
    }
  }

  if (perfStats.successRate < 90 && perfStats.totalOperations > 0) {
    status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  return {
    status,
    timestamp: new Date(),
    metrics: {
      performance: perfStats,
      errors: errorStats,
    },
  };
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance();
