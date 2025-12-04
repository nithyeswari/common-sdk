// Browser-compatible SDK generator
// This runs entirely in the browser without any backend

class SDKGenerator {
  constructor() {
    this.parsedAPI = null;
  }

  /**
   * Bundle multiple OpenAPI specs by resolving external $ref references
   * @param {string} mainContent - Content of the main spec file
   * @param {string} mainFileName - Name of the main spec file
   * @param {object} fileContents - Map of filename to {content, filename}
   * @returns {string} - Bundled spec content as string
   */
  async bundleSpecs(mainContent, mainFileName, fileContents) {
    // Parse main spec
    let mainSpec;
    if (mainFileName.endsWith('.yaml') || mainFileName.endsWith('.yml')) {
      mainSpec = jsyaml.load(mainContent);
    } else {
      mainSpec = JSON.parse(mainContent);
    }

    // Parse all referenced files
    const parsedFiles = {};
    for (const [filename, fileData] of Object.entries(fileContents)) {
      try {
        if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
          parsedFiles[filename] = jsyaml.load(fileData.content);
        } else {
          parsedFiles[filename] = JSON.parse(fileData.content);
        }
      } catch (error) {
        console.warn(`Failed to parse ${filename}:`, error);
      }
    }

    // Resolve all $ref references
    const resolveRef = (obj, currentFile) => {
      if (!obj || typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map(item => resolveRef(item, currentFile));
      }

      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && typeof value === 'string') {
          // Handle external file references
          if (value.startsWith('./') || value.startsWith('../')) {
            const [refFile, refPath] = value.split('#');
            const cleanRefFile = refFile.replace('./', '');

            if (parsedFiles[cleanRefFile]) {
              // Navigate to the referenced path in the external file
              const refValue = this.navigateJsonPath(parsedFiles[cleanRefFile], refPath);
              if (refValue) {
                // Inline the referenced content and resolve nested refs
                return resolveRef(refValue, cleanRefFile);
              }
            }
            console.warn(`Could not resolve external reference: ${value}`);
            return obj; // Return original if cannot resolve
          }
          // Handle internal references (#/components/...)
          else if (value.startsWith('#/')) {
            const refValue = this.navigateJsonPath(mainSpec, value.substring(1));
            if (refValue) {
              return resolveRef(refValue, currentFile);
            }
          }
        }
        result[key] = resolveRef(value, currentFile);
      }
      return result;
    };

    // Resolve all references in the main spec
    const bundledSpec = resolveRef(mainSpec, mainFileName);

    // Convert back to string
    if (mainFileName.endsWith('.yaml') || mainFileName.endsWith('.yml')) {
      return jsyaml.dump(bundledSpec);
    } else {
      return JSON.stringify(bundledSpec, null, 2);
    }
  }

  /**
   * Navigate a JSON path like /components/schemas/User
   */
  navigateJsonPath(obj, path) {
    if (!path || path === '/') return obj;

    const parts = path.split('/').filter(p => p);
    let current = obj;

    for (const part of parts) {
      if (!current || typeof current !== 'object') return null;
      current = current[part];
    }

    return current;
  }

  /**
   * Aggregate multiple OpenAPI specs into a single unified spec
   * @param {Array} parsedAPIs - Array of parsed API objects
   * @param {Object} options - Aggregation options
   * @returns {Object} - Aggregated OpenAPI spec
   */
  async aggregateSpecs(parsedAPIs, options = {}) {
    const {
      name = 'unified-api',
      enableCO2Tracking = false,
      consolidationRules = []  // Array of 2-to-1 consolidation rules
    } = options;

    if (!parsedAPIs || parsedAPIs.length === 0) {
      throw new Error('No specs to aggregate');
    }

    // Start with base spec structure
    const aggregated = {
      openapi: '3.0.0',
      info: {
        title: `${name} - Aggregated API`,
        version: '1.0.0',
        description: `Unified API spec aggregated from ${parsedAPIs.length} source specifications`,
        'x-aggregated-from': parsedAPIs.map(api => ({
          title: api.title,
          version: api.version
        }))
      },
      servers: [],
      paths: {},
      components: {
        schemas: {},
        parameters: {},
        responses: {},
        securitySchemes: {}
      }
    };

    // Collect all unique servers
    const serverUrls = new Set();
    parsedAPIs.forEach(api => {
      if (api.baseURL) {
        serverUrls.add(api.baseURL);
      }
    });
    aggregated.servers = Array.from(serverUrls).map(url => ({ url }));

    // Aggregate operations (paths)
    const pathsMap = new Map();
    parsedAPIs.forEach((api, apiIndex) => {
      api.operations.forEach(op => {
        const key = `${op.method}:${op.path}`;
        if (pathsMap.has(key)) {
          // Merge with existing operation
          const existing = pathsMap.get(key);
          pathsMap.set(key, this.mergeOperations(existing, op, api.title));
        } else {
          // Add new operation
          pathsMap.set(key, { ...op, sourceAPI: api.title });
        }
      });
    });

    // Build paths object from merged operations
    pathsMap.forEach((op, key) => {
      if (!aggregated.paths[op.path]) {
        aggregated.paths[op.path] = {};
      }

      const pathItem = {
        summary: op.summary,
        description: op.description,
        parameters: op.parameters || []
      };

      if (op.requestBody) {
        pathItem.requestBody = op.requestBody;
      }

      pathItem.responses = op.responses || {
        '200': { description: 'Successful response' }
      };

      // Add CO2 tracking extension if enabled
      if (enableCO2Tracking) {
        pathItem['x-co2-impact'] = {
          estimatedGramsPerRequest: this.estimateCO2Impact(op),
          trackingEnabled: true,
          monitoringMetric: `co2.${op.operationId || op.path.replace(/\//g, '.')}`
        };
      }

      aggregated.paths[op.path][op.method.toLowerCase()] = pathItem;
    });

    // Aggregate schemas with smart merging
    const schemaMap = new Map();
    parsedAPIs.forEach((api, apiIndex) => {
      if (!api.schemas) return;

      // Handle both array and object formats for schemas
      const schemasArray = Array.isArray(api.schemas)
        ? api.schemas
        : Object.entries(api.schemas).map(([name, schema]) => ({ name, schema }));

      schemasArray.forEach(({ name, schema }) => {
        if (schemaMap.has(name)) {
          // Check compatibility and merge
          const existing = schemaMap.get(name);
          const merged = this.smartMergeSchemas(existing, schema, name, api.title);
          schemaMap.set(merged.name, merged.schema);
        } else {
          schemaMap.set(name, schema);
        }
      });
    });

    // Build components schemas
    schemaMap.forEach((schema, name) => {
      aggregated.components.schemas[name] = schema;
    });

    // Collect all unique headers (union)
    const headerParams = new Set();
    parsedAPIs.forEach(api => {
      api.operations.forEach(op => {
        const headers = op.parameters?.filter(p => p.in === 'header') || [];
        headers.forEach(h => {
          headerParams.add(JSON.stringify(h));
        });
      });
    });

    // Add unique headers as reusable parameters
    Array.from(headerParams).forEach((headerStr, index) => {
      const header = JSON.parse(headerStr);
      const paramName = header.name.replace(/[^a-zA-Z0-9]/g, '');
      aggregated.components.parameters[paramName] = header;
    });

    // Apply 2-to-1 consolidation rules
    if (consolidationRules && consolidationRules.length > 0) {
      this.applyConsolidationRules(aggregated, parsedAPIs, consolidationRules, enableCO2Tracking);
    }

    return aggregated;
  }

  /**
   * Apply 2-to-1 consolidation rules to create merged endpoints
   * This merges 2 different endpoints into 1 consolidated endpoint with all headers and payload info
   */
  applyConsolidationRules(aggregatedSpec, parsedAPIs, consolidationRules, enableCO2Tracking) {
    console.log('Applying consolidation rules:', consolidationRules.length);

    consolidationRules.forEach(rule => {
      console.log('Processing rule:', rule.id, 'type:', rule.type);

      if (rule.type !== '2-to-1-consolidation') {
        console.log('Skipping non-consolidation rule');
        return;
      }

      // Get source endpoints from the rule - use the stored operation data
      const endpoint1 = this.getEndpointFromRule(parsedAPIs, rule.endpoint1);
      const endpoint2 = this.getEndpointFromRule(parsedAPIs, rule.endpoint2);

      console.log('Endpoint1:', endpoint1?.path, 'Endpoint2:', endpoint2?.path);

      if (!endpoint1 || !endpoint2) {
        console.warn('Could not find source endpoints for consolidation rule:', rule.id);
        return;
      }

      // Create the consolidated endpoint using the user-edited merged data from the rule
      const consolidatedEndpoint = this.createConsolidatedEndpointFromRule(
        endpoint1,
        endpoint2,
        rule,
        enableCO2Tracking
      );

      // Add to the aggregated spec at the user-specified path
      const consolidatedPath = rule.path || '/api/aggregated';
      const consolidatedMethod = (rule.method || 'post').toLowerCase();

      console.log('Adding consolidated endpoint:', consolidatedMethod.toUpperCase(), consolidatedPath);

      if (!aggregatedSpec.paths[consolidatedPath]) {
        aggregatedSpec.paths[consolidatedPath] = {};
      }
      aggregatedSpec.paths[consolidatedPath][consolidatedMethod] = consolidatedEndpoint;

      // Also add consolidated response schema to components
      const responseSchemaName = `${this.toPascalCase(consolidatedPath.replace(/[^a-zA-Z0-9]/g, ''))}Response`;
      if (consolidatedEndpoint.responses?.['200']?.content?.['application/json']?.schema) {
        aggregatedSpec.components.schemas[responseSchemaName] =
          consolidatedEndpoint.responses['200'].content['application/json'].schema;
      }

      // Add request body schema if present
      if (consolidatedEndpoint.requestBody?.content?.['application/json']?.schema) {
        const requestSchemaName = `${this.toPascalCase(consolidatedPath.replace(/[^a-zA-Z0-9]/g, ''))}Request`;
        aggregatedSpec.components.schemas[requestSchemaName] =
          consolidatedEndpoint.requestBody.content['application/json'].schema;
      }
    });
  }

  /**
   * Get endpoint operation from parsed APIs based on rule reference
   */
  getEndpointFromRule(parsedAPIs, endpointRef) {
    if (!endpointRef) return null;

    const { apiIndex, opIndex, operation, api } = endpointRef;

    // First, try to use the stored operation data directly from the rule
    if (operation && operation.method && operation.path) {
      return {
        ...operation,
        sourceAPI: api || 'Unknown',
        operationId: operation.operationId || `${operation.method}_${operation.path.replace(/[^a-zA-Z0-9]/g, '_')}`
      };
    }

    // Fallback: Try to get from parsed APIs by index
    if (apiIndex !== undefined && opIndex !== undefined && parsedAPIs) {
      const apiData = parsedAPIs[apiIndex];
      if (apiData && apiData.operations && apiData.operations[opIndex]) {
        return {
          ...apiData.operations[opIndex],
          sourceAPI: apiData.title || apiData.fileName
        };
      }
    }

    // Fallback: search by method and path in parsedAPIs
    if (operation && parsedAPIs) {
      for (const apiData of parsedAPIs) {
        const found = apiData.operations?.find(op =>
          op.method.toLowerCase() === operation.method.toLowerCase() &&
          op.path === operation.path
        );
        if (found) {
          return { ...found, sourceAPI: apiData.title || apiData.fileName };
        }
      }
    }

    return null;
  }

  /**
   * Create a consolidated endpoint using user-edited merged data from the rule
   * This uses the mergedHeaders, mergedQueryParams, mergedRequestBodyFields, mergedResponseFields from the rule
   */
  createConsolidatedEndpointFromRule(endpoint1, endpoint2, rule, enableCO2Tracking) {
    const { rules: consolidationOptions = {} } = rule;

    // Use user-edited merged data if available, otherwise fall back to auto-merge
    const hasUserEditedData = rule.mergedHeaders || rule.mergedQueryParams || rule.mergedRequestBodyFields;

    if (hasUserEditedData) {
      return this.buildConsolidatedEndpointFromUserData(endpoint1, endpoint2, rule, enableCO2Tracking);
    } else {
      return this.createConsolidatedEndpoint(endpoint1, endpoint2, rule, enableCO2Tracking);
    }
  }

  /**
   * Build consolidated endpoint from user-edited merged data
   */
  buildConsolidatedEndpointFromUserData(endpoint1, endpoint2, rule, enableCO2Tracking) {
    // Build parameters from user-edited data
    const parameters = [];

    // Add headers
    (rule.mergedHeaders || []).forEach(h => {
      if (h.enabled !== false) {
        parameters.push({
          name: h.name,
          in: 'header',
          required: h.required || false,
          description: h.description || `Header from ${h.source || h.sources?.join(', ') || 'consolidated'}`,
          schema: { type: h.type || 'string', default: h.defaultValue || undefined }
        });
      }
    });

    // Add query params
    (rule.mergedQueryParams || []).forEach(p => {
      if (p.enabled !== false) {
        parameters.push({
          name: p.name,
          in: 'query',
          required: p.required || false,
          description: p.description || `Query param from ${p.source || 'consolidated'}`,
          schema: { type: p.type || p.schema?.type || 'string', default: p.defaultValue || undefined }
        });
      }
    });

    // Add path params
    (rule.mergedPathParams || []).forEach(p => {
      if (p.enabled !== false) {
        parameters.push({
          name: p.name,
          in: 'path',
          required: true,
          description: p.description || `Path param from ${p.source || 'consolidated'}`,
          schema: { type: p.type || p.schema?.type || 'string' }
        });
      }
    });

    // Build request body from user-edited fields
    let requestBody = null;
    const requestFields = (rule.mergedRequestBodyFields || []).filter(f => f.enabled !== false);
    if (requestFields.length > 0) {
      const properties = {};
      const required = [];

      requestFields.forEach(f => {
        properties[f.name] = {
          type: f.type || 'string',
          description: f.description || `Field from ${f.source || f.sources?.join(', ') || 'consolidated'}`
        };
        if (f.defaultValue) {
          properties[f.name].default = f.defaultValue;
        }
        if (f.required) {
          required.push(f.name);
        }
      });

      requestBody = {
        description: `Consolidated request body combining data for both endpoints`,
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties,
              required: required.length > 0 ? required : undefined
            }
          }
        }
      };
    }

    // Build response from user-edited fields
    const responseFields = (rule.mergedResponseFields || []).filter(f => f.enabled !== false);
    const responseProperties = {
      success: { type: 'boolean', description: 'Whether the consolidated operation succeeded' },
      timestamp: { type: 'string', format: 'date-time', description: 'Response timestamp' }
    };

    // Add endpoint1 response wrapper
    responseProperties[`${(endpoint1.sourceAPI || 'endpoint1').replace(/[^a-zA-Z0-9]/g, '')}Data`] = {
      type: 'object',
      description: `Response data from ${endpoint1.sourceAPI || 'endpoint 1'} (${endpoint1.method?.toUpperCase()} ${endpoint1.path})`
    };

    // Add endpoint2 response wrapper
    responseProperties[`${(endpoint2.sourceAPI || 'endpoint2').replace(/[^a-zA-Z0-9]/g, '')}Data`] = {
      type: 'object',
      description: `Response data from ${endpoint2.sourceAPI || 'endpoint 2'} (${endpoint2.method?.toUpperCase()} ${endpoint2.path})`
    };

    // Add user-defined response fields
    responseFields.forEach(f => {
      responseProperties[f.name] = {
        type: f.type || 'string',
        description: f.description || `Field from ${f.source || f.sources?.join(', ') || 'consolidated'}`
      };
    });

    const responses = {
      '200': {
        description: 'Successful consolidated response from both endpoints',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: responseProperties
            }
          }
        }
      },
      '400': { description: 'Bad Request - Invalid parameters' },
      '500': { description: 'Internal Server Error - One or more upstream calls failed' }
    };

    // Build the consolidated endpoint
    const consolidated = {
      summary: rule.summary || `Consolidated: ${endpoint1.summary || endpoint1.path} + ${endpoint2.summary || endpoint2.path}`,
      description: this.buildConsolidatedDescription(endpoint1, endpoint2, rule),
      operationId: `consolidated_${(rule.path || '/api/aggregated').replace(/[^a-zA-Z0-9]/g, '_')}`,
      tags: ['consolidated', 'aggregator'],
      parameters: parameters,
      responses: responses,

      // Add consolidation metadata
      'x-consolidation': {
        type: '2-to-1',
        sources: [
          {
            client: endpoint1.sourceAPI,
            endpoint: `${(endpoint1.method || 'GET').toUpperCase()} ${endpoint1.path}`,
            description: endpoint1.summary || ''
          },
          {
            client: endpoint2.sourceAPI,
            endpoint: `${(endpoint2.method || 'GET').toUpperCase()} ${endpoint2.path}`,
            description: endpoint2.summary || ''
          }
        ],
        execution: rule.rules?.parallelCalls ? 'parallel' : 'sequential',
        mergedContent: {
          headersCount: (rule.mergedHeaders || []).filter(h => h.enabled !== false).length,
          queryParamsCount: (rule.mergedQueryParams || []).filter(p => p.enabled !== false).length,
          pathParamsCount: (rule.mergedPathParams || []).filter(p => p.enabled !== false).length,
          requestFieldsCount: requestFields.length,
          responseFieldsCount: responseFields.length
        }
      }
    };

    // Add request body if present
    if (requestBody) {
      consolidated.requestBody = requestBody;
    }

    // Add CO2 tracking if enabled
    if (enableCO2Tracking) {
      consolidated['x-co2-impact'] = {
        enabled: true,
        estimatedGramsPerRequest: 0.25,
        note: 'Consolidated endpoint reduces network overhead'
      };
    }

    return consolidated;
  }

  /**
   * Create a consolidated endpoint from two source endpoints (auto-merge)
   * Merges all headers, parameters, and payload information
   */
  createConsolidatedEndpoint(endpoint1, endpoint2, rule, enableCO2Tracking) {
    const { rules: consolidationOptions = {} } = rule;

    // Merge all parameters (path, query, header) from both endpoints
    const mergedParameters = this.mergeAllParameters(
      endpoint1.parameters || [],
      endpoint2.parameters || [],
      endpoint1.sourceAPI,
      endpoint2.sourceAPI,
      consolidationOptions.addSourceTracking
    );

    // Merge request bodies from both endpoints
    const mergedRequestBody = this.mergeConsolidatedRequestBodies(
      endpoint1.requestBody,
      endpoint2.requestBody,
      endpoint1.sourceAPI,
      endpoint2.sourceAPI,
      consolidationOptions.addSourceTracking
    );

    // Merge response schemas from both endpoints
    const mergedResponse = this.mergeConsolidatedResponses(
      endpoint1.responses,
      endpoint2.responses,
      endpoint1.sourceAPI,
      endpoint2.sourceAPI,
      consolidationOptions.addSourceTracking
    );

    // Build the consolidated endpoint
    const consolidated = {
      summary: rule.summary || `Consolidated: ${endpoint1.summary || endpoint1.path} + ${endpoint2.summary || endpoint2.path}`,
      description: this.buildConsolidatedDescription(endpoint1, endpoint2, rule),
      operationId: rule.operationId || `consolidated_${endpoint1.operationId || ''}_${endpoint2.operationId || ''}`.replace(/[^a-zA-Z0-9_]/g, ''),
      tags: [...new Set([...(endpoint1.tags || []), ...(endpoint2.tags || []), 'consolidated'])],
      parameters: mergedParameters,
      responses: mergedResponse,

      // Add consolidation metadata (x-consolidation)
      'x-consolidation': {
        type: '2-to-1',
        sources: [
          {
            client: endpoint1.sourceAPI,
            endpoint: `${endpoint1.method.toUpperCase()} ${endpoint1.path}`,
            description: endpoint1.summary || endpoint1.description || '',
            operationId: endpoint1.operationId
          },
          {
            client: endpoint2.sourceAPI,
            endpoint: `${endpoint2.method.toUpperCase()} ${endpoint2.path}`,
            description: endpoint2.summary || endpoint2.description || '',
            operationId: endpoint2.operationId
          }
        ],
        rules: {
          execution: consolidationOptions.parallelCalls ? 'parallel' : 'sequential',
          failureStrategy: 'fail-fast',
          timeout: 10000,
          headerPropagation: this.extractPropagatedHeaders(mergedParameters)
        },
        mergedContent: {
          parametersCount: mergedParameters.length,
          headersCount: mergedParameters.filter(p => p.in === 'header').length,
          queryParamsCount: mergedParameters.filter(p => p.in === 'query').length,
          pathParamsCount: mergedParameters.filter(p => p.in === 'path').length,
          hasRequestBody: !!mergedRequestBody,
          responseFieldsCount: this.countResponseFields(mergedResponse)
        }
      }
    };

    // Add request body if either endpoint has one
    if (mergedRequestBody) {
      consolidated.requestBody = mergedRequestBody;
    }

    // Add CO2 tracking if enabled
    if (enableCO2Tracking) {
      const ep1Impact = this.estimateCO2Impact(endpoint1);
      const ep2Impact = this.estimateCO2Impact(endpoint2);
      const consolidatedImpact = (ep1Impact + ep2Impact) * 0.9; // 10% savings from consolidation

      consolidated['x-co2-impact'] = {
        enabled: true,
        estimatedGramsPerRequest: parseFloat(consolidatedImpact.toFixed(3)),
        calculationMethod: 'cloud-carbon-coefficients',
        upstreamEmissions: [
          { client: endpoint1.sourceAPI, endpoint: `${endpoint1.method.toUpperCase()} ${endpoint1.path}`, estimatedGrams: ep1Impact },
          { client: endpoint2.sourceAPI, endpoint: `${endpoint2.method.toUpperCase()} ${endpoint2.path}`, estimatedGrams: ep2Impact }
        ],
        consolidationBenefit: {
          withoutAggregator: parseFloat((ep1Impact + ep2Impact).toFixed(3)),
          withAggregator: parseFloat(consolidatedImpact.toFixed(3)),
          savingsGrams: parseFloat(((ep1Impact + ep2Impact) * 0.1).toFixed(3)),
          savingsPercent: 10
        }
      };
    }

    return consolidated;
  }

  /**
   * Merge all parameters from both endpoints with source tracking
   */
  mergeAllParameters(params1, params2, source1, source2, trackSource) {
    const paramMap = new Map();

    // Add parameters from first endpoint
    params1.forEach(param => {
      const key = `${param.in}:${param.name}`;
      const paramWithSource = trackSource
        ? { ...param, 'x-source': source1 }
        : { ...param };
      paramMap.set(key, paramWithSource);
    });

    // Add/merge parameters from second endpoint
    params2.forEach(param => {
      const key = `${param.in}:${param.name}`;
      if (paramMap.has(key)) {
        // Merge: combine required status, keep most specific schema
        const existing = paramMap.get(key);
        paramMap.set(key, {
          ...existing,
          required: existing.required || param.required,
          description: existing.description || param.description,
          schema: existing.schema || param.schema,
          'x-sources': trackSource ? [source1, source2] : undefined
        });
      } else {
        const paramWithSource = trackSource
          ? { ...param, 'x-source': source2 }
          : { ...param };
        paramMap.set(key, paramWithSource);
      }
    });

    return Array.from(paramMap.values());
  }

  /**
   * Merge request bodies from both endpoints into a consolidated request body
   */
  mergeConsolidatedRequestBodies(body1, body2, source1, source2, trackSource) {
    if (!body1 && !body2) return null;
    if (!body1) return this.wrapRequestBodyWithSource(body2, source2, trackSource);
    if (!body2) return this.wrapRequestBodyWithSource(body1, source1, trackSource);

    // Both have request bodies - merge them
    const mergedSchema = {
      type: 'object',
      properties: {},
      required: []
    };

    // Add description
    const description = `Consolidated request combining:\n- ${source1}: ${body1.description || 'Request body'}\n- ${source2}: ${body2.description || 'Request body'}`;

    // Extract and merge properties from both bodies
    const addPropertiesFromBody = (body, source) => {
      const content = body.content?.['application/json'];
      if (!content?.schema) return;

      const schema = content.schema;
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const finalPropName = trackSource && mergedSchema.properties[propName]
            ? `${propName}_${source.replace(/[^a-zA-Z0-9]/g, '')}`
            : propName;

          mergedSchema.properties[finalPropName] = trackSource
            ? { ...propSchema, 'x-source': source }
            : propSchema;
        }
      }
      if (schema.required) {
        mergedSchema.required.push(...schema.required);
      }
    };

    addPropertiesFromBody(body1, source1);
    addPropertiesFromBody(body2, source2);

    // Remove duplicate required fields
    mergedSchema.required = [...new Set(mergedSchema.required)];
    if (mergedSchema.required.length === 0) delete mergedSchema.required;

    return {
      description,
      required: body1.required || body2.required,
      content: {
        'application/json': {
          schema: mergedSchema
        }
      }
    };
  }

  /**
   * Wrap request body with source tracking
   */
  wrapRequestBodyWithSource(body, source, trackSource) {
    if (!trackSource || !body) return body;

    return {
      ...body,
      description: `${body.description || 'Request body'} (from ${source})`
    };
  }

  /**
   * Merge responses from both endpoints into a consolidated response
   */
  mergeConsolidatedResponses(responses1, responses2, source1, source2, trackSource) {
    const merged = {
      '200': {
        description: 'Consolidated response from both source endpoints',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                consolidatedResult: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', description: 'Whether the consolidated operation succeeded' },
                    upstreamCalls: { type: 'integer', description: 'Number of upstream API calls made' },
                    duration: { type: 'integer', description: 'Total duration in milliseconds' }
                  }
                }
              }
            }
          }
        }
      }
    };

    // Add response data from first endpoint
    if (responses1?.['200']?.content?.['application/json']?.schema) {
      const schema1 = responses1['200'].content['application/json'].schema;
      const fieldName1 = trackSource
        ? `${source1.replace(/[^a-zA-Z0-9]/g, '')}Response`
        : 'endpoint1Response';

      merged['200'].content['application/json'].schema.properties[fieldName1] = {
        ...schema1,
        description: `Response from ${source1}`
      };
    }

    // Add response data from second endpoint
    if (responses2?.['200']?.content?.['application/json']?.schema) {
      const schema2 = responses2['200'].content['application/json'].schema;
      const fieldName2 = trackSource
        ? `${source2.replace(/[^a-zA-Z0-9]/g, '')}Response`
        : 'endpoint2Response';

      merged['200'].content['application/json'].schema.properties[fieldName2] = {
        ...schema2,
        description: `Response from ${source2}`
      };
    }

    // Add error responses
    merged['400'] = { description: 'Bad Request - Invalid parameters' };
    merged['500'] = { description: 'Internal Server Error - One or more upstream calls failed' };

    return merged;
  }

  /**
   * Build consolidated endpoint description
   */
  buildConsolidatedDescription(endpoint1, endpoint2, rule) {
    const execType = rule.rules?.parallelCalls ? 'parallel' : 'sequentially';

    return `**Consolidated Endpoint**

This endpoint consolidates two separate API calls into one:
1. \`${endpoint1.method.toUpperCase()} ${endpoint1.path}\` (${endpoint1.sourceAPI})
   ${endpoint1.summary || endpoint1.description || 'No description'}

2. \`${endpoint2.method.toUpperCase()} ${endpoint2.path}\` (${endpoint2.sourceAPI})
   ${endpoint2.summary || endpoint2.description || 'No description'}

Both calls are made ${execType} and results are merged into a single response.

**Merged Parameters:** All path, query, and header parameters from both endpoints are combined.
**Merged Request Body:** Request bodies from both endpoints are merged into a single request object.
**Merged Response:** Responses from both endpoints are combined with metadata about the consolidated operation.`;
  }

  /**
   * Extract header names for propagation
   */
  extractPropagatedHeaders(parameters) {
    return parameters
      .filter(p => p.in === 'header')
      .map(p => p.name);
  }

  /**
   * Count response fields for metadata
   */
  countResponseFields(responses) {
    const schema = responses?.['200']?.content?.['application/json']?.schema;
    if (!schema?.properties) return 0;
    return Object.keys(schema.properties).length;
  }

  /**
   * Convert string to PascalCase
   */
  toPascalCase(str) {
    return str
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Merge two operations with the same path and method
   */
  mergeOperations(op1, op2, sourceAPI) {
    return {
      ...op1,
      summary: op1.summary || op2.summary,
      description: `${op1.description || ''}\n\nMerged from: ${sourceAPI}\n${op2.description || ''}`.trim(),
      parameters: this.mergeParameters(op1.parameters, op2.parameters),
      requestBody: this.mergeRequestBodies(op1.requestBody, op2.requestBody),
      responses: { ...op1.responses, ...op2.responses },
      tags: [...new Set([...(op1.tags || []), ...(op2.tags || [])])],
      'x-merged-from': [...(op1['x-merged-from'] || [op1.sourceAPI]), sourceAPI]
    };
  }

  /**
   * Merge parameters from two operations
   */
  mergeParameters(params1 = [], params2 = []) {
    const paramMap = new Map();

    [...params1, ...params2].forEach(param => {
      const key = `${param.in}:${param.name}`;
      if (!paramMap.has(key)) {
        paramMap.set(key, param);
      } else {
        // Merge parameter properties
        const existing = paramMap.get(key);
        paramMap.set(key, {
          ...existing,
          required: existing.required || param.required,
          description: existing.description || param.description,
          schema: existing.schema || param.schema
        });
      }
    });

    return Array.from(paramMap.values());
  }

  /**
   * Merge request bodies
   */
  mergeRequestBodies(body1, body2) {
    if (!body1) return body2;
    if (!body2) return body1;

    return {
      description: body1.description || body2.description,
      required: body1.required || body2.required,
      content: {
        ...body1.content,
        ...body2.content
      }
    };
  }

  /**
   * Smart merge of schemas - checks compatibility
   */
  smartMergeSchemas(schema1, schema2, name, sourceAPI) {
    // Check if schemas are compatible (same type)
    if (schema1.type !== schema2.type) {
      // Incompatible - rename the second one
      const newName = `${name}_${sourceAPI.replace(/[^a-zA-Z0-9]/g, '')}`;
      return { name: newName, schema: schema2 };
    }

    // If both are objects, merge properties
    if (schema1.type === 'object' && schema2.type === 'object') {
      const mergedProperties = {
        ...(schema1.properties || {}),
        ...(schema2.properties || {})
      };

      const mergedRequired = [
        ...new Set([
          ...(schema1.required || []),
          ...(schema2.required || [])
        ])
      ];

      return {
        name,
        schema: {
          type: 'object',
          properties: mergedProperties,
          required: mergedRequired.length > 0 ? mergedRequired : undefined,
          description: `${schema1.description || ''}\nMerged from multiple sources`.trim()
        }
      };
    }

    // For other types, keep the first one
    return { name, schema: schema1 };
  }

  /**
   * Estimate CO2 impact of an API endpoint
   */
  estimateCO2Impact(operation) {
    // Simple estimation based on operation characteristics
    let baseImpact = 0.1; // grams per request baseline

    // Adjust based on HTTP method
    switch (operation.method.toUpperCase()) {
      case 'POST':
      case 'PUT':
        baseImpact += 0.2; // Write operations cost more
        break;
      case 'DELETE':
        baseImpact += 0.15;
        break;
      case 'GET':
        baseImpact += 0.05;
        break;
    }

    // Adjust based on number of parameters
    const paramCount = operation.parameters?.length || 0;
    baseImpact += paramCount * 0.01;

    // Adjust if has request body
    if (operation.requestBody) {
      baseImpact += 0.1;
    }

    return parseFloat(baseImpact.toFixed(3));
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
    if (api.schemas) {
      // Handle both array and object formats for schemas
      const schemasArray = Array.isArray(api.schemas)
        ? api.schemas
        : Object.entries(api.schemas).map(([name, schema]) => ({ name, schema }));

      for (const { name, schema } of schemasArray) {
        content += this.generateTypeFromSchema(name, schema);
      }
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
    const headerParams = operation.parameters?.filter((p) => p.in === 'header') || [];
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
    if (headerParams.length > 0) {
      params.push(`headerParams?: { ${headerParams.map(p => `${p.name}?: ${this.getParamType(p)}`).join(', ')} }`);
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
    if (headerParams.length > 0) {
      method += `, headers: { ...config?.headers, ...headerParams }`;
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
    const headerParams = operation.parameters?.filter((p) => p.in === 'header') || [];
    const hasBody = operation.requestBody !== undefined;

    const paramFields = [];
    pathParams.forEach(p => paramFields.push(`${p.name}: ${this.getParamType(p)}`));
    queryParams.forEach(p => paramFields.push(`${p.name}?: ${this.getParamType(p)}`));
    headerParams.forEach(p => paramFields.push(`${p.name}?: ${this.getParamType(p)}`));
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
    if (headerParams.length > 0) {
      callParams.push(`{ ${headerParams.map(p => `${p.name}: params.${p.name}`).join(', ')} }`);
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

  // Java Backend Generators

  async generateSpringBoot(parsedAPI, options) {
    const files = {};
    const { packageName, groupId, artifactId, javaVersion } = options;
    const packagePath = packageName.replace(/\./g, '/');

    files['pom.xml'] = this.generateSpringBootPom(groupId, artifactId, javaVersion);
    files[`src/main/java/${packagePath}/Application.java`] = this.generateSpringBootApp(packageName, artifactId);

    // Generate DTOs
    if (parsedAPI.schemas) {
      const schemasArray = Array.isArray(parsedAPI.schemas)
        ? parsedAPI.schemas
        : Object.entries(parsedAPI.schemas).map(([name, schema]) => ({ name, schema }));

      for (const { name, schema } of schemasArray) {
        files[`src/main/java/${packagePath}/dto/${name}.java`] = this.generateJavaDTO(packageName, name, schema);
      }
    }

    // Generate Controllers
    const controllersByTag = this.groupOperationsByTag(parsedAPI.operations);
    for (const [tag, operations] of Object.entries(controllersByTag)) {
      const controllerName = this.capitalize(tag || 'Api') + 'Controller';
      files[`src/main/java/${packagePath}/controller/${controllerName}.java`] =
        this.generateSpringBootController(packageName, controllerName, operations);
    }

    files['src/main/resources/application.properties'] = this.generateSpringBootProperties();
    files['README.md'] = this.generateSpringBootReadme(artifactId);

    return files;
  }

  async generateQuarkus(parsedAPI, options) {
    const files = {};
    const { packageName, groupId, artifactId, javaVersion } = options;
    const packagePath = packageName.replace(/\./g, '/');

    files['pom.xml'] = this.generateQuarkusPom(groupId, artifactId, javaVersion);

    // Generate DTOs
    if (parsedAPI.schemas) {
      const schemasArray = Array.isArray(parsedAPI.schemas)
        ? parsedAPI.schemas
        : Object.entries(parsedAPI.schemas).map(([name, schema]) => ({ name, schema }));

      for (const { name, schema } of schemasArray) {
        files[`src/main/java/${packagePath}/dto/${name}.java`] = this.generateJavaDTO(packageName, name, schema);
      }
    }

    // Generate Resources (JAX-RS)
    const resourcesByTag = this.groupOperationsByTag(parsedAPI.operations);
    const hasCO2Tracking = parsedAPI.operations.some(op => op['x-co2-impact']);

    for (const [tag, operations] of Object.entries(resourcesByTag)) {
      const resourceName = this.capitalize(tag || 'Api') + 'Resource';
      files[`src/main/java/${packagePath}/resource/${resourceName}.java`] =
        this.generateQuarkusResource(packageName, resourceName, operations);
    }

    // Generate CO2 tracking support if needed
    if (hasCO2Tracking) {
      files[`src/main/java/${packagePath}/monitoring/CO2Tracked.java`] =
        this.generateCO2TrackedAnnotation(packageName);
      files[`src/main/java/${packagePath}/monitoring/CO2TrackingInterceptor.java`] =
        this.generateCO2TrackingInterceptor(packageName);
      files[`src/main/java/${packagePath}/monitoring/CO2MetricsService.java`] =
        this.generateCO2MetricsService(packageName);
    }

    files['src/main/resources/application.properties'] = this.generateQuarkusProperties();
    files['README.md'] = this.generateQuarkusReadme(artifactId);

    return files;
  }

  groupOperationsByTag(operations) {
    const grouped = {};
    for (const operation of operations) {
      const tag = operation.tags?.[0] || 'default';
      if (!grouped[tag]) grouped[tag] = [];
      grouped[tag].push(operation);
    }
    return grouped;
  }

  generateSpringBootPom(groupId, artifactId, javaVersion) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>

    <properties>
        <java.version>${javaVersion}</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>`;
  }

  generateSpringBootApp(packageName, artifactId) {
    const className = this.capitalize(artifactId.replace(/-/g, ''));
    return `package ${packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ${className}Application {
    public static void main(String[] args) {
        SpringApplication.run(${className}Application.class, args);
    }
}`;
  }

  generateJavaDTO(packageName, name, schema) {
    let content = `package ${packageName}.dto;

import java.util.*;

public class ${name} {
`;

    if (schema.properties) {
      // Generate fields
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const javaType = this.mapSchemaToJavaType(propSchema);
        content += `    private ${javaType} ${propName};\n`;
      }

      content += '\n';

      // Generate getters and setters
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const javaType = this.mapSchemaToJavaType(propSchema);
        const capitalizedProp = this.capitalize(propName);
        content += `    public ${javaType} get${capitalizedProp}() {
        return ${propName};
    }

    public void set${capitalizedProp}(${javaType} ${propName}) {
        this.${propName} = ${propName};
    }

`;
      }
    }

    content += `}`;
    return content;
  }

  mapSchemaToJavaType(schema) {
    if (!schema) return 'Object';
    if (schema.$ref) {
      const parts = schema.$ref.split('/');
      return parts[parts.length - 1];
    }
    if (schema.type === 'array' && schema.items) {
      return `List<${this.mapSchemaToJavaType(schema.items)}>`;
    }
    switch (schema.type) {
      case 'integer':
        return schema.format === 'int64' ? 'Long' : 'Integer';
      case 'number':
        return schema.format === 'double' ? 'Double' : 'Float';
      case 'boolean':
        return 'Boolean';
      case 'string':
        return schema.format === 'date-time' ? 'Date' : 'String';
      case 'object':
        return 'Map<String, Object>';
      default:
        return 'Object';
    }
  }

  generateSpringBootController(packageName, controllerName, operations) {
    let content = `package ${packageName}.controller;

import ${packageName}.dto.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ${controllerName} {

`;

    for (const operation of operations) {
      const method = operation.method.toLowerCase();
      const springMethod = method === 'get' ? 'GetMapping' :
                          method === 'post' ? 'PostMapping' :
                          method === 'put' ? 'PutMapping' :
                          method === 'delete' ? 'DeleteMapping' :
                          'RequestMapping';

      const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
      const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
      const headerParams = operation.parameters?.filter(p => p.in === 'header') || [];
      const hasBody = operation.requestBody !== undefined;

      content += `    @${springMethod}("${operation.path}")\n`;
      content += `    public ResponseEntity<Object> ${operation.operationId}(`;

      const params = [];
      for (const param of pathParams) {
        params.push(`@PathVariable ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of queryParams) {
        params.push(`@RequestParam(required=false) ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of headerParams) {
        const required = param.required ? 'true' : 'false';
        params.push(`@RequestHeader(value="${param.name}", required=${required}) ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      if (hasBody) {
        params.push('@RequestBody Object requestBody');
      }

      content += params.join(', ');
      content += `) {
        // TODO: Implement ${operation.operationId}
        return ResponseEntity.ok().build();
    }

`;
    }

    content += `}`;
    return content;
  }

  generateQuarkusPom(groupId, artifactId, javaVersion) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>

    <properties>
        <quarkus.version>3.6.0</quarkus.version>
        <maven.compiler.source>${javaVersion}</maven.compiler.source>
        <maven.compiler.target>${javaVersion}</maven.compiler.target>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>io.quarkus</groupId>
                <artifactId>quarkus-bom</artifactId>
                <version>\${quarkus.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-resteasy-reactive-jackson</artifactId>
        </dependency>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-arc</artifactId>
        </dependency>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
        </dependency>
        <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-core</artifactId>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>io.quarkus</groupId>
                <artifactId>quarkus-maven-plugin</artifactId>
                <version>\${quarkus.version}</version>
            </plugin>
        </plugins>
    </build>
</project>`;
  }

  generateQuarkusResource(packageName, resourceName, operations) {
    // Check if any operation has CO2 tracking
    const hasCO2Tracking = operations.some(op => op['x-co2-impact']);

    let content = `package ${packageName}.resource;

import ${packageName}.dto.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
`;

    if (hasCO2Tracking) {
      content += `import ${packageName}.monitoring.CO2Tracked;\n`;
    }

    content += `
@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ${resourceName} {

`;

    for (const operation of operations) {
      const method = operation.method.toUpperCase();
      const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
      const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
      const headerParams = operation.parameters?.filter(p => p.in === 'header') || [];
      const hasBody = operation.requestBody !== undefined;
      const co2Impact = operation['x-co2-impact'];

      // Add CO2 tracking annotation if present
      if (co2Impact) {
        content += `    @CO2Tracked(\n`;
        content += `        estimatedGrams = ${co2Impact.estimatedGramsPerRequest},\n`;
        content += `        metric = "${co2Impact.monitoringMetric}"\n`;
        content += `    )\n`;
      }

      content += `    @${method}\n`;
      content += `    @Path("${operation.path}")\n`;
      content += `    public Response ${operation.operationId}(`;

      const params = [];
      for (const param of pathParams) {
        params.push(`@PathParam("${param.name}") ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of queryParams) {
        params.push(`@QueryParam("${param.name}") ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of headerParams) {
        params.push(`@HeaderParam("${param.name}") ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      if (hasBody) {
        params.push('Object requestBody');
      }

      content += params.join(', ');
      content += `) {
        // TODO: Implement ${operation.operationId}
        return Response.ok().build();
    }

`;
    }

    content += `}`;
    return content;
  }

  generateCO2TrackedAnnotation(packageName) {
    return `package ${packageName}.monitoring;

import jakarta.interceptor.InterceptorBinding;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation for tracking CO2 emissions of API endpoints.
 * Automatically captures execution metrics and estimates carbon impact.
 */
@InterceptorBinding
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface CO2Tracked {
    /**
     * Estimated CO2 emissions in grams per request
     */
    double estimatedGrams() default 0.1;

    /**
     * Metric name for monitoring systems
     */
    String metric() default "api.co2.default";
}`;
  }

  generateCO2TrackingInterceptor(packageName) {
    return `package ${packageName}.monitoring;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.inject.Inject;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;
import org.jboss.logging.Logger;

/**
 * Interceptor that tracks CO2 emissions for annotated methods.
 * Records execution time and estimated carbon impact to metrics system.
 */
@CO2Tracked
@Interceptor
public class CO2TrackingInterceptor {

    private static final Logger LOG = Logger.getLogger(CO2TrackingInterceptor.class);

    @Inject
    MeterRegistry meterRegistry;

    @Inject
    CO2MetricsService co2MetricsService;

    @AroundInvoke
    public Object trackCO2Impact(InvocationContext context) throws Exception {
        CO2Tracked annotation = context.getMethod().getAnnotation(CO2Tracked.class);
        if (annotation == null) {
            return context.proceed();
        }

        String metricName = annotation.metric();
        double estimatedGrams = annotation.estimatedGrams();

        long startTime = System.nanoTime();
        Timer.Sample sample = Timer.start(meterRegistry);

        try {
            Object result = context.proceed();

            // Record successful request with CO2 impact
            long duration = System.nanoTime() - startTime;
            co2MetricsService.recordApiCall(metricName, estimatedGrams, duration, true);

            sample.stop(meterRegistry.timer("api.duration",
                "operation", metricName,
                "co2_grams", String.valueOf(estimatedGrams)));

            LOG.debugf("API call %s completed - CO2 impact: %.3fg, duration: %dms",
                metricName, estimatedGrams, duration / 1_000_000);

            return result;
        } catch (Exception e) {
            // Record failed request
            long duration = System.nanoTime() - startTime;
            co2MetricsService.recordApiCall(metricName, estimatedGrams, duration, false);
            throw e;
        }
    }
}`;
  }

  generateCO2MetricsService(packageName) {
    return `package ${packageName}.monitoring;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.concurrent.TimeUnit;

/**
 * Service for recording and aggregating CO2 emissions metrics.
 * Provides detailed tracking of carbon impact across API endpoints.
 */
@ApplicationScoped
public class CO2MetricsService {

    private static final Logger LOG = Logger.getLogger(CO2MetricsService.class);

    @Inject
    MeterRegistry meterRegistry;

    /**
     * Record an API call with its CO2 impact
     *
     * @param operation The operation identifier
     * @param co2Grams Estimated CO2 emissions in grams
     * @param durationNanos Execution duration in nanoseconds
     * @param success Whether the call was successful
     */
    public void recordApiCall(String operation, double co2Grams, long durationNanos, boolean success) {
        String status = success ? "success" : "error";

        // Record CO2 emissions
        Counter.builder("api.co2.emissions")
            .description("Total CO2 emissions in grams")
            .tag("operation", operation)
            .tag("status", status)
            .register(meterRegistry)
            .increment(co2Grams);

        // Record request count
        Counter.builder("api.co2.requests")
            .description("Number of requests per operation")
            .tag("operation", operation)
            .tag("status", status)
            .register(meterRegistry)
            .increment();

        // Record duration
        Timer.builder("api.co2.duration")
            .description("API call duration")
            .tag("operation", operation)
            .tag("status", status)
            .register(meterRegistry)
            .record(durationNanos, TimeUnit.NANOSECONDS);

        LOG.infof("Recorded CO2 metrics: operation=%s, co2=%.3fg, duration=%dms, status=%s",
            operation, co2Grams, durationNanos / 1_000_000, status);
    }

    /**
     * Get total CO2 emissions for an operation
     */
    public double getTotalEmissions(String operation) {
        Counter counter = meterRegistry.find("api.co2.emissions")
            .tag("operation", operation)
            .counter();
        return counter != null ? counter.count() : 0.0;
    }

    /**
     * Get total request count for an operation
     */
    public long getTotalRequests(String operation) {
        Counter counter = meterRegistry.find("api.co2.requests")
            .tag("operation", operation)
            .counter();
        return counter != null ? (long) counter.count() : 0L;
    }
}`;
  }

  generateSpringBootProperties() {
    return `server.port=8080
spring.application.name=api-service

# Logging
logging.level.root=INFO`;
  }

  generateQuarkusProperties() {
    return `quarkus.http.port=8080

# Logging
quarkus.log.level=INFO`;
  }

  generateSpringBootReadme(artifactId) {
    return `# ${artifactId}

Spring Boot REST API generated from OpenAPI specification.

## Build

\`\`\`bash
mvn clean package
\`\`\`

## Run

\`\`\`bash
mvn spring-boot:run
\`\`\`

Or run the JAR:

\`\`\`bash
java -jar target/${artifactId}-1.0.0.jar
\`\`\`

## Test

\`\`\`bash
curl http://localhost:8080/api
\`\`\`

Generated by OpenAPI Redux SDK Generator`;
  }

  generateQuarkusReadme(artifactId) {
    return `# ${artifactId}

Quarkus REST API generated from OpenAPI specification.

## Build

\`\`\`bash
mvn clean package
\`\`\`

## Run in Dev Mode

\`\`\`bash
mvn quarkus:dev
\`\`\`

## Run in Production

\`\`\`bash
java -jar target/quarkus-app/quarkus-run.jar
\`\`\`

## Test

\`\`\`bash
curl http://localhost:8080/api
\`\`\`

Generated by OpenAPI Redux SDK Generator`;
  }

  // ============================================
  // CLIENT SDK GENERATORS (for inter-service communication)
  // ============================================

  async generateSpringBootClient(parsedAPI, options) {
    const files = {};
    const { packageName, groupId, artifactId, javaVersion } = options;
    const packagePath = packageName.replace(/\./g, '/');

    files['pom.xml'] = this.generateSpringBootClientPom(groupId, artifactId, javaVersion);

    // Generate DTOs (same as backend)
    for (const { name, schema } of parsedAPI.schemas) {
      files[`src/main/java/${packagePath}/dto/${name}.java`] = this.generateJavaDTO(packageName, name, schema);
    }

    // Generate WebClient-based API client
    files[`src/main/java/${packagePath}/client/ApiClient.java`] =
      this.generateSpringBootWebClient(packageName, parsedAPI);

    // Generate configuration class
    files[`src/main/java/${packagePath}/config/ApiClientConfig.java`] =
      this.generateSpringBootClientConfig(packageName);

    files['src/main/resources/application.properties'] = this.generateSpringBootClientProperties();
    files['README.md'] = this.generateSpringBootClientReadme(artifactId, parsedAPI);

    return files;
  }

  generateSpringBootClientPom(groupId, artifactId, javaVersion) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>

    <properties>
        <java.version>${javaVersion}</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-webflux</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>
</project>`;
  }

  generateSpringBootWebClient(packageName, parsedAPI) {
    let content = `package ${packageName}.client;

import ${packageName}.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

import java.util.Map;

/**
 * API Client for calling the remote service
 * Generated from OpenAPI specification
 */
@Component
public class ApiClient {

    private final WebClient webClient;

    public ApiClient(
            WebClient.Builder webClientBuilder,
            @Value("\${api.base-url}") String baseUrl
    ) {
        this.webClient = webClientBuilder
                .baseUrl(baseUrl)
                .build();
    }

`;

    // Generate methods for each operation
    for (const operation of parsedAPI.operations) {
      const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
      const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
      const headerParams = operation.parameters?.filter(p => p.in === 'header') || [];
      const hasBody = operation.requestBody !== undefined;

      const method = operation.method.toLowerCase();
      const returnType = 'Object'; // TODO: Determine actual return type from responses

      content += `    /**\n`;
      if (operation.summary) {
        content += `     * ${operation.summary}\n`;
      }
      content += `     */\n`;
      content += `    public Mono<${returnType}> ${operation.operationId}(`;

      const params = [];
      for (const param of pathParams) {
        params.push(`${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of queryParams) {
        params.push(`${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of headerParams) {
        params.push(`${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      if (hasBody) {
        params.push('Object requestBody');
      }

      content += params.join(', ');
      content += `) {\n`;

      // Build URI
      let uri = operation.path;
      if (pathParams.length > 0) {
        const uriParams = pathParams.map(p => `${p.name}`).join(', ');
        content += `        String uri = "${uri}";\n`;
        for (const param of pathParams) {
          content += `        uri = uri.replace("{${param.name}}", String.valueOf(${param.name}));\n`;
        }
      } else {
        content += `        String uri = "${uri}";\n`;
      }

      // Build request
      content += `\n        return webClient.${method}()\n`;
      content += `                .uri(uriBuilder -> {\n`;
      content += `                    var builder = uriBuilder.path(uri);\n`;
      if (queryParams.length > 0) {
        for (const param of queryParams) {
          content += `                    if (${param.name} != null) builder.queryParam("${param.name}", ${param.name});\n`;
        }
      }
      content += `                    return builder.build();\n`;
      content += `                })\n`;

      // Add headers
      for (const param of headerParams) {
        content += `                .header("${param.name}", String.valueOf(${param.name}))\n`;
      }

      // Add body if needed
      if (hasBody) {
        content += `                .bodyValue(requestBody)\n`;
      }

      content += `                .retrieve()\n`;
      content += `                .bodyToMono(${returnType}.class);\n`;
      content += `    }\n\n`;
    }

    content += `}\n`;
    return content;
  }

  generateSpringBootClientConfig(packageName) {
    return `package ${packageName}.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class ApiClientConfig {

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }
}`;
  }

  generateSpringBootClientProperties() {
    return `# API endpoint configuration
api.base-url=http://localhost:8080/api

# Timeout settings
spring.webflux.client.connect-timeout=5000
spring.webflux.client.read-timeout=10000`;
  }

  generateSpringBootClientReadme(artifactId, parsedAPI) {
    return `# ${artifactId}

Spring Boot WebClient-based API client library.

## Usage

### 1. Add to your Spring Boot project

Add this as a dependency in your \`pom.xml\`:

\`\`\`xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>
</dependency>
\`\`\`

### 2. Configure the API endpoint

In your \`application.properties\`:

\`\`\`properties
api.base-url=http://api-service:8080/api
\`\`\`

### 3. Inject and use the client

\`\`\`java
@Service
public class MyService {

    private final ApiClient apiClient;

    public MyService(ApiClient apiClient) {
        this.apiClient = apiClient;
    }

    public void doSomething() {
        apiClient.someOperation(params)
                .subscribe(result -> {
                    // Handle result
                });
    }
}
\`\`\`

## Available Operations

${parsedAPI.operations.map(op => `- \`${op.operationId}()\` - ${op.summary || ''}`).join('\n')}

## Configuration

| Property | Description | Default |
|----------|-------------|---------|
| api.base-url | Base URL of the API | http://localhost:8080/api |

Generated by OpenAPI Redux SDK Generator`;
  }

  // Standalone client helper methods
  generateStandaloneHeaderPropagationFactory(packageName) {
    return `package ${packageName}.filter;

import org.eclipse.microprofile.rest.client.ext.ClientHeadersFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.MultivaluedHashMap;
import lombok.extern.slf4j.Slf4j;

/**
 * Automatic header propagation for REST clients
 * Forwards authentication, tracing, and context headers from incoming requests
 */
@ApplicationScoped
@Slf4j
public class HeaderPropagationFactory implements ClientHeadersFactory {

    /**
     * Headers to automatically propagate from incoming requests to outgoing REST client calls
     */
    private static final String[] PROPAGATED_HEADERS = {
        "Authorization",
        "X-Correlation-ID",
        "X-Request-ID",
        "X-Trace-ID",
        "X-Tenant-ID",
        "Accept-Language",
        "X-Forwarded-For",
        "X-Forwarded-Proto",
        "X-Forwarded-Host"
    };

    @Override
    public MultivaluedMap<String, String> update(
            MultivaluedMap<String, String> incomingHeaders,
            MultivaluedMap<String, String> clientOutgoingHeaders) {

        MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();

        // Copy all existing outgoing headers
        headers.putAll(clientOutgoingHeaders);

        // Propagate specific headers from incoming request
        if (incomingHeaders != null) {
            for (String headerName : PROPAGATED_HEADERS) {
                if (incomingHeaders.containsKey(headerName)) {
                    String value = incomingHeaders.getFirst(headerName);
                    if (value != null && !value.isEmpty()) {
                        headers.putSingle(headerName, value);
                        log.debug("Propagating header: {} = {}", headerName, value);
                    }
                }
            }
        }

        return headers;
    }
}
`;
  }

  generateClientExceptionMapper(packageName) {
    return `package ${packageName}.exception;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.rest.client.ext.ResponseExceptionMapper;
import lombok.extern.slf4j.Slf4j;

/**
 * Exception mapper for REST client errors
 * Converts HTTP error responses into Java exceptions
 */
@Provider
@Slf4j
public class ClientExceptionMapper implements ResponseExceptionMapper<ApiClientException> {

    @Override
    public ApiClientException toThrowable(Response response) {
        int status = response.getStatus();
        String message = "API call failed with status: " + status;

        try {
            String body = response.readEntity(String.class);
            if (body != null && !body.isEmpty()) {
                message = message + ", body: " + body;
            }
        } catch (Exception e) {
            log.warn("Could not read error response body", e);
        }

        log.error(message);

        return new ApiClientException(message, status);
    }

    @Override
    public boolean handles(int status, jakarta.ws.rs.core.MultivaluedMap<String, Object> headers) {
        // Handle all 4xx and 5xx errors
        return status >= 400;
    }
}
`;
  }

  generateApiClientException(packageName) {
    return `package ${packageName}.exception;

/**
 * Custom exception for API client errors
 * Contains HTTP status code and error details
 */
public class ApiClientException extends RuntimeException {

    private final int statusCode;

    public ApiClientException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }

    public ApiClientException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = 500;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public boolean isClientError() {
        return statusCode >= 400 && statusCode < 500;
    }

    public boolean isServerError() {
        return statusCode >= 500;
    }

    @Override
    public String toString() {
        return "ApiClientException{" +
                "statusCode=" + statusCode +
                ", message='" + getMessage() + '\'' +
                '}';
    }
}
`;
  }

  generateClientLoggingFilter(packageName) {
    return `package ${packageName}.filter;

import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.client.ClientRequestFilter;
import jakarta.ws.rs.client.ClientResponseContext;
import jakarta.ws.rs.client.ClientResponseFilter;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;
import java.io.IOException;

/**
 * Request/Response logging filter for REST client
 * Logs all outgoing requests and incoming responses for debugging and monitoring
 */
@Provider
@Slf4j
public class LoggingFilter implements ClientRequestFilter, ClientResponseFilter {

    @Override
    public void filter(ClientRequestContext requestContext) throws IOException {
        log.debug("REST Client Request: {} {} {}",
            requestContext.getMethod(),
            requestContext.getUri(),
            requestContext.getHeaders()
        );
    }

    @Override
    public void filter(ClientRequestContext requestContext, ClientResponseContext responseContext) throws IOException {
        log.debug("REST Client Response: {} {} - Status: {}",
            requestContext.getMethod(),
            requestContext.getUri(),
            responseContext.getStatus()
        );
    }
}
`;
  }

  async generateQuarkusClient(parsedAPI, options) {
    const files = {};
    const { packageName, groupId, artifactId, javaVersion } = options;
    const packagePath = packageName.replace(/\./g, '/');

    files['pom.xml'] = this.generateQuarkusClientPom(groupId, artifactId, javaVersion);

    // Generate DTOs (same as backend)
    if (parsedAPI.schemas) {
      const schemasArray = Array.isArray(parsedAPI.schemas)
        ? parsedAPI.schemas
        : Object.entries(parsedAPI.schemas).map(([name, schema]) => ({ name, schema }));

      for (const { name, schema } of schemasArray) {
        files[`src/main/java/${packagePath}/dto/${name}.java`] = this.generateJavaDTO(packageName, name, schema);
      }
    }

    // Generate REST Client interface
    files[`src/main/java/${packagePath}/client/ApiClient.java`] =
      this.generateQuarkusRestClient(packageName, parsedAPI);

    // Generate HeaderPropagationFactory
    files[`src/main/java/${packagePath}/filter/HeaderPropagationFactory.java`] =
      this.generateStandaloneHeaderPropagationFactory(packageName);

    // Generate Exception Mappers
    files[`src/main/java/${packagePath}/exception/ClientExceptionMapper.java`] =
      this.generateClientExceptionMapper(packageName);
    files[`src/main/java/${packagePath}/exception/ApiClientException.java`] =
      this.generateApiClientException(packageName);

    // Generate Logging Filter
    files[`src/main/java/${packagePath}/filter/LoggingFilter.java`] =
      this.generateClientLoggingFilter(packageName);

    files['src/main/resources/application.properties'] = this.generateQuarkusClientProperties();
    files['README.md'] = this.generateQuarkusClientReadme(artifactId, parsedAPI);

    return files;
  }

  generateQuarkusClientPom(groupId, artifactId, javaVersion) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>

    <properties>
        <quarkus.version>3.6.0</quarkus.version>
        <maven.compiler.source>${javaVersion}</maven.compiler.source>
        <maven.compiler.target>${javaVersion}</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>io.quarkus</groupId>
                <artifactId>quarkus-bom</artifactId>
                <version>\${quarkus.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <!-- REST Client -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest-client-reactive-jackson</artifactId>
        </dependency>

        <!-- Fault Tolerance (Circuit Breaker, Retry, Timeout) -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-smallrye-fault-tolerance</artifactId>
        </dependency>

        <!-- Logging -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-logging-json</artifactId>
        </dependency>

        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>1.18.30</version>
            <scope>provided</scope>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-junit5</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>rest-assured</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>io.quarkus</groupId>
                <artifactId>quarkus-maven-plugin</artifactId>
                <version>\${quarkus.version}</version>
                <extensions>true</extensions>
            </plugin>
            <plugin>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <compilerArgs>
                        <arg>-parameters</arg>
                    </compilerArgs>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;
  }

  generateQuarkusRestClient(packageName, parsedAPI) {
    const serviceName = parsedAPI.title?.toLowerCase().replace(/\s+/g, '-') || 'api';

    let content = `package ${packageName}.client;

import ${packageName}.dto.*;
import ${packageName}.filter.HeaderPropagationFactory;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.eclipse.microprofile.rest.client.annotation.RegisterClientHeaders;
import org.eclipse.microprofile.faulttolerance.*;

/**
 * REST Client for calling the remote API
 * Generated from OpenAPI specification
 *
 * Features:
 * - Automatic header propagation (Authorization, X-Request-ID, etc.)
 * - Circuit breaker for resilience
 * - Retry on failures
 * - Timeout protection
 *
 * Usage:
 * @Inject
 * @RestClient
 * ApiClient apiClient;
 */
@RegisterRestClient(configKey = "${serviceName}")
@RegisterClientHeaders(HeaderPropagationFactory.class)
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface ApiClient {

`;

    for (const operation of parsedAPI.operations) {
      const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
      const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
      const headerParams = operation.parameters?.filter(p => p.in === 'header') || [];
      const hasBody = operation.requestBody !== undefined;

      if (operation.summary) {
        content += `    /**\n     * ${operation.summary}\n     */\n`;
      }

      const method = operation.method.toUpperCase();

      // Add fault tolerance annotations
      content += `    @CircuitBreaker(\n`;
      content += `        requestVolumeThreshold = 10,\n`;
      content += `        failureRatio = 0.5,\n`;
      content += `        delay = 5000,\n`;
      content += `        successThreshold = 3\n`;
      content += `    )\n`;
      content += `    @Retry(\n`;
      content += `        maxRetries = 3,\n`;
      content += `        delay = 1000,\n`;
      content += `        jitter = 500\n`;
      content += `    )\n`;
      content += `    @Timeout(value = 10000)\n`;
      content += `    @Fallback(fallbackMethod = "${operation.operationId}Fallback")\n`;
      content += `    @${method}\n`;
      content += `    @Path("${operation.path}")\n`;

      content += `    Object ${operation.operationId}(`;

      const params = [];
      for (const param of pathParams) {
        params.push(`@PathParam("${param.name}") ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of queryParams) {
        params.push(`@QueryParam("${param.name}") ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of headerParams) {
        params.push(`@HeaderParam("${param.name}") ${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      if (hasBody) {
        params.push('Object requestBody');
      }

      content += params.join(', ');
      content += `);\n\n`;

      // Add fallback method
      content += `    /**\n     * Fallback method for ${operation.operationId}\n     */\n`;
      content += `    default Object ${operation.operationId}Fallback(`;

      // Same parameters but without JAX-RS annotations
      const fallbackParams = [];
      for (const param of pathParams) {
        fallbackParams.push(`${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of queryParams) {
        fallbackParams.push(`${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      for (const param of headerParams) {
        fallbackParams.push(`${this.mapSchemaToJavaType(param.schema)} ${param.name}`);
      }
      if (hasBody) {
        fallbackParams.push('Object requestBody');
      }

      content += fallbackParams.join(', ');
      content += `) {\n`;
      content += `        throw new RuntimeException("Service ${parsedAPI.title || 'API'} is unavailable");\n`;
      content += `    }\n\n`;
    }

    content += `}\n`;
    return content;
  }

  generateQuarkusClientProperties() {
    return `# API Client configuration
quarkus.rest-client.api.url=http://localhost:8080/api

# Timeouts (milliseconds)
quarkus.rest-client.api.connect-timeout=5000
quarkus.rest-client.api.read-timeout=10000

# Header Propagation
# Automatic header forwarding is enabled via HeaderPropagationFactory
# The following headers are automatically propagated from incoming requests:
# - Authorization
# - X-Correlation-ID
# - X-Request-ID
# - X-Trace-ID
# - X-Tenant-ID
# - Accept-Language
# - X-Forwarded-For
# - X-Forwarded-Proto
# - X-Forwarded-Host

# Circuit Breaker Configuration (configured via annotations)
# requestVolumeThreshold: 10
# failureRatio: 0.5 (50%)
# delay: 5000ms
# successThreshold: 3

# Retry Configuration (configured via annotations)
# maxRetries: 3
# delay: 1000ms
# jitter: 500ms

# Timeout Configuration (configured via annotations)
# timeout: 10000ms (10 seconds)

# Global Fault Tolerance Settings
mp.fault-tolerance.circuitbreaker.enabled=true

# Logging
quarkus.log.level=INFO
quarkus.log.category."org.eclipse.microprofile.rest.client".level=DEBUG
quarkus.log.console.json=false

# Production logging
%prod.quarkus.log.console.json=true`;
  }

  generateQuarkusClientReadme(artifactId, parsedAPI) {
    return `# ${artifactId}

Quarkus MicroProfile REST Client for API communication with enterprise-grade cross-cutting concerns.

## 📁 Package Structure

\`\`\`
${artifactId}/
├── pom.xml                                   # Maven configuration with all dependencies
├── src/main/java/
│   └── com/example/api/
│       ├── client/
│       │   └── ApiClient.java               # REST Client interface with fault tolerance
│       ├── dto/
│       │   └── *.java                       # Data Transfer Objects
│       ├── filter/
│       │   ├── HeaderPropagationFactory.java # Automatic header forwarding
│       │   └── LoggingFilter.java           # Request/response logging
│       └── exception/
│           ├── ApiClientException.java      # Custom exception
│           └── ClientExceptionMapper.java   # Error response mapping
├── src/main/resources/
│   └── application.properties               # Configuration
└── README.md
\`\`\`

## 🎯 Features

✅ **Automatic Header Propagation** - Auth tokens, request IDs, and tracing headers forwarded automatically
✅ **Circuit Breaker** - Prevents cascading failures with automatic circuit breaking
✅ **Retry Logic** - Automatic retries with exponential backoff and jitter
✅ **Timeout Protection** - Prevents hanging requests with configurable timeouts
✅ **Fallback Methods** - Graceful degradation when services are unavailable
✅ **Exception Mapping** - HTTP errors converted to typed Java exceptions
✅ **Request/Response Logging** - Automatic logging of all REST calls
✅ **Fault Tolerance** - Production-ready resilience patterns built-in

## 📋 Cross-Cutting Concerns Included

### 1. Header Propagation
Headers are automatically forwarded from incoming requests to outgoing REST client calls:
- \`Authorization\` - Authentication tokens
- \`X-Request-ID\` - Request tracking
- \`X-Correlation-ID\` - Distributed tracing correlation
- \`X-Trace-ID\` - OpenTelemetry trace ID
- \`X-Tenant-ID\` - Multi-tenancy support
- \`Accept-Language\` - Internationalization
- \`X-Forwarded-*\` - Proxy headers

### 2. Circuit Breaker
Automatically opens circuit when:
- 50% of requests fail
- After 10 requests (volume threshold)
- Circuit stays open for 5 seconds
- Requires 3 successful requests to close

### 3. Retry Logic
Failed requests are automatically retried:
- Maximum 3 retries
- 1000ms base delay
- 500ms jitter (randomization)
- Exponential backoff

### 4. Timeout Protection
All requests have:
- 10-second timeout
- 5-second connection timeout
- 10-second read timeout

### 5. Fallback Methods
Each operation has a fallback method that:
- Returns a default value or throws exception
- Prevents cascading failures
- Can be customized per operation

### 6. Exception Handling
Automatic exception mapping converts HTTP errors:
- 4xx errors → \`ApiClientException\` with \`isClientError() = true\`
- 5xx errors → \`ApiClientException\` with \`isServerError() = true\`
- Includes response body for debugging
- Logged automatically for monitoring

### 7. Request/Response Logging
All REST calls are logged:
- Request: Method, URL, Headers
- Response: Status code
- Debug level logging (INFO in production)
- Integration with application logging framework

## Usage

### 1. Add to your Quarkus project

Add this as a dependency in your \`pom.xml\`:

\`\`\`xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>
</dependency>
\`\`\`

### 2. Configure the API endpoint

In your \`application.properties\`:

\`\`\`properties
quarkus.rest-client.api.url=http://api-service:8080/api
\`\`\`

### 3. Inject and use the client

\`\`\`java
@ApplicationScoped
public class MyService {

    @Inject
    @RestClient
    ApiClient apiClient;

    public void doSomething() {
        // Headers are automatically propagated!
        // Circuit breaker, retry, and timeout are all handled automatically!
        Object result = apiClient.someOperation(params);
        // Handle result
    }
}
\`\`\`

## 📖 Usage Examples

### Example 1: Automatic Header Propagation

\`\`\`java
@Path("/orders")
public class OrdersResource {

    @Inject
    @RestClient
    ApiClient apiClient;  // Products API client

    @POST
    public Response createOrder(
            @HeaderParam("Authorization") String authToken,
            @HeaderParam("X-Request-ID") String requestId,
            OrderRequest request) {

        // Authorization and X-Request-ID are automatically
        // forwarded to the apiClient call!
        Product product = apiClient.getProduct(request.getProductId());

        // Create order logic...
        return Response.ok().build();
    }
}
\`\`\`

### Example 2: Circuit Breaker in Action

The circuit breaker automatically protects your service:

\`\`\`
Normal Operation:
  Request 1 → Success ✅
  Request 2 → Success ✅
  Request 3 → Success ✅

Service Degradation:
  Request 4 → Failure ❌ (Retry 1)
  Request 4 → Failure ❌ (Retry 2)
  Request 4 → Failure ❌ (Retry 3)
  Request 4 → Fallback executed 🛡️

  Request 5 → Failure ❌
  Request 6 → Failure ❌
  ...
  (After 10 requests with 50% failure rate)

Circuit Opened (5 seconds):
  Request 11 → Fallback immediately 🛡️ (no network call)
  Request 12 → Fallback immediately 🛡️ (no network call)

Circuit Half-Open (testing):
  Request 13 → Success ✅ (1/3)
  Request 14 → Success ✅ (2/3)
  Request 15 → Success ✅ (3/3)

Circuit Closed:
  Request 16 → Success ✅ (back to normal)
\`\`\`

### Example 3: Custom Fallback Methods

You can override the default fallback behavior:

\`\`\`java
public interface ApiClient {

    @GET
    @Path("/products/{id}")
    @CircuitBreaker(...)
    @Retry(...)
    @Timeout(...)
    @Fallback(fallbackMethod = "getProductFallback")
    Object getProduct(@PathParam("id") String id);

    // Custom fallback - return cached data instead of throwing
    default Object getProductFallback(String id) {
        log.warn("Products service unavailable, using cached data for: {}", id);
        return getCachedProduct(id);
    }
}
\`\`\`

### Example 4: Exception Handling

Handle errors with typed exceptions:

\`\`\`java
@ApplicationScoped
public class OrderService {

    @Inject
    @RestClient
    ApiClient apiClient;

    public Product getProduct(String id) {
        try {
            return apiClient.getProduct(id);
        } catch (ApiClientException e) {
            if (e.isClientError()) {
                // 4xx - Client error (bad request, not found, etc.)
                log.warn("Invalid product ID: {}, status: {}", id, e.getStatusCode());
                return null;
            } else if (e.isServerError()) {
                // 5xx - Server error (service down, internal error, etc.)
                log.error("Product service error: {}", e.getMessage());
                throw new ServiceUnavailableException("Products service is down");
            }
            throw e;
        }
    }
}
\`\`\`

### Example 5: Monitoring & Observability

All fault tolerance metrics are automatically exposed:

\`\`\`bash
# Circuit breaker metrics
curl http://localhost:9090/q/metrics | grep circuit

# Retry metrics
curl http://localhost:9090/q/metrics | grep retry

# Timeout metrics
curl http://localhost:9090/q/metrics | grep timeout
\`\`\`

View logs for debugging:

\`\`\`bash
# Enable debug logging for REST client
quarkus.log.category."com.example.api.filter".level=DEBUG

# You'll see:
# DEBUG [filter.LoggingFilter] REST Client Request: GET http://api:8080/products/123
# DEBUG [filter.HeaderPropagationFactory] Propagating header: Authorization = Bearer xyz
# DEBUG [filter.LoggingFilter] REST Client Response: GET http://api:8080/products/123 - Status: 200
\`\`\`

## Available Operations

${parsedAPI.operations.map(op => `- \`${op.operationId}()\` - ${op.summary || ''}`).join('\n')}

## Configuration

| Property | Description | Default |
|----------|-------------|---------|
| quarkus.rest-client.api.url | Base URL of the API | http://localhost:8080/api |
| quarkus.rest-client.api.connect-timeout | Connection timeout (ms) | 5000 |
| quarkus.rest-client.api.read-timeout | Read timeout (ms) | 10000 |
| mp.fault-tolerance.circuitbreaker.enabled | Enable circuit breaker | true |

## 🔧 Customization

### Adjust Circuit Breaker Settings

Override defaults in your client interface:

\`\`\`java
@CircuitBreaker(
    requestVolumeThreshold = 20,    // Require 20 requests
    failureRatio = 0.6,              // 60% failure rate
    delay = 10000,                   // 10 second delay
    successThreshold = 5             // 5 successes to close
)
\`\`\`

### Adjust Retry Settings

\`\`\`java
@Retry(
    maxRetries = 5,      // Try 5 times
    delay = 2000,        // 2 second base delay
    jitter = 1000,       // 1 second jitter
    maxDuration = 30000  // Give up after 30 seconds
)
\`\`\`

### Adjust Timeout

\`\`\`java
@Timeout(value = 30000)  // 30 second timeout
\`\`\`

## 🐛 Troubleshooting

### Headers Not Propagating

1. Verify \`HeaderPropagationFactory\` is in the classpath
2. Check the client interface has \`@RegisterClientHeaders(HeaderPropagationFactory.class)\`
3. Enable debug logging:
   \`\`\`properties
   quarkus.log.category."your.package.filter".level=DEBUG
   \`\`\`

### Circuit Breaker Not Working

1. Ensure \`mp.fault-tolerance.circuitbreaker.enabled=true\`
2. Check SmallRye Fault Tolerance dependency is included
3. Verify annotations are on interface methods (not implementation)

### Retries Not Happening

1. Make sure exception is not a non-retriable exception
2. Check \`@Retry\` annotation is present
3. Verify \`maxRetries\` is not set to 0

## 📚 Learn More

- [Quarkus REST Client](https://quarkus.io/guides/rest-client)
- [MicroProfile Fault Tolerance](https://microprofile.io/project/eclipse/microprofile-fault-tolerance)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)

## 🎯 Best Practices

1. ✅ **Use meaningful request IDs** for distributed tracing
2. ✅ **Implement custom fallbacks** for better user experience
3. ✅ **Monitor circuit breaker metrics** to detect issues early
4. ✅ **Tune timeouts** based on actual service SLAs
5. ✅ **Log failures** but don't spam logs during circuit-open state
6. ✅ **Test resilience** with chaos engineering tools
7. ✅ **Cache fallback data** when possible for better degradation

Generated by OpenAPI Redux SDK Generator`;
  }

  generateQuarkusFullstackDocs(parsedAPI, options) {
    const { packageName, artifactId } = options;
    const serviceName = parsedAPI.title || 'API Service';

    return `# ${serviceName} - Quarkus Full Stack
## Backend + Client SDK with Automatic Header Propagation

This package contains both the **backend service** implementation and a **client SDK** for calling other APIs from this service, with built-in header propagation for seamless inter-service communication.

## 📁 Package Structure

\`\`\`
quarkus-fullstack/
├── backend/                    # Your service implementation
│   ├── src/main/java/
│   │   └── ${packageName.replace(/\./g, '/')}/
│   │       ├── resource/       # REST endpoints
│   │       └── dto/            # Data models
│   ├── pom.xml
│   └── README.md
│
└── client-sdk/                 # Client library for calling other APIs
    ├── src/main/java/
    │   └── ${packageName.replace(/\./g, '/')}/client/
    │       ├── client/         # REST client interfaces
    │       ├── model/          # DTOs
    │       ├── filter/         # Header propagation factory
    │       └── exception/      # Exception handling
    └── pom.xml
\`\`\`

## 🚀 Quick Start

### 1. Build the Backend Service

\`\`\`bash
cd backend
./mvnw clean package
\`\`\`

### 2. Run in Development Mode

\`\`\`bash
./mvnw quarkus:dev
\`\`\`

The service will start at \`http://localhost:8080\`

## 🔗 Inter-Service Communication

### Calling Another API from Your Service

The client SDK is already configured with **automatic header propagation**. Here's how to use it:

#### Step 1: Add Another Service's Client SDK

If you generated a client SDK for another service (e.g., Products Service), copy it to your project:

\`\`\`bash
# Copy the client SDK
cp -r path/to/products-service/client-sdk/* client-sdk/
\`\`\`

#### Step 2: Configure the External Service URL

Add to \`backend/src/main/resources/application.properties\`:

\`\`\`properties
# External service configuration
quarkus.rest-client."products-api".url=http://products-service:8080/api
quarkus.rest-client."products-api".connect-timeout=5000
quarkus.rest-client."products-api".read-timeout=10000
\`\`\`

#### Step 3: Inject and Use the Client in Your Service

\`\`\`java
package ${packageName}.resource;

import ${packageName}.client.client.ProductsClient;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import org.eclipse.microprofile.rest.client.inject.RestClient;

@Path("/orders")
public class OrdersResource {

    @Inject
    @RestClient
    ProductsClient productsClient;

    @POST
    @Path("/create")
    public Response createOrder(
            @HeaderParam("Authorization") String auth,
            @HeaderParam("X-Request-ID") String requestId,
            CreateOrderRequest request) {

        // Call Products Service - headers are automatically propagated!
        Product product = productsClient.getProductById(
            request.getProductId(),
            requestId,
            "orders-service"
        );

        // Validate product exists and in stock
        if (product == null || !product.getInStock()) {
            throw new BadRequestException("Product not available");
        }

        // Create order with validated product info
        Order order = new Order();
        order.setProductId(product.getId());
        order.setProductName(product.getName());
        order.setUnitPrice(product.getPrice());

        return Response.ok(order).build();
    }
}
\`\`\`

## 🔐 Automatic Header Propagation

The client SDK includes a \`HeaderPropagationFactory\` that **automatically forwards** these headers from incoming requests to outgoing REST client calls:

- \`Authorization\` - Authentication tokens
- \`X-Correlation-ID\` - Request correlation
- \`X-Request-ID\` - Unique request tracking
- \`X-Trace-ID\` - Distributed tracing
- \`X-Tenant-ID\` - Multi-tenancy support
- \`Accept-Language\` - Localization
- \`X-Forwarded-For\` - Client IP forwarding
- \`X-Forwarded-Proto\` - Protocol forwarding
- \`X-Forwarded-Host\` - Host forwarding

### How It Works

1. A request comes in to your service with headers (e.g., \`Authorization: Bearer token123\`)
2. Your service processes the request and needs to call another API
3. The \`HeaderPropagationFactory\` automatically copies the headers to the outgoing REST client call
4. The external service receives the same headers (authentication context preserved!)

### Example Flow

\`\`\`
Frontend Request
  └─> Authorization: Bearer abc123
  └─> X-Request-ID: req-456

Your Service (Orders)
  └─> Receives: Authorization: Bearer abc123
  └─> Receives: X-Request-ID: req-456
  └─> Calls: Products Service
      └─> Sends: Authorization: Bearer abc123  ✅ Auto-propagated
      └─> Sends: X-Request-ID: req-456         ✅ Auto-propagated

Products Service
  └─> Receives: Authorization: Bearer abc123
  └─> Can validate the same user token!
\`\`\`

## 🛠️ Configuration

### Backend Service Configuration

\`backend/src/main/resources/application.properties\`:

\`\`\`properties
# Server port
quarkus.http.port=8080

# Logging
quarkus.log.level=INFO

# Enable JSON logging in production
%prod.quarkus.log.console.json=true
\`\`\`

### Client SDK Configuration

The client SDK is pre-configured in the backend's dependencies. No additional configuration needed!

## 📊 Available Operations

${parsedAPI.operations.map(op => `- **${op.operationId}** - ${op.summary || op.description || ''}`).join('\n')}

## 🧪 Testing

### Test with cURL

\`\`\`bash
# Test your endpoint
curl -X GET http://localhost:8080/api/endpoint \\
  -H "Authorization: Bearer your-token" \\
  -H "X-Request-ID: \$(uuidgen)"
\`\`\`

### Verify Header Propagation

Check the logs to see headers being propagated:

\`\`\`bash
./mvnw quarkus:dev

# In the logs, you'll see:
# DEBUG [filter.HeaderPropagationFactory] Propagating header: Authorization = Bearer your-token
# DEBUG [filter.HeaderPropagationFactory] Propagating header: X-Request-ID = req-123
\`\`\`

## 🐳 Docker Deployment

### Build Native Image (Optional)

\`\`\`bash
cd backend
./mvnw package -Pnative
\`\`\`

### Run with Docker Compose

\`\`\`yaml
version: '3.8'
services:
  orders-service:
    image: ${artifactId}:latest
    ports:
      - "8080:8080"
    environment:
      # Configure external service URLs
      - QUARKUS_REST_CLIENT_PRODUCTS_API_URL=http://products-service:8080/api
      - QUARKUS_REST_CLIENT_PRODUCTS_API_CONNECT_TIMEOUT=5000
      - QUARKUS_REST_CLIENT_PRODUCTS_API_READ_TIMEOUT=10000

  products-service:
    image: products-service:latest
    ports:
      - "8081:8080"
\`\`\`

## 🔍 Troubleshooting

### Headers Not Being Propagated

1. Check that \`HeaderPropagationFactory\` is in the client SDK
2. Verify the client interface has \`@RegisterClientHeaders(HeaderPropagationFactory.class)\`
3. Enable debug logging:
   \`\`\`properties
   quarkus.log.category."${packageName}.client.filter".level=DEBUG
   \`\`\`

### External Service Call Failing

1. Check the service URL in \`application.properties\`
2. Verify network connectivity
3. Check circuit breaker logs (retries, fallbacks)

## 📚 Learn More

- [Quarkus REST Client Guide](https://quarkus.io/guides/rest-client)
- [MicroProfile REST Client](https://microprofile.io/project/eclipse/microprofile-rest-client)
- [Fault Tolerance](https://quarkus.io/guides/smallrye-fault-tolerance)

## 🎯 Best Practices

1. **Always use X-Request-ID** for tracing requests across services
2. **Forward authentication tokens** to maintain security context
3. **Add circuit breakers** for resilience
4. **Log all inter-service calls** for debugging
5. **Use timeouts** to prevent hanging requests

Generated by OpenAPI Redux SDK Generator
`;
  }

  // ============================================
  // UNIFIED QUARKUS PROJECT GENERATOR
  // ============================================

  async generateQuarkusUnifiedProject(mainAPI, clientAPIs, options) {
    const files = {};
    const { packageName, groupId, artifactId, javaVersion, headers, businessLogic } = options;
    const packagePath = packageName.replace(/\./g, '/');

    // Generate POM with all dependencies
    files['pom.xml'] = this.generateUnifiedQuarkusPom(groupId, artifactId, javaVersion);

    // Generate main API resources
    const resourcesByTag = this.groupOperationsByTag(mainAPI.operations);
    for (const [tag, operations] of Object.entries(resourcesByTag)) {
      const resourceName = this.capitalize(tag || 'Api') + 'Resource';
      files[`src/main/java/${packagePath}/resource/${resourceName}.java`] =
        this.generateUnifiedQuarkusResource(packageName, resourceName, operations, clientAPIs, businessLogic);
    }

    // Generate DTOs for main API
    for (const { name, schema } of mainAPI.schemas) {
      files[`src/main/java/${packagePath}/dto/${name}.java`] = this.generateJavaDTO(packageName, name, schema);
    }

    // Generate REST clients for external APIs
    for (const clientAPI of clientAPIs) {
      const clientName = this.capitalize(clientAPI.title.replace(/\s+/g, '')) + 'Client';
      files[`src/main/java/${packagePath}/client/${clientName}.java`] =
        this.generateQuarkusRestClientInterface(packageName, clientName, clientAPI, headers);

      // Generate DTOs for client APIs
      for (const { name, schema } of clientAPI.schemas) {
        files[`src/main/java/${packagePath}/client/dto/${name}.java`] =
          this.generateClientJavaDTO(packageName, name, schema);
      }
    }

    // Generate header propagation factory
    files[`src/main/java/${packagePath}/filter/HeaderPropagationFactory.java`] =
      this.generateConfigurableHeaderPropagation(packageName, headers);

    // Generate business logic services
    if (businessLogic.enableValidation || businessLogic.enableTransformation || businessLogic.enableEnrichment) {
      files[`src/main/java/${packagePath}/service/BusinessLogicService.java`] =
        this.generateBusinessLogicService(packageName, mainAPI, clientAPIs, businessLogic);
    }

    // Generate application properties
    files['src/main/resources/application.properties'] =
      this.generateUnifiedApplicationProperties(mainAPI, clientAPIs, headers);

    // Generate README
    files['README.md'] = this.generateUnifiedReadme(mainAPI, clientAPIs, options);

    return files;
  }

  generateUnifiedQuarkusPom(groupId, artifactId, javaVersion) {
    return `<?xml version="1.0"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd"
         xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0</version>

    <properties>
        <compiler-plugin.version>3.11.0</compiler-plugin.version>
        <maven.compiler.release>${javaVersion}</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <quarkus.platform.version>3.6.0</quarkus.platform.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>io.quarkus.platform</groupId>
                <artifactId>quarkus-bom</artifactId>
                <version>\${quarkus.platform.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <!-- Quarkus REST -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-resteasy-reactive-jackson</artifactId>
        </dependency>

        <!-- REST Client for calling external APIs -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest-client-reactive-jackson</artifactId>
        </dependency>

        <!-- Bean Validation -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-hibernate-validator</artifactId>
        </dependency>

        <!-- Fault Tolerance (Circuit Breaker, Retry) -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-smallrye-fault-tolerance</artifactId>
        </dependency>

        <!-- Cache -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-cache</artifactId>
        </dependency>

        <!-- Logging -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-logging-json</artifactId>
        </dependency>

        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>1.18.30</version>
            <scope>provided</scope>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-junit5</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>rest-assured</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>io.quarkus.platform</groupId>
                <artifactId>quarkus-maven-plugin</artifactId>
                <version>\${quarkus.platform.version}</version>
                <extensions>true</extensions>
            </plugin>
        </plugins>
    </build>
</project>
`;
  }

  generateUnifiedQuarkusResource(packageName, resourceName, operations, clientAPIs, businessLogic) {
    let content = `package ${packageName}.resource;

import ${packageName}.dto.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;

`;

    // Import clients if needed
    if (clientAPIs.length > 0) {
      content += `// External API clients\n`;
      clientAPIs.forEach(api => {
        const clientName = this.capitalize(api.title.replace(/\s+/g, '')) + 'Client';
        content += `import ${packageName}.client.${clientName};\n`;
      });
      content += `import org.eclipse.microprofile.rest.client.inject.RestClient;\n\n`;
    }

    // Import business logic service if enabled
    if (businessLogic.enableValidation || businessLogic.enableTransformation || businessLogic.enableEnrichment) {
      content += `import ${packageName}.service.BusinessLogicService;\n\n`;
    }

    content += `@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Slf4j
public class ${resourceName} {

`;

    // Inject clients
    if (clientAPIs.length > 0) {
      clientAPIs.forEach(api => {
        const clientName = this.capitalize(api.title.replace(/\s+/g, '')) + 'Client';
        const fieldName = clientName.charAt(0).toLowerCase() + clientName.slice(1);
        content += `    @Inject
    @RestClient
    ${clientName} ${fieldName};

`;
      });
    }

    // Inject business logic service
    if (businessLogic.enableValidation || businessLogic.enableTransformation || businessLogic.enableEnrichment) {
      content += `    @Inject
    BusinessLogicService businessLogicService;

`;
    }

    // Generate methods
    for (const operation of operations) {
      content += this.generateUnifiedResourceMethod(operation, clientAPIs, businessLogic);
    }

    content += `}\n`;
    return content;
  }

  generateUnifiedResourceMethod(operation, clientAPIs, businessLogic) {
    const method = operation.method.toUpperCase();
    const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
    const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
    const headerParams = operation.parameters?.filter(p => p.in === 'header') || [];
    const hasBody = operation.requestBody !== undefined;

    let code = `    @${method}
    @Path("${operation.path}")
    public Response ${operation.operationId}(`;

    const params = [];
    pathParams.forEach(p => params.push(`@PathParam("${p.name}") ${this.mapSchemaToJavaType(p.schema)} ${p.name}`));
    queryParams.forEach(p => params.push(`@QueryParam("${p.name}") ${this.mapSchemaToJavaType(p.schema)} ${p.name}`));
    headerParams.forEach(p => params.push(`@HeaderParam("${p.name}") ${this.mapSchemaToJavaType(p.schema)} ${p.name}`));
    if (hasBody) params.push('@Valid Object requestBody');

    code += params.join(', ');
    code += `) {
        log.info("${operation.operationId} called");

`;

    // Add validation
    if (businessLogic.enableValidation) {
      code += `        // TODO: Add custom validation logic
        // businessLogicService.validate${this.capitalize(operation.operationId)}(requestBody);

`;
    }

    // Add transformation
    if (businessLogic.enableTransformation) {
      code += `        // TODO: Transform request data
        // Object transformedData = businessLogicService.transform${this.capitalize(operation.operationId)}(requestBody);

`;
    }

    // Add enrichment example if there are client APIs
    if (businessLogic.enableEnrichment && clientAPIs.length > 0) {
      const firstClient = this.capitalize(clientAPIs[0].title.replace(/\s+/g, '')) + 'Client';
      const fieldName = firstClient.charAt(0).toLowerCase() + firstClient.slice(1);

      code += `        // TODO: Enrich with data from external API
        // Example: Call ${clientAPIs[0].title}
        // var externalData = ${fieldName}.someMethod(param);

`;
    }

    code += `        // TODO: Implement ${operation.operationId} logic
        return Response.ok().build();
    }

`;

    return code;
  }

  generateQuarkusRestClientInterface(packageName, clientName, api, headers) {
    const propagatedHeaders = Object.keys(headers).filter(h => headers[h].propagate);

    let content = `package ${packageName}.client;

import ${packageName}.client.dto.*;
import ${packageName}.filter.HeaderPropagationFactory;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.eclipse.microprofile.rest.client.annotation.RegisterClientHeaders;
import org.eclipse.microprofile.faulttolerance.*;

/**
 * REST Client for ${api.title}
 * Automatically propagates headers: ${propagatedHeaders.join(', ')}
 */
@RegisterRestClient(configKey = "${api.title.toLowerCase().replace(/\s+/g, '-')}")
@RegisterClientHeaders(HeaderPropagationFactory.class)
@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface ${clientName} {

`;

    // Generate first 3 operations as examples
    const exampleOps = api.operations.slice(0, 3);
    for (const op of exampleOps) {
      content += this.generateClientMethodSignature(op);
    }

    if (api.operations.length > 3) {
      content += `    // TODO: Add remaining ${api.operations.length - 3} operations

`;
    }

    content += `}\n`;
    return content;
  }

  generateClientMethodSignature(operation) {
    const method = operation.method.toUpperCase();
    const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
    const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
    const hasBody = operation.requestBody !== undefined;

    let code = `    @${method}
    @Path("${operation.path}")
    @Timeout(10000)
    @Retry(maxRetries = 2)
    Object ${operation.operationId}(`;

    const params = [];
    pathParams.forEach(p => params.push(`@PathParam("${p.name}") ${this.mapSchemaToJavaType(p.schema)} ${p.name}`));
    queryParams.forEach(p => params.push(`@QueryParam("${p.name}") ${this.mapSchemaToJavaType(p.schema)} ${p.name}`));
    if (hasBody) params.push('Object body');

    code += params.join(', ');
    code += `);\n\n`;

    return code;
  }

  generateClientJavaDTO(packageName, name, schema) {
    return this.generateJavaDTO(packageName + '.client', name, schema);
  }

  generateConfigurableHeaderPropagation(packageName, headers) {
    const propagatedHeaders = Object.keys(headers).filter(h => headers[h].propagate);

    return `package ${packageName}.filter;

import org.eclipse.microprofile.rest.client.ext.ClientHeadersFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.MultivaluedHashMap;
import lombok.extern.slf4j.Slf4j;

/**
 * Automatic header propagation for REST clients
 * Configured to propagate: ${propagatedHeaders.join(', ')}
 */
@ApplicationScoped
@Slf4j
public class HeaderPropagationFactory implements ClientHeadersFactory {

    private static final String[] PROPAGATED_HEADERS = {
        ${propagatedHeaders.map(h => `"${h}"`).join(',\n        ')}
    };

    @Override
    public MultivaluedMap<String, String> update(
            MultivaluedMap<String, String> incomingHeaders,
            MultivaluedMap<String, String> clientOutgoingHeaders) {

        MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();
        headers.putAll(clientOutgoingHeaders);

        if (incomingHeaders != null) {
            for (String headerName : PROPAGATED_HEADERS) {
                if (incomingHeaders.containsKey(headerName)) {
                    String value = incomingHeaders.getFirst(headerName);
                    if (value != null && !value.isEmpty()) {
                        headers.putSingle(headerName, value);
                        log.debug("Propagating header: {} = {}", headerName, value);
                    }
                }
            }
        }

        return headers;
    }
}
`;
  }

  generateBusinessLogicService(packageName, mainAPI, clientAPIs, businessLogic) {
    return `package ${packageName}.service;

import ${packageName}.dto.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import io.quarkus.cache.CacheResult;
import lombok.extern.slf4j.Slf4j;

/**
 * Business logic service with configurable features
 * - Validation: ${businessLogic.enableValidation}
 * - Transformation: ${businessLogic.enableTransformation}
 * - Enrichment: ${businessLogic.enableEnrichment}
 * - Caching: ${businessLogic.enableCaching}
 */
@ApplicationScoped
@Slf4j
public class BusinessLogicService {

${businessLogic.enableValidation ? `
    /**
     * Validate request data
     */
    public void validateRequest(Object data) {
        // TODO: Add validation logic
        log.debug("Validating request: {}", data);
    }
` : ''}
${businessLogic.enableTransformation ? `
    /**
     * Transform data between APIs
     */
    public Object transformData(Object source) {
        // TODO: Add transformation logic
        log.debug("Transforming data: {}", source);
        return source;
    }
` : ''}
${businessLogic.enableEnrichment ? `
    /**
     * Enrich data from external APIs
     */
    public Object enrichData(Object data) {
        // TODO: Call external APIs and enrich
        log.debug("Enriching data: {}", data);
        return data;
    }
` : ''}
${businessLogic.enableCaching ? `
    /**
     * Cached method example
     */
    @CacheResult(cacheName = "business-cache")
    public Object getCachedData(String key) {
        // TODO: Implement cached logic
        log.debug("Fetching cached data for key: {}", key);
        return null;
    }
` : ''}
}
`;
  }

  generateUnifiedApplicationProperties(mainAPI, clientAPIs, headers) {
    let content = `# Main Service Configuration
quarkus.http.port=8080

# External API Clients
`;

    clientAPIs.forEach(api => {
      const configKey = api.title.toLowerCase().replace(/\s+/g, '-');
      content += `
# ${api.title} Client
quarkus.rest-client."${configKey}".url=http://localhost:8081/api
quarkus.rest-client."${configKey}".connect-timeout=5000
quarkus.rest-client."${configKey}".read-timeout=10000
`;
    });

    content += `
# Header Propagation (configured in HeaderPropagationFactory)
# Propagated headers: ${Object.keys(headers).filter(h => headers[h].propagate).join(', ')}

# Fault Tolerance
mp.fault-tolerance.circuitbreaker.enabled=true

# Caching
quarkus.cache.type=caffeine

# Logging
quarkus.log.level=INFO
quarkus.log.category."${mainAPI.title?.replace(/\s+/g, '.').toLowerCase() || 'app'}".level=DEBUG
%prod.quarkus.log.console.json=true
`;

    return content;
  }

  generateUnifiedReadme(mainAPI, clientAPIs, options) {
    return `# ${mainAPI.title} - Unified Quarkus Microservice

This is a unified Quarkus project that implements **${mainAPI.title}** and can call the following external APIs:

${clientAPIs.map(api => `- **${api.title}** (${api.operations.length} operations)`).join('\n')}

## Features

✅ **Main API Implementation**: ${mainAPI.operations.length} endpoints
✅ **External API Clients**: ${clientAPIs.length} REST clients with automatic header propagation
✅ **Header Propagation**: ${Object.keys(options.headers).filter(h => options.headers[h].propagate).length} headers automatically forwarded
✅ **Business Logic**: ${Object.values(options.businessLogic).filter(v => v).length} features enabled
${options.businessLogic.enableValidation ? '✅ Request/Response Validation\n' : ''}${options.businessLogic.enableTransformation ? '✅ Data Transformation\n' : ''}${options.businessLogic.enableEnrichment ? '✅ Data Enrichment\n' : ''}${options.businessLogic.enableCaching ? '✅ Caching Layer\n' : ''}
## Quick Start

\`\`\`bash
# Run in dev mode
./mvnw quarkus:dev

# Build
./mvnw clean package

# Run
java -jar target/quarkus-app/quarkus-run.jar
\`\`\`

## Configuration

Edit \`src/main/resources/application.properties\` to configure external API endpoints:

\`\`\`properties
${clientAPIs.map(api => `quarkus.rest-client."${api.title.toLowerCase().replace(/\s+/g, '-')}".url=http://your-${api.title.toLowerCase().replace(/\s+/g, '-')}:8080/api`).join('\n')}
\`\`\`

## Architecture

This service calls external APIs using Quarkus REST Client with automatic header propagation.
All configured headers are automatically forwarded from incoming requests to outgoing API calls.

Generated by OpenAPI Redux SDK Generator
`;
  }
}

// Export for use in app.js
window.SDKGenerator = SDKGenerator;
