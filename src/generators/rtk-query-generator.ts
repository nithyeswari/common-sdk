/**
 * RTK Query API Generator
 * Generates modern Redux Toolkit Query API with latest features
 */

import { ParsedAPI, Endpoint, Parameter } from '../types';
import { writeFile } from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { trackPerformance } from '../utils/monitoring';

export async function generateRTKQuery(
  api: ParsedAPI,
  outputDir: string,
  moduleName: string,
  baseURL?: string
): Promise<void> {
  return trackPerformance('RTK Query Generation', async () => {
    logger.debug('Generating RTK Query API', { moduleName, endpoints: api.endpoints.length });

    const lines: string[] = [];

    // Imports
    lines.push("import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';");
    lines.push("import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';");
    lines.push(`import * as Types from './types';\n`);

    // Error handling types
    lines.push('// Error handling types');
    lines.push('export interface ApiError {');
    lines.push('  status: number;');
    lines.push('  data: any;');
    lines.push('  error?: string;');
    lines.push('}\n');

    lines.push('export interface RetryConfig {');
    lines.push('  maxRetries?: number;');
    lines.push('  retryCondition?: (error: FetchBaseQueryError) => boolean;');
    lines.push('}\n');

    // Base query with retry logic
    lines.push('// Base query with error handling and retry logic');
    lines.push('const baseQueryWithRetry: BaseQueryFn<');
    lines.push('  string | FetchArgs,');
    lines.push('  unknown,');
    lines.push('  FetchBaseQueryError');
    lines.push('> = async (args, api, extraOptions) => {');
    lines.push('  const baseQuery = fetchBaseQuery({');
    lines.push(`    baseUrl: '${baseURL || api.baseURL || ''}',`);
    lines.push('    prepareHeaders: (headers, { getState }) => {');
    lines.push('      // Add authentication token if available');
    lines.push('      // const token = (getState() as any).auth?.token;');
    lines.push('      // if (token) {');
    lines.push("      //   headers.set('Authorization', `Bearer ${token}`);");
    lines.push('      // }');
    lines.push('      return headers;');
    lines.push('    },');
    lines.push('  });');
    lines.push('');
    lines.push('  const maxRetries = 3;');
    lines.push('  let retries = 0;');
    lines.push('');
    lines.push('  while (retries < maxRetries) {');
    lines.push('    const result = await baseQuery(args, api, extraOptions);');
    lines.push('');
    lines.push('    // Success - return immediately');
    lines.push('    if (!result.error) {');
    lines.push('      return result;');
    lines.push('    }');
    lines.push('');
    lines.push('    // Determine if error is retryable');
    lines.push('    const isRetryable = ');
    lines.push("      result.error.status === 'FETCH_ERROR' ||");
    lines.push("      result.error.status === 'TIMEOUT_ERROR' ||");
    lines.push('      (typeof result.error.status === \'number\' && result.error.status >= 500);');
    lines.push('');
    lines.push('    if (!isRetryable || retries >= maxRetries - 1) {');
    lines.push('      return result;');
    lines.push('    }');
    lines.push('');
    lines.push('    // Exponential backoff');
    lines.push('    const delay = Math.min(1000 * Math.pow(2, retries), 10000);');
    lines.push('    await new Promise(resolve => setTimeout(resolve, delay));');
    lines.push('    retries++;');
    lines.push('  }');
    lines.push('');
    lines.push('  // Should never reach here, but TypeScript needs a return');
    lines.push('  return await baseQuery(args, api, extraOptions);');
    lines.push('};\n');

    // Create API
    lines.push(`// ${capitalize(moduleName)} API`);
    lines.push(`export const ${moduleName}Api = createApi({`);
    lines.push(`  reducerPath: '${moduleName}Api',`);
    lines.push('  baseQuery: baseQueryWithRetry,');
    lines.push('  tagTypes: [' + generateTagTypes(api) + '],');
    lines.push('  endpoints: (builder) => ({');

    // Generate endpoints
    api.endpoints.forEach((endpoint, index) => {
      lines.push(...generateEndpoint(endpoint, moduleName));
      if (index < api.endpoints.length - 1) {
        lines.push('');
      }
    });

    lines.push('  }),');
    lines.push('});\n');

    // Export hooks
    lines.push('// Export hooks for each endpoint');
    lines.push(`export const {`);
    api.endpoints.forEach((endpoint, index) => {
      const hookName = generateHookName(endpoint);
      lines.push(`  ${hookName},`);
    });
    lines.push(`} = ${moduleName}Api;\n`);

    // Export reducer and middleware
    lines.push('// Export reducer and middleware');
    lines.push(`export const ${moduleName}ApiReducer = ${moduleName}Api.reducer;`);
    lines.push(`export const ${moduleName}ApiMiddleware = ${moduleName}Api.middleware;\n`);

    // Export types
    lines.push('// Export types for all endpoints');
    api.endpoints.forEach((endpoint) => {
      const typeName = capitalize(toCamelCase(endpoint.operationId || endpoint.path));
      if (endpoint.requestBody) {
        lines.push(`export type ${typeName}Request = Types.${typeName}Request;`);
      }
      if (endpoint.response) {
        lines.push(`export type ${typeName}Response = Types.${typeName}Response;`);
      }
    });
    lines.push('');

    // Utility hooks
    lines.push('// Utility functions');
    lines.push('export function invalidateTags(tags: string[]) {');
    lines.push(`  return ${moduleName}Api.util.invalidateTags(tags as any);`);
    lines.push('}\n');

    lines.push('export function resetApiState() {');
    lines.push(`  return ${moduleName}Api.util.resetApiState();`);
    lines.push('}\n');

    const content = lines.join('\n');
    await writeFile(path.join(outputDir, 'api.ts'), content);

    logger.info('RTK Query API generated successfully', {
      endpoints: api.endpoints.length,
      outputFile: 'api.ts',
    });
  });
}

