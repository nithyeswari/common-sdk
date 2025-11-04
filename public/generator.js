// Browser-compatible SDK generator
// This runs entirely in the browser without any backend

class SDKGenerator {
  constructor() {
    this.parsedAPI = null;
  }

  async parseOpenAPISpec(content, fileName, baseURL) {
    let spec;

    // Parse YAML or JSON
    if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
      spec = jsyaml.load(content);
    } else {
      spec = JSON.parse(content);
    }

    const title = spec.info?.title || 'API';
    const version = spec.info?.version || '1.0.0';
    const operations = this.extractOperations(spec);
    const schemas = this.extractSchemas(spec);

    // Determine base URL
    let apiBaseURL = baseURL;
    if (!apiBaseURL && spec.servers && spec.servers.length > 0) {
      apiBaseURL = spec.servers[0].url;
    }

    return {
      title,
      version,
      baseURL: apiBaseURL,
      operations,
      schemas,
    };
  }

  extractOperations(spec) {
    const operations = [];
    if (!spec.paths) return operations;

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem) continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const operationId = operation.operationId || this.generateOperationId(method, path);

        operations.push({
          operationId,
          method: method.toUpperCase(),
          path,
          summary: operation.summary,
          description: operation.description,
          parameters: this.resolveParameters(operation.parameters, pathItem.parameters),
          requestBody: operation.requestBody,
          responses: operation.responses,
          tags: operation.tags,
        });
      }
    }

    return operations;
  }

  resolveParameters(operationParams, pathParams) {
    const params = [];
    if (pathParams) {
      for (const param of pathParams) {
        if (!param.$ref) params.push(param);
      }
    }
    if (operationParams) {
      for (const param of operationParams) {
        if (!param.$ref) params.push(param);
      }
    }
    return params;
  }

  extractSchemas(spec) {
    const schemas = [];
    if (!spec.components?.schemas) return schemas;

    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      if (!schema.$ref) {
        schemas.push({ name, schema });
      }
    }

    return schemas;
  }

  generateOperationId(method, path) {
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

  async generateSDK(parsedAPI, moduleName) {
    const files = {};

    files['types.ts'] = this.generateTypes(parsedAPI);
    files['client.ts'] = this.generateClient(parsedAPI, moduleName);
    files['actions.ts'] = this.generateActions(parsedAPI, moduleName);
    files['reducers.ts'] = this.generateReducers(parsedAPI, moduleName);
    files['store.ts'] = this.generateStore(parsedAPI, moduleName);
    files['index.ts'] = this.generateIndex();
    files['package.json'] = this.generatePackageJson(parsedAPI, moduleName);
    files['README.md'] = this.generateReadme(moduleName);

    return files;
  }

  generateTypes(api) {
    let content = '// Generated TypeScript types from OpenAPI specification\n\n';

    // Generate types for schemas
    for (const { name, schema } of api.schemas) {
      content += this.generateTypeFromSchema(name, schema);
    }

    // Generate parameter types
    for (const operation of api.operations) {
      const params = operation.parameters || [];
      if (params.length > 0) {
        const typeName = `${this.capitalize(operation.operationId)}Params`;
        content += `export interface ${typeName} {\n`;
        for (const param of params) {
          const optional = !param.required ? '?' : '';
          const paramType = this.getParamType(param);
          if (param.description) {
            content += `  /** ${param.description} */\n`;
          }
          content += `  ${param.name}${optional}: ${paramType};\n`;
        }
        content += '}\n\n';
      }
    }

    return content;
  }

  generateTypeFromSchema(name, schema) {
    if (schema.enum) {
      const enumValues = schema.enum.map((v) => `'${v}'`).join(' | ');
      return `export type ${name} = ${enumValues};\n\n`;
    }

    if (schema.type === 'object' || schema.properties) {
      let typeStr = `export interface ${name} {\n`;
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const optional = !schema.required?.includes(propName) ? '?' : '';
          const propType = this.mapSchemaType(propSchema);
          if (propSchema.description) {
            typeStr += `  /** ${propSchema.description} */\n`;
          }
          typeStr += `  ${propName}${optional}: ${propType};\n`;
        }
      }
      typeStr += '}\n\n';
      return typeStr;
    }

    return `export type ${name} = ${this.mapSchemaType(schema)};\n\n`;
  }

  mapSchemaType(schema) {
    if (!schema) return 'any';
    if (schema.$ref) {
      const parts = schema.$ref.split('/');
      return parts[parts.length - 1];
    }
    if (schema.enum) {
      return schema.enum.map((v) => `'${v}'`).join(' | ');
    }
    if (schema.type === 'array' && schema.items) {
      return `${this.mapSchemaType(schema.items)}[]`;
    }
    if (schema.type === 'object') {
      return 'Record<string, any>';
    }
    switch (schema.type) {
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'string':
        return 'string';
      default:
        return 'any';
    }
  }

  getParamType(param) {
    if (!param.schema) return 'any';
    return this.mapSchemaType(param.schema);
  }

  generateClient(api, moduleName) {
    let content = `import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';\nimport * as Types from './types';\n\n`;

    content += `export interface ClientConfig {\n`;
    content += `  baseURL?: string;\n`;
    content += `  timeout?: number;\n`;
    content += `  headers?: Record<string, string>;\n`;
    content += `}\n\n`;

    content += `export class ${this.capitalize(moduleName)}Client {\n`;
    content += `  private client: AxiosInstance;\n\n`;
    content += `  constructor(config: ClientConfig = {}) {\n`;
    content += `    this.client = axios.create({\n`;
    content += `      baseURL: config.baseURL || '${api.baseURL || ''}',\n`;
    content += `      timeout: config.timeout || 30000,\n`;
    content += `      headers: { 'Content-Type': 'application/json', ...config.headers },\n`;
    content += `    });\n`;
    content += `  }\n\n`;
    content += `  setAuthToken(token: string): void {\n`;
    content += `    this.client.defaults.headers.common['Authorization'] = \`Bearer \${token}\`;\n`;
    content += `  }\n\n`;

    for (const operation of api.operations) {
      content += this.generateClientMethod(operation);
    }

    content += `}\n\n`;
    content += `export const ${moduleName}Client = new ${this.capitalize(moduleName)}Client();\n`;

    return content;
  }

  generateClientMethod(operation) {
    const pathParams = operation.parameters?.filter((p) => p.in === 'path') || [];
    const queryParams = operation.parameters?.filter((p) => p.in === 'query') || [];
    const hasBody = operation.requestBody !== undefined;

    let method = '';
    if (operation.summary) {
      method += `  /** ${operation.summary} */\n`;
    }

    const params = [];
    if (pathParams.length > 0) {
      params.push(`pathParams: { ${pathParams.map(p => `${p.name}: ${this.getParamType(p)}`).join(', ')} }`);
    }
    if (queryParams.length > 0) {
      params.push(`queryParams?: { ${queryParams.map(p => `${p.name}?: ${this.getParamType(p)}`).join(', ')} }`);
    }
    if (hasBody) {
      params.push(`data: any`);
    }
    params.push('config?: AxiosRequestConfig');

    method += `  async ${operation.operationId}(${params.join(', ')}): Promise<AxiosResponse<any>> {\n`;

    let url = operation.path;
    if (pathParams.length > 0) {
      for (const param of pathParams) {
        url = url.replace(`{${param.name}}`, `\${pathParams.${param.name}}`);
      }
      method += `    const url = \`${url}\`;\n`;
    } else {
      method += `    const url = '${url}';\n`;
    }

    method += `    const requestConfig: AxiosRequestConfig = { ...config`;
    if (queryParams.length > 0) {
      method += `, params: queryParams`;
    }
    method += ` };\n`;

    const httpMethod = operation.method.toLowerCase();
    if (hasBody) {
      method += `    return this.client.${httpMethod}(url, data, requestConfig);\n`;
    } else {
      method += `    return this.client.${httpMethod}(url, requestConfig);\n`;
    }

    method += `  }\n\n`;
    return method;
  }

  generateActions(api, moduleName) {
    let content = `import { createAsyncThunk } from '@reduxjs/toolkit';\nimport { ${this.capitalize(moduleName)}Client } from './client';\nimport * as Types from './types';\n\n`;

    for (const operation of api.operations) {
      content += this.generateAsyncThunk(operation, moduleName);
    }

    return content;
  }

  generateAsyncThunk(operation, moduleName) {
    const pathParams = operation.parameters?.filter((p) => p.in === 'path') || [];
    const queryParams = operation.parameters?.filter((p) => p.in === 'query') || [];
    const hasBody = operation.requestBody !== undefined;

    const paramFields = [];
    pathParams.forEach(p => paramFields.push(`${p.name}: ${this.getParamType(p)}`));
    queryParams.forEach(p => paramFields.push(`${p.name}?: ${this.getParamType(p)}`));
    if (hasBody) paramFields.push(`data: any`);

    const paramType = paramFields.length > 0 ? `{ ${paramFields.join('; ')} }` : 'void';

    let thunk = '';
    if (operation.summary) {
      thunk += `/** ${operation.summary} */\n`;
    }

    thunk += `export const ${operation.operationId} = createAsyncThunk<any, ${paramType}>(\n`;
    thunk += `  '${moduleName}/${operation.operationId}',\n`;
    thunk += `  async (params${paramFields.length === 0 ? '?' : ''}) => {\n`;

    const callParams = [];
    if (pathParams.length > 0) {
      callParams.push(`{ ${pathParams.map(p => `${p.name}: params.${p.name}`).join(', ')} }`);
    }
    if (queryParams.length > 0) {
      callParams.push(`{ ${queryParams.map(p => `${p.name}: params.${p.name}`).join(', ')} }`);
    }
    if (hasBody) callParams.push('params.data');

    thunk += `    const response = await ${moduleName}Client.${operation.operationId}(${callParams.join(', ')});\n`;
    thunk += `    return response.data;\n`;
    thunk += `  }\n`;
    thunk += `);\n\n`;

    return thunk;
  }

  generateReducers(api, moduleName) {
    let content = `import { createSlice } from '@reduxjs/toolkit';\nimport * as Actions from './actions';\n\n`;

    content += `export interface ${this.capitalize(moduleName)}State {\n`;
    for (const operation of api.operations) {
      content += `  ${operation.operationId}: { data: any | null; loading: boolean; error: string | null };\n`;
    }
    content += `}\n\n`;

    content += `const initialState: ${this.capitalize(moduleName)}State = {\n`;
    for (const operation of api.operations) {
      content += `  ${operation.operationId}: { data: null, loading: false, error: null },\n`;
    }
    content += `};\n\n`;

    content += `const ${moduleName}Slice = createSlice({\n`;
    content += `  name: '${moduleName}',\n`;
    content += `  initialState,\n`;
    content += `  reducers: {\n`;
    content += `    reset: () => initialState,\n`;
    content += `  },\n`;
    content += `  extraReducers: (builder) => {\n`;

    for (const operation of api.operations) {
      content += `    builder.addCase(Actions.${operation.operationId}.pending, (state) => {\n`;
      content += `      state.${operation.operationId}.loading = true;\n`;
      content += `      state.${operation.operationId}.error = null;\n`;
      content += `    });\n`;
      content += `    builder.addCase(Actions.${operation.operationId}.fulfilled, (state, action) => {\n`;
      content += `      state.${operation.operationId}.loading = false;\n`;
      content += `      state.${operation.operationId}.data = action.payload;\n`;
      content += `    });\n`;
      content += `    builder.addCase(Actions.${operation.operationId}.rejected, (state, action) => {\n`;
      content += `      state.${operation.operationId}.loading = false;\n`;
      content += `      state.${operation.operationId}.error = action.error.message || 'Error';\n`;
      content += `    });\n`;
    }

    content += `  },\n`;
    content += `});\n\n`;
    content += `export const { reset } = ${moduleName}Slice.actions;\n`;
    content += `export const ${moduleName}Reducer = ${moduleName}Slice.reducer;\n\n`;

    // Generate selectors
    for (const operation of api.operations) {
      const cap = this.capitalize(operation.operationId);
      content += `export const select${cap}Data = (state: { ${moduleName}: ${this.capitalize(moduleName)}State }) => state.${moduleName}.${operation.operationId}.data;\n`;
      content += `export const select${cap}Loading = (state: { ${moduleName}: ${this.capitalize(moduleName)}State }) => state.${moduleName}.${operation.operationId}.loading;\n`;
      content += `export const select${cap}Error = (state: { ${moduleName}: ${this.capitalize(moduleName)}State }) => state.${moduleName}.${operation.operationId}.error;\n\n`;
    }

    return content;
  }

  generateStore(api, moduleName) {
    return `import { configureStore } from '@reduxjs/toolkit';
import { ${moduleName}Reducer, ${this.capitalize(moduleName)}State } from './reducers';

export function create${this.capitalize(moduleName)}Store(
  preloadedState?: { ${moduleName}?: Partial<${this.capitalize(moduleName)}State> },
  additionalReducers?: Record<string, any>
) {
  return configureStore({
    reducer: { ${moduleName}: ${moduleName}Reducer, ...additionalReducers },
    preloadedState,
  });
}

export type ${this.capitalize(moduleName)}Store = ReturnType<typeof create${this.capitalize(moduleName)}Store>;
export type ${this.capitalize(moduleName)}RootState = ReturnType<${this.capitalize(moduleName)}Store['getState']>;
export type ${this.capitalize(moduleName)}Dispatch = ${this.capitalize(moduleName)}Store['dispatch'];

export { ${moduleName}Reducer } from './reducers';
`;
  }

  generateIndex() {
    return `// Generated by OpenAPI Redux SDK Generator
export * from './types';
export * from './client';
export * from './store';
export * from './actions';
export * from './reducers';
`;
  }

  generatePackageJson(api, moduleName) {
    return JSON.stringify({
      name: `${moduleName}-sdk`,
      version: '1.0.0',
      description: `Generated SDK for ${api.title}`,
      main: 'index.ts',
      peerDependencies: {
        '@reduxjs/toolkit': '^2.0.0',
        redux: '^5.0.0',
        axios: '^1.6.0',
      },
    }, null, 2);
  }

  generateReadme(moduleName) {
    return `# ${moduleName.toUpperCase()} SDK

Generated Redux-based SDK from OpenAPI specification.

## Installation

\`\`\`bash
npm install axios redux @reduxjs/toolkit
\`\`\`

## Usage

See documentation for integration examples.

Generated by OpenAPI Redux SDK Generator
`;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Export for use in app.js
window.SDKGenerator = SDKGenerator;
