// Simple SDK Generator with Spec Consolidation

// DOM Elements
const fileInput = document.getElementById('openApiFile');
const fileName = document.getElementById('fileName');
const uploadedFilesList = document.getElementById('uploadedFilesList');
const consolidationOptions = document.getElementById('consolidationOptions');
const mainApiSelector = document.getElementById('mainApiSelector');
const mainClientConfig = document.getElementById('mainClientConfig');
const sourceTargetConfig = document.getElementById('sourceTargetConfig');
const aggregationConfig = document.getElementById('aggregationConfig');
const sourceTargetMappingList = document.getElementById('sourceTargetMappingList');
const aggregationMappingList = document.getElementById('aggregationMappingList');
const headerConfigList = document.getElementById('headerConfigList');
const moduleName = document.getElementById('moduleName');
const baseURL = document.getElementById('baseURL');
const generateBtn = document.getElementById('generateBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const errorContainer = document.getElementById('errorContainer');
const errorText = document.getElementById('errorText');
const successContainer = document.getElementById('successContainer');
const javaOptions = document.getElementById('javaOptions');

// SDK type radio buttons
const sdkTypeRadios = document.querySelectorAll('input[name="sdkType"]');
const consolidationTypeRadios = document.querySelectorAll('input[name="consolidationType"]');

// State
let uploadedFiles = [];
let parsedSpecs = [];
let mainApiIndex = 0;
let extractedHeaders = new Set();
let headerConfigs = [];
let sourceTargetMappings = [];  // 1-to-1 mappings
let aggregationMappings = [];   // many-to-1 mappings

// Default headers to propagate
const DEFAULT_HEADERS = [
    { name: 'Authorization', enabled: true, description: 'Auth token for downstream services' },
    { name: 'X-Correlation-ID', enabled: true, description: 'Request tracing ID' },
    { name: 'X-Request-ID', enabled: true, description: 'Unique request identifier' },
    { name: 'X-Tenant-ID', enabled: false, description: 'Multi-tenant identifier' },
    { name: 'Accept-Language', enabled: false, description: 'Localization preference' },
    { name: 'X-Forwarded-For', enabled: false, description: 'Client IP address' }
];

// File input change handler
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    console.log('Files selected:', files.length, files.map(f => f.name));

    if (files.length === 0) {
        resetState();
        return;
    }

    // Store files
    uploadedFiles = [...files];
    console.log('Stored files:', uploadedFiles.length);

    if (uploadedFiles.length === 1) {
        fileName.textContent = uploadedFiles[0].name;
        fileName.classList.add('selected');
        uploadedFilesList.classList.add('hidden');
        consolidationOptions.classList.add('hidden');
        parsedSpecs = [];
    } else {
        fileName.textContent = `${uploadedFiles.length} files selected`;
        fileName.classList.add('selected');

        // Show uploaded files list
        renderUploadedFilesList(uploadedFiles);
        uploadedFilesList.classList.remove('hidden');

        // Show consolidation options
        consolidationOptions.classList.remove('hidden');

        // Parse specs
        await parseUploadedSpecs(uploadedFiles);

        // Initialize UI
        renderMainApiSelector();
        renderHeaderConfig();
        renderSourceTargetMappings();
        renderAggregationMappings();

        console.log('Parsed specs:', parsedSpecs.length, parsedSpecs.map(s => s.title));
    }
});

function resetState() {
    fileName.textContent = 'Choose OpenAPI file(s) (.yaml, .yml, .json)';
    fileName.classList.remove('selected');
    uploadedFilesList.classList.add('hidden');
    consolidationOptions.classList.add('hidden');
    uploadedFiles = [];
    parsedSpecs = [];
    extractedHeaders = new Set();
    headerConfigs = [];
    sourceTargetMappings = [];
    aggregationMappings = [];
    mainApiIndex = 0;
}

function renderUploadedFilesList(files) {
    uploadedFilesList.innerHTML = files.map((file, index) => `
        <div class="uploaded-file-item">
            <span class="file-icon">📄</span>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
        </div>
    `).join('');
}

async function parseUploadedSpecs(files) {
    parsedSpecs = [];
    extractedHeaders = new Set();
    const generator = new window.SDKGenerator();

    for (let i = 0; i < files.length; i++) {
        try {
            const content = await files[i].text();
            const parsed = await generator.parseOpenAPISpec(content, files[i].name);

            // Extract headers from operations
            parsed.operations?.forEach(op => {
                op.parameters?.forEach(param => {
                    if (param.in === 'header') {
                        extractedHeaders.add(param.name);
                    }
                });
            });

            parsedSpecs.push({
                filename: files[i].name,
                content: content,
                parsed: parsed,
                title: parsed.info?.title || files[i].name.replace(/\.(yaml|yml|json)$/i, ''),
                operationCount: parsed.operations?.length || 0,
                operations: parsed.operations || [],
                baseURL: parsed.baseURL
            });
        } catch (error) {
            console.error(`Error parsing ${files[i].name}:`, error);
            parsedSpecs.push({
                filename: files[i].name,
                content: null,
                parsed: null,
                title: files[i].name,
                operationCount: 0,
                operations: [],
                error: error.message
            });
        }
    }

    // Initialize header configs with defaults + extracted
    initializeHeaderConfigs();
}

function initializeHeaderConfigs() {
    // Only use headers that are actually extracted from the specs
    // Don't add default headers that aren't in the client specs
    headerConfigs = [];

    // Add headers extracted from spec operations
    extractedHeaders.forEach(header => {
        headerConfigs.push({
            name: header,
            enabled: true,
            description: `Extracted from spec`,
            extracted: true
        });
    });

    // If no headers were extracted, show a message (handled in render)
    // Users can still add custom headers via the "Add Header" button
}

function renderMainApiSelector() {
    if (!mainApiSelector) return;

    mainApiSelector.innerHTML = parsedSpecs.map((spec, index) => `
        <label class="api-option ${index === mainApiIndex ? 'selected' : ''}" onclick="setMainApi(${index})">
            <input type="radio" name="mainApi" value="${index}" ${index === mainApiIndex ? 'checked' : ''}>
            <div class="api-option-content">
                <span class="api-badge">${index === mainApiIndex ? '⭐ Main' : '🔗 Client'}</span>
                <strong>${spec.title}</strong>
                <small>${spec.operationCount} endpoints${spec.baseURL ? ' • ' + spec.baseURL : ''}</small>
            </div>
        </label>
    `).join('');
}

window.setMainApi = function(index) {
    mainApiIndex = index;
    renderMainApiSelector();
};

function renderHeaderConfig() {
    if (!headerConfigList) return;

    if (headerConfigs.length === 0) {
        headerConfigList.innerHTML = `
            <div class="no-headers-message" style="padding: 12px; color: #6B7280; text-align: center; font-style: italic;">
                No header parameters found in the uploaded specs.<br>
                <small>Use "Add Header" to manually add headers for propagation.</small>
            </div>
        `;
        return;
    }

    headerConfigList.innerHTML = headerConfigs.map((header, index) => `
        <div class="header-config-item">
            <label class="header-checkbox">
                <input type="checkbox" ${header.enabled ? 'checked' : ''} onchange="toggleHeader(${index}, this.checked)">
                <span class="header-name">${header.name}</span>
                ${header.extracted ? '<span class="header-badge">from spec</span>' : '<span class="header-badge custom">custom</span>'}
            </label>
            <input type="text" class="header-default" placeholder="Default value (optional)"
                   value="${header.defaultValue || ''}"
                   onchange="setHeaderDefault(${index}, this.value)">
            <button type="button" class="btn-remove" onclick="removeHeader(${index})" title="Remove">×</button>
        </div>
    `).join('');
}

window.toggleHeader = function(index, enabled) {
    headerConfigs[index].enabled = enabled;
};

window.setHeaderDefault = function(index, value) {
    headerConfigs[index].defaultValue = value;
};

window.removeHeader = function(index) {
    headerConfigs.splice(index, 1);
    renderHeaderConfig();
};

// Add custom header button
document.getElementById('addHeaderBtn')?.addEventListener('click', () => {
    const name = prompt('Enter header name:');
    if (name && name.trim()) {
        headerConfigs.push({
            name: name.trim(),
            enabled: true,
            description: 'Custom header',
            custom: true
        });
        renderHeaderConfig();
    }
});

// ============ SOURCE → TARGET MAPPINGS (1-to-1) ============

function renderSourceTargetMappings() {
    if (!sourceTargetMappingList) return;

    sourceTargetMappingList.innerHTML = sourceTargetMappings.map((mapping, index) => `
        <div class="endpoint-mapping-item">
            <div class="mapping-header">
                <input type="text" class="mapping-name-input" value="${mapping.name || ''}"
                       placeholder="Mapping name" onchange="updateSourceTargetName(${index}, this.value)">
                <button type="button" class="btn-remove" onclick="removeSourceTargetMapping(${index})">×</button>
            </div>
            <div class="mapping-row">
                <div class="mapping-source">
                    <label>Source Endpoint (caller)</label>
                    <select onchange="updateSourceTargetSource(${index}, this.value)">
                        <option value="">Select source endpoint...</option>
                        ${getEndpointsForSpec(0, mapping.sourceEndpoint)}
                    </select>
                </div>
                <span class="mapping-arrow">➡️</span>
                <div class="mapping-target">
                    <label>Target Endpoint (called)</label>
                    <select onchange="updateSourceTargetTarget(${index}, this.value)">
                        <option value="">Select target endpoint...</option>
                        ${getEndpointsForSpec(1, mapping.targetEndpoint)}
                    </select>
                </div>
            </div>
            <div class="mapping-defaults">
                <label>Default Values (stored in config file):</label>
                <div class="defaults-grid">
                    <input type="text" placeholder="Parameter name" value="${mapping.defaultParam || ''}"
                           onchange="updateSourceTargetDefault(${index}, 'param', this.value)">
                    <input type="text" placeholder="Default value" value="${mapping.defaultValue || ''}"
                           onchange="updateSourceTargetDefault(${index}, 'value', this.value)">
                </div>
            </div>
        </div>
    `).join('');

    if (sourceTargetMappings.length === 0) {
        sourceTargetMappingList.innerHTML = '<p class="empty-state">No source→target mappings. Click button below to add one.</p>';
    }
}

window.updateSourceTargetName = function(index, value) {
    sourceTargetMappings[index].name = value;
};

window.updateSourceTargetSource = function(index, value) {
    sourceTargetMappings[index].sourceEndpoint = value;
};

window.updateSourceTargetTarget = function(index, value) {
    sourceTargetMappings[index].targetEndpoint = value;
};

window.updateSourceTargetDefault = function(index, field, value) {
    if (field === 'param') sourceTargetMappings[index].defaultParam = value;
    if (field === 'value') sourceTargetMappings[index].defaultValue = value;
};

window.removeSourceTargetMapping = function(index) {
    sourceTargetMappings.splice(index, 1);
    renderSourceTargetMappings();
};

document.getElementById('addSourceTargetMappingBtn')?.addEventListener('click', () => {
    sourceTargetMappings.push({
        name: `source-target-${sourceTargetMappings.length + 1}`,
        sourceEndpoint: '',
        targetEndpoint: '',
        defaultParam: '',
        defaultValue: ''
    });
    renderSourceTargetMappings();
});

// ============ AGGREGATION MAPPINGS (many-to-1) ============

