import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';
import { ParsedAPI, ParsedOperation, ParsedSchema, Endpoint, Parameter } from '../types';

export async function parseOpenAPISpec(
  specPath: string,
  baseURL?: string
): Promise<ParsedAPI> {
  const api = (await SwaggerParser.validate(specPath)) as OpenAPIV3.Document;

  const title = api.info.title;
  const version = api.info.version;
  const operations = extractOperations(api);
  const schemas = extractSchemas(api);

  // Convert operations to endpoints for modern generators
  const endpoints = convertOperationsToEndpoints(operations);

  // Determine base URL
  let apiBaseURL = baseURL;
  if (!apiBaseURL && api.servers && api.servers.length > 0) {
    apiBaseURL = api.servers[0].url;
  }

  return {
    title,
    version,
    baseURL: apiBaseURL,
    operations,
    endpoints,
    schemas,
  };
}

function extractOperations(api: OpenAPIV3.Document): ParsedOperation[] {
  const operations: ParsedOperation[] = [];

  if (!api.paths) {
    return operations;
  }

  for (const [path, pathItem] of Object.entries(api.paths)) {
    if (!pathItem) continue;

    const methods: string[] = [
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'options',
      'head',
    ];

    for (const method of methods) {
      const operation = (pathItem as any)[method] as OpenAPIV3.OperationObject;
      if (!operation) continue;

      const operationId =
        operation.operationId || generateOperationId(method, path);

      operations.push({
        operationId,
        method: method.toUpperCase(),
        path,
        summary: operation.summary,
        description: operation.description,
        parameters: resolveParameters(operation.parameters, (pathItem as any).parameters),
        requestBody: operation.requestBody as OpenAPIV3.RequestBodyObject,
        responses: operation.responses,
        tags: operation.tags,
      });
    }
  }

  return operations;
}

function resolveParameters(
  operationParams?: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[],
  pathParams?: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[]
): OpenAPIV3.ParameterObject[] {
  const params: OpenAPIV3.ParameterObject[] = [];

  if (pathParams) {
    for (const param of pathParams) {
      if (!('$ref' in param)) {
        params.push(param);
      }
    }
  }

  if (operationParams) {
    for (const param of operationParams) {
      if (!('$ref' in param)) {
        params.push(param);
      }
    }
  }

  return params;
}

function extractSchemas(api: OpenAPIV3.Document): ParsedSchema[] {
  const schemas: ParsedSchema[] = [];

  if (!api.components?.schemas) {
    return schemas;
  }

  for (const [name, schema] of Object.entries(api.components.schemas)) {
    if (schema && !('$ref' in schema)) {
      schemas.push({
        name,
        schema: schema as OpenAPIV3.SchemaObject,
      });
    }
  }

  return schemas;
}

function generateOperationId(method: string, path: string): string {
  // Convert /users/{id}/posts -> getUsersIdPosts
  const cleanPath = path
    .replace(/\{|\}/g, '')
    .split('/')
    .filter(Boolean)
    .map((segment, index) =>
      index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)
    )
    .join('');

  return `${method}${cleanPath.charAt(0).toUpperCase()}${cleanPath.slice(1)}`;
}

function convertOperationsToEndpoints(operations: ParsedOperation[]): Endpoint[] {
  return operations.map(op => {
    const parameters: Parameter[] = (op.parameters || []).map(param => ({
      name: param.name,
      in: param.in as 'path' | 'query' | 'header' | 'cookie',
      required: param.required || false,
      type: getParameterType(param.schema),
      description: param.description,
    }));

    return {
      operationId: op.operationId,
      method: op.method,
      path: op.path,
      summary: op.summary,
      description: op.description,
      parameters,
      requestBody: op.requestBody,
      response: op.responses,
      tags: op.tags,
    };
  });
}

function getParameterType(schema: any): string {
  if (!schema) return 'string';
  if (typeof schema === 'object' && schema.type) {
    return schema.type;
  }
  return 'string';
}
