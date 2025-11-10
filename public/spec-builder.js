// Spec Builder - Create OpenAPI specs from scratch

// State
let schemas = [];
let endpoints = [];

// Mode Toggle
document.getElementById('uploadModeBtn')?.addEventListener('click', function() {
    document.getElementById('uploadModeBtn').classList.add('active');
    document.getElementById('createModeBtn').classList.remove('active');
    document.getElementById('uploadModeCard').classList.remove('hidden');
    document.getElementById('createModeCard').classList.add('hidden');
});

document.getElementById('createModeBtn')?.addEventListener('click', function() {
    document.getElementById('createModeBtn').classList.add('active');
    document.getElementById('uploadModeBtn').classList.remove('active');
    document.getElementById('createModeCard').classList.remove('hidden');
    document.getElementById('uploadModeCard').classList.add('hidden');
});

// Add Schema
document.getElementById('addSchema')?.addEventListener('click', function() {
    const schema = {
        id: Date.now(),
        name: '',
        type: 'object',
        fields: []
    };
    schemas.push(schema);
    renderSchema(schema);
});

function renderSchema(schema) {
    const schemasList = document.getElementById('schemasList');

    // Remove empty state if exists
    const emptyState = schemasList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const schemaItem = document.createElement('div');
    schemaItem.className = 'schema-item';
    schemaItem.dataset.schemaId = schema.id;

    schemaItem.innerHTML = `
        <div class="item-header">
            <input type="text" class="item-title" placeholder="Schema Name (e.g., User, Product)"
                value="${schema.name}"
                onchange="updateSchema(${schema.id}, 'name', this.value)"
                style="border: none; background: transparent; font-weight: 600; font-size: 1rem; color: #111827; padding: 0;">
            <button type="button" class="btn-remove" onclick="removeSchema(${schema.id})">✕ Remove</button>
        </div>
        <div class="form-group">
            <label style="font-size: 0.85rem; margin-bottom: 4px;">Description</label>
            <input type="text" placeholder="Description of this schema"
                value="${schema.description || ''}"
                onchange="updateSchema(${schema.id}, 'description', this.value)"
                style="padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 0.85rem;">
        </div>
        <div class="schema-fields" id="fields-${schema.id}">
            <!-- Fields will be added here -->
        </div>
        <button type="button" class="btn-add-field" onclick="addSchemaField(${schema.id})">+ Add Field</button>
    `;

    schemasList.appendChild(schemaItem);

    // Render existing fields
    schema.fields.forEach(field => renderSchemaField(schema.id, field));
}

function addSchemaField(schemaId) {
    const schema = schemas.find(s => s.id === schemaId);
    if (!schema) return;

    const field = {
        id: Date.now(),
        name: '',
        type: 'string',
        required: false
    };

    schema.fields.push(field);
    renderSchemaField(schemaId, field);
}

function renderSchemaField(schemaId, field) {
    const fieldsContainer = document.getElementById(`fields-${schemaId}`);

    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-row';
    fieldRow.dataset.fieldId = field.id;

    fieldRow.innerHTML = `
        <input type="text" placeholder="Field name" value="${field.name}"
            onchange="updateSchemaField(${schemaId}, ${field.id}, 'name', this.value)">
        <select onchange="updateSchemaField(${schemaId}, ${field.id}, 'type', this.value)">
            <option value="string" ${field.type === 'string' ? 'selected' : ''}>String</option>
            <option value="number" ${field.type === 'number' ? 'selected' : ''}>Number</option>
            <option value="integer" ${field.type === 'integer' ? 'selected' : ''}>Integer</option>
            <option value="boolean" ${field.type === 'boolean' ? 'selected' : ''}>Boolean</option>
            <option value="array" ${field.type === 'array' ? 'selected' : ''}>Array</option>
            <option value="object" ${field.type === 'object' ? 'selected' : ''}>Object</option>
        </select>
        <label style="display: flex; align-items: center; gap: 4px; font-size: 0.85rem; cursor: pointer;">
            <input type="checkbox" ${field.required ? 'checked' : ''}
                onchange="updateSchemaField(${schemaId}, ${field.id}, 'required', this.checked)">
            Required
        </label>
        <button type="button" onclick="removeSchemaField(${schemaId}, ${field.id})"
            style="background: #FEE2E2; color: #DC2626; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
            ✕
        </button>
    `;

    fieldsContainer.appendChild(fieldRow);
}

