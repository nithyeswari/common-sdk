/**
 * Monitoring Hooks Generator
 * Generates React hooks for monitoring API usage and performance
 */

import { writeFile } from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { trackPerformance } from '../utils/monitoring';

export async function generateMonitoringHooks(
  outputDir: string,
  moduleName: string
): Promise<void> {
  return trackPerformance('Monitoring Hooks Generation', async () => {
    logger.debug('Generating monitoring hooks', { moduleName });

    const lines: string[] = [];

    lines.push('/**');
    lines.push(' * React hooks for monitoring API usage and performance');
    lines.push(' */\n');

    lines.push("import { useEffect, useRef, useState, useCallback } from 'react';");
    lines.push("import { metricsCollector } from './monitoring';");
    lines.push("import type { ApiMetrics } from './monitoring';\n");

    // API metrics hook
    lines.push('/**');
    lines.push(' * Hook to get current API metrics');
    lines.push(' * Updates every interval (default 5 seconds)');
    lines.push(' */');
    lines.push('export function useApiMetrics(intervalMs: number = 5000): ApiMetrics {');
    lines.push('  const [metrics, setMetrics] = useState<ApiMetrics>(() => metricsCollector.getMetrics());');
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    const interval = setInterval(() => {');
    lines.push('      setMetrics(metricsCollector.getMetrics());');
    lines.push('    }, intervalMs);');
    lines.push('');
    lines.push('    return () => clearInterval(interval);');
    lines.push('  }, [intervalMs]);');
    lines.push('');
    lines.push('  return metrics;');
    lines.push('}\n');

    // Request timing hook
    lines.push('/**');
    lines.push(' * Hook to track request timing');
    lines.push(' * Returns duration in milliseconds');
    lines.push(' */');
    lines.push('export function useRequestTiming(operationName: string) {');
    lines.push('  const [duration, setDuration] = useState<number | null>(null);');
    lines.push('  const [isTracking, setIsTracking] = useState(false);');
    lines.push('  const startTimeRef = useRef<number | null>(null);');
    lines.push('');
    lines.push('  const start = useCallback(() => {');
    lines.push('    startTimeRef.current = Date.now();');
    lines.push('    setIsTracking(true);');
    lines.push('    setDuration(null);');
    lines.push('  }, []);');
    lines.push('');
    lines.push('  const end = useCallback(() => {');
    lines.push('    if (startTimeRef.current !== null) {');
    lines.push('      const elapsed = Date.now() - startTimeRef.current;');
    lines.push('      setDuration(elapsed);');
    lines.push('      setIsTracking(false);');
    lines.push('      startTimeRef.current = null;');
    lines.push('    }');
    lines.push('  }, []);');
    lines.push('');
    lines.push('  return { duration, isTracking, start, end };');
    lines.push('}\n');

    // Performance observer hook
    lines.push('/**');
    lines.push(' * Hook for monitoring component render performance');
    lines.push(' */');
    lines.push('export function useRenderPerformance(componentName: string, enabled: boolean = false) {');
    lines.push('  const renderCountRef = useRef(0);');
    lines.push('  const lastRenderTimeRef = useRef<number>(Date.now());');
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    if (!enabled) return;');
    lines.push('');
    lines.push('    renderCountRef.current++;');
    lines.push('    const now = Date.now();');
    lines.push('    const timeSinceLastRender = now - lastRenderTimeRef.current;');
    lines.push('');
    lines.push('    if (timeSinceLastRender > 0) {');
    lines.push('      console.debug(');
    lines.push('        `[${componentName}] Render #${renderCountRef.current}, ` +');
    lines.push('        `Time since last render: ${timeSinceLastRender}ms`');
    lines.push('      );');
    lines.push('    }');
    lines.push('');
    lines.push('    lastRenderTimeRef.current = now;');
    lines.push('  });');
    lines.push('');
    lines.push('  return {');
    lines.push('    renderCount: renderCountRef.current,');
    lines.push('  };');
    lines.push('}\n');

    // Error tracking hook
    lines.push('/**');
    lines.push(' * Hook for tracking errors in components');
    lines.push(' */');
    lines.push('export function useErrorTracking() {');
    lines.push('  const [errors, setErrors] = useState<Array<{ timestamp: Date; error: Error }>>([]);');
    lines.push('');
    lines.push('  const trackError = useCallback((error: Error) => {');
    lines.push('    setErrors(prev => [');
    lines.push('      ...prev,');
    lines.push('      { timestamp: new Date(), error },');
    lines.push('    ].slice(-10)); // Keep last 10 errors');
    lines.push('  }, []);');
    lines.push('');
    lines.push('  const clearErrors = useCallback(() => {');
    lines.push('    setErrors([]);');
    lines.push('  }, []);');
    lines.push('');
    lines.push('  return {');
    lines.push('    errors,');
    lines.push('    trackError,');
    lines.push('    clearErrors,');
    lines.push('    errorCount: errors.length,');
    lines.push('  };');
    lines.push('}\n');

    // Network status hook
    lines.push('/**');
    lines.push(' * Hook for monitoring network status');
    lines.push(' * Useful for handling offline scenarios');
    lines.push(' */');
    lines.push('export function useNetworkStatus() {');
    lines.push('  const [isOnline, setIsOnline] = useState(() => {');
    lines.push('    if (typeof navigator !== "undefined") {');
    lines.push('      return navigator.onLine;');
    lines.push('    }');
    lines.push('    return true;');
    lines.push('  });');
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    const handleOnline = () => setIsOnline(true);');
    lines.push('    const handleOffline = () => setIsOnline(false);');
    lines.push('');
    lines.push('    window.addEventListener("online", handleOnline);');
    lines.push('    window.addEventListener("offline", handleOffline);');
    lines.push('');
    lines.push('    return () => {');
    lines.push('      window.removeEventListener("online", handleOnline);');
    lines.push('      window.removeEventListener("offline", handleOffline);');
    lines.push('    };');
    lines.push('  }, []);');
    lines.push('');
    lines.push('  return isOnline;');
    lines.push('}\n');

    // Cache monitoring hook
    lines.push('/**');
    lines.push(' * Hook for monitoring RTK Query cache status');
    lines.push(' */');
    lines.push('export function useCacheMonitor(endpointName?: string) {');
    lines.push('  const [cacheSize, setCacheSize] = useState(0);');
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    // This is a simplified version');
    lines.push('    // In production, integrate with RTK Query\'s internal cache');
    lines.push('    const updateCacheSize = () => {');
    lines.push('      // Calculate cache size from RTK Query state');
    lines.push('      // This would require access to the store');
    lines.push('      setCacheSize(0);');
    lines.push('    };');
    lines.push('');
    lines.push('    updateCacheSize();');
    lines.push('  }, [endpointName]);');
    lines.push('');
    lines.push('  return { cacheSize };');
    lines.push('}\n');

    // Request queue monitor
    lines.push('/**');
    lines.push(' * Hook for monitoring pending requests');
    lines.push(' */');
    lines.push('export function useRequestQueueMonitor() {');
    lines.push('  const [pendingRequests, setPendingRequests] = useState<string[]>([]);');
    lines.push('');
    lines.push('  const addRequest = useCallback((requestId: string) => {');
    lines.push('    setPendingRequests(prev => [...prev, requestId]);');
    lines.push('  }, []);');
    lines.push('');
    lines.push('  const removeRequest = useCallback((requestId: string) => {');
    lines.push('    setPendingRequests(prev => prev.filter(id => id !== requestId));');
    lines.push('  }, []);');
    lines.push('');
    lines.push('  return {');
    lines.push('    pendingRequests,');
    lines.push('    pendingCount: pendingRequests.length,');
    lines.push('    hasPendingRequests: pendingRequests.length > 0,');
    lines.push('    addRequest,');
    lines.push('    removeRequest,');
    lines.push('  };');
    lines.push('}\n');

    // API health check hook
    lines.push('/**');
    lines.push(' * Hook for checking API health');
    lines.push(' * Periodically pings a health endpoint');
    lines.push(' */');
    lines.push('export function useApiHealth(');
    lines.push('  healthCheckFn: () => Promise<boolean>,');
    lines.push('  intervalMs: number = 60000');
    lines.push(') {');
    lines.push('  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);');
    lines.push('  const [lastCheck, setLastCheck] = useState<Date | null>(null);');
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    const checkHealth = async () => {');
    lines.push('      try {');
    lines.push('        const healthy = await healthCheckFn();');
    lines.push('        setIsHealthy(healthy);');
    lines.push('        setLastCheck(new Date());');
    lines.push('      } catch (error) {');
    lines.push('        setIsHealthy(false);');
    lines.push('        setLastCheck(new Date());');
    lines.push('      }');
    lines.push('    };');
    lines.push('');
    lines.push('    // Initial check');
    lines.push('    checkHealth();');
    lines.push('');
    lines.push('    // Periodic checks');
    lines.push('    const interval = setInterval(checkHealth, intervalMs);');
    lines.push('');
    lines.push('    return () => clearInterval(interval);');
    lines.push('  }, [healthCheckFn, intervalMs]);');
    lines.push('');
    lines.push('  return { isHealthy, lastCheck };');
    lines.push('}\n');

    // Devtools integration
    lines.push('/**');
    lines.push(' * Hook for exposing metrics to browser devtools');
    lines.push(' */');
    lines.push('export function useDevToolsMonitoring(enabled: boolean = process.env.NODE_ENV === "development") {');
    lines.push('  useEffect(() => {');
    lines.push('    if (!enabled || typeof window === "undefined") return;');
    lines.push('');
    lines.push('    // Expose metrics to window for devtools access');
    lines.push('    (window as any).__SDK_METRICS__ = metricsCollector;');
    lines.push('');
    lines.push('    return () => {');
    lines.push('      delete (window as any).__SDK_METRICS__;');
    lines.push('    };');
    lines.push('  }, [enabled]);');
    lines.push('}\n');

    const content = lines.join('\n');
    await writeFile(path.join(outputDir, 'monitoring-hooks.ts'), content);

    logger.info('Monitoring hooks generated successfully', {
      outputFile: 'monitoring-hooks.ts',
    });
  });
}
