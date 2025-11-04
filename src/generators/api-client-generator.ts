import { ParsedAPI, ParsedOperation } from '../types';
import { OpenAPIV3 } from 'openapi-types';
import { writeFile } from 'fs-extra';
import path from 'path';

export async function generateAPIClient(
  api: ParsedAPI,
  outputDir: string,
  moduleName: string
): Promise<void> {
  const lines: string[] = [];

  // Imports
  lines.push("import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';");
  lines.push("import * as Types from './types';\n");

  // Client configuration interface
  lines.push('export interface ClientConfig {');
  lines.push('  baseURL?: string;');
  lines.push('  timeout?: number;');
  lines.push('  headers?: Record<string, string>;');
  lines.push('}\n');

  // API Client class
  lines.push(`export class ${capitalize(moduleName)}Client {`);
  lines.push('  private client: AxiosInstance;\n');

  lines.push('  constructor(config: ClientConfig = {}) {');
  lines.push('    this.client = axios.create({');
  lines.push(`      baseURL: config.baseURL || '${api.baseURL || ''}',`);
  lines.push('      timeout: config.timeout || 30000,');
  lines.push('      headers: {');
  lines.push("        'Content-Type': 'application/json',");
  lines.push('        ...config.headers,');
  lines.push('      },');
  lines.push('    });');
  lines.push('  }\n');

  lines.push('  setAuthToken(token: string): void {');
  lines.push("    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;");
  lines.push('  }\n');

  lines.push('  removeAuthToken(): void {');
  lines.push("    delete this.client.defaults.headers.common['Authorization'];");
  lines.push('  }\n');

  // Generate methods for each operation
  for (const operation of api.operations) {
    lines.push(generateClientMethod(operation));
  }

  lines.push('}\n');

  // Export singleton instance
  lines.push(`export const ${moduleName}Client = new ${capitalize(moduleName)}Client();\n`);

  const content = lines.join('\n');
  await writeFile(path.join(outputDir, 'client.ts'), content);
}

function generateClientMethod(operation: ParsedOperation): string {
  const lines: string[] = [];
  const methodName = operation.operationId;
  const hasParams = operation.parameters && operation.parameters.length > 0;
  const hasBody = operation.requestBody !== undefined;

  // Determine parameter types
  const pathParams = operation.parameters?.filter((p) => p.in === 'path') || [];
  const queryParams = operation.parameters?.filter((p) => p.in === 'query') || [];
  const headerParams = operation.parameters?.filter((p) => p.in === 'header') || [];

  // Get response type
  const responseType = getResponseType(operation);
  const requestBodyType = getRequestBodyType(operation);

  // Method signature
  const params: string[] = [];

  if (pathParams.length > 0) {
    params.push(`pathParams: { ${pathParams.map(p => `${p.name}: ${getParamType(p)}`).join(', ')} }`);
  }

  if (queryParams.length > 0) {
    params.push(`queryParams?: { ${queryParams.map(p => `${p.name}?: ${getParamType(p)}`).join(', ')} }`);
  }

  if (hasBody) {
    params.push(`data: ${requestBodyType}`);
  }

  if (headerParams.length > 0) {
    params.push(`headers?: { ${headerParams.map(p => `${p.name}?: ${getParamType(p)}`).join(', ')} }`);
  }

  params.push('config?: AxiosRequestConfig');

  if (operation.summary) {
    lines.push(`  /** ${operation.summary} */`);
  }

  lines.push(`  async ${methodName}(`);
  lines.push(`    ${params.join(',\n    ')}`);
  lines.push(`  ): Promise<AxiosResponse<${responseType}>> {`);

  // Build URL
  let urlTemplate = operation.path;
  if (pathParams.length > 0) {
    for (const param of pathParams) {
      urlTemplate = urlTemplate.replace(`{${param.name}}`, `\${pathParams.${param.name}}`);
    }
    lines.push(`    const url = \`${urlTemplate}\`;`);
  } else {
    lines.push(`    const url = '${urlTemplate}';`);
  }

  // Build request config
  lines.push('    const requestConfig: AxiosRequestConfig = {');
  lines.push('      ...config,');

  if (queryParams.length > 0) {
    lines.push('      params: queryParams,');
  }

  if (headerParams.length > 0) {
    lines.push('      headers: { ...config?.headers, ...headers },');
  }

  lines.push('    };\n');

  // Make request
  const method = operation.method.toLowerCase();
  if (hasBody) {
    lines.push(`    return this.client.${method}(url, data, requestConfig);`);
  } else {
    lines.push(`    return this.client.${method}(url, requestConfig);`);
  }

  lines.push('  }\n');

  return lines.join('\n');
}

function getParamType(param: OpenAPIV3.ParameterObject): string {
  if (!param.schema) return 'any';

  const schema = param.schema as OpenAPIV3.SchemaObject;

  switch (schema.type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'any[]';
    case 'object':
      return 'Record<string, any>';
    case 'string':
    default:
      return 'string';
  }
}

function getResponseType(operation: ParsedOperation): string {
  const responses = operation.responses;

  // Look for successful response (200, 201, etc.)
  for (const [code, response] of Object.entries(responses)) {
    if (code.startsWith('2')) {
      if (!response || '$ref' in response) {
        return 'any';
      }

      const responseObj = response as OpenAPIV3.ResponseObject;
      const content = responseObj.content;

      if (content && content['application/json']) {
        const schema = content['application/json'].schema;
        if (schema && '$ref' in schema) {
          return extractRefType(schema.$ref);
        }
        if (schema) {
          return mapSchemaToType(schema as OpenAPIV3.SchemaObject);
        }
      }

      return 'any';
    }
  }

  return 'any';
}

function getRequestBodyType(operation: ParsedOperation): string {
  if (!operation.requestBody) return 'any';

  const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
  const content = requestBody.content;

  if (content && content['application/json']) {
    const schema = content['application/json'].schema;
    if (schema && '$ref' in schema) {
      return extractRefType(schema.$ref);
    }
    if (schema) {
      return mapSchemaToType(schema as OpenAPIV3.SchemaObject);
    }
  }

  return 'any';
}

function mapSchemaToType(schema: OpenAPIV3.SchemaObject): string {
  if (schema.type === 'array' && schema.items) {
    if ('$ref' in schema.items) {
      return `${extractRefType(schema.items.$ref)}[]`;
    }
    return 'any[]';
  }

  switch (schema.type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

function extractRefType(ref: string): string {
  const parts = ref.split('/');
  return `Types.${parts[parts.length - 1]}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