function updateSchema(schemaId, field, value) {
    const schema = schemas.find(s => s.id === schemaId);
    if (schema) {
        schema[field] = value;
    }
}

function updateSchemaField(schemaId, fieldId, field, value) {
    const schema = schemas.find(s => s.id === schemaId);
    if (schema) {
        const fieldObj = schema.fields.find(f => f.id === fieldId);
        if (fieldObj) {
            fieldObj[field] = value;
        }
    }
}

function removeSchemaField(schemaId, fieldId) {
    const schema = schemas.find(s => s.id === schemaId);
    if (schema) {
        schema.fields = schema.fields.filter(f => f.id !== fieldId);
        const fieldRow = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldRow) {
            fieldRow.remove();
        }
    }
}

function removeSchema(schemaId) {
    schemas = schemas.filter(s => s.id !== schemaId);
    const schemaItem = document.querySelector(`[data-schema-id="${schemaId}"]`);
    if (schemaItem) {
        schemaItem.remove();
    }

    // Show empty state if no schemas left
    const schemasList = document.getElementById('schemasList');
    if (schemas.length === 0) {
        schemasList.innerHTML = '<div class="empty-state">No schemas added yet. Click "Add Schema" to create one.</div>';
    }
}

// Add Endpoint
document.getElementById('addEndpoint')?.addEventListener('click', function() {
    const endpoint = {
        id: Date.now(),
        path: '',
        method: 'get',
        summary: '',
        description: '',
        parameters: [],
        requestBody: null,
        responses: {}
    };
    endpoints.push(endpoint);
    renderEndpoint(endpoint);
});

function renderEndpoint(endpoint) {
    const endpointsList = document.getElementById('endpointsList');

    // Remove empty state if exists
    const emptyState = endpointsList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const endpointItem = document.createElement('div');
    endpointItem.className = 'endpoint-item';
    endpointItem.dataset.endpointId = endpoint.id;

    const schemaOptions = schemas.map(s =>
        `<option value="${s.name}">${s.name}</option>`
    ).join('');

    endpointItem.innerHTML = `
        <div class="item-header">
            <div style="display: flex; align-items: center; gap: 8px;">
                <select onchange="updateEndpoint(${endpoint.id}, 'method', this.value)"
                    style="padding: 6px 10px; border: 2px solid #D1D5DB; border-radius: 6px; font-weight: 700;">
                    <option value="get" ${endpoint.method === 'get' ? 'selected' : ''}>GET</option>
                    <option value="post" ${endpoint.method === 'post' ? 'selected' : ''}>POST</option>
                    <option value="put" ${endpoint.method === 'put' ? 'selected' : ''}>PUT</option>
                    <option value="patch" ${endpoint.method === 'patch' ? 'selected' : ''}>PATCH</option>
                    <option value="delete" ${endpoint.method === 'delete' ? 'selected' : ''}>DELETE</option>
                </select>
                <input type="text" placeholder="/api/users" value="${endpoint.path}"
                    onchange="updateEndpoint(${endpoint.id}, 'path', this.value)"
                    style="flex: 1; padding: 6px 10px; border: 2px solid #D1D5DB; border-radius: 6px; font-family: monospace;">
            </div>
            <button type="button" class="btn-remove" onclick="removeEndpoint(${endpoint.id})">✕ Remove</button>
        </div>

        <div class="form-group">
            <label style="font-size: 0.85rem; margin-bottom: 4px;">Summary</label>
            <input type="text" placeholder="Brief description" value="${endpoint.summary || ''}"
                onchange="updateEndpoint(${endpoint.id}, 'summary', this.value)"
                style="padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 0.85rem;">
        </div>

        <div class="form-group">
            <label style="font-size: 0.85rem; margin-bottom: 4px;">Description</label>
            <textarea rows="2" placeholder="Detailed description"
                onchange="updateEndpoint(${endpoint.id}, 'description', this.value)"
                style="padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 0.85rem;">${endpoint.description || ''}</textarea>
        </div>

        <div class="form-group">
            <label style="font-size: 0.85rem; margin-bottom: 4px;">Request Body Schema (optional)</label>
            <select onchange="updateEndpoint(${endpoint.id}, 'requestBody', this.value)"
                style="padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 0.85rem;">
                <option value="">None</option>
                ${schemaOptions}
            </select>
        </div>

        <div class="form-group">
            <label style="font-size: 0.85rem; margin-bottom: 4px;">Success Response (200) Schema</label>
            <select onchange="updateEndpoint(${endpoint.id}, 'responseSchema', this.value)"
                style="padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 0.85rem;">
                <option value="">None</option>
                ${schemaOptions}
            </select>
        </div>

        <div class="endpoint-params" id="params-${endpoint.id}">
            <!-- Parameters will be added here -->
        </div>
        <button type="button" class="btn-add-param" onclick="addEndpointParam(${endpoint.id})">+ Add Parameter</button>
    `;

    endpointsList.appendChild(endpointItem);

    // Render existing parameters
    endpoint.parameters.forEach(param => renderEndpointParam(endpoint.id, param));
}