function generateEndpoint(endpoint: Endpoint, moduleName: string): string[] {
  const lines: string[] = [];
  const operationName = toCamelCase(endpoint.operationId || endpoint.path);
  const isQuery = endpoint.method === 'GET';
  const builderMethod = isQuery ? 'query' : 'mutation';

  lines.push(`    // ${endpoint.method} ${endpoint.path}`);
  lines.push(`    ${operationName}: builder.${builderMethod}<`);

  // Response type
  const responseType = endpoint.response ? `Types.${capitalize(operationName)}Response` : 'void';

  // Request type
  let requestType = 'void';
  if (endpoint.parameters.length > 0 || endpoint.requestBody) {
    requestType = '{';
    const parts: string[] = [];

    if (endpoint.parameters.length > 0) {
      endpoint.parameters.forEach((param) => {
        parts.push(`${param.name}${param.required ? '' : '?'}: ${mapType(param.type)}`);
      });
    }

    if (endpoint.requestBody) {
      parts.push(`body: Types.${capitalize(operationName)}Request`);
    }

    requestType += parts.join('; ') + '}';
  }

  lines.push(`      ${responseType},`);
  lines.push(`      ${requestType}`);
  lines.push('    >({');

  // Query function
  lines.push('      query: (arg) => {');

  if (requestType === 'void') {
    lines.push(`        return '${endpoint.path}';`);
  } else {
    // Build URL with path parameters
    let urlPath = endpoint.path;
    const pathParams = endpoint.parameters.filter(p => p.in === 'path');
    const queryParams = endpoint.parameters.filter(p => p.in === 'query');

    if (pathParams.length > 0) {
      pathParams.forEach(param => {
        urlPath = urlPath.replace(`{${param.name}}`, `\${arg.${param.name}}`);
      });
    }

    lines.push('        return {');
    lines.push(`          url: \`${urlPath}\`,`);
    lines.push(`          method: '${endpoint.method}',`);

    if (endpoint.requestBody) {
      lines.push('          body: arg.body,');
    }

    if (queryParams.length > 0) {
      lines.push('          params: {');
      queryParams.forEach(param => {
        lines.push(`            ${param.name}: arg.${param.name},`);
      });
      lines.push('          },');
    }

    lines.push('        };');
  }

  lines.push('      },');

  // Provide tags for cache invalidation
  if (isQuery) {
    const tag = generateTagForEndpoint(endpoint);
    lines.push(`      providesTags: (result, error, arg) => [${tag}],`);
  } else {
    const tag = generateInvalidatesTagForEndpoint(endpoint);
    lines.push(`      invalidatesTags: (result, error, arg) => [${tag}],`);
  }

  lines.push('    }),');

  return lines;
}

function generateTagTypes(api: ParsedAPI): string {
  const tags = new Set<string>();

  api.endpoints.forEach(endpoint => {
    const path = endpoint.path.split('/')[1] || 'Default';
    tags.add(`'${capitalize(path)}'`);
  });

  return Array.from(tags).join(', ');
}

function generateTagForEndpoint(endpoint: Endpoint): string {
  const tag = endpoint.path.split('/')[1] || 'Default';
  return `{ type: '${capitalize(tag)}', id: 'LIST' }`;
}

function generateInvalidatesTagForEndpoint(endpoint: Endpoint): string {
  const tag = endpoint.path.split('/')[1] || 'Default';
  return `{ type: '${capitalize(tag)}', id: 'LIST' }`;
}

function generateHookName(endpoint: Endpoint): string {
  const operationName = toCamelCase(endpoint.operationId || endpoint.path);
  const isQuery = endpoint.method === 'GET';
  const prefix = isQuery ? 'use' : 'use';
  const suffix = isQuery ? 'Query' : 'Mutation';
  return `${prefix}${capitalize(operationName)}${suffix}`;
}

function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^./, (chr) => chr.toLowerCase());
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function mapType(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    array: 'any[]',
    object: 'Record<string, any>',
  };

  return typeMap[type] || 'any';
}
