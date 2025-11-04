import { OpenAPIV3 } from 'openapi-types';

export interface GeneratorOptions {
  inputSpec: string;
  outputDir: string;
  moduleName?: string;
  baseURL?: string;
  modernOnly?: boolean;  // Skip legacy async thunks
  legacyOnly?: boolean;  // Skip modern RTK Query
}

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  type: string;
  description?: string;
}

export interface Endpoint {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  parameters: Parameter[];
  requestBody?: any;
  response?: any;
  tags?: string[];
}

export interface ParsedOperation {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIV3.ParameterObject[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  responses: OpenAPIV3.ResponsesObject;
  tags?: string[];
}

export interface ParsedSchema {
  name: string;
  schema: OpenAPIV3.SchemaObject;
}

export interface ParsedAPI {
  title: string;
  version: string;
  baseURL?: string;
  operations: ParsedOperation[];
  endpoints: Endpoint[];
  schemas: ParsedSchema[];
}
