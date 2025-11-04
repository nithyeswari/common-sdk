/**
 * React 19 Hooks Generator
 * Generates React 19 hooks and utilities for the SDK
 */

import { ParsedAPI } from '../types';
import { writeFile } from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { trackPerformance } from '../utils/monitoring';

export async function generateReactHooks(
  api: ParsedAPI,
  outputDir: string,
  moduleName: string
): Promise<void> {
  return trackPerformance('React 19 Hooks Generation', async () => {
    logger.debug('Generating React 19 hooks', { moduleName });

    const lines: string[] = [];

    // Imports
    lines.push("import { use, useOptimistic, useTransition, useMemo, useCallback } from 'react';");
    lines.push(`import { ${moduleName}Api } from './api';`);
    lines.push("import type { TypedUseSelectorHook } from 'react-redux';");
    lines.push("import { useDispatch, useSelector } from 'react-redux';\n");

    // Types
    lines.push('// Hook types');
    lines.push('export interface OptimisticUpdateConfig<T> {');
    lines.push('  optimisticData: T;');
    lines.push('  rollbackOnError?: boolean;');
    lines.push('}\n');

    lines.push('export interface MutationState<T = any> {');
    lines.push('  data: T | null;');
    lines.push('  isLoading: boolean;');
    lines.push('  error: Error | null;');
    lines.push('}\n');

    // Typed hooks
    lines.push('// Typed Redux hooks');
    lines.push('export type RootState = any; // Replace with your actual root state type');
    lines.push('export type AppDispatch = any; // Replace with your actual dispatch type\n');

    lines.push('export const useAppDispatch = () => useDispatch<AppDispatch>();');
    lines.push('export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;\n');

    // Optimistic mutation hook
    lines.push('/**');
    lines.push(' * Hook for optimistic mutations with React 19 useOptimistic');
    lines.push(' * Provides instant UI updates while mutation is in progress');
    lines.push(' */');
    lines.push('export function useOptimisticMutation<TData, TVariables>(');
    lines.push('  mutationFn: (variables: TVariables) => Promise<TData>,');
    lines.push('  options?: {');
    lines.push('    onSuccess?: (data: TData) => void;');
    lines.push('    onError?: (error: Error) => void;');
    lines.push('    getOptimisticData?: (variables: TVariables) => TData;');
    lines.push('  }');
    lines.push(') {');
    lines.push('  const [isPending, startTransition] = useTransition();');
    lines.push('  const [state, setState] = useOptimistic<MutationState<TData>>({');
    lines.push('    data: null,');
    lines.push('    isLoading: false,');
    lines.push('    error: null,');
    lines.push('  });');
    lines.push('');
    lines.push('  const mutate = useCallback(');
    lines.push('    async (variables: TVariables) => {');
    lines.push('      startTransition(async () => {');
    lines.push('        // Set optimistic state');
    lines.push('        if (options?.getOptimisticData) {');
    lines.push('          setState({');
    lines.push('            data: options.getOptimisticData(variables),');
    lines.push('            isLoading: true,');
    lines.push('            error: null,');
    lines.push('          });');
    lines.push('        } else {');
    lines.push('          setState({ data: null, isLoading: true, error: null });');
    lines.push('        }');
    lines.push('');
    lines.push('        try {');
    lines.push('          const data = await mutationFn(variables);');
    lines.push('          setState({ data, isLoading: false, error: null });');
    lines.push('          options?.onSuccess?.(data);');
    lines.push('        } catch (error) {');
    lines.push('          setState({ data: null, isLoading: false, error: error as Error });');
    lines.push('          options?.onError?.(error as Error);');
    lines.push('        }');
    lines.push('      });');
    lines.push('    },');
    lines.push('    [mutationFn, options, setState, startTransition]');
    lines.push('  );');
    lines.push('');
    lines.push('  return {');
    lines.push('    ...state,');
    lines.push('    mutate,');
    lines.push('    isPending,');
    lines.push('  };');
    lines.push('}\n');

    // Suspense data hook
    lines.push('/**');
    lines.push(' * Hook that integrates with React 19 Suspense using the "use" hook');
    lines.push(' * Automatically suspends the component while data is loading');
    lines.push(' */');
    lines.push('export function useSuspenseQuery<TData>(');
    lines.push('  queryFn: () => Promise<TData>,');
    lines.push('  deps: any[] = []');
    lines.push('): TData {');
    lines.push('  const promise = useMemo(() => queryFn(), deps);');
    lines.push('  return use(promise);');
    lines.push('}\n');

    // Form action hook with React 19 useFormStatus integration
    lines.push('/**');
    lines.push(' * Hook for handling form submissions with React 19 form features');
    lines.push(' * Works with useFormStatus for pending state management');
    lines.push(' */');
    lines.push('export function useFormMutation<TData, TFormData = FormData>(');
    lines.push('  mutationFn: (formData: TFormData) => Promise<TData>,');
    lines.push('  options?: {');
    lines.push('    onSuccess?: (data: TData) => void;');
    lines.push('    onError?: (error: Error) => void;');
    lines.push('    resetOnSuccess?: boolean;');
    lines.push('  }');
    lines.push(') {');
    lines.push('  const [state, setState] = useOptimistic<MutationState<TData>>({');
    lines.push('    data: null,');
    lines.push('    isLoading: false,');
    lines.push('    error: null,');
    lines.push('  });');
    lines.push('');
    lines.push('  const handleSubmit = useCallback(');
    lines.push('    async (formData: TFormData) => {');
    lines.push('      setState({ data: null, isLoading: true, error: null });');
    lines.push('');
    lines.push('      try {');
    lines.push('        const data = await mutationFn(formData);');
    lines.push('        setState({ data, isLoading: false, error: null });');
    lines.push('        options?.onSuccess?.(data);');
    lines.push('      } catch (error) {');
    lines.push('        setState({ data: null, isLoading: false, error: error as Error });');
    lines.push('        options?.onError?.(error as Error);');
    lines.push('      }');
    lines.push('    },');
    lines.push('    [mutationFn, options, setState]');
    lines.push('  );');
    lines.push('');
    lines.push('  return {');
    lines.push('    ...state,');
    lines.push('    handleSubmit,');
    lines.push('  };');
    lines.push('}\n');

    // Prefetch hook
    lines.push('/**');
    lines.push(' * Hook for prefetching data to improve perceived performance');
    lines.push(' * Integrates with RTK Query cache');
    lines.push(' */');
    lines.push('export function usePrefetch() {');
    lines.push('  const dispatch = useAppDispatch();');
    lines.push('');
    lines.push('  return useCallback(');
    lines.push('    (endpointName: string, args: any) => {');
    lines.push(`      // @ts-ignore - Dynamic endpoint access`);
    lines.push(`      dispatch(${moduleName}Api.util.prefetch(endpointName, args));`);
    lines.push('    },');
    lines.push('    [dispatch]');
    lines.push('  );');
    lines.push('}\n');

    // Invalidate cache hook
    lines.push('/**');
    lines.push(' * Hook for invalidating RTK Query cache');
    lines.push(' * Useful for manual cache management');
    lines.push(' */');
    lines.push('export function useInvalidateCache() {');
    lines.push('  const dispatch = useAppDispatch();');
    lines.push('');
    lines.push('  return useCallback(');
    lines.push('    (tags: string[]) => {');
    lines.push(`      dispatch(${moduleName}Api.util.invalidateTags(tags as any));`);
    lines.push('    },');
    lines.push('    [dispatch]');
    lines.push('  );');
    lines.push('}\n');

    // Batch mutations hook
    lines.push('/**');
    lines.push(' * Hook for batching multiple mutations with optimistic updates');
    lines.push(' * Uses React 19 transitions for better UX');
    lines.push(' */');
    lines.push('export function useBatchMutations() {');
    lines.push('  const [isPending, startTransition] = useTransition();');
    lines.push('');
    lines.push('  const executeBatch = useCallback(');
    lines.push('    async (mutations: Array<() => Promise<any>>) => {');
    lines.push('      return new Promise((resolve, reject) => {');
    lines.push('        startTransition(async () => {');
    lines.push('          try {');
    lines.push('            const results = await Promise.all(mutations.map(m => m()));');
    lines.push('            resolve(results);');
    lines.push('          } catch (error) {');
    lines.push('            reject(error);');
    lines.push('          }');
    lines.push('        });');
    lines.push('      });');
    lines.push('    },');
    lines.push('    [startTransition]');
    lines.push('  );');
    lines.push('');
    lines.push('  return { executeBatch, isPending };');
    lines.push('}\n');

    // Error boundary hook
    lines.push('/**');
    lines.push(' * Hook for error recovery with React 19 error handling');
    lines.push(' */');
    lines.push('export function useErrorRecovery<T>(');
    lines.push('  fn: () => Promise<T>,');
    lines.push('  fallback?: T');
    lines.push('): { data: T | undefined; error: Error | null; retry: () => void } {');
    lines.push('  const [data, setData] = useOptimistic<T | undefined>(fallback);');
    lines.push('  const [error, setError] = useOptimistic<Error | null>(null);');
    lines.push('  const [isPending, startTransition] = useTransition();');
    lines.push('');
    lines.push('  const execute = useCallback(() => {');
    lines.push('    startTransition(async () => {');
    lines.push('      setError(null);');
    lines.push('      try {');
    lines.push('        const result = await fn();');
    lines.push('        setData(result);');
    lines.push('      } catch (err) {');
    lines.push('        setError(err as Error);');
    lines.push('      }');
    lines.push('    });');
    lines.push('  }, [fn, setData, setError, startTransition]);');
    lines.push('');
    lines.push('  return { data, error, retry: execute };');
    lines.push('}\n');

    const content = lines.join('\n');
    await writeFile(path.join(outputDir, 'hooks.ts'), content);

    logger.info('React 19 hooks generated successfully', {
      outputFile: 'hooks.ts',
    });
  });
}