function renderAggregationMappings() {
    console.log('renderAggregationMappings called, aggregationMappingList:', aggregationMappingList);
    if (!aggregationMappingList) {
        console.log('aggregationMappingList is null!');
        return;
    }

    console.log('Rendering', aggregationMappings.length, 'mappings');

    aggregationMappingList.innerHTML = aggregationMappings.map((mapping, index) => {
        // Get combined headers, payload, and responses from selected endpoints
        const combined = getCombinedHeadersAndPayload(mapping.sourceEndpoints || []);
        const hasSelectedEndpoints = (mapping.sourceEndpoints || []).filter(ep => ep).length > 0;
        console.log('Mapping', index, 'hasSelectedEndpoints:', hasSelectedEndpoints, 'combined:', combined);

        return `
        <div class="aggregation-mapping-item">
            <div class="mapping-header">
                <input type="text" class="mapping-name-input" value="${mapping.name || ''}"
                       placeholder="Aggregation name" onchange="updateAggregationName(${index}, this.value)">
                <button type="button" class="btn-remove" onclick="removeAggregationMapping(${index})">×</button>
            </div>

            <div class="aggregation-sources">
                <label>Source Endpoints (to combine):</label>
                <div class="source-endpoints-list" id="sourceEndpoints-${index}">
                    ${(mapping.sourceEndpoints || []).map((ep, epIndex) => `
                        <div class="source-endpoint-item">
                            <select onchange="updateAggregationSource(${index}, ${epIndex}, this.value)">
                                <option value="">Select endpoint...</option>
                                ${getAllEndpointsOptions(ep)}
                            </select>
                            <button type="button" class="btn-remove-small" onclick="removeAggregationSource(${index}, ${epIndex})">×</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-add-source" onclick="addAggregationSource(${index})">+ Add Source Endpoint</button>
            </div>

            ${hasSelectedEndpoints ? `
            <div class="consolidation-preview">
                <div class="preview-header">
                    <span class="preview-icon">📋</span>
                    <label>Consolidated API Preview</label>
                    <span class="preview-badge">${combined.sourceCount} endpoints combined</span>
                </div>

                <!-- Source Endpoints Summary -->
                <div class="source-summary">
                    <div class="source-summary-title">Source Endpoints:</div>
                    <div class="source-list">
                        ${(mapping.sourceEndpoints || []).filter(ep => ep).map(ep => {
                            const [specIndexStr, method, ...pathParts] = ep.split(':');
                            const specIndex = parseInt(specIndexStr);
                            const spec = parsedSpecs[specIndex];
                            const specName = spec ? spec.title : 'Unknown';
                            return `<div class="source-item">
                                <span class="source-spec">${specName}</span>
                                <span class="source-method method-${method}">${method.toUpperCase()}</span>
                                <span class="source-path">${pathParts.join(':')}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Combined Request Preview -->
                <div class="preview-section request-preview">
                    <div class="preview-section-header">
                        <span class="section-icon">📤</span>
                        <strong>Consolidated Request</strong>
                        <span class="dedup-badge">Duplicates removed</span>
                    </div>

                    ${combined.headers.length > 0 ? `
                    <div class="preview-row">
                        <span class="preview-label">Headers:</span>
                        <div class="preview-content field-list">
                            ${combined.headers.map(h => `
                                <div class="field-item">
                                    <span class="param-chip header-chip">${h.name}${h.required ? ' *' : ''}</span>
                                    <span class="field-sources">→ ${h.sources ? h.sources.map(s => `<span class="source-tag">${s.split(':')[0]}</span>`).join(' ') : 'all'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${combined.queryParams.length > 0 ? `
                    <div class="preview-row">
                        <span class="preview-label">Query Params:</span>
                        <div class="preview-content field-list">
                            ${combined.queryParams.map(q => `
                                <div class="field-item">
                                    <span class="param-chip query-chip">${q.name}${q.required ? ' *' : ''}</span>
                                    <span class="field-sources">→ ${q.sources ? q.sources.map(s => `<span class="source-tag">${s.split(':')[0]}</span>`).join(' ') : 'all'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${combined.pathParams.length > 0 ? `
                    <div class="preview-row">
                        <span class="preview-label">Path Params:</span>
                        <div class="preview-content field-list">
                            ${combined.pathParams.map(p => `
                                <div class="field-item">
                                    <span class="param-chip path-chip">{${p.name}}</span>
                                    <span class="field-sources">→ ${p.sources ? p.sources.map(s => `<span class="source-tag">${s.split(':')[0]}</span>`).join(' ') : 'all'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${combined.payload.length > 0 ? `
                    <div class="preview-row">
                        <span class="preview-label">Request Body:</span>
                        <div class="preview-content field-list">
                            ${combined.payload.map(p => `
                                <div class="field-item">
                                    <span class="param-chip payload-chip">${p.name}: ${p.type || 'any'}${p.required ? ' *' : ''}</span>
                                    <span class="field-sources">→ ${p.sources ? p.sources.map(s => `<span class="source-tag">${s.split(':')[0]}</span>`).join(' ') : 'all'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Combined Response Preview -->
                <div class="preview-section response-preview">
                    <div class="preview-section-header">
                        <span class="section-icon">📥</span>
                        <strong>Consolidated Response</strong>
                        <span class="merge-badge">${mapping.mergeStrategy || 'combine'} strategy</span>
                    </div>
                    <div class="preview-row">
                        <span class="preview-label">Response Fields:</span>
                        <div class="preview-content field-list">
                            ${combined.responses.length > 0 ? combined.responses.map(r => `
                                <div class="field-item">
                                    <span class="param-chip response-chip">${r.name}: ${r.type || 'any'}</span>
                                    <span class="field-sources">← <span class="source-tag">${r.source ? r.source.split(':')[0] : 'merged'}</span></span>
                                </div>
                            `).join('') : '<div class="field-item"><span class="no-fields">Response fields will be merged from all sources</span></div>'}
                        </div>
                    </div>
                </div>

                <!-- Header Propagation Map -->
                <div class="preview-section header-propagation-preview">
                    <div class="preview-section-header">
                        <span class="section-icon">🔗</span>
                        <strong>Header Propagation Map</strong>
                    </div>
                    <div class="header-propagation-map">
                        <div class="propagation-intro">Headers from incoming request are forwarded to each client based on their requirements:</div>
                        ${buildHeaderPropagationMap(combined, mapping)}
                    </div>
                </div>

                <!-- Flow Diagram -->
                <div class="flow-diagram">
                    <div class="flow-title">Request Flow:</div>
                    <div class="flow-steps">
                        <div class="flow-step">
                            <span class="flow-icon">🌐</span>
                            <span>Client Request</span>
                        </div>
                        <span class="flow-arrow">→</span>
                        <div class="flow-step">
                            <span class="flow-icon">🔀</span>
                            <span>Aggregator</span>
                        </div>
                        <span class="flow-arrow">→</span>
                        <div class="flow-step parallel-calls">
                            <span class="flow-icon">${mapping.parallel !== false ? '⚡' : '📝'}</span>
                            <span>${mapping.parallel !== false ? 'Parallel' : 'Sequential'} Calls</span>
                            <small>(${combined.sourceCount} endpoints)</small>
                        </div>
                        <span class="flow-arrow">→</span>
                        <div class="flow-step">
                            <span class="flow-icon">🔄</span>
                            <span>Merge Response</span>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}

            <div class="mapping-arrow-down">⬇️ Consolidate into</div>

            <div class="aggregation-target">
                <label>Consolidated Endpoint:</label>
                <div class="consolidated-endpoint-config">
                    <select onchange="updateAggregationMethod(${index}, this.value)">
                        <option value="get" ${mapping.method === 'get' ? 'selected' : ''}>GET</option>
                        <option value="post" ${mapping.method === 'post' ? 'selected' : ''}>POST</option>
                        <option value="put" ${mapping.method === 'put' ? 'selected' : ''}>PUT</option>
                        <option value="delete" ${mapping.method === 'delete' ? 'selected' : ''}>DELETE</option>
                    </select>
                    <input type="text" placeholder="/api/aggregated/..." value="${mapping.consolidatedPath || ''}"
                           onchange="updateAggregationPath(${index}, this.value)">
                </div>
            </div>

            <div class="mapping-defaults">
                <label>Execution Configuration:</label>
                <div class="defaults-grid">
                    <select onchange="updateAggregationConfig(${index}, 'mergeStrategy', this.value)">
                        <option value="combine" ${mapping.mergeStrategy === 'combine' ? 'selected' : ''}>Combine (merge all fields)</option>
                        <option value="wrap" ${mapping.mergeStrategy === 'wrap' ? 'selected' : ''}>Wrap (keep separate)</option>
                        <option value="first" ${mapping.mergeStrategy === 'first' ? 'selected' : ''}>First success only</option>
                    </select>
                    <select onchange="updateAggregationConfig(${index}, 'parallel', this.value)">
                        <option value="true" ${mapping.parallel !== false ? 'selected' : ''}>Parallel execution</option>
                        <option value="false" ${mapping.parallel === false ? 'selected' : ''}>Sequential execution</option>
                    </select>
                </div>
            </div>

            ${hasSelectedEndpoints ? `
            <!-- Payload Merge Configuration -->
            <div class="payload-merge-section">
                <div class="payload-merge-header" onclick="togglePayloadMerge(${index})">
                    <span class="section-icon">🔀</span>
                    <strong>Payload Merge Configuration</strong>
                    <span class="toggle-icon">${mapping.showPayloadMerge ? '▼' : '▶'}</span>
                </div>

                <div class="payload-merge-content ${mapping.showPayloadMerge ? '' : 'hidden'}">
                    <!-- Request Payload Merge -->
                    <div class="merge-subsection">
                        <div class="merge-subsection-header">
                            <span class="subsection-icon">📤</span>
                            <strong>Request Payload Merge</strong>
                            <small>Configure how request fields from multiple sources are combined</small>
                        </div>
                        <div class="payload-fields-list">
                            ${combined.payload.length > 0 ? combined.payload.map((field, fIdx) => `
                                <div class="payload-field-config">
                                    <div class="field-info">
                                        <label class="field-checkbox">
                                            <input type="checkbox"
                                                   ${isFieldEnabled(mapping, 'request', field.name) ? 'checked' : ''}
                                                   onchange="togglePayloadField(${index}, 'request', '${field.name}', this.checked)">
                                            <span class="field-name">${field.name}</span>
                                            <span class="field-type">${field.type || 'any'}${field.required ? ' *' : ''}</span>
                                        </label>
                                        <div class="field-sources-info">
                                            Sources: ${field.sources ? field.sources.map(s => `<span class="source-tag">${s.split(':')[0]}</span>`).join(' ') : 'all'}
                                        </div>
                                    </div>
                                    <div class="field-mapping">
                                        <input type="text"
                                               class="rename-input"
                                               placeholder="Rename to (optional)"
                                               value="${getFieldRename(mapping, 'request', field.name) || ''}"
                                               onchange="setFieldRename(${index}, 'request', '${field.name}', this.value)">
                                        <select class="target-select" onchange="setFieldTarget(${index}, 'request', '${field.name}', this.value)">
                                            <option value="all" ${getFieldTarget(mapping, 'request', field.name) === 'all' ? 'selected' : ''}>→ All targets</option>
                                            ${(mapping.sourceEndpoints || []).filter(ep => ep).map((ep, epIdx) => {
                                                const [specIdx] = ep.split(':');
                                                const spec = parsedSpecs[parseInt(specIdx)];
                                                return `<option value="${ep}" ${getFieldTarget(mapping, 'request', field.name) === ep ? 'selected' : ''}>→ ${spec ? spec.title : 'Unknown'} only</option>`;
                                            }).join('')}
                                        </select>
                                    </div>
                                </div>
                            `).join('') : '<div class="no-fields-msg">No request body fields to configure</div>'}
                        </div>
                    </div>

                    <!-- Response Payload Merge -->
                    <div class="merge-subsection">
                        <div class="merge-subsection-header">
                            <span class="subsection-icon">📥</span>
                            <strong>Response Payload Merge</strong>
                            <small>Configure how response fields from multiple sources are merged</small>
                        </div>
                        <div class="payload-fields-list">
                            ${combined.responses.length > 0 ? combined.responses.map((field, fIdx) => `
                                <div class="payload-field-config response-field">
                                    <div class="field-info">
                                        <label class="field-checkbox">
                                            <input type="checkbox"
                                                   ${isFieldEnabled(mapping, 'response', field.name) ? 'checked' : ''}
                                                   onchange="togglePayloadField(${index}, 'response', '${field.name}', this.checked)">
                                            <span class="field-name">${field.name}</span>
                                            <span class="field-type">${field.type || 'any'}</span>
                                        </label>
                                        <div class="field-sources-info">
                                            Source: <span class="source-tag">${field.source ? field.source.split(':')[0] : 'merged'}</span>
                                        </div>
                                    </div>
                                    <div class="field-mapping">
                                        <input type="text"
                                               class="rename-input"
                                               placeholder="Rename to (optional)"
                                               value="${getFieldRename(mapping, 'response', field.name) || ''}"
                                               onchange="setFieldRename(${index}, 'response', '${field.name}', this.value)">
                                        <select class="conflict-select" onchange="setFieldConflict(${index}, '${field.name}', this.value)">
                                            <option value="merge" ${getFieldConflict(mapping, field.name) === 'merge' ? 'selected' : ''}>Merge if conflict</option>
                                            <option value="first" ${getFieldConflict(mapping, field.name) === 'first' ? 'selected' : ''}>Use first value</option>
                                            <option value="last" ${getFieldConflict(mapping, field.name) === 'last' ? 'selected' : ''}>Use last value</option>
                                            <option value="array" ${getFieldConflict(mapping, field.name) === 'array' ? 'selected' : ''}>Collect as array</option>
                                        </select>
                                    </div>
                                </div>
                            `).join('') : '<div class="no-fields-msg">No response fields to configure</div>'}
                        </div>
                    </div>

                    <!-- Merged Payload Preview -->
                    <div class="merge-preview-section">
                        <div class="merge-preview-header">
                            <span class="preview-icon">👁️</span>
                            <strong>Merged Payload Preview</strong>
                        </div>
                        <div class="merge-preview-grid">
                            <div class="preview-box request-preview-box">
                                <div class="preview-box-header">Request Body</div>
                                <pre class="preview-json">${JSON.stringify(buildMergedRequestPreview(combined, mapping), null, 2)}</pre>
                            </div>
                            <div class="preview-box response-preview-box">
                                <div class="preview-box-header">Response Body</div>
                                <pre class="preview-json">${JSON.stringify(buildMergedResponsePreview(combined, mapping), null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `}).join('');

    if (aggregationMappings.length === 0) {
        aggregationMappingList.innerHTML = '<p class="empty-state">No aggregation mappings. Click button below to combine multiple endpoints into one.</p>';
    }
}

// Build a preview JSON object for request payload
function buildPayloadPreview(payloadFields) {
    const preview = {};
    payloadFields.forEach(field => {
        if (field.type === 'array') {
            preview[field.name] = [];
        } else if (field.type === 'object') {
            preview[field.name] = {};
        } else if (field.type === 'integer' || field.type === 'number') {
            preview[field.name] = 0;
        } else if (field.type === 'boolean') {
            preview[field.name] = false;
        } else {
            preview[field.name] = `<${field.type || 'string'}>`;
        }
    });
    return preview;
}

// Build a preview JSON object for response (merged from all endpoints)
function buildResponsePreview(responses) {
    if (!responses || responses.length === 0) {
        return { data: {}, sources: [] };
    }

    const preview = {};
    responses.forEach(resp => {
        if (resp.fields) {
            resp.fields.forEach(field => {
                if (!preview[field.name]) {
                    preview[field.name] = `<${field.type || 'any'}>`;
                }
            });
        } else {
            preview[resp.name] = `<from ${resp.source}>`;
        }
    });

    return Object.keys(preview).length > 0 ? preview : { result: "<merged response>" };
}

// Build full request preview with all details
function buildFullRequestPreview(combined, mapping) {
    const request = {
        "_endpoint": `${(mapping.method || 'GET').toUpperCase()} ${mapping.consolidatedPath || '/api/aggregated'}`,
        "_description": `Consolidated from ${combined.sourceCount} source endpoint(s)`
    };

    // Add headers section
    if (combined.headers.length > 0) {
        request.headers = {};
        combined.headers.forEach(h => {
            request.headers[h.name] = h.required ? `<required: ${h.schema?.type || 'string'}>` : `<optional: ${h.schema?.type || 'string'}>`;
        });
    }

    // Add query params section
    if (combined.queryParams.length > 0) {
        request.queryParams = {};
        combined.queryParams.forEach(q => {
            request.queryParams[q.name] = q.required ? `<required>` : `<optional>`;
        });
    }

    // Add body section
    if (combined.payload.length > 0) {
        request.body = {};
        combined.payload.forEach(field => {
            let value;
            if (field.type === 'array') value = [];
            else if (field.type === 'object') value = {};
            else if (field.type === 'integer') value = 0;
            else if (field.type === 'number') value = 0.0;
            else if (field.type === 'boolean') value = false;
            else value = `<${field.type || 'string'}>`;

            request.body[field.name] = value;
            // Add comment about source
            if (field.sources && field.sources.length > 1) {
                request.body[`_${field.name}_from`] = `merged from ${field.sources.length} endpoints`;
            }
        });
    } else {
        request.body = null;
    }

    return request;
}

// Build header propagation map showing which headers go to which clients
function buildHeaderPropagationMap(combined, mapping) {
    const sourceEndpoints = (mapping.sourceEndpoints || []).filter(ep => ep);
    if (sourceEndpoints.length === 0) return '<div class="no-fields">Select endpoints to see header mapping</div>';

    // Group headers by which clients need them
    const clientHeaderMap = {};

    sourceEndpoints.forEach(ep => {
        const [specIndexStr, method, ...pathParts] = ep.split(':');
        const specIndex = parseInt(specIndexStr);
        const spec = parsedSpecs[specIndex];
        if (!spec) return;

        const clientName = spec.title;
        const endpointPath = pathParts.join(':');
        const operation = spec.operations?.find(op => op.method === method && op.path === endpointPath);

        if (!clientHeaderMap[clientName]) {
            clientHeaderMap[clientName] = { headers: [], endpoint: `${method.toUpperCase()} ${endpointPath}` };
        }

        // Get headers this operation needs
        (operation?.parameters || []).filter(p => p.in === 'header').forEach(h => {
            if (!clientHeaderMap[clientName].headers.find(x => x.name === h.name)) {
                clientHeaderMap[clientName].headers.push({
                    name: h.name,
                    required: h.required || false,
                    defaultValue: headerConfigs?.find(hc => hc.name.toLowerCase() === h.name.toLowerCase())?.defaultValue
                });
            }
        });
    });

    // Build HTML for the map
    let html = '<div class="client-header-grid">';

    Object.entries(clientHeaderMap).forEach(([clientName, data]) => {
        html += `
            <div class="client-header-card">
                <div class="client-header-title">
                    <span class="client-name">${clientName}</span>
                    <span class="client-endpoint">${data.endpoint}</span>
                </div>
                <div class="client-headers">
                    ${data.headers.length > 0 ? data.headers.map(h => `
                        <div class="header-mapping-item">
                            <span class="header-name">${h.name}${h.required ? ' *' : ''}</span>
                            ${h.defaultValue ? `<span class="header-default">default: "${h.defaultValue}"</span>` : ''}
                        </div>
                    `).join('') : '<span class="no-headers-needed">No headers required</span>'}
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

// Build full response preview based on merge strategy
function buildFullResponsePreview(combined, mapping) {
    const strategy = mapping.mergeStrategy || 'combine';
    const response = {
        "_mergeStrategy": strategy,
        "_sourceCount": combined.sourceCount
    };

    if (strategy === 'combine') {
        // All fields merged into single object
        response.data = {};
        if (combined.responses && combined.responses.length > 0) {
            combined.responses.forEach(resp => {
                response.data[resp.name] = `<${resp.type || 'any'}>`;
            });
        } else {
            response.data = { "_merged": "fields from all endpoints combined" };
        }
    } else if (strategy === 'wrap') {
        // Each source response wrapped separately
        response.results = [];
        (mapping.sourceEndpoints || []).filter(ep => ep).forEach((ep, idx) => {
            const [specIndexStr, method, ...pathParts] = ep.split(':');
            const specIndex = parseInt(specIndexStr);
            const spec = parsedSpecs[specIndex];
            response.results.push({
                source: spec ? spec.title : `endpoint_${idx + 1}`,
                endpoint: `${method.toUpperCase()} ${pathParts.join(':')}`,
                data: {}
            });
        });
    } else if (strategy === 'first') {
        // Only first successful response
        response.data = { "_note": "First successful response returned" };
    }

    response.metadata = {
        aggregatedAt: "<timestamp>",
        sourcesQueried: combined.sourceCount,
        executionMode: mapping.parallel !== false ? "parallel" : "sequential"
    };

    return response;
}

// Get combined headers and payload from selected endpoints (with duplicates removed)
function getCombinedHeadersAndPayload(sourceEndpoints) {
    const headersMap = new Map();
    const queryParamsMap = new Map();
    const pathParamsMap = new Map();
    const payloadMap = new Map();
    const responsesMap = new Map();
    let sourceCount = 0;

    // Safety check for undefined or non-array
    if (!sourceEndpoints || !Array.isArray(sourceEndpoints)) {
        return { headers: [], queryParams: [], pathParams: [], payload: [], responses: [], sourceCount: 0 };
    }

    sourceEndpoints.forEach(epValue => {
        if (!epValue) return;

        sourceCount++;

        // Parse endpoint value: "specIndex:method:path"
        const [specIndexStr, method, ...pathParts] = epValue.split(':');
        const specIndex = parseInt(specIndexStr);
        const path = pathParts.join(':'); // In case path has colons

        const spec = parsedSpecs[specIndex];
        if (!spec) return;

        const sourceName = `${spec.title}:${method.toUpperCase()} ${path}`;

        // Find the operation
        const operation = spec.operations?.find(op =>
            op.method === method && op.path === path
        );
        if (!operation) return;

        // Extract parameters
        (operation.parameters || []).forEach(param => {
            const key = param.name.toLowerCase();
            if (param.in === 'header') {
                if (!headersMap.has(key)) {
                    headersMap.set(key, {
                        name: param.name,
                        required: param.required || false,
                        description: param.description || '',
                        schema: param.schema,
                        sources: [sourceName]
                    });
                } else {
                    if (param.required) headersMap.get(key).required = true;
                    headersMap.get(key).sources.push(sourceName);
                }
            } else if (param.in === 'query') {
                if (!queryParamsMap.has(key)) {
                    queryParamsMap.set(key, {
                        name: param.name,
                        required: param.required || false,
                        description: param.description || '',
                        schema: param.schema,
                        sources: [sourceName]
                    });
                } else {
                    if (param.required) queryParamsMap.get(key).required = true;
                    queryParamsMap.get(key).sources.push(sourceName);
                }
            } else if (param.in === 'path') {
                if (!pathParamsMap.has(key)) {
                    pathParamsMap.set(key, {
                        name: param.name,
                        required: true,
                        description: param.description || '',
                        schema: param.schema,
                        sources: [sourceName]
                    });
                } else {
                    pathParamsMap.get(key).sources.push(sourceName);
                }
            }
        });

        // Extract request body fields
        if (operation.requestBody) {
            const content = operation.requestBody.content;
            const jsonContent = content?.['application/json'] || content?.['*/*'];
            if (jsonContent?.schema) {
                const schema = jsonContent.schema;
                if (schema.properties) {
                    Object.entries(schema.properties).forEach(([propName, propSchema]) => {
                        const key = propName.toLowerCase();
                        const isRequired = (schema.required || []).includes(propName);
                        if (!payloadMap.has(key)) {
                            payloadMap.set(key, {
                                name: propName,
                                type: propSchema.type || 'object',
                                required: isRequired,
                                description: propSchema.description || '',
                                sources: [sourceName]
                            });
                        } else {
                            if (isRequired) payloadMap.get(key).required = true;
                            payloadMap.get(key).sources.push(sourceName);
                        }
                    });
                } else if (schema.$ref) {
                    const refName = schema.$ref.split('/').pop();
                    if (!payloadMap.has(refName.toLowerCase())) {
                        payloadMap.set(refName.toLowerCase(), {
                            name: refName,
                            type: 'object',
                            required: operation.requestBody.required || false,
                            description: `Reference to ${refName}`,
                            sources: [sourceName]
                        });
                    }
                }
            }
        }

        // Extract response fields
        const responses = operation.responses || {};
        const successResponse = responses['200'] || responses['201'] || responses['default'];
        if (successResponse) {
            const respContent = successResponse.content;
            const jsonResp = respContent?.['application/json'] || respContent?.['*/*'];
            if (jsonResp?.schema) {
                const schema = jsonResp.schema;
                if (schema.properties) {
                    Object.entries(schema.properties).forEach(([propName, propSchema]) => {
                        const key = propName.toLowerCase();
                        if (!responsesMap.has(key)) {
                            responsesMap.set(key, {
                                name: propName,
                                type: propSchema.type || 'object',
                                source: sourceName
                            });
                        }
                    });
                } else if (schema.$ref) {
                    const refName = schema.$ref.split('/').pop();
                    responsesMap.set(refName.toLowerCase(), {
                        name: refName,
                        type: 'object',
                        source: sourceName
                    });
                } else if (schema.type) {
                    responsesMap.set(sourceName, {
                        name: `response_${sourceCount}`,
                        type: schema.type,
                        source: sourceName
                    });
                }
            }
        }
    });

    return {
        headers: Array.from(headersMap.values()),
        queryParams: Array.from(queryParamsMap.values()),
        pathParams: Array.from(pathParamsMap.values()),
        payload: Array.from(payloadMap.values()),
        responses: Array.from(responsesMap.values()),
        sourceCount
    };
}

function getAllEndpointsOptions(selectedEndpoint) {
    let options = '';
    parsedSpecs.forEach((spec, specIndex) => {
        spec.operations?.forEach(op => {
            const value = `${specIndex}:${op.method}:${op.path}`;
            const selected = selectedEndpoint === value ? 'selected' : '';
            options += `<option value="${value}" ${selected}>[${spec.title}] ${op.method.toUpperCase()} ${op.path}</option>`;
        });
    });
    return options;
}

function getEndpointsForSpec(specIndex, selectedEndpoint) {
    let options = '';
    const spec = parsedSpecs[specIndex];
    if (!spec) return options;

    spec.operations?.forEach(op => {
        const value = `${op.method}:${op.path}`;
        const selected = selectedEndpoint === value ? 'selected' : '';
        options += `<option value="${value}" ${selected}>${op.method.toUpperCase()} ${op.path}</option>`;
    });
    return options;
}

window.updateAggregationName = function(index, value) {
    aggregationMappings[index].name = value;
};

window.updateAggregationSource = function(mappingIndex, sourceIndex, value) {
    console.log('updateAggregationSource called:', mappingIndex, sourceIndex, value);
    aggregationMappings[mappingIndex].sourceEndpoints[sourceIndex] = value;
    console.log('Updated aggregationMappings:', JSON.stringify(aggregationMappings));
    // Re-render to show the consolidated preview with merged parameters
    renderAggregationMappings();
    console.log('renderAggregationMappings completed');
};

window.addAggregationSource = function(mappingIndex) {
    if (!aggregationMappings[mappingIndex].sourceEndpoints) {
        aggregationMappings[mappingIndex].sourceEndpoints = [];
    }
    aggregationMappings[mappingIndex].sourceEndpoints.push('');
    renderAggregationMappings();
};

window.removeAggregationSource = function(mappingIndex, sourceIndex) {
    aggregationMappings[mappingIndex].sourceEndpoints.splice(sourceIndex, 1);
    renderAggregationMappings();
};

window.updateAggregationMethod = function(index, value) {
    aggregationMappings[index].method = value;
    renderAggregationMappings();
};

window.updateAggregationPath = function(index, value) {
    aggregationMappings[index].consolidatedPath = value;
    renderAggregationMappings();
};

window.updateAggregationConfig = function(index, field, value) {
    aggregationMappings[index][field] = value;
};

// ============ PAYLOAD MERGE CONFIGURATION FUNCTIONS ============

// Toggle payload merge section visibility
window.togglePayloadMerge = function(index) {
    aggregationMappings[index].showPayloadMerge = !aggregationMappings[index].showPayloadMerge;
    renderAggregationMappings();
};

// Check if a field is enabled in the mapping
function isFieldEnabled(mapping, type, fieldName) {
    if (!mapping.fieldConfig) return true; // All enabled by default
    const config = mapping.fieldConfig[`${type}:${fieldName}`];
    return config ? config.enabled !== false : true;
}

// Get field rename value
function getFieldRename(mapping, type, fieldName) {
    if (!mapping.fieldConfig) return '';
    const config = mapping.fieldConfig[`${type}:${fieldName}`];
    return config?.rename || '';
}

// Get field target (for request fields)
function getFieldTarget(mapping, type, fieldName) {
    if (!mapping.fieldConfig) return 'all';
    const config = mapping.fieldConfig[`${type}:${fieldName}`];
    return config?.target || 'all';
}

// Get field conflict resolution strategy (for response fields)
function getFieldConflict(mapping, fieldName) {
    if (!mapping.fieldConfig) return 'merge';
    const config = mapping.fieldConfig[`response:${fieldName}`];
    return config?.conflict || 'merge';
}

// Toggle a payload field enabled/disabled
window.togglePayloadField = function(mappingIndex, type, fieldName, enabled) {
    if (!aggregationMappings[mappingIndex].fieldConfig) {
        aggregationMappings[mappingIndex].fieldConfig = {};
    }
    const key = `${type}:${fieldName}`;
    if (!aggregationMappings[mappingIndex].fieldConfig[key]) {
        aggregationMappings[mappingIndex].fieldConfig[key] = {};
    }
    aggregationMappings[mappingIndex].fieldConfig[key].enabled = enabled;
    renderAggregationMappings();
};

// Set field rename
window.setFieldRename = function(mappingIndex, type, fieldName, rename) {
    if (!aggregationMappings[mappingIndex].fieldConfig) {
        aggregationMappings[mappingIndex].fieldConfig = {};
    }
    const key = `${type}:${fieldName}`;
    if (!aggregationMappings[mappingIndex].fieldConfig[key]) {
        aggregationMappings[mappingIndex].fieldConfig[key] = {};
    }
    aggregationMappings[mappingIndex].fieldConfig[key].rename = rename;
    renderAggregationMappings();
};

// Set field target (which endpoint to send to)
window.setFieldTarget = function(mappingIndex, type, fieldName, target) {
    if (!aggregationMappings[mappingIndex].fieldConfig) {
        aggregationMappings[mappingIndex].fieldConfig = {};
    }
    const key = `${type}:${fieldName}`;
    if (!aggregationMappings[mappingIndex].fieldConfig[key]) {
        aggregationMappings[mappingIndex].fieldConfig[key] = {};
    }
    aggregationMappings[mappingIndex].fieldConfig[key].target = target;
    renderAggregationMappings();
};

// Set field conflict resolution
window.setFieldConflict = function(mappingIndex, fieldName, conflict) {
    if (!aggregationMappings[mappingIndex].fieldConfig) {
        aggregationMappings[mappingIndex].fieldConfig = {};
    }
    const key = `response:${fieldName}`;
    if (!aggregationMappings[mappingIndex].fieldConfig[key]) {
        aggregationMappings[mappingIndex].fieldConfig[key] = {};
    }
    aggregationMappings[mappingIndex].fieldConfig[key].conflict = conflict;
    renderAggregationMappings();
};

// Build merged request preview based on field configuration
function buildMergedRequestPreview(combined, mapping) {
    const preview = {};

    (combined.payload || []).forEach(field => {
        if (!isFieldEnabled(mapping, 'request', field.name)) return;

        const rename = getFieldRename(mapping, 'request', field.name);
        const fieldName = rename || field.name;
        const target = getFieldTarget(mapping, 'request', field.name);

        let value;
        if (field.type === 'array') {
            value = [];
        } else if (field.type === 'object') {
            value = {};
        } else if (field.type === 'integer' || field.type === 'number') {
            value = 0;
        } else if (field.type === 'boolean') {
            value = false;
        } else {
            value = `<${field.type || 'string'}>`;
        }

        // Add target annotation if not "all"
        if (target !== 'all') {
            const [specIdx] = target.split(':');
            const spec = parsedSpecs[parseInt(specIdx)];
            preview[`${fieldName} → ${spec?.title || 'target'}`] = value;
        } else {
            preview[fieldName] = value;
        }
    });

    return Object.keys(preview).length > 0 ? preview : { "_note": "No request body fields" };
}

// Build merged response preview based on field configuration
function buildMergedResponsePreview(combined, mapping) {
    const preview = {};

    (combined.responses || []).forEach(field => {
        if (!isFieldEnabled(mapping, 'response', field.name)) return;

        const rename = getFieldRename(mapping, 'response', field.name);
        const fieldName = rename || field.name;
        const conflict = getFieldConflict(mapping, field.name);

        let value;
        if (field.type === 'array' || conflict === 'array') {
            value = [`<${field.type || 'any'}>`];
        } else if (field.type === 'object') {
            value = {};
        } else {
            value = `<${field.type || 'any'}>`;
        }

        // Add conflict annotation
        if (conflict !== 'merge') {
            preview[`${fieldName} (${conflict})`] = value;
        } else {
            preview[fieldName] = value;
        }
    });

    return Object.keys(preview).length > 0 ? preview : { "_note": "Response fields will be merged" };
}

window.removeAggregationMapping = function(index) {
    aggregationMappings.splice(index, 1);
    renderAggregationMappings();
};

document.getElementById('addAggregationMappingBtn')?.addEventListener('click', () => {
    aggregationMappings.push({
        name: `aggregation-${aggregationMappings.length + 1}`,
        sourceEndpoints: ['', ''],  // Start with 2 source endpoints
        method: 'get',
        consolidatedPath: '/api/aggregated/',
        mergeStrategy: 'combine',
        parallel: true
    });
    renderAggregationMappings();
});

// Consolidation type change handler
consolidationTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const type = e.target.value;

        // Hide all config sections first
        mainClientConfig?.classList.add('hidden');
        sourceTargetConfig?.classList.add('hidden');
        aggregationConfig?.classList.add('hidden');

        // Show the relevant section
        if (type === 'main-client') {
            mainClientConfig?.classList.remove('hidden');
        } else if (type === 'source-target') {
            sourceTargetConfig?.classList.remove('hidden');
        } else if (type === 'aggregation') {
            aggregationConfig?.classList.remove('hidden');
        }
    });
});

// SDK type change handler
sdkTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateJavaOptionsVisibility);
});

function updateJavaOptionsVisibility() {
    const selectedType = document.querySelector('input[name="sdkType"]:checked')?.value;
    const javaTypes = ['quarkus-fullstack', 'spring-boot-client', 'quarkus-client'];

    if (javaTypes.includes(selectedType)) {
        javaOptions?.classList.remove('hidden');
    } else {
        javaOptions?.classList.add('hidden');
    }
}

updateJavaOptionsVisibility();

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Generate button click handler
generateBtn.addEventListener('click', async () => {
    console.log('Generate clicked. uploadedFiles:', uploadedFiles.length);

    if (uploadedFiles.length === 0) {
        showError('Please select an OpenAPI specification file');
        return;
    }

    const sdkType = document.querySelector('input[name="sdkType"]:checked')?.value;
    if (!sdkType) {
        showError('Please select an SDK type');
        return;
    }

    const consolidationType = document.querySelector('input[name="consolidationType"]:checked')?.value || 'main-client';
    const configFormat = document.getElementById('configFormat')?.value || 'auto';

    const options = {
        moduleName: moduleName.value || 'api',
        baseURL: baseURL.value || undefined,
        sdkType: sdkType,
        javaPackage: document.getElementById('packageName')?.value || 'com.example.api',
        groupId: document.getElementById('groupId')?.value || 'com.example',
        artifactId: document.getElementById('artifactId')?.value || 'api-service',
        javaVersion: document.getElementById('javaVersion')?.value || '21',
        consolidationType: consolidationType,
        consolidatedSpecName: document.getElementById('consolidatedSpecName')?.value || 'unified-api',
        downloadConsolidatedSpec: document.getElementById('downloadConsolidatedSpec')?.checked,
        mainApiIndex: mainApiIndex,
        headerConfigs: headerConfigs.filter(h => h.enabled),
        sourceTargetMappings: sourceTargetMappings,
        aggregationMappings: aggregationMappings,
        configFormat: configFormat
    };

    console.log('Options:', options);

    if (uploadedFiles.length === 1) {
        await generateSingleSDK(uploadedFiles[0], options);
    } else {
        await generateConsolidatedSDK(uploadedFiles, options);
    }
});

async function generateSingleSDK(file, options) {
    hideMessages();
    showProgress('Reading file...', 10);
    generateBtn.disabled = true;

    try {
        const content = await file.text();
        showProgress('Parsing OpenAPI specification...', 20);

        const generator = new window.SDKGenerator();
        const parsedAPI = await generator.parseOpenAPISpec(content, file.name, options.baseURL);

        await generateAndDownload(generator, parsedAPI, options);
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'An error occurred');
        generateBtn.disabled = false;
    }
}

async function generateConsolidatedSDK(files, options) {
    console.log('generateConsolidatedSDK with', files.length, 'files');

    hideMessages();
    showProgress('Reading files...', 5);
    generateBtn.disabled = true;

    try {
        const generator = new window.SDKGenerator();

        if (parsedSpecs.length === 0 || parsedSpecs.length !== files.length) {
            await parseUploadedSpecs(files);
        }

        console.log('Parsed specs:', parsedSpecs.length);

        showProgress('Consolidating specifications...', 20);

        const zip = new JSZip();
        const mainSpec = parsedSpecs[options.mainApiIndex];
        const clientSpecs = parsedSpecs.filter((_, idx) => idx !== options.mainApiIndex);

        if (options.consolidationType === 'aggregation') {
            await generateAggregatedSDK(generator, zip, options);
        } else {
            await generateMainClientSDK(generator, zip, mainSpec, clientSpecs, options);
        }

        // Generate configuration file
        const configContent = generateConfigFile(options);
        const configFileName = getConfigFileName(options);
        zip.file(configFileName, configContent);

        // Optionally add consolidated spec
        console.log('downloadConsolidatedSpec:', options.downloadConsolidatedSpec);
        console.log('consolidationType:', options.consolidationType);
        console.log('aggregationMappings:', options.aggregationMappings);

        if (options.downloadConsolidatedSpec) {
            console.log('Building consolidated spec...');
            const mergedSpec = mergeSpecs(parsedSpecs, options);
            // Build the raw spec and add consolidated endpoints
            const rawSpec = buildRawSpec(mergedSpec, options);
            console.log('Raw spec paths BEFORE adding consolidated:', Object.keys(rawSpec.paths));

            // Add consolidated endpoints from aggregation mappings
            if (options.consolidationType === 'aggregation' && options.aggregationMappings?.length > 0) {
                console.log('Adding consolidated endpoints from', options.aggregationMappings.length, 'mappings');
                addConsolidatedEndpointsToSpec(rawSpec, options.aggregationMappings);
                console.log('Raw spec paths AFTER adding consolidated:', Object.keys(rawSpec.paths));
            } else {
                console.log('NOT adding consolidated - type:', options.consolidationType, 'mappings:', options.aggregationMappings?.length);
            }

            const specYaml = jsyaml.dump(rawSpec);
            zip.file(`${options.consolidatedSpecName}.yaml`, specYaml);
            console.log('Added', options.consolidatedSpecName + '.yaml to zip');
        } else {
            console.log('downloadConsolidatedSpec is not checked');
        }

        // ALWAYS add consolidated spec for aggregation mode - ONLY consolidated endpoints
        if (options.consolidationType === 'aggregation' && options.aggregationMappings?.length > 0) {
            console.log('Creating unified-api.yaml with ONLY consolidated endpoints');

            // Create a spec with ONLY the consolidated endpoints (not the source endpoints)
            const consolidatedOnlySpec = {
                openapi: '3.0.3',
                info: {
                    title: options.consolidatedSpecName || 'Unified API',
                    version: '1.0.0',
                    description: 'Aggregated API combining multiple source endpoints into consolidated endpoints'
                },
                paths: {},
                components: { schemas: {} }
            };

            // Add ONLY the consolidated endpoints
            addConsolidatedEndpointsToSpec(consolidatedOnlySpec, options.aggregationMappings);

            const specYaml = jsyaml.dump(consolidatedOnlySpec);
            zip.file('unified-api.yaml', specYaml);
            console.log('Created unified-api.yaml with ONLY consolidated paths:', Object.keys(consolidatedOnlySpec.paths));
        }

        await downloadZip(zip, options);
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'An error occurred');
        generateBtn.disabled = false;
    }
}

async function generateMainClientSDK(generator, zip, mainSpec, clientSpecs, options) {
    showProgress('Generating main service...', 30);

    if (options.sdkType === 'quarkus-fullstack') {
        // Backend
        const backendFiles = await generator.generateQuarkus(mainSpec.parsed, {
            packageName: options.javaPackage,
            groupId: options.groupId,
            artifactId: options.artifactId,
            javaVersion: options.javaVersion
        });

        const backendFolder = zip.folder('unified-service/backend');
        for (const [filename, content] of Object.entries(backendFiles)) {
            backendFolder.file(filename, content);
        }

        // Client SDKs
        for (let i = 0; i < clientSpecs.length; i++) {
            const clientSpec = clientSpecs[i];
            showProgress(`Generating client for ${clientSpec.title}...`, 40 + i * 15);

            const clientName = sanitizeName(clientSpec.title);
            const clientFiles = await generator.generateQuarkusClient(clientSpec.parsed, {
                packageName: options.javaPackage + '.clients.' + clientName,
                groupId: options.groupId,
                artifactId: options.artifactId + '-' + clientName + '-client',
                javaVersion: options.javaVersion
            });

            const clientFolder = zip.folder(`unified-service/clients/${clientName}-client`);
            for (const [filename, content] of Object.entries(clientFiles)) {
                clientFolder.file(filename, content);
            }
        }

        // Orchestration service with header propagation
        const orchestrationCode = generateOrchestrationService(mainSpec, clientSpecs, options);
        const orchestrationPath = `unified-service/backend/src/main/java/${options.javaPackage.replace(/\./g, '/')}/orchestration`;
        zip.folder(orchestrationPath).file('OrchestrationService.java', orchestrationCode);
        zip.folder(orchestrationPath).file('HeaderPropagationFilter.java', generateHeaderFilter(options));

        // README
        zip.file('unified-service/README.md', generateReadme(mainSpec, clientSpecs, options));

    } else if (options.sdkType === 'react') {
        // Merge all specs for React SDK
        const mergedSpec = mergeSpecs(parsedSpecs, options);
        const sdkFiles = await generator.generateSDK(mergedSpec, options.moduleName);
        const folder = zip.folder('react-sdk');
        for (const [filename, content] of Object.entries(sdkFiles)) {
            folder.file(filename, content);
        }
    } else {
        // Other SDK types - generate for main spec
        await generateStandardSDK(generator, zip, mainSpec.parsed, options);
    }
}

async function generateAggregatedSDK(generator, zip, options) {
    showProgress('Building aggregated endpoints...', 30);

    // Build consolidated spec from mappings
    const consolidatedSpec = buildConsolidatedSpec(options);

    showProgress(`Generating ${options.sdkType} SDK...`, 50);

    if (options.sdkType === 'quarkus-fullstack') {
        const basePath = options.javaPackage.replace(/\./g, '/');
        const srcMainJava = `aggregator-service/src/main/java/${basePath}`;

        // 1. Generate pom.xml and basic project structure
        showProgress('Generating project structure...', 40);
        const pomContent = generateAggregatorPom(options);
        zip.file('aggregator-service/pom.xml', pomContent);

        // 2. Generate Client interfaces INSIDE src/main/java
        showProgress('Generating client interfaces...', 50);
        const clientsGenerated = new Set();

        for (const spec of parsedSpecs) {
            const clientName = sanitizeName(spec.title);
            if (clientsGenerated.has(clientName)) continue;
            clientsGenerated.add(clientName);

            // Generate client interface and models inside src
            const clientCode = generateClientInterface(spec, clientName, options);
            zip.folder(`${srcMainJava}/client`).file(`${capitalize(clientName)}Client.java`, clientCode);

            // Generate client models
            const modelsCode = generateClientModels(spec, clientName, options);
            if (modelsCode) {
                zip.folder(`${srcMainJava}/client/model`).file(`${capitalize(clientName)}Models.java`, modelsCode);
            }
        }

        // 3. Generate EndpointAggregator Resource (REST endpoint that calls all clients)
        showProgress('Generating aggregator resource...', 65);
        const aggregatorCode = generateAggregatorResource(options);
        zip.folder(`${srcMainJava}/resource`).file('EndpointAggregator.java', aggregatorCode);

        // 4. Generate Header Propagation Factory (implements ClientHeadersFactory)
        showProgress('Configuring header propagation...', 75);
        const headerFactoryCode = generateAggregationHeaderFilter(options);
        zip.folder(`${srcMainJava}/service`).file('HeaderPropagationFactory.java', headerFactoryCode);

        // 5. Generate Request/Response DTOs
        showProgress('Generating DTOs...', 80);
        const dtoCode = generateAggregationDTOs(options);
        zip.folder(`${srcMainJava}/dto`).file('AggregatedDTO.java', dtoCode);

        // 6. Generate application.properties
        const propsContent = generateAggregationProperties(options);
        zip.file('aggregator-service/src/main/resources/application.properties', propsContent);

        // 7. Generate README
        zip.file('aggregator-service/README.md', generateAggregationReadme(options));

    } else {
        await generateStandardSDK(generator, zip, consolidatedSpec, options);
    }
}

function buildConsolidatedSpec(options) {
    const operations = [];
    const schemas = [];

    // Get the appropriate mappings based on consolidation type
    const endpointMappings = options.consolidationType === 'aggregation'
        ? (options.aggregationMappings || [])
        : (options.sourceTargetMappings || []);

    console.log('Building consolidated spec with mappings:', endpointMappings);

    // Build operations from endpoint mappings
    endpointMappings.forEach(mapping => {
        // Handle both source-target (single endpoint) and aggregation (multiple endpoints) mappings
        const hasSource = mapping.sourceEndpoint || (mapping.sourceEndpoints && mapping.sourceEndpoints.length > 0);
        const hasTarget = mapping.targetEndpoint || mapping.consolidatedPath;

        if (mapping.consolidatedPath && hasSource) {
            // For aggregation, use the mapping's method; for source-target, extract from source
            let method = mapping.method || 'get';
            if (mapping.sourceEndpoint) {
                const [sourceMethod] = mapping.sourceEndpoint.split(':');
                method = sourceMethod;
            }

            // Merge parameters from all source endpoints
            const mergedParams = mergeSourceEndpointParameters(mapping.sourceEndpoints || [mapping.sourceEndpoint]);

            // Merge request body fields from all source endpoints
            const mergedRequestBody = mergeSourceEndpointRequestBodies(mapping.sourceEndpoints || [mapping.sourceEndpoint]);

            // Merge responses from all source endpoints
            const mergedResponses = mergeSourceEndpointResponses(mapping.sourceEndpoints || [mapping.sourceEndpoint], mapping);

            const operation = {
                method: method,
                path: mapping.consolidatedPath,
                operationId: `consolidated_${sanitizeName(mapping.name || 'endpoint')}`,
                summary: `Consolidated: ${mapping.name || 'Aggregated Endpoint'}`,
                description: buildAggregatedDescription(mapping),
                tags: ['Consolidated', 'Aggregator'],
                parameters: mergedParams,
                responses: mergedResponses,
                sourceMapping: mapping,
                'x-consolidation': {
                    type: '2-to-1',
                    sources: (mapping.sourceEndpoints || []).filter(ep => ep).map(ep => {
                        const [specIdx, epMethod, ...pathParts] = ep.split(':');
                        const spec = parsedSpecs[parseInt(specIdx)];
                        return {
                            client: spec?.title || 'Unknown',
                            endpoint: `${epMethod?.toUpperCase()} ${pathParts.join(':')}`
                        };
                    }),
                    execution: mapping.parallel ? 'parallel' : 'sequential'
                }
            };

            // Add request body if present
            if (mergedRequestBody) {
                operation.requestBody = mergedRequestBody;
            }

            operations.push(operation);
            console.log('Added consolidated operation:', operation.path, 'with', mergedParams.length, 'params');
        }
    });

    // Collect all schemas from all specs
    const schemaNames = new Set();
    parsedSpecs.forEach(spec => {
        spec.parsed?.schemas?.forEach(schema => {
            if (!schemaNames.has(schema.name)) {
                schemaNames.add(schema.name);
                schemas.push(schema);
            }
        });
    });

    return {
        info: { title: options.consolidatedSpecName, version: '1.0.0' },
        baseURL: parsedSpecs[0]?.baseURL,
        operations,
        schemas
    };
}

// Merge parameters from multiple source endpoints
function mergeSourceEndpointParameters(sourceEndpoints) {
    const paramMap = new Map();

    sourceEndpoints.filter(ep => ep).forEach(ep => {
        const [specIndexStr, method, ...pathParts] = ep.split(':');
        const specIndex = parseInt(specIndexStr);
        const spec = parsedSpecs[specIndex];
        if (!spec) return;

        const endpointPath = pathParts.join(':');
        const operation = spec.operations?.find(op =>
            op.method === method && op.path === endpointPath
        );
        if (!operation) return;

        const sourceName = spec.title || `Spec${specIndex}`;

        // Add all parameters from this endpoint
        (operation.parameters || []).forEach(param => {
            const key = `${param.in}:${param.name}`;
            if (!paramMap.has(key)) {
                paramMap.set(key, {
                    ...param,
                    description: `${param.description || param.name} (from ${sourceName})`,
                    'x-source': sourceName
                });
            } else {
                // Merge: combine required status
                const existing = paramMap.get(key);
                existing.required = existing.required || param.required;
                existing['x-sources'] = existing['x-sources'] || [existing['x-source']];
                if (!existing['x-sources'].includes(sourceName)) {
                    existing['x-sources'].push(sourceName);
                }
            }
        });
    });

    return Array.from(paramMap.values());
}

// Merge request bodies from multiple source endpoints
function mergeSourceEndpointRequestBodies(sourceEndpoints) {
    const properties = {};
    const required = [];
    let hasBody = false;

    sourceEndpoints.filter(ep => ep).forEach(ep => {
        const [specIndexStr, method, ...pathParts] = ep.split(':');
        const specIndex = parseInt(specIndexStr);
        const spec = parsedSpecs[specIndex];
        if (!spec) return;

        const endpointPath = pathParts.join(':');
        const operation = spec.operations?.find(op =>
            op.method === method && op.path === endpointPath
        );
        if (!operation?.requestBody) return;

        hasBody = true;
        const sourceName = spec.title || `Spec${specIndex}`;
        const bodyContent = operation.requestBody.content?.['application/json'];
        const schema = bodyContent?.schema;

        if (schema?.properties) {
            Object.entries(schema.properties).forEach(([name, prop]) => {
                if (!properties[name]) {
                    properties[name] = {
                        ...prop,
                        description: `${prop.description || name} (from ${sourceName})`
                    };
                }
            });
        }
        if (schema?.required) {
            schema.required.forEach(r => {
                if (!required.includes(r)) required.push(r);
            });
        }
    });

    if (!hasBody) return null;

    return {
        description: 'Consolidated request body from multiple endpoints',
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

// Merge responses from multiple source endpoints
function mergeSourceEndpointResponses(sourceEndpoints, mapping) {
    const responseProperties = {
        success: { type: 'boolean', description: 'Whether the consolidated operation succeeded' },
        timestamp: { type: 'string', format: 'date-time', description: 'Response timestamp' }
    };

    sourceEndpoints.filter(ep => ep).forEach(ep => {
        const [specIndexStr, method, ...pathParts] = ep.split(':');
        const specIndex = parseInt(specIndexStr);
        const spec = parsedSpecs[specIndex];
        if (!spec) return;

        const endpointPath = pathParts.join(':');
        const operation = spec.operations?.find(op =>
            op.method === method && op.path === endpointPath
        );
        if (!operation?.responses) return;

        const sourceName = sanitizeName(spec.title || `Spec${specIndex}`);
        const successResponse = operation.responses['200'] || operation.responses['201'];

        if (successResponse?.content?.['application/json']?.schema) {
            responseProperties[`${sourceName}Data`] = {
                type: 'object',
                description: `Response from ${spec.title} (${method.toUpperCase()} ${endpointPath})`,
                ...successResponse.content['application/json'].schema
            };
        } else {
            responseProperties[`${sourceName}Data`] = {
                type: 'object',
                description: `Response from ${spec.title} (${method.toUpperCase()} ${endpointPath})`
            };
        }
    });

    return {
        '200': {
            description: 'Successful consolidated response',
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: responseProperties
                    }
                }
            }
        },
        '400': { description: 'Bad Request' },
        '500': { description: 'Internal Server Error' }
    };
}

// Build description for aggregated endpoint
function buildAggregatedDescription(mapping) {
    const sources = (mapping.sourceEndpoints || []).filter(ep => ep);
    let desc = `**Aggregated Endpoint**\n\nThis endpoint consolidates ${sources.length} API calls:\n`;

    sources.forEach((ep, idx) => {
        const [specIndexStr, method, ...pathParts] = ep.split(':');
        const specIndex = parseInt(specIndexStr);
        const spec = parsedSpecs[specIndex];
        desc += `${idx + 1}. \`${method?.toUpperCase()} ${pathParts.join(':')}\` (${spec?.title || 'Unknown'})\n`;
    });

    desc += `\nExecution: ${mapping.parallel ? 'parallel' : 'sequential'}\n`;
    desc += `Merge strategy: ${mapping.mergeStrategy || 'combine'}`;

    return desc;
}

function generateConfigFile(options) {
    const format = options.configFormat === 'auto'
        ? (options.sdkType.includes('quarkus') || options.sdkType.includes('spring') ? 'properties' : 'json')
        : options.configFormat;

    // Get the appropriate mappings based on consolidation type
    const endpointMappings = options.consolidationType === 'aggregation'
        ? (options.aggregationMappings || [])
        : (options.sourceTargetMappings || []);

    const config = {
        // Header propagation config
        headers: {
            propagate: (options.headerConfigs || []).map(h => ({
                name: h.name,
                defaultValue: h.defaultValue || null
            }))
        },
        // Endpoint mappings
        mappings: endpointMappings.map(m => ({
            name: m.name,
            source: m.sourceEndpoint || (m.sourceEndpoints || []).join(','),
            target: m.targetEndpoint || m.consolidatedPath,
            path: m.consolidatedPath
        })),
        // Client configs
        clients: parsedSpecs.filter((_, i) => i !== options.mainApiIndex).map(spec => ({
            name: sanitizeName(spec.title),
            baseUrl: spec.baseURL || '${' + sanitizeName(spec.title).toUpperCase() + '_BASE_URL}'
        }))
    };

    if (format === 'properties') {
        return generatePropertiesFormat(config, options);
    } else if (format === 'yaml') {
        return jsyaml.dump(config);
    } else {
        return JSON.stringify(config, null, 2);
    }
}

function generatePropertiesFormat(config, options) {
    let props = `# Generated Configuration for ${options.consolidatedSpecName}\n`;
    props += `# SDK Type: ${options.sdkType}\n\n`;

    // Header propagation
    props += `# Header Propagation\n`;
    config.headers.propagate.forEach((h, i) => {
        props += `header.propagate[${i}].name=${h.name}\n`;
        if (h.defaultValue) {
            props += `header.propagate[${i}].default=${h.defaultValue}\n`;
        }
    });
    props += '\n';

    // Client base URLs
    props += `# Client Service URLs\n`;
    config.clients.forEach(client => {
        props += `client.${client.name}.base-url=${client.baseUrl}\n`;
    });
    props += '\n';

    // Endpoint mappings
    if (config.mappings.length > 0) {
        props += `# Endpoint Mappings\n`;
        config.mappings.forEach((m, i) => {
            props += `mapping[${i}].name=${m.name}\n`;
            props += `mapping[${i}].path=${m.path}\n`;
            props += `mapping[${i}].source=${m.source}\n`;
            props += `mapping[${i}].target=${m.target}\n`;
        });
    }

    return props;
}

function getConfigFileName(options) {
    const format = options.configFormat === 'auto'
        ? (options.sdkType.includes('quarkus') || options.sdkType.includes('spring') ? 'properties' : 'json')
        : options.configFormat;

    switch (format) {
        case 'properties': return 'application-consolidation.properties';
        case 'yaml': return 'consolidation-config.yaml';
        default: return 'consolidation-config.json';
    }
}

function generateOrchestrationService(mainSpec, clientSpecs, options) {
    const pkg = options.javaPackage;
    const clientImports = clientSpecs.map(spec => {
        const name = sanitizeName(spec.title);
        return `import ${pkg}.clients.${name}.api.*;`;
    }).join('\n');

    const clientInjections = clientSpecs.map(spec => {
        const name = sanitizeName(spec.title);
        const className = capitalize(name) + 'Api';
        return `    @Inject\n    @RestClient\n    ${className} ${name}Client;`;
    }).join('\n\n');

    return `package ${pkg}.orchestration;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Context;
import java.util.Map;
import java.util.HashMap;

${clientImports}

@ApplicationScoped
public class OrchestrationService {

    @Context
    HttpHeaders headers;

${clientInjections}

    /**
     * Get headers to propagate to downstream services.
     * Configured headers: ${(options.headerConfigs || []).map(h => h.name).join(', ')}
     */
    public Map<String, String> getPropagatedHeaders() {
        Map<String, String> propagated = new HashMap<>();

${(options.headerConfigs || []).map(h => `        // ${h.name}${h.defaultValue ? ' (default: ' + h.defaultValue + ')' : ''}
        String ${sanitizeVarName(h.name)} = headers.getHeaderString("${h.name}");
        if (${sanitizeVarName(h.name)} != null) {
            propagated.put("${h.name}", ${sanitizeVarName(h.name)});
        }${h.defaultValue ? ` else {
            propagated.put("${h.name}", "${h.defaultValue}");
        }` : ''}`).join('\n\n')}

        return propagated;
    }
}
`;
}

function generateHeaderFilter(options) {
    const pkg = options.javaPackage;
    return `package ${pkg}.orchestration;

import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.client.ClientRequestFilter;
import jakarta.ws.rs.ext.Provider;
import jakarta.inject.Inject;
import java.io.IOException;

@Provider
public class HeaderPropagationFilter implements ClientRequestFilter {

    @Inject
    OrchestrationService orchestrationService;

    @Override
    public void filter(ClientRequestContext requestContext) throws IOException {
        orchestrationService.getPropagatedHeaders().forEach((name, value) -> {
            requestContext.getHeaders().add(name, value);
        });
    }
}
`;
}

function generateAggregatorService(options) {
    // This is now replaced by generateAggregatorResource
    return '';
}

// Generate pom.xml for the aggregator service
function generateAggregatorPom(options) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${options.groupId}</groupId>
    <artifactId>${options.artifactId}-aggregator</artifactId>
    <version>1.0.0-SNAPSHOT</version>

    <properties>
        <maven.compiler.source>${options.javaVersion}</maven.compiler.source>
        <maven.compiler.target>${options.javaVersion}</maven.compiler.target>
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
            <artifactId>quarkus-resteasy-reactive</artifactId>
        </dependency>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-resteasy-reactive-jackson</artifactId>
        </dependency>

        <!-- REST Client for calling other services -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest-client-reactive</artifactId>
        </dependency>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest-client-reactive-jackson</artifactId>
        </dependency>

        <!-- Health checks -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-smallrye-health</artifactId>
        </dependency>

        <!-- OpenAPI -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-smallrye-openapi</artifactId>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-junit5</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>io.quarkus.platform</groupId>
                <artifactId>quarkus-maven-plugin</artifactId>
                <version>\${quarkus.platform.version}</version>
                <executions>
                    <execution>
                        <goals>
                            <goal>build</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
`;
}

// Generate REST Client interface for a spec
function generateClientInterface(spec, clientName, options) {
    const pkg = options.javaPackage;
    const className = capitalize(clientName) + 'Client';
    const operations = spec.operations || [];

    // Generate method signatures for each operation
    // Note: Header parameters are NOT included since they're auto-propagated via @RegisterClientHeaders
    const methods = operations.map(op => {
        const methodName = sanitizeVarName(op.operationId || `${op.method}${op.path.replace(/[^a-zA-Z0-9]/g, '')}`);
        const httpMethod = op.method.toUpperCase();
        const path = op.path;

        // Generate parameters (excluding headers - they're auto-propagated)
        const params = [];

        // Path parameters
        (op.parameters || []).filter(p => p.in === 'path').forEach(p => {
            params.push(`@PathParam("${p.name}") ${getJavaType(p.schema)} ${sanitizeVarName(p.name)}`);
        });

        // Query parameters
        (op.parameters || []).filter(p => p.in === 'query').forEach(p => {
            params.push(`@QueryParam("${p.name}") ${getJavaType(p.schema)} ${sanitizeVarName(p.name)}`);
        });

        // Header parameters are automatically propagated via @RegisterClientHeaders
        // No @HeaderParam annotations needed

        // Request body
        if (op.requestBody) {
            params.push(`Object requestBody`);
        }

        return `
    /**
     * ${op.summary || op.operationId || methodName}
     */
    @${httpMethod}
    @Path("${path}")
    Object ${methodName}(${params.join(', ')});`;
    }).join('\n');

    return `package ${pkg}.client;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.eclipse.microprofile.rest.client.annotation.RegisterClientHeaders;
import ${pkg}.service.HeaderPropagationFactory;

/**
 * REST Client for ${spec.title || clientName}
 * Base URL configured in application.properties: quarkus.rest-client.${clientName}.url
 *
 * Headers are automatically propagated via HeaderPropagationFactory
 */
@Path("/")
@RegisterRestClient(configKey = "${clientName}")
@RegisterClientHeaders(HeaderPropagationFactory.class)
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface ${className} {
${methods}
}
`;
}

// Generate model classes for a client
function generateClientModels(spec, clientName, options) {
    const pkg = options.javaPackage;
    const schemas = spec.parsed?.schemas || [];

    if (schemas.length === 0) return null;

    const modelClasses = schemas.map(schema => {
        const className = capitalize(sanitizeVarName(schema.name));
        const fields = Object.entries(schema.properties || {}).map(([name, prop]) => {
            return `        private ${getJavaType(prop)} ${sanitizeVarName(name)};`;
        }).join('\n');

        return `
    /**
     * ${schema.description || schema.name}
     */
    public static class ${className} {
${fields || '        // No properties defined'}

        // Getters and setters omitted for brevity
    }`;
    }).join('\n');

    return `package ${pkg}.client.model;

import java.util.List;
import java.util.Map;

/**
 * Model classes for ${spec.title || clientName} client
 */
public class ${capitalize(clientName)}Models {
${modelClasses}
}
`;
}

// Generate the main EndpointAggregator Resource
function generateAggregatorResource(options) {
    const pkg = options.javaPackage;
    const mappings = options.aggregationMappings || [];

    // Generate client injections
    const clientInjections = parsedSpecs.map(spec => {
        const clientName = sanitizeName(spec.title);
        const className = capitalize(clientName) + 'Client';
        return `    @Inject
    @RestClient
    ${className} ${clientName}Client;`;
    }).join('\n\n');

    const clientImports = parsedSpecs.map(spec => {
        const clientName = sanitizeName(spec.title);
        return `import ${pkg}.client.${capitalize(clientName)}Client;`;
    }).join('\n');

    // Generate endpoint methods
    const endpointMethods = mappings.map(mapping => {
        const methodName = sanitizeVarName(mapping.name || 'aggregate');
        const httpMethod = (mapping.method || 'get').toUpperCase();
        const path = mapping.consolidatedPath || '/aggregated';
        const combined = getCombinedHeadersAndPayload(mapping.sourceEndpoints || []);
        const isParallel = mapping.parallel !== false;

        // Generate parameters
        const params = [];

        // Header parameters
        combined.headers.forEach(h => {
            params.push(`@HeaderParam("${h.name}") String ${sanitizeVarName(h.name)}`);
        });

        // Query parameters
        combined.queryParams.forEach(q => {
            params.push(`@QueryParam("${q.name}") String ${sanitizeVarName(q.name)}`);
        });

        // Path parameters
        combined.pathParams.forEach(p => {
            params.push(`@PathParam("${p.name}") String ${sanitizeVarName(p.name)}`);
        });

        const paramString = params.length > 0 ? '\n            ' + params.join(',\n            ') : '';

        // Generate client calls for each source endpoint
        const clientCalls = (mapping.sourceEndpoints || []).filter(ep => ep).map((ep, idx) => {
            const [specIndexStr, method, ...pathParts] = ep.split(':');
            const specIndex = parseInt(specIndexStr);
            const spec = parsedSpecs[specIndex];
            if (!spec) return '';

            const clientName = sanitizeName(spec.title);
            const endpointPath = pathParts.join(':');

            // Find the operation to get the method name
            const operation = spec.operations?.find(op => op.method === method && op.path === endpointPath);
            const opMethodName = operation ?
                sanitizeVarName(operation.operationId || `${method}${endpointPath.replace(/[^a-zA-Z0-9]/g, '')}`) :
                `call${idx + 1}`;

            if (isParallel) {
                return `            // Call ${spec.title}: ${method.toUpperCase()} ${endpointPath}
            CompletableFuture<Object> future${idx + 1} = CompletableFuture.supplyAsync(() -> {
                try {
                    return ${clientName}Client.${opMethodName}(${generateClientCallParams(operation, combined)});
                } catch (Exception e) {
                    log.error("Error calling ${clientName}", e);
                    return Map.of("error", e.getMessage(), "source", "${clientName}");
                }
            });
            futures.add(future${idx + 1});`;
            } else {
                return `            // Call ${spec.title}: ${method.toUpperCase()} ${endpointPath}
            try {
                Object result${idx + 1} = ${clientName}Client.${opMethodName}(${generateClientCallParams(operation, combined)});
                results.put("${clientName}", result${idx + 1});
            } catch (Exception e) {
                log.error("Error calling ${clientName}", e);
                results.put("${clientName}_error", e.getMessage());
            }`;
            }
        }).join('\n\n');

        const mergeStrategy = mapping.mergeStrategy || 'combine';

        if (isParallel) {
            return `
    /**
     * Aggregated endpoint: ${mapping.name || 'aggregated'}
     * Combines ${combined.sourceCount} source endpoints in PARALLEL
     * Merge strategy: ${mergeStrategy}
     *
     * Note: Headers are automatically propagated via @RegisterClientHeaders
     */
    @${httpMethod}
    @Path("${path}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response ${methodName}(${paramString}) {
        log.info("Aggregating ${combined.sourceCount} endpoints for ${mapping.name || path}");

        List<CompletableFuture<Object>> futures = new ArrayList<>();

${clientCalls}

        // Wait for all calls to complete
        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

            Map<String, Object> results = new LinkedHashMap<>();
            for (int i = 0; i < futures.size(); i++) {
                results.put("source_" + (i + 1), futures.get(i).get());
            }

            return Response.ok(${mergeStrategy === 'combine' ? 'mergeResults(results)' : mergeStrategy === 'wrap' ? 'wrapResults(results)' : 'results'})
                .build();
        } catch (Exception e) {
            log.error("Aggregation failed", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(Map.of("error", e.getMessage()))
                .build();
        }
    }`;
        } else {
            return `
    /**
     * Aggregated endpoint: ${mapping.name || 'aggregated'}
     * Combines ${combined.sourceCount} source endpoints SEQUENTIALLY
     * Merge strategy: ${mergeStrategy}
     *
     * Note: Headers are automatically propagated via @RegisterClientHeaders
     */
    @${httpMethod}
    @Path("${path}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response ${methodName}(${paramString}) {
        log.info("Aggregating ${combined.sourceCount} endpoints sequentially for ${mapping.name || path}");

        Map<String, Object> results = new LinkedHashMap<>();

${clientCalls}

        return Response.ok(${mergeStrategy === 'combine' ? 'mergeResults(results)' : mergeStrategy === 'wrap' ? 'wrapResults(results)' : 'results'})
            .build();
    }`;
        }
    }).join('\n');

    return `package ${pkg}.resource;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.util.*;
import java.util.concurrent.CompletableFuture;

${clientImports}

/**
 * EndpointAggregator Resource
 *
 * This resource exposes consolidated API endpoints that aggregate
 * responses from multiple backend services.
 *
 * Headers are automatically propagated to all clients via @RegisterClientHeaders(HeaderPropagationFactory.class)
 *
 * Generated from ${mappings.length} aggregation mapping(s)
 */
@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class EndpointAggregator {

    private static final Logger log = Logger.getLogger(EndpointAggregator.class);

${clientInjections}

${endpointMethods}

    /**
     * Merge all results into a single flat object (combine strategy)
     */
    private Map<String, Object> mergeResults(Map<String, Object> results) {
        Map<String, Object> merged = new LinkedHashMap<>();
        merged.put("_aggregated", true);
        merged.put("_sourceCount", results.size());

        for (Map.Entry<String, Object> entry : results.entrySet()) {
            if (entry.getValue() instanceof Map) {
                merged.putAll((Map<String, Object>) entry.getValue());
            } else {
                merged.put(entry.getKey(), entry.getValue());
            }
        }

        merged.put("_metadata", Map.of(
            "aggregatedAt", java.time.Instant.now().toString(),
            "sources", results.keySet()
        ));

        return merged;
    }

    /**
     * Wrap each result separately (wrap strategy)
     */
    private Map<String, Object> wrapResults(Map<String, Object> results) {
        Map<String, Object> wrapped = new LinkedHashMap<>();
        wrapped.put("_aggregated", true);
        wrapped.put("results", results);
        wrapped.put("_metadata", Map.of(
            "aggregatedAt", java.time.Instant.now().toString(),
            "sourceCount", results.size()
        ));
        return wrapped;
    }
}
`;
}

// Helper to generate client call parameters
// Note: Header params are NOT passed here since they're auto-propagated via @RegisterClientHeaders
function generateClientCallParams(operation, combined) {
    if (!operation) return '';

    const params = [];

    // Add path params
    (operation.parameters || []).filter(p => p.in === 'path').forEach(p => {
        const varName = sanitizeVarName(p.name);
        // Check if this param exists in combined params
        const exists = combined.pathParams.find(cp => cp.name.toLowerCase() === p.name.toLowerCase());
        params.push(exists ? varName : 'null');
    });

    // Add query params
    (operation.parameters || []).filter(p => p.in === 'query').forEach(p => {
        const varName = sanitizeVarName(p.name);
        const exists = combined.queryParams.find(cp => cp.name.toLowerCase() === p.name.toLowerCase());
        params.push(exists ? varName : 'null');
    });

    // Header params are automatically propagated via @RegisterClientHeaders(HeaderPropagationFactory.class)
    // No need to pass them explicitly

    // Add request body if needed
    if (operation.requestBody) {
        params.push('null');
    }

    return params.join(', ');
}

// Helper to get Java type from OpenAPI schema
function getJavaType(schema) {
    if (!schema) return 'Object';

    switch (schema.type) {
        case 'string':
            if (schema.format === 'date') return 'java.time.LocalDate';
            if (schema.format === 'date-time') return 'java.time.Instant';
            return 'String';
        case 'integer':
            if (schema.format === 'int64') return 'Long';
            return 'Integer';
        case 'number':
            if (schema.format === 'float') return 'Float';
            return 'Double';
        case 'boolean':
            return 'Boolean';
        case 'array':
            return 'List<Object>';
        case 'object':
            return 'Map<String, Object>';
        default:
            if (schema.$ref) {
                return schema.$ref.split('/').pop();
            }
            return 'Object';
    }
}

function generateReadme(mainSpec, clientSpecs, options) {
    return `# ${options.consolidatedSpecName}

## Overview
This project consolidates ${parsedSpecs.length} API specifications.

## Structure
- \`backend/\` - Main service (${mainSpec?.title || 'Main'})
${(clientSpecs || []).map(s => `- \`clients/${sanitizeName(s.title)}-client/\` - Client for ${s.title}`).join('\n')}

## Configuration
See \`${getConfigFileName(options)}\` for:
- Header propagation settings
- Client service URLs
- Endpoint mappings

## Header Propagation
The following headers are automatically propagated:
${(options.headerConfigs || []).map(h => `- \`${h.name}\`${h.defaultValue ? ` (default: ${h.defaultValue})` : ''}`).join('\n')}

## Getting Started
\`\`\`bash
cd backend
./mvnw quarkus:dev
\`\`\`
`;
}

// ============ AGGREGATION SDK GENERATORS ============

function generateAggregationResource(options) {
    const pkg = options.javaPackage;
    const mappings = options.aggregationMappings || [];

    // Generate client injections for all specs
    const clientInjections = parsedSpecs.map(spec => {
        const name = sanitizeName(spec.title);
        const className = capitalize(name) + 'Api';
        return `    @Inject
    @RestClient
    ${className} ${name}Client;`;
    }).join('\n\n');

    const clientImports = parsedSpecs.map(spec => {
        const name = sanitizeName(spec.title);
        return `import ${pkg}.clients.${name}.api.${capitalize(name)}Api;`;
    }).join('\n');

    // Generate endpoint methods
    const endpointMethods = mappings.map(mapping => {
        const methodName = sanitizeVarName(mapping.name || 'aggregate');
        const httpMethod = (mapping.method || 'get').toUpperCase();
        const path = mapping.consolidatedPath || '/aggregated';
        const combined = getCombinedHeadersAndPayload(mapping.sourceEndpoints || []);
        const isParallel = mapping.parallel !== false;

        // Generate header params
        const headerParams = combined.headers.map(h =>
            `@HeaderParam("${h.name}") String ${sanitizeVarName(h.name)}`
        ).join(',\n            ');

        // Generate query params
        const queryParams = combined.queryParams.map(q =>
            `@QueryParam("${q.name}") String ${sanitizeVarName(q.name)}`
        ).join(',\n            ');

        // Generate method parameters
        const allParams = [headerParams, queryParams].filter(p => p).join(',\n            ');

        // Generate client calls
        const clientCalls = (mapping.sourceEndpoints || []).filter(ep => ep).map((ep, idx) => {
            const [specIndexStr, method, ...pathParts] = ep.split(':');
            const specIndex = parseInt(specIndexStr);
            const spec = parsedSpecs[specIndex];
            if (!spec) return '';
            const clientName = sanitizeName(spec.title);
            return `            // Call ${clientName}: ${method.toUpperCase()} ${pathParts.join(':')}
            CompletableFuture<Object> call${idx + 1} = CompletableFuture.supplyAsync(() ->
                ${clientName}Client./* TODO: add method call */());`;
        }).join('\n\n');

        return `
    /**
     * Aggregated endpoint: ${mapping.name}
     * Combines ${combined.sourceCount} source endpoints
     * Execution: ${isParallel ? 'Parallel' : 'Sequential'}
     */
    @${httpMethod}
    @Path("${path}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response ${methodName}(${allParams ? '\n            ' + allParams : ''}) {
        try {
            // Propagate headers to downstream calls
            Map<String, String> headers = headerPropagation.getPropagatedHeaders();

${clientCalls}

            // Wait for all calls and merge results
            Map<String, Object> result = new HashMap<>();
            // TODO: Implement result merging based on strategy: ${mapping.mergeStrategy || 'combine'}

            return Response.ok(result).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(Map.of("error", e.getMessage()))
                .build();
        }
    }`;
    }).join('\n');

    return `package ${pkg}.resource;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.CompletableFuture;

${clientImports}
import ${pkg}.filter.HeaderPropagationService;

/**
 * Aggregated API Resource
 * Auto-generated from ${mappings.length} aggregation mapping(s)
 */
@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AggregatedResource {

${clientInjections}

    @Inject
    HeaderPropagationService headerPropagation;

${endpointMethods}
}
`;
}

function generateAggregationHeaderFilter(options) {
    const pkg = options.javaPackage;
    const mappings = options.aggregationMappings || [];
    const globalDefaults = options.headerConfigs || [];

    // Collect all unique headers needed by all clients from their specs
    const clientHeaderRequirements = {};
    const allHeadersSet = new Set();

    mappings.forEach(mapping => {
        (mapping.sourceEndpoints || []).filter(ep => ep).forEach(ep => {
            const [specIndexStr, method, ...pathParts] = ep.split(':');
            const specIndex = parseInt(specIndexStr);
            const spec = parsedSpecs[specIndex];
            if (!spec) return;

            const clientName = sanitizeName(spec.title);
            const endpointPath = pathParts.join(':');
            const operation = spec.operations?.find(op => op.method === method && op.path === endpointPath);

            if (!clientHeaderRequirements[clientName]) {
                clientHeaderRequirements[clientName] = new Set();
            }

            (operation?.parameters || []).filter(p => p.in === 'header').forEach(h => {
                clientHeaderRequirements[clientName].add(h.name);
                allHeadersSet.add(h.name);
            });
        });
    });

    // Generate client-specific header maps
    const clientHeaderMaps = Object.entries(clientHeaderRequirements).map(([clientName, headers]) => {
        const headerList = Array.from(headers).map(h => `"${h}"`).join(', ');
        return `        CLIENT_HEADERS.put("${clientName}", new HashSet<>(Arrays.asList(${headerList || ''})));`;
    }).join('\n');

    // Generate default values map from global config
    const defaultValuesMap = globalDefaults.filter(h => h.defaultValue).map(h =>
        `        DEFAULT_VALUES.put("${h.name}", "${h.defaultValue}");`
    ).join('\n');

    // All unique headers
    const allHeaders = Array.from(allHeadersSet).map(h => `"${h}"`).join(', ');

    // Build comments showing which client needs which headers
    const clientHeaderComments = Object.entries(clientHeaderRequirements).map(([clientName, headers]) => {
        const headerList = Array.from(headers).join(', ');
        return ` *   - ${clientName}: ${headerList || 'none'}`;
    }).join('\n');

    return `package ${pkg}.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.ext.ClientHeadersFactory;

import java.util.*;

/**
 * Header Propagation Factory for REST Clients.
 *
 * This factory propagates headers from incoming requests to outgoing client calls.
 * Headers to propagate are derived from each client's OpenAPI spec.
 *
 * Client header requirements (from specs):
${clientHeaderComments || ' *   No headers found in specs'}
 *
 * Usage: Applied via @RegisterClientHeaders(HeaderPropagationFactory.class)
 */
@ApplicationScoped
public class HeaderPropagationFactory implements ClientHeadersFactory {

    /**
     * Headers to propagate (derived from all client OpenAPI specs)
     */
    private static final Set<String> HEADERS_TO_PROPAGATE = new HashSet<>(Arrays.asList(
        ${allHeaders || '// No headers found in specs'}
    ));

    /**
     * Default values for headers when not provided in request
     */
    private static final Map<String, String> DEFAULT_VALUES = new HashMap<>();

    static {
${defaultValuesMap || '        // No default values configured'}
    }

    @Inject
    @ConfigProperty(name = "header.propagation.enabled", defaultValue = "true")
    boolean propagationEnabled;

    @Override
    public MultivaluedMap<String, String> update(
            MultivaluedMap<String, String> incomingHeaders,
            MultivaluedMap<String, String> clientOutgoingHeaders) {

        MultivaluedMap<String, String> result = new MultivaluedHashMap<>();
        result.putAll(clientOutgoingHeaders);

        if (!propagationEnabled) {
            return result;
        }

        for (String headerName : HEADERS_TO_PROPAGATE) {
            String value = getFirst(incomingHeaders, headerName);

            if (value != null && !value.isEmpty()) {
                result.add(headerName, value);
            } else if (DEFAULT_VALUES.containsKey(headerName)) {
                result.add(headerName, DEFAULT_VALUES.get(headerName));
            }
        }

        return result;
    }

    private String getFirst(MultivaluedMap<String, String> headers, String headerName) {
        String value = headers.getFirst(headerName);
        if (value != null) return value;

        for (String key : headers.keySet()) {
            if (key.equalsIgnoreCase(headerName)) {
                return headers.getFirst(key);
            }
        }
        return null;
    }
}
`;
}

function generateAggregationDTOs(options) {
    const pkg = options.javaPackage;
    const mappings = options.aggregationMappings || [];

    // Generate request/response DTOs for each mapping
    const dtos = mappings.map(mapping => {
        const className = capitalize(sanitizeVarName(mapping.name || 'Aggregated'));
        const combined = getCombinedHeadersAndPayload(mapping.sourceEndpoints || []);

        // Request DTO fields
        const requestFields = combined.payload.map(f =>
            `    private ${mapTypeToJava(f.type)} ${sanitizeVarName(f.name)};`
        ).join('\n');

        // Response DTO fields
        const responseFields = combined.responses.map(r =>
            `    private ${mapTypeToJava(r.type)} ${sanitizeVarName(r.name)};`
        ).join('\n');

        return `
    /**
     * Request DTO for ${mapping.name}
     */
    public static class ${className}Request {
${requestFields || '        // No request body fields'}

        // Getters and setters
    }

    /**
     * Response DTO for ${mapping.name}
     */
    public static class ${className}Response {
${responseFields || '        private Object data;'}
        private Map<String, Object> metadata = new HashMap<>();

        // Getters and setters
    }`;
    }).join('\n');

    return `package ${pkg}.dto;

import java.util.Map;
import java.util.HashMap;
import java.util.List;

/**
 * Data Transfer Objects for Aggregated Endpoints
 */
public class AggregatedDTO {
${dtos}
}
`;
}

function generateAggregationProperties(options) {
    const headers = options.headerConfigs || [];
    const mappings = options.aggregationMappings || [];

    let props = `# Aggregation Service Configuration
# Generated for: ${options.consolidatedSpecName}

# ===========================================
# Header Propagation Configuration
# ===========================================
`;

    headers.forEach((h, i) => {
        props += `aggregation.header[${i}].name=${h.name}\n`;
        props += `aggregation.header[${i}].enabled=true\n`;
        if (h.defaultValue) {
            props += `aggregation.header[${i}].default=${h.defaultValue}\n`;
        }
    });

    props += `\n# ===========================================
# Client Service URLs
# ===========================================
`;

    parsedSpecs.forEach(spec => {
        const name = sanitizeName(spec.title);
        const baseUrl = spec.baseURL || 'http://localhost:8080';
        props += `quarkus.rest-client.${name}.url=${baseUrl}\n`;
        props += `quarkus.rest-client.${name}.scope=jakarta.inject.Singleton\n`;
    });

    props += `\n# ===========================================
# Aggregation Mappings
# ===========================================
`;

    mappings.forEach((m, i) => {
        props += `aggregation.mapping[${i}].name=${m.name || 'mapping-' + i}\n`;
        props += `aggregation.mapping[${i}].path=${m.consolidatedPath || '/aggregated'}\n`;
        props += `aggregation.mapping[${i}].method=${m.method || 'get'}\n`;
        props += `aggregation.mapping[${i}].parallel=${m.parallel !== false}\n`;
        props += `aggregation.mapping[${i}].merge-strategy=${m.mergeStrategy || 'combine'}\n`;
        const sources = (m.sourceEndpoints || []).filter(ep => ep).join(',');
        props += `aggregation.mapping[${i}].sources=${sources}\n`;
    });

    return props;
}

function generateAggregationReadme(options) {
    const mappings = options.aggregationMappings || [];
    const headers = options.headerConfigs || [];

    const mappingDocs = mappings.map(m => {
        const combined = getCombinedHeadersAndPayload(m.sourceEndpoints || []);
        return `
### ${m.name || 'Aggregated Endpoint'}
- **Path:** \`${m.consolidatedPath || '/api/aggregated'}\`
- **Method:** \`${(m.method || 'GET').toUpperCase()}\`
- **Execution:** ${m.parallel !== false ? 'Parallel' : 'Sequential'}
- **Merge Strategy:** ${m.mergeStrategy || 'combine'}
- **Source Endpoints:** ${combined.sourceCount}
- **Combined Headers:** ${combined.headers.map(h => h.name).join(', ') || 'None'}
- **Combined Query Params:** ${combined.queryParams.map(q => q.name).join(', ') || 'None'}
`;
    }).join('\n');

    return `# ${options.consolidatedSpecName} - Aggregation Service

## Overview
This service aggregates ${mappings.length} endpoint mapping(s) from ${parsedSpecs.length} source API(s).

## Architecture

\`\`\`
                    ┌─────────────────────┐
                    │   Client Request    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Aggregated Resource │
                    │  (AggregatedResource)│
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Client 1 │    │ Client 2 │    │ Client N │
        └──────────┘    └──────────┘    └──────────┘
\`\`\`

## Aggregated Endpoints
${mappingDocs}

## Header Propagation
The following headers are automatically propagated to all downstream service calls:
${headers.map(h => `- \`${h.name}\`${h.defaultValue ? ` (default: ${h.defaultValue})` : ''}`).join('\n')}

## Project Structure
\`\`\`
aggregator-service/
├── src/main/java/${options.javaPackage.replace(/\./g, '/')}/
│   ├── resource/
│   │   └── AggregatedResource.java    # REST endpoints
│   ├── aggregator/
│   │   └── EndpointAggregator.java    # Business logic
│   ├── filter/
│   │   └── HeaderPropagationService.java  # Header management
│   └── dto/
│       └── AggregatedDTO.java         # Request/Response objects
├── clients/                           # Generated client SDKs
│   ${parsedSpecs.map(s => `├── ${sanitizeName(s.title)}-client/`).join('\n│   ')}
└── src/main/resources/
    └── application.properties         # Configuration
\`\`\`

## Getting Started

1. Configure client URLs in \`application.properties\`
2. Run the service:
   \`\`\`bash
   ./mvnw quarkus:dev
   \`\`\`
3. Access endpoints at \`http://localhost:8080/api/...\`

## Configuration
See \`application.properties\` for:
- Client service URLs
- Header propagation settings
- Aggregation mapping configuration
`;
}

function mapTypeToJava(type) {
    switch (type) {
        case 'string': return 'String';
        case 'integer': return 'Integer';
        case 'number': return 'Double';
        case 'boolean': return 'Boolean';
        case 'array': return 'List<Object>';
        case 'object': return 'Map<String, Object>';
        default: return 'Object';
    }
}

async function generateStandardSDK(generator, zip, parsedAPI, options) {
    if (options.sdkType === 'react') {
        const sdkFiles = await generator.generateSDK(parsedAPI, options.moduleName);
        const folder = zip.folder('react-sdk');
        for (const [filename, content] of Object.entries(sdkFiles)) {
            folder.file(filename, content);
        }
    } else if (options.sdkType === 'quarkus-fullstack') {
        const backendFiles = await generator.generateQuarkus(parsedAPI, {
            packageName: options.javaPackage,
            groupId: options.groupId,
            artifactId: options.artifactId,
            javaVersion: options.javaVersion
        });
        for (const [filename, content] of Object.entries(backendFiles)) {
            zip.file(filename, content);
        }
    } else if (options.sdkType === 'spring-boot-client') {
        const clientFiles = await generator.generateSpringBootClient(parsedAPI, {
            packageName: options.javaPackage,
            groupId: options.groupId,
            artifactId: options.artifactId + '-client',
            javaVersion: options.javaVersion
        });
        for (const [filename, content] of Object.entries(clientFiles)) {
            zip.file(filename, content);
        }
    } else if (options.sdkType === 'quarkus-client') {
        const clientFiles = await generator.generateQuarkusClient(parsedAPI, {
            packageName: options.javaPackage,
            groupId: options.groupId,
            artifactId: options.artifactId + '-client',
            javaVersion: options.javaVersion
        });
        for (const [filename, content] of Object.entries(clientFiles)) {
            zip.file(filename, content);
        }
    }
}

async function generateAndDownload(generator, parsedAPI, options) {
    showProgress(`Generating ${options.sdkType} SDK...`, 40);
    const zip = new JSZip();
    await generateStandardSDK(generator, zip, parsedAPI, options);
    await downloadZip(zip, options);
}

function mergeSpecs(specs, options) {
    const merged = {
        info: { title: options.consolidatedSpecName, version: '1.0.0' },
        baseURL: specs[0]?.parsed?.baseURL,
        operations: [],
        schemas: [],
        tags: []
    };

    const schemaNames = new Set();
    specs.forEach((spec, idx) => {
        if (!spec.parsed) return;
        spec.parsed.operations?.forEach(op => {
            merged.operations.push({ ...op, sourceSpec: spec.filename, sourceSpecIndex: idx });
        });
        spec.parsed.schemas?.forEach(schema => {
            if (!schemaNames.has(schema.name)) {
                schemaNames.add(schema.name);
                merged.schemas.push(schema);
            }
        });
    });

    return merged;
}

function buildRawSpec(parsedAPI, options) {
    const paths = {};
    parsedAPI.operations?.forEach(op => {
        if (!paths[op.path]) paths[op.path] = {};
        paths[op.path][op.method] = {
            operationId: op.operationId,
            summary: op.summary,
            tags: op.tags,
            parameters: op.parameters,
            requestBody: op.requestBody,
            responses: op.responses || { '200': { description: 'Success' } }
        };

        // Add x-consolidation if present
        if (op['x-consolidation']) {
            paths[op.path][op.method]['x-consolidation'] = op['x-consolidation'];
        }
    });

    return {
        openapi: '3.0.3',
        info: parsedAPI.info,
        paths,
        components: { schemas: {} }
    };
}

/**
 * Add consolidated endpoints from aggregation mappings to the OpenAPI spec
 */
function addConsolidatedEndpointsToSpec(spec, aggregationMappings) {
    console.log('Adding consolidated endpoints to spec:', aggregationMappings.length);

    aggregationMappings.forEach(mapping => {
        const path = mapping.consolidatedPath;
        const method = (mapping.method || 'get').toLowerCase();

        if (!path) return;

        // Get combined data from source endpoints
        const combined = getCombinedHeadersAndPayload(mapping.sourceEndpoints || []);

        // Build parameters array
        const parameters = [];

        // Add header parameters
        combined.headers.forEach(h => {
            parameters.push({
                name: h.name,
                in: 'header',
                required: h.required || false,
                description: h.description || `Header from ${h.sources?.join(', ') || 'source'}`,
                schema: h.schema || { type: 'string' }
            });
        });

        // Add query parameters
        combined.queryParams.forEach(q => {
            parameters.push({
                name: q.name,
                in: 'query',
                required: q.required || false,
                description: q.description || `Query param from ${q.sources?.join(', ') || 'source'}`,
                schema: q.schema || { type: 'string' }
            });
        });

        // Add path parameters
        combined.pathParams.forEach(p => {
            parameters.push({
                name: p.name,
                in: 'path',
                required: true,
                description: p.description || `Path param from ${p.sources?.join(', ') || 'source'}`,
                schema: p.schema || { type: 'string' }
            });
        });

        // Build request body if there are payload fields
        let requestBody = undefined;
        if (combined.payload.length > 0) {
            const properties = {};
            const required = [];

            combined.payload.forEach(p => {
                properties[p.name] = {
                    type: p.type || 'string',
                    description: p.description || `Field from ${p.sources?.join(', ') || 'source'}`
                };
                if (p.required) {
                    required.push(p.name);
                }
            });

            requestBody = {
                description: 'Consolidated request body',
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

        // Build response schema
        const responseProperties = {
            success: { type: 'boolean', description: 'Operation success status' },
            timestamp: { type: 'string', format: 'date-time' }
        };

        // Add response fields from sources
        combined.responses.forEach(r => {
            responseProperties[r.name] = {
                type: r.type || 'object',
                description: r.description || `Response from ${r.source || 'source'}`
            };
        });

        // Add source data wrappers
        (mapping.sourceEndpoints || []).filter(ep => ep).forEach(ep => {
            const [specIndexStr, epMethod, ...pathParts] = ep.split(':');
            const specIndex = parseInt(specIndexStr);
            const specData = parsedSpecs[specIndex];
            if (specData) {
                const sourceName = sanitizeName(specData.title || `source${specIndex}`);
                responseProperties[`${sourceName}Data`] = {
                    type: 'object',
                    description: `Response data from ${specData.title} (${epMethod.toUpperCase()} ${pathParts.join(':')})`
                };
            }
        });

        // Build the consolidated endpoint
        const endpoint = {
            operationId: `consolidated_${sanitizeName(mapping.name || path)}`,
            summary: `Consolidated: ${mapping.name || 'Aggregated Endpoint'}`,
            description: buildAggregatedDescription(mapping),
            tags: ['Consolidated', 'Aggregator'],
            parameters: parameters.length > 0 ? parameters : undefined,
            requestBody: requestBody,
            responses: {
                '200': {
                    description: 'Successful consolidated response',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: responseProperties
                            }
                        }
                    }
                },
                '400': { description: 'Bad Request' },
                '500': { description: 'Internal Server Error' }
            },
            'x-consolidation': {
                type: '2-to-1',
                sources: (mapping.sourceEndpoints || []).filter(ep => ep).map(ep => {
                    const [specIdx, epMethod, ...pathParts] = ep.split(':');
                    const specData = parsedSpecs[parseInt(specIdx)];
                    return {
                        client: specData?.title || 'Unknown',
                        endpoint: `${epMethod?.toUpperCase()} ${pathParts.join(':')}`
                    };
                }),
                execution: mapping.parallel !== false ? 'parallel' : 'sequential',
                mergeStrategy: mapping.mergeStrategy || 'combine'
            }
        };

        // Add to spec paths
        if (!spec.paths[path]) {
            spec.paths[path] = {};
        }
        spec.paths[path][method] = endpoint;

        console.log('Added consolidated endpoint:', method.toUpperCase(), path);
    });
}

async function downloadZip(zip, options) {
    showProgress('Creating ZIP archive...', 80);

    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });

    showProgress('Downloading...', 95);

    const url = window.URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${options.moduleName}-${options.sdkType}-sdk.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showProgress('Complete!', 100);

    setTimeout(() => {
        progressContainer.classList.add('hidden');
        successContainer.classList.remove('hidden');
        generateBtn.disabled = false;
        setTimeout(() => successContainer.classList.add('hidden'), 5000);
    }, 500);
}