function addEndpointParam(endpointId) {
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (!endpoint) return;

    const param = {
        id: Date.now(),
        name: '',
        in: 'query',
        type: 'string',
        required: false
    };

    endpoint.parameters.push(param);
    renderEndpointParam(endpointId, param);
}

function renderEndpointParam(endpointId, param) {
    const paramsContainer = document.getElementById(`params-${endpointId}`);

    const paramRow = document.createElement('div');
    paramRow.className = 'param-row';
    paramRow.dataset.paramId = param.id;

    paramRow.innerHTML = `
        <input type="text" placeholder="Parameter name" value="${param.name}"
            onchange="updateEndpointParam(${endpointId}, ${param.id}, 'name', this.value)">
        <select onchange="updateEndpointParam(${endpointId}, ${param.id}, 'in', this.value)">
            <option value="query" ${param.in === 'query' ? 'selected' : ''}>Query</option>
            <option value="path" ${param.in === 'path' ? 'selected' : ''}>Path</option>
            <option value="header" ${param.in === 'header' ? 'selected' : ''}>Header</option>
        </select>
        <select onchange="updateEndpointParam(${endpointId}, ${param.id}, 'type', this.value)">
            <option value="string" ${param.type === 'string' ? 'selected' : ''}>String</option>
            <option value="number" ${param.type === 'number' ? 'selected' : ''}>Number</option>
            <option value="integer" ${param.type === 'integer' ? 'selected' : ''}>Integer</option>
            <option value="boolean" ${param.type === 'boolean' ? 'selected' : ''}>Boolean</option>
        </select>
        <button type="button" onclick="removeEndpointParam(${endpointId}, ${param.id})"
            style="background: #FEE2E2; color: #DC2626; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
            ✕
        </button>
    `;

    paramsContainer.appendChild(paramRow);
}

function updateEndpoint(endpointId, field, value) {
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (endpoint) {
        endpoint[field] = value;
    }
}

function updateEndpointParam(endpointId, paramId, field, value) {
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (endpoint) {
        const param = endpoint.parameters.find(p => p.id === paramId);
        if (param) {
            param[field] = value;
        }
    }
}

function removeEndpointParam(endpointId, paramId) {
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (endpoint) {
        endpoint.parameters = endpoint.parameters.filter(p => p.id !== paramId);
        const paramRow = document.querySelector(`[data-param-id="${paramId}"]`);
        if (paramRow) {
            paramRow.remove();
        }
    }
}

function removeEndpoint(endpointId) {
    endpoints = endpoints.filter(e => e.id !== endpointId);
    const endpointItem = document.querySelector(`[data-endpoint-id="${endpointId}"]`);
    if (endpointItem) {
        endpointItem.remove();
    }

    // Show empty state if no endpoints left
    const endpointsList = document.getElementById('endpointsList');
    if (endpoints.length === 0) {
        endpointsList.innerHTML = '<div class="empty-state">No endpoints added yet. Click "Add Endpoint" to create one.</div>';
    }
}

