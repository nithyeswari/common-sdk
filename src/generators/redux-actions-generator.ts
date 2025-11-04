import { ParsedAPI, ParsedOperation } from '../types';
import { OpenAPIV3 } from 'openapi-types';
import { writeFile } from 'fs-extra';
import path from 'path';

export async function generateReduxActions(
  api: ParsedAPI,
  outputDir: string,
  moduleName: string
): Promise<void> {
  const lines: string[] = [];

  // Imports
  lines.push("import { createAsyncThunk } from '@reduxjs/toolkit';");
  lines.push(`import { ${capitalize(moduleName)}Client } from './client';`);
  lines.push("import * as Types from './types';\n");

  // Generate async thunk for each operation
  for (const operation of api.operations) {
    lines.push(generateAsyncThunk(operation, moduleName));
  }

  const content = lines.join('\n');
  await writeFile(path.join(outputDir, 'actions.ts'), content);
}

function generateAsyncThunk(operation: ParsedOperation, moduleName: string): string {
  const lines: string[] = [];
  const actionName = operation.operationId;
  const thunkName = `${moduleName}/${actionName}`;

  // Determine parameter types
  const pathParams = operation.parameters?.filter((p) => p.in === 'path') || [];
  const queryParams = operation.parameters?.filter((p) => p.in === 'query') || [];
  const hasBody = operation.requestBody !== undefined;

  // Build parameter interface
  const paramFields: string[] = [];

  if (pathParams.length > 0) {
    for (const param of pathParams) {
      paramFields.push(`${param.name}: ${getParamType(param)}`);
    }
  }

  if (queryParams.length > 0) {
    for (const param of queryParams) {
      const optional = !param.required ? '?' : '';
      paramFields.push(`${param.name}${optional}: ${getParamType(param)}`);
    }
  }

  if (hasBody) {
    const bodyType = getRequestBodyType(operation);
    paramFields.push(`data: ${bodyType}`);
  }

  const responseType = getResponseType(operation);
  const paramType = paramFields.length > 0 ? `{ ${paramFields.join('; ')} }` : 'void';

  // Add documentation
  if (operation.summary) {
    lines.push(`/** ${operation.summary} */`);
  }
  if (operation.description) {
    lines.push(`/** ${operation.description} */`);
  }

  // Create async thunk
  lines.push(`export const ${actionName} = createAsyncThunk<`);
  lines.push(`  ${responseType},`);
  lines.push(`  ${paramType}`);
  lines.push(`>(`);
  lines.push(`  '${thunkName}',`);
  lines.push(`  async (params${paramFields.length === 0 ? '?' : ''}) => {`);

  // Build client method call
  const clientCallParams: string[] = [];

  if (pathParams.length > 0) {
    const pathParamObj = pathParams.map(p => `${p.name}: params.${p.name}`).join(', ');
    clientCallParams.push(`{ ${pathParamObj} }`);
  }

  if (queryParams.length > 0) {
    const queryParamObj = queryParams
      .map(p => `${p.name}: params.${p.name}`)
      .join(', ');
    clientCallParams.push(`{ ${queryParamObj} }`);
  }

  if (hasBody) {
    clientCallParams.push('params.data');
  }

  const clientCall = `${moduleName}Client.${actionName}(${clientCallParams.join(', ')})`;

  lines.push(`    const response = await ${clientCall};`);
  lines.push('    return response.data;');
  lines.push('  }');
  lines.push(');\n');

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