// Utility functions
function sanitizeName(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sanitizeVarName(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showProgress(text, percent) {
    progressContainer.classList.remove('hidden');
    progressBar.style.width = percent + '%';
    progressText.textContent = text;
}

function showError(message) {
    hideMessages();
    errorContainer.classList.remove('hidden');
    errorText.textContent = message;
}

function hideMessages() {
    progressContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
    successContainer.classList.add('hidden');
}

// CSS for new UI elements
const style = document.createElement('style');
style.textContent = `
    .step-section { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E5E7EB; }
    .step-section:last-of-type { border-bottom: none; margin-bottom: 0; }
    .step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .step-number { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #4F46E5; color: white; border-radius: 50%; font-weight: 600; }
    .step-header h2 { margin: 0; font-size: 1.25rem; color: #111827; }

    .consolidation-options { margin: 20px 0; padding: 20px; background: #F8FAFC; border: 2px solid #E2E8F0; border-radius: 12px; }
    .consolidation-options h3 { margin: 0 0 8px 0; color: #1E293B; }
    .consolidation-options > p { margin: 0 0 20px 0; color: #64748B; }

    .consolidation-section { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px dashed #CBD5E1; }
    .consolidation-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .section-label { font-weight: 600; color: #334155; display: block; margin-bottom: 8px; }
    .section-desc { color: #64748B; font-size: 0.9rem; margin: 0 0 12px 0; }

    .consolidation-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .consolidation-type-card { display: flex; align-items: center; padding: 16px; background: white; border: 2px solid #E2E8F0; border-radius: 10px; cursor: pointer; transition: all 0.2s; }
    .consolidation-type-card:hover { border-color: #4F46E5; }
    .consolidation-type-card input:checked + .type-content { color: #4F46E5; }
    .consolidation-type-card:has(input:checked) { border-color: #4F46E5; background: #EEF2FF; }
    .type-content { display: flex; flex-direction: column; margin-left: 12px; }
    .type-icon { font-size: 1.5rem; }
    .type-content strong { color: #1E293B; }
    .type-content small { color: #64748B; margin-top: 2px; }

    .uploaded-files-list { margin: 16px 0; padding: 12px; background: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB; }
    .uploaded-file-item { display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid #E5E7EB; }
    .uploaded-file-item:last-child { border-bottom: none; }
    .file-icon { font-size: 1.2rem; }
    .file-name { flex: 1; font-weight: 500; }
    .file-size { color: #6B7280; font-size: 0.85rem; }

    .main-api-selector { display: flex; flex-direction: column; gap: 8px; }
    .api-option { display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border: 2px solid #E5E7EB; border-radius: 8px; cursor: pointer; }
    .api-option:hover { border-color: #4F46E5; }
    .api-option.selected { border-color: #4F46E5; background: #EEF2FF; }
    .api-option-content { display: flex; flex-direction: column; }
    .api-badge { font-size: 0.75rem; color: #4F46E5; }
    .api-option-content strong { color: #111827; }
    .api-option-content small { color: #6B7280; }

    .header-config-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .header-config-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: white; border: 1px solid #E5E7EB; border-radius: 6px; }
    .header-checkbox { display: flex; align-items: center; gap: 8px; flex: 1; }
    .header-name { font-weight: 500; }
    .header-badge { font-size: 0.7rem; background: #DBEAFE; color: #1D4ED8; padding: 2px 6px; border-radius: 4px; }
    .header-default { flex: 1; padding: 4px 8px; border: 1px solid #E5E7EB; border-radius: 4px; font-size: 0.85rem; }
    .btn-remove { background: none; border: none; color: #EF4444; cursor: pointer; font-size: 1.2rem; padding: 0 4px; }

    .endpoint-mapping-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px; }
    .endpoint-mapping-item { padding: 16px; background: white; border: 1px solid #E5E7EB; border-radius: 8px; }
    .mapping-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .mapping-name { font-weight: 600; color: #334155; }
    .mapping-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .mapping-source, .mapping-target { flex: 1; }
    .mapping-source label, .mapping-target label { display: block; font-size: 0.8rem; color: #64748B; margin-bottom: 4px; }
    .mapping-source select, .mapping-target select { width: 100%; padding: 8px; border: 1px solid #E5E7EB; border-radius: 6px; }
    .mapping-arrow { color: #94A3B8; font-size: 1.5rem; }
    .mapping-config { display: flex; align-items: center; gap: 8px; }
    .mapping-config label { font-size: 0.85rem; color: #64748B; }
    .mapping-config input { flex: 1; padding: 6px 10px; border: 1px solid #E5E7EB; border-radius: 6px; }

    .checkbox-option { display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: white; border-radius: 8px; cursor: pointer; }
    .checkbox-option input { margin-top: 3px; }
    .checkbox-option span { display: flex; flex-direction: column; }
    .checkbox-option strong { color: #111827; }
    .checkbox-option small { color: #6B7280; margin-top: 2px; }

    .btn-small { padding: 8px 12px; font-size: 0.85rem; }
    .btn-secondary { background: white; border: 1px solid #E5E7EB; color: #374151; border-radius: 6px; cursor: pointer; }
    .btn-secondary:hover { background: #F9FAFB; border-color: #D1D5DB; }

    .empty-state { color: #9CA3AF; font-style: italic; padding: 16px; text-align: center; }

    .sdk-type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    @media (max-width: 600px) { .sdk-type-grid, .consolidation-type-grid { grid-template-columns: 1fr; } }
    .sdk-type-card { display: flex; align-items: center; padding: 16px; background: white; border: 2px solid #E5E7EB; border-radius: 12px; cursor: pointer; }
    .sdk-type-card:hover { border-color: #4F46E5; background: #F5F3FF; }
    .sdk-type-card.featured { border-color: #10B981; background: #ECFDF5; }
    .sdk-type-card input[type="radio"] { margin-right: 12px; }
    .sdk-type-content { display: flex; flex-direction: column; }
    .sdk-icon { font-size: 1.5rem; margin-bottom: 4px; }
    .sdk-type-content strong { color: #111827; }
    .sdk-type-content small { color: #6B7280; margin-top: 2px; }

    .java-options { margin-top: 20px; padding: 20px; background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 12px; }
    .java-options h3 { margin: 0 0 16px 0; color: #92400E; }

    .btn-large { width: 100%; padding: 16px 24px; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .file-label.selected { border-color: #10B981; background: #ECFDF5; }
`;
document.head.appendChild(style);