// Generate OpenAPI YAML
function generateOpenAPISpec() {
    const title = document.getElementById('specTitle').value || 'My API';
    const version = document.getElementById('specVersion').value || '1.0.0';
    const description = document.getElementById('specDescription').value || '';
    const baseUrl = document.getElementById('specBaseUrl').value || 'https://api.example.com';
    const openApiVersion = document.getElementById('specOpenAPIVersion').value || '3.1.0';

    const spec = {
        openapi: openApiVersion,
        info: {
            title: title,
            version: version,
            description: description
        },
        servers: [
            {
                url: baseUrl
            }
        ],
        paths: {},
        components: {
            schemas: {}
        }
    };

    // Add schemas
    schemas.forEach(schema => {
        if (!schema.name) return;

        const properties = {};
        const required = [];

        schema.fields.forEach(field => {
            if (!field.name) return;

            properties[field.name] = {
                type: field.type
            };

            if (field.required) {
                required.push(field.name);
            }
        });

        spec.components.schemas[schema.name] = {
            type: 'object',
            properties: properties
        };

        if (schema.description) {
            spec.components.schemas[schema.name].description = schema.description;
        }

        if (required.length > 0) {
            spec.components.schemas[schema.name].required = required;
        }
    });

    // Add endpoints
    endpoints.forEach(endpoint => {
        if (!endpoint.path) return;

        if (!spec.paths[endpoint.path]) {
            spec.paths[endpoint.path] = {};
        }

        const operation = {
            summary: endpoint.summary || '',
            description: endpoint.description || '',
            parameters: [],
            responses: {
                '200': {
                    description: 'Successful response'
                }
            }
        };

        // Add parameters
        endpoint.parameters.forEach(param => {
            if (!param.name) return;

            operation.parameters.push({
                name: param.name,
                in: param.in,
                required: param.required || false,
                schema: {
                    type: param.type
                }
            });
        });

        // Add request body
        if (endpoint.requestBody) {
            operation.requestBody = {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: `#/components/schemas/${endpoint.requestBody}`
                        }
                    }
                }
            };
        }

        // Add response schema
        if (endpoint.responseSchema) {
            operation.responses['200'].content = {
                'application/json': {
                    schema: {
                        $ref: `#/components/schemas/${endpoint.responseSchema}`
                    }
                }
            };
        }

        spec.paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
    });

    return spec;
}

// Preview Spec
document.getElementById('previewSpec')?.addEventListener('click', function() {
    const spec = generateOpenAPISpec();
    const yaml = jsyaml.dump(spec, { indent: 2 });

    const modal = document.getElementById('specPreviewModal');
    const infoDiv = document.getElementById('specPreviewInfo');
    const contentPre = document.getElementById('specPreviewContent');

    infoDiv.innerHTML = `
        <strong>API Title:</strong> ${spec.info.title}<br>
        <strong>Version:</strong> ${spec.info.version}<br>
        <strong>Endpoints:</strong> ${endpoints.length}<br>
        <strong>Schemas:</strong> ${schemas.length}
    `;

    contentPre.textContent = yaml;
    modal.classList.remove('hidden');
});

// Download Spec
document.getElementById('downloadSpec')?.addEventListener('click', function() {
    const spec = generateOpenAPISpec();
    const yaml = jsyaml.dump(spec, { indent: 2 });
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = (document.getElementById('specTitle').value || 'api').toLowerCase().replace(/\s+/g, '-');
    a.download = `${filename}-spec.yaml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
});

// Generate SDK from created spec
document.getElementById('generateFromCreated')?.addEventListener('click', async function() {
    const spec = generateOpenAPISpec();
    const yaml = jsyaml.dump(spec, { indent: 2 });

    // Create a file-like object and trigger upload flow
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const file = new File([blob], 'created-spec.yaml', { type: 'text/yaml' });

    // Switch to upload mode and process
    document.getElementById('uploadModeBtn').click();

    // Wait a bit for UI to update
    setTimeout(async () => {
        // Create a DataTransfer object to simulate file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        const fileInput = document.getElementById('openApiFile');
        fileInput.files = dataTransfer.files;

        // Trigger the change event
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);

        // Scroll to upload form
        document.getElementById('uploadModeCard').scrollIntoView({ behavior: 'smooth' });
    }, 100);
});
