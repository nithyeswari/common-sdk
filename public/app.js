// Get DOM elements
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('openApiFile');
const fileName = document.getElementById('fileName');
const moduleNameInput = document.getElementById('moduleName');
const baseURLInput = document.getElementById('baseURL');
const generateBtn = document.getElementById('generateBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const errorContainer = document.getElementById('errorContainer');
const errorText = document.getElementById('errorText');
const successContainer = document.getElementById('successContainer');
const sdkTypeCheckboxes = document.querySelectorAll('input[name="sdkType"]');
const javaOptions = document.getElementById('javaOptions');

// Selected SDK type from modal
let selectedSdkTypeFromModal = null;

// SDK Type Modal Functions
function showSdkTypeModal() {
    // Validate file is selected first
    const files = fileInput.files;
    if (!files || files.length === 0) {
        alert('Please select an OpenAPI specification file first');
        return;
    }

    // Reset selection
    selectedSdkTypeFromModal = null;
    const radios = document.querySelectorAll('input[name="sdkTypeModal"]');
    radios.forEach(r => r.checked = false);

    // Hide Java options
    const javaOptionsModal = document.getElementById('javaOptionsModal');
    if (javaOptionsModal) javaOptionsModal.classList.add('hidden');

    // Show modal
    document.getElementById('sdkTypeModal').classList.remove('hidden');
}

function closeSdkTypeModal() {
    document.getElementById('sdkTypeModal').classList.add('hidden');
}

function selectSdkType(sdkType) {
    selectedSdkTypeFromModal = sdkType;

    // Check the radio button
    const radio = document.querySelector(`input[name="sdkTypeModal"][value="${sdkType}"]`);
    if (radio) radio.checked = true;

    // Show/hide Java options
    const javaOptionsModal = document.getElementById('javaOptionsModal');
    const javaSDKs = ['spring-boot', 'quarkus', 'quarkus-fullstack', 'spring-boot-client', 'quarkus-client'];

    if (javaSDKs.includes(sdkType)) {
        javaOptionsModal.classList.remove('hidden');
    } else {
        javaOptionsModal.classList.add('hidden');
    }
}

function confirmGenerateSdk() {
    if (!selectedSdkTypeFromModal) {
        alert('Please select an SDK type');
        return;
    }

    // Close modal
    closeSdkTypeModal();

    // Trigger SDK generation
    generateSdkWithType(selectedSdkTypeFromModal);
}

// State for multi-spec configuration (must be declared before functions that use them)
let parsedAPIs = [];
let allHeaders = new Set();
let selectedHeaders = {};
let mainAPIIndex = 0;
let endpointMergeConfig = {}; // { path: { method: 'merge'|'keep-first'|'keep-all', sourceSpecs: [...] } }
let payloadMappings = []; // [{ sourceSpec, targetSpec, sourceField, targetField, transformFn }]
let selectedStrategy = 'merge-all';
let aggregatedSpecPreview = null;

// SessionStorage keys
const STORAGE_KEYS = {
    SPECS: 'openapi_specs',
    MAIN_INDEX: 'main_api_index',
    HEADERS: 'selected_headers',
    BUSINESS_LOGIC: 'business_logic',
    ENDPOINT_MERGE: 'endpoint_merge_config',
    PAYLOAD_MAPPINGS: 'payload_mappings'
};

// Set version timestamp
(function setVersionTimestamp() {
    const timestampEl = document.getElementById('versionTimestamp');
    if (timestampEl) {
        const now = new Date();
        const formatted = now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        timestampEl.textContent = formatted;
    }
})();

// Toggle Java options visibility based on SDK type selection
function updateJavaOptionsVisibility() {
    const selectedSDK = document.querySelector('input[name="sdkType"]:checked')?.value;
    const javaSDKs = ['spring-boot', 'quarkus', 'quarkus-fullstack', 'spring-boot-client', 'quarkus-client'];

    if (!javaOptions) {
        console.warn('javaOptions element not found');
        return;
    }

    if (javaSDKs.includes(selectedSDK)) {
        javaOptions.classList.remove('hidden');
    } else {
        javaOptions.classList.add('hidden');
    }

    // Ensure multiSpecConfig stays visible if it was already visible
    const multiSpecConfig = document.getElementById('multiSpecConfig');
    if (multiSpecConfig && parsedAPIs.length > 0 && multiSpecConfig.classList.contains('hidden')) {
        console.log('Restoring multiSpecConfig visibility');
        multiSpecConfig.classList.remove('hidden');
    }
}

// Update Java options visibility for preview step
function updateJavaOptionsPreviewVisibility() {
    const selectedSDK = document.querySelector('input[name="sdkTypePreview"]:checked')?.value;
    const javaSDKs = ['spring-boot', 'quarkus', 'quarkus-fullstack', 'spring-boot-client', 'quarkus-client'];
    const javaOptionsPreview = document.getElementById('javaOptionsPreview');

    if (!javaOptionsPreview) {
        return;
    }

    if (javaSDKs.includes(selectedSDK)) {
        javaOptionsPreview.classList.remove('hidden');
    } else {
        javaOptionsPreview.classList.add('hidden');
    }
}

// Update Java options visibility for main form
function updateJavaOptionsMainVisibility() {
    const selectedSDK = document.querySelector('input[name="sdkTypeMain"]:checked')?.value;
    const javaSDKs = ['spring-boot', 'quarkus', 'quarkus-fullstack', 'spring-boot-client', 'quarkus-client'];
    const javaOptionsMain = document.getElementById('javaOptionsMain');

    if (!javaOptionsMain) {
        console.warn('javaOptionsMain element not found');
        return;
    }

    if (javaSDKs.includes(selectedSDK)) {
        javaOptionsMain.classList.remove('hidden');
    } else {
        javaOptionsMain.classList.add('hidden');
    }
}

// Add event listeners to SDK type radio buttons (with delay to ensure DOM is ready)
function initSDKRadioListeners() {
    // Main form SDK type listeners
    const sdkTypeMainRadios = document.querySelectorAll('input[name="sdkTypeMain"]');
    sdkTypeMainRadios.forEach(radio => {
        radio.addEventListener('change', updateJavaOptionsMainVisibility);
    });
    updateJavaOptionsMainVisibility();

    const sdkTypeRadios = document.querySelectorAll('input[name="sdkType"]');
    sdkTypeRadios.forEach(radio => {
        radio.addEventListener('change', updateJavaOptionsVisibility);
    });
    // Set initial visibility
    updateJavaOptionsVisibility();

    // Also init preview step listeners
    const sdkTypePreviewRadios = document.querySelectorAll('input[name="sdkTypePreview"]');
    sdkTypePreviewRadios.forEach(radio => {
        radio.addEventListener('change', updateJavaOptionsPreviewVisibility);
    });
    updateJavaOptionsPreviewVisibility();
}

// Initialize on load and also try immediately
initSDKRadioListeners();
window.addEventListener('load', initSDKRadioListeners);

// Toggle aggregator options visibility
document.getElementById('enableAggregator')?.addEventListener('change', function () {
    const aggregatorOptions = document.getElementById('aggregatorOptions');
    if (this.checked) {
        aggregatorOptions.classList.remove('hidden');
    } else {
        aggregatorOptions.classList.add('hidden');
    }
});

// Load saved specs from sessionStorage on page load
function loadSavedSpecs() {
    const savedSpecs = sessionStorage.getItem(STORAGE_KEYS.SPECS);
    if (savedSpecs) {
        try {
            const specs = JSON.parse(savedSpecs);
            parsedAPIs = specs;
            mainAPIIndex = parseInt(sessionStorage.getItem(STORAGE_KEYS.MAIN_INDEX) || '0');

            const savedHeaders = sessionStorage.getItem(STORAGE_KEYS.HEADERS);
            if (savedHeaders) {
                selectedHeaders = JSON.parse(savedHeaders);
            }

            if (parsedAPIs.length > 0) {
                showSpecsManager();
                updateAPIList();
                extractAllHeaders();
                populateHeaderConfig();
            }
        } catch (error) {
            console.error('Error loading saved specs:', error);
            sessionStorage.clear();
        }
    }
}

// Save specs to sessionStorage
function saveSpecs() {
    sessionStorage.setItem(STORAGE_KEYS.SPECS, JSON.stringify(parsedAPIs));
    sessionStorage.setItem(STORAGE_KEYS.MAIN_INDEX, mainAPIIndex.toString());
    sessionStorage.setItem(STORAGE_KEYS.HEADERS, JSON.stringify(selectedHeaders));
}

// Extract all headers from loaded specs
function extractAllHeaders() {
    allHeaders = new Set();
    parsedAPIs.forEach(api => {
        api.operations.forEach(op => {
            const headerParams = op.parameters?.filter(p => p.in === 'header') || [];
            headerParams.forEach(h => allHeaders.add(h.name));
        });
    });
}

// Show specs manager UI
function showSpecsManager() {
    document.getElementById('multiSpecConfig').classList.remove('hidden');
}

// Show upload options modal
function showUploadOptionsModal() {
    const modal = document.getElementById('uploadOptionsModal');
    const specCount = document.getElementById('uploadedSpecCount');

    specCount.textContent = `${parsedAPIs.length} spec${parsedAPIs.length > 1 ? 's' : ''}`;
    modal.classList.remove('hidden');
}

// Close upload options modal
function closeUploadOptionsModal() {
    const modal = document.getElementById('uploadOptionsModal');
    modal.classList.add('hidden');
}

// Handle upload option selection
function selectUploadOption(option) {
    closeUploadOptionsModal();

    // Always show spec manager for all options
    showSpecsManager();

    switch (option) {
        case 'direct-generate':
            // Show spec manager and scroll to it
            document.getElementById('multiSpecConfig').scrollIntoView({ behavior: 'smooth' });
            break;

        case 'aggregator':
            // Set strategy to aggregator and show configuration
            selectedStrategy = 'aggregator';
            showAggregationStrategyStep();
            break;

        case 'main-clients':
            // Set strategy to main-clients and show configuration
            selectedStrategy = 'main-clients';
            showAggregationStrategyStep();
            break;

        case 'configure':
            // Show the full specs manager with all options
            document.getElementById('multiSpecConfig').scrollIntoView({ behavior: 'smooth' });
            break;
    }
}

// Clear all saved specs
function clearAllSpecs() {
    if (confirm('Are you sure you want to clear all uploaded specifications?')) {
        parsedAPIs = [];
        sessionStorage.clear();
        document.getElementById('multiSpecConfig').classList.add('hidden');
        fileName.textContent = 'Choose OpenAPI file(s) - First file is main spec';
        fileName.classList.remove('selected');
    }
}

// Load saved specs when page loads
window.addEventListener('load', loadSavedSpecs);

// Update file name display and show multi-spec config
fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        // Parse and add new specs to existing ones
        try {
            await parseAndAddSpecs(files);
            fileName.textContent = `${parsedAPIs.length} spec${parsedAPIs.length > 1 ? 's' : ''} loaded`;
            fileName.classList.add('selected');

            // Show options modal after upload
            showUploadOptionsModal();
        } catch (error) {
            console.error('Error parsing specs:', error);
            errorContainer.classList.remove('hidden');
            errorText.textContent = `Error parsing specs: ${error.message}`;
        }
    }
});

// Parse and add new specs to existing collection
async function parseAndAddSpecs(files) {
    const generator = new window.SDKGenerator();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await file.text();
        const parsed = await generator.parseOpenAPISpec(content, file.name, undefined);
        parsed.fileName = file.name;
        parsed.fileContent = content; // Store content for later use
        parsed.uploadedAt = new Date().toISOString();

        // Check if already exists
        const existingIndex = parsedAPIs.findIndex(api => api.fileName === file.name);
        if (existingIndex >= 0) {
            parsedAPIs[existingIndex] = parsed; // Replace existing
        } else {
            parsedAPIs.push(parsed); // Add new
        }
    }

    // Save to sessionStorage
    saveSpecs();

    // Update UI
    updateAPIList();
    extractAllHeaders();
    populateHeaderConfig();
}

function updateAPIList() {
    const apiList = document.getElementById('apiList');
    apiList.innerHTML = '';

    if (parsedAPIs.length === 0) {
        apiList.innerHTML = '<p style="color: #6B7280; text-align: center; padding: 20px;">No specs uploaded yet. Use the file selector above to upload OpenAPI specifications.</p>';
        return;
    }

    parsedAPIs.forEach((api, index) => {
        const isMain = index === mainAPIIndex;
        const item = document.createElement('div');
        item.className = `api-item ${isMain ? 'main-api' : ''}`;
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div class="api-item-info" style="flex: 1;">
                <div class="api-item-title">${api.title || 'Untitled API'}</div>
                <div class="api-item-meta">
                    ${api.operations.length} operations • ${api.fileName}
                    ${api.uploadedAt ? `• Uploaded ${new Date(api.uploadedAt).toLocaleTimeString()}` : ''}
                </div>
            </div>
            <span class="api-badge ${isMain ? 'main' : 'client'}" style="cursor: pointer;">${isMain ? '⭐ Main Service' : '🔗 Client'}</span>
            <button class="btn-delete" onclick="event.stopPropagation(); deleteSpec(${index})" style="margin-left: 10px; padding: 5px 10px; background: #EF4444; color: white; border: none; border-radius: 4px; cursor: pointer;">✕</button>
        `;

        // Click to toggle main/secondary
        item.addEventListener('click', () => {
            if (index !== mainAPIIndex) {
                mainAPIIndex = index;
                saveSpecs();
                updateAPIList();
            }
        });

        apiList.appendChild(item);
    });
}

// Delete a spec
function deleteSpec(index) {
    if (confirm(`Delete "${parsedAPIs[index].title || parsedAPIs[index].fileName}"?`)) {
        parsedAPIs.splice(index, 1);

        // Adjust mainAPIIndex if needed
        if (mainAPIIndex >= parsedAPIs.length) {
            mainAPIIndex = Math.max(0, parsedAPIs.length - 1);
        }

        saveSpecs();
        updateAPIList();
        extractAllHeaders();
        populateHeaderConfig();

        if (parsedAPIs.length === 0) {
            document.getElementById('multiSpecConfig').classList.add('hidden');
            fileName.textContent = 'Choose OpenAPI file(s) - First file is main spec';
            fileName.classList.remove('selected');
        } else {
            fileName.textContent = `${parsedAPIs.length} spec${parsedAPIs.length > 1 ? 's' : ''} loaded`;
        }
    }
}

function populateHeaderConfig() {
    const headerConfig = document.getElementById('headerConfig');
    headerConfig.innerHTML = '';

    // Only use headers that are actually detected from the specs
    // Don't add hardcoded default headers that aren't in the client specs
    const allHeadersList = Array.from(allHeaders);

    // Show message if no headers found
    if (allHeadersList.length === 0) {
        headerConfig.innerHTML = `
            <div class="no-headers-message" style="padding: 16px; color: #6B7280; text-align: center; font-style: italic;">
                No header parameters found in the uploaded specs.<br>
                <small>Headers will be automatically detected from your OpenAPI specification's operation parameters.</small>
            </div>
        `;
        return;
    }

    // Initialize selectedHeaders from saved data - default to propagate: true for detected headers
    allHeadersList.forEach(headerName => {
        if (!selectedHeaders[headerName]) {
            selectedHeaders[headerName] = {
                propagate: true,  // Default to propagate for headers found in spec
                transform: false
            };
        }
    });

    allHeadersList.forEach((headerName, index) => {
        const config = selectedHeaders[headerName] || { propagate: false, transform: false };
        const isDetected = allHeaders.has(headerName);

        const item = document.createElement('div');
        item.className = 'header-item';
        item.innerHTML = `
            <div class="header-name-column">
                <input type="checkbox" id="header-${index}" ${config.propagate ? 'checked' : ''}
                    onchange="updateHeaderConfig('${headerName}', 'propagate', this.checked)">
                <label for="header-${index}" class="header-label">${headerName}</label>
            </div>
            <div class="header-transform-column">
                <label class="header-label">
                    <input type="checkbox" id="transform-${index}" ${config.transform ? 'checked' : ''}
                        onchange="updateHeaderConfig('${headerName}', 'transform', this.checked)">
                    <span>Add transformation</span>
                </label>
            </div>
            <div class="header-source-badge">
                <span class="badge ${isDetected ? 'badge-detected' : 'badge-default'}">
                    ${isDetected ? '🔍 Detected' : '⭐ Default'}
                </span>
            </div>
        `;
        headerConfig.appendChild(item);
    });
}

// Update header configuration and save
function updateHeaderConfig(headerName, field, value) {
    if (!selectedHeaders[headerName]) {
        selectedHeaders[headerName] = { propagate: false, transform: false };
    }
    selectedHeaders[headerName][field] = value;
    saveSpecs();
}

// Add custom header
document.getElementById('addCustomHeader')?.addEventListener('click', () => {
    const headerName = prompt('Enter custom header name:');
    if (headerName && headerName.trim()) {
        allHeaders.add(headerName.trim());
        populateHeaderConfig();
    }
});

// Generate SDK with specified type (called from modal)
async function generateSdkWithType(sdkType) {
    // Hide previous messages
    errorContainer.classList.add('hidden');
    successContainer.classList.add('hidden');

    // Show progress
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '10%';
    progressText.textContent = 'Reading file...';

    // Disable form
    generateBtn.disabled = true;

    try {
        const files = fileInput.files;
        if (!files || files.length === 0) {
            throw new Error('Please select at least one file');
        }

        console.log('Generating SDK with type:', sdkType);

        // Wrap in array for compatibility with the rest of the code
        const selectedSDKTypes = [sdkType];

        const moduleName = moduleNameInput.value || 'api';
        const baseURL = baseURLInput.value || undefined;

        // Get Java options - prioritize modal inputs
        const javaPackage = document.getElementById('packageNameModal')?.value
            || document.getElementById('packageNameMain')?.value
            || document.getElementById('packageName')?.value
            || 'com.example.api';
        const groupId = document.getElementById('groupIdModal')?.value
            || document.getElementById('groupIdMain')?.value
            || document.getElementById('groupId')?.value
            || 'com.example';
        const artifactId = document.getElementById('artifactIdModal')?.value
            || document.getElementById('artifactIdMain')?.value
            || document.getElementById('artifactId')?.value
            || 'api-service';
        const javaVersion = document.getElementById('javaVersionModal')?.value
            || document.getElementById('javaVersionMain')?.value
            || document.getElementById('javaVersion')?.value
            || '21';

        console.log('Java options:', { javaPackage, groupId, artifactId, javaVersion });

        // Read all files
        progressBar.style.width = '15%';
        progressText.textContent = 'Reading files...';

        const fileContents = {};
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const content = await file.text();
            fileContents[file.name] = { content, filename: file.name };
        }

        // Main spec is the first file
        const mainFile = files[0];
        const mainContent = fileContents[mainFile.name].content;

        // Bundle and resolve references if multiple files
        let specContent = mainContent;
        if (files.length > 1) {
            progressBar.style.width = '25%';
            progressText.textContent = 'Resolving external references...';

            const generator = new window.SDKGenerator();
            specContent = await generator.bundleSpecs(mainContent, mainFile.name, fileContents);
        }

        // Parse OpenAPI spec
        progressBar.style.width = '30%';
        progressText.textContent = 'Parsing OpenAPI specification...';

        const generator = new window.SDKGenerator();
        let parsedAPI = await generator.parseOpenAPISpec(specContent, mainFile.name, baseURL);

        console.log('Parsed API:', parsedAPI);
        console.log(`Found ${parsedAPI.operations.length} operations`);
        console.log(`Found ${parsedAPI.schemas.length} schemas`);
        console.log('Selected SDK types:', selectedSDKTypes);

        // Check if aggregation is enabled
        const enableAggregator = document.getElementById('enableAggregator')?.checked || false;
        let aggregatedSpec = null;

        if (enableAggregator && parsedAPIs.length > 0) {
            // Use stored specs for aggregation
            progressBar.style.width = '25%';
            progressText.textContent = 'Aggregating specifications...';

            const aggregatedSpecName = document.getElementById('aggregatedSpecName')?.value || 'unified-api';
            const enableCO2Tracking = document.getElementById('enableCO2Tracking')?.checked || false;
            const downloadAggregatedSpec = document.getElementById('downloadAggregatedSpec')?.checked || false;
            const generateFromAggregated = document.getElementById('generateFromAggregated')?.checked || false;
            const showAggregatedPreview = document.getElementById('showAggregatedPreview')?.checked || false;

            // Load consolidation rules from session storage
            let storedConsolidationRules = [];
            try {
                const storedRules = sessionStorage.getItem('consolidation_rules');
                console.log('Raw consolidation rules from sessionStorage:', storedRules);
                if (storedRules) {
                    storedConsolidationRules = JSON.parse(storedRules);
                    console.log('Parsed consolidation rules:', storedConsolidationRules);
                }
            } catch (e) {
                console.warn('Failed to load consolidation rules:', e);
            }

            // Also check in-memory consolidationRules array
            if (typeof consolidationRules !== 'undefined' && consolidationRules.length > 0) {
                console.log('In-memory consolidationRules:', consolidationRules);
                // Merge with stored rules if different
                consolidationRules.forEach(rule => {
                    if (!storedConsolidationRules.find(r => r.id === rule.id)) {
                        storedConsolidationRules.push(rule);
                    }
                });
            }

            console.log('Final consolidation rules to apply:', storedConsolidationRules.length, storedConsolidationRules);

            // Aggregate all specs with consolidation rules
            aggregatedSpec = await generator.aggregateSpecs(parsedAPIs, {
                name: aggregatedSpecName,
                enableCO2Tracking: enableCO2Tracking,
                consolidationRules: storedConsolidationRules
            });

            console.log('Aggregated spec:', aggregatedSpec);
            console.log('Aggregated spec paths:', Object.keys(aggregatedSpec.paths || {}));
            console.log(`Aggregated ${parsedAPIs.length} specifications`);

            // Log consolidation details if any rules were applied
            if (storedConsolidationRules.length > 0) {
                console.log(`Applied ${storedConsolidationRules.length} consolidation rule(s):`);
                storedConsolidationRules.forEach((rule, idx) => {
                    if (rule.type === '2-to-1-consolidation') {
                        console.log(`  ${idx + 1}. Consolidated ${rule.endpoint1?.operation?.method?.toUpperCase()} ${rule.endpoint1?.operation?.path} + ${rule.endpoint2?.operation?.method?.toUpperCase()} ${rule.endpoint2?.operation?.path} → ${rule.method?.toUpperCase()} ${rule.path}`);
                        console.log(`     Merged headers: ${rule.mergedHeaders?.length || 0}`);
                        console.log(`     Merged query params: ${rule.mergedQueryParams?.length || 0}`);
                        console.log(`     Merged request fields: ${rule.mergedRequestBodyFields?.length || 0}`);
                        console.log(`     Parallel execution: ${rule.rules?.parallelCalls ? 'Yes' : 'No'}`);
                    }
                });

                // Verify the consolidated path exists in aggregated spec
                storedConsolidationRules.forEach(rule => {
                    if (rule.path && aggregatedSpec.paths[rule.path]) {
                        console.log(`✅ Consolidated endpoint ${rule.path} EXISTS in aggregated spec`);
                    } else if (rule.path) {
                        console.log(`❌ Consolidated endpoint ${rule.path} NOT FOUND in aggregated spec`);
                    }
                });
            }

            // Download aggregated spec if requested
            if (downloadAggregatedSpec) {
                const specYaml = jsyaml.dump(aggregatedSpec);
                const specBlob = new Blob([specYaml], { type: 'text/yaml' });
                const specUrl = window.URL.createObjectURL(specBlob);
                const specLink = document.createElement('a');
                specLink.href = specUrl;
                specLink.download = `${aggregatedSpecName}-aggregated.yaml`;
                document.body.appendChild(specLink);
                specLink.click();
                window.URL.revokeObjectURL(specUrl);
                document.body.removeChild(specLink);
            }

            // Show preview if requested
            if (showAggregatedPreview) {
                showSpecPreviewModal(aggregatedSpec, aggregatedSpecName, parsedAPIs.length, enableCO2Tracking);
            }

            // Use aggregated spec for SDK generation if requested
            if (generateFromAggregated) {
                // Parse the aggregated spec back to parsedAPI format
                const aggregatedYaml = jsyaml.dump(aggregatedSpec);
                parsedAPI = await generator.parseOpenAPISpec(aggregatedYaml, `${aggregatedSpecName}.yaml`, baseURL);
                console.log('Using aggregated spec for SDK generation');
            }
        }

        // Create ZIP file
        const zip = new JSZip();
        let currentProgress = 30;
        const progressPerSDK = 50 / selectedSDKTypes.length;

        // Generate each selected SDK type
        for (const sdkType of selectedSDKTypes) {
            progressText.textContent = `Generating ${sdkType} SDK...`;
            progressBar.style.width = `${currentProgress}%`;

            if (sdkType === 'react') {
                const sdkFiles = await generator.generateSDK(parsedAPI, moduleName);
                const reactFolder = zip.folder('react-sdk');
                for (const [filename, content] of Object.entries(sdkFiles)) {
                    reactFolder.file(filename, content);
                }
            } else if (sdkType === 'spring-boot') {
                const springBootFiles = await generator.generateSpringBoot(parsedAPI, {
                    packageName: javaPackage,
                    groupId: groupId,
                    artifactId: artifactId,
                    javaVersion: javaVersion
                });
                const springFolder = zip.folder('spring-boot-backend');
                for (const [filename, content] of Object.entries(springBootFiles)) {
                    springFolder.file(filename, content);
                }
            } else if (sdkType === 'quarkus') {
                const quarkusFiles = await generator.generateQuarkus(parsedAPI, {
                    packageName: javaPackage,
                    groupId: groupId,
                    artifactId: artifactId,
                    javaVersion: javaVersion
                });
                const quarkusFolder = zip.folder('quarkus-backend');
                for (const [filename, content] of Object.entries(quarkusFiles)) {
                    quarkusFolder.file(filename, content);
                }
            } else if (sdkType === 'spring-boot-client') {
                const clientFiles = await generator.generateSpringBootClient(parsedAPI, {
                    packageName: javaPackage,
                    groupId: groupId,
                    artifactId: artifactId + '-client',
                    javaVersion: javaVersion
                });
                const clientFolder = zip.folder('spring-boot-client');
                for (const [filename, content] of Object.entries(clientFiles)) {
                    clientFolder.file(filename, content);
                }
            } else if (sdkType === 'quarkus-client') {
                const clientFiles = await generator.generateQuarkusClient(parsedAPI, {
                    packageName: javaPackage,
                    groupId: groupId,
                    artifactId: artifactId + '-client',
                    javaVersion: javaVersion
                });
                const clientFolder = zip.folder('quarkus-client');
                for (const [filename, content] of Object.entries(clientFiles)) {
                    clientFolder.file(filename, content);
                }
            } else if (sdkType === 'quarkus-fullstack') {
                // Check if multi-spec mode
                if (parsedAPIs.length > 1) {
                    // Multi-spec unified project
                    const mainAPI = parsedAPIs[mainAPIIndex];
                    const clientAPIs = parsedAPIs.filter((_, idx) => idx !== mainAPIIndex);

                    // Get business logic configuration
                    const businessLogic = {
                        enableValidation: document.getElementById('enableValidation')?.checked || false,
                        enableTransformation: document.getElementById('enableTransformation')?.checked || false,
                        enableEnrichment: document.getElementById('enableEnrichment')?.checked || false,
                        enableCaching: document.getElementById('enableCaching')?.checked || false
                    };

                    // Generate unified project
                    const unifiedFiles = await generator.generateQuarkusUnifiedProject(
                        mainAPI,
                        clientAPIs,
                        {
                            packageName: javaPackage,
                            groupId: groupId,
                            artifactId: artifactId,
                            javaVersion: javaVersion,
                            headers: selectedHeaders,
                            businessLogic: businessLogic
                        }
                    );

                    const folder = zip.folder('quarkus-fullstack');
                    for (const [filename, content] of Object.entries(unifiedFiles)) {
                        folder.file(filename, content);
                    }
                } else {
                    // Single spec - original behavior
                    const backendFiles = await generator.generateQuarkus(parsedAPI, {
                        packageName: javaPackage,
                        groupId: groupId,
                        artifactId: artifactId,
                        javaVersion: javaVersion
                    });
                    const backendFolder = zip.folder('quarkus-fullstack/backend');
                    for (const [filename, content] of Object.entries(backendFiles)) {
                        backendFolder.file(filename, content);
                    }

                    const clientFiles = await generator.generateQuarkusClient(parsedAPI, {
                        packageName: javaPackage + '.client',
                        groupId: groupId,
                        artifactId: artifactId + '-client',
                        javaVersion: javaVersion
                    });
                    const clientFolder = zip.folder('quarkus-fullstack/client-sdk');
                    for (const [filename, content] of Object.entries(clientFiles)) {
                        clientFolder.file(filename, content);
                    }

                    const docContent = generator.generateQuarkusFullstackDocs(parsedAPI, {
                        packageName: javaPackage,
                        artifactId: artifactId
                    });
                    zip.folder('quarkus-fullstack').file('INTER-SERVICE-COMMUNICATION.md', docContent);
                }
            }

            currentProgress += progressPerSDK;
        }

        // Generate ZIP blob
        progressBar.style.width = '85%';
        progressText.textContent = 'Creating ZIP archive...';

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        // Download the file
        progressBar.style.width = '95%';
        progressText.textContent = 'Preparing download...';

        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${moduleName}-full-sdk.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        progressBar.style.width = '100%';
        progressText.textContent = 'Complete!';

        // Show success
        setTimeout(() => {
            progressContainer.classList.add('hidden');
            successContainer.classList.remove('hidden');

            // Reset form
            uploadForm.reset();
            fileName.textContent = 'Choose OpenAPI file(s) - First file is main spec';
            fileName.classList.remove('selected');
            generateBtn.disabled = false;

            // Hide success message after 5 seconds
            setTimeout(() => {
                successContainer.classList.add('hidden');
            }, 5000);
        }, 500);

    } catch (error) {
        console.error('Error:', error);

        progressContainer.classList.add('hidden');
        errorContainer.classList.remove('hidden');
        errorText.textContent = error.message || 'An error occurred while generating the SDK';

        generateBtn.disabled = false;
    }
}

// Add some animation when page loads
window.addEventListener('load', () => {
    document.querySelector('.card').style.animation = 'slideUp 0.6s ease-out';
});

// Add slideUp animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Modal functionality for spec preview
let currentSpecYaml = '';
let currentSpecName = '';

function showSpecPreviewModal(spec, name, sourceCount, co2Enabled) {
    const modal = document.getElementById('specPreviewModal');
    const infoDiv = document.getElementById('specPreviewInfo');
    const contentPre = document.getElementById('specPreviewContent');

    currentSpecYaml = jsyaml.dump(spec);
    currentSpecName = name;

    // Populate info
    infoDiv.innerHTML = `
        <strong>Name:</strong> ${name}<br>
        <strong>Source APIs:</strong> ${sourceCount}<br>
        <strong>CO2 Tracking:</strong> ${co2Enabled ? 'Enabled ✓' : 'Disabled'}<br>
        <strong>Paths:</strong> ${Object.keys(spec.paths || {}).length}<br>
        <strong>Schemas:</strong> ${Object.keys(spec.components?.schemas || {}).length}
    `;

    // Populate content
    contentPre.textContent = currentSpecYaml;

    // Show modal
    modal.classList.remove('hidden');
}

function closeSpecPreviewModal() {
    const modal = document.getElementById('specPreviewModal');
    modal.classList.add('hidden');
}

// Modal event listeners
document.getElementById('closePreviewModal')?.addEventListener('click', closeSpecPreviewModal);

// Close modal when clicking outside content
document.getElementById('specPreviewModal')?.addEventListener('click', function (e) {
    if (e.target === this) {
        closeSpecPreviewModal();
    }
});

// Copy to clipboard
document.getElementById('copySpecContent')?.addEventListener('click', function () {
    navigator.clipboard.writeText(currentSpecYaml).then(() => {
        const originalText = this.textContent;
        this.textContent = 'Copied! ✓';
        setTimeout(() => {
            this.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
});

// Download from preview
document.getElementById('downloadSpecFromPreview')?.addEventListener('click', function () {
    const blob = new Blob([currentSpecYaml], { type: 'text/yaml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSpecName}-aggregated.yaml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
});

// ESC key to close modal
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeSpecPreviewModal();
    }
});

// Scan for duplicate endpoints across specs
document.getElementById('scanForDuplicates')?.addEventListener('click', function () {
    scanForDuplicateEndpoints();
});

function scanForDuplicateEndpoints() {
    const endpointMergeList = document.getElementById('endpointMergeList');
    endpointMergeList.innerHTML = '';

    if (parsedAPIs.length < 2) {
        endpointMergeList.innerHTML = '<div class="empty-state">Upload at least 2 specs to detect duplicate endpoints</div>';
        return;
    }

    // Find duplicate paths across specs
    const pathMap = new Map(); // path+method -> [{ spec, index }]
    const allEndpoints = new Map(); // All unique endpoints for consolidation

    parsedAPIs.forEach((api, apiIndex) => {
        api.operations.forEach(op => {
            const key = `${op.method.toUpperCase()} ${op.path}`;
            const uniqueKey = `${apiIndex}-${key}`;

            if (!pathMap.has(key)) {
                pathMap.set(key, []);
            }
            pathMap.get(key).push({ spec: api, index: apiIndex, operation: op });

            // Store all endpoints for consolidation
            allEndpoints.set(uniqueKey, {
                spec: api,
                index: apiIndex,
                operation: op,
                key: key
            });
        });
    });

    // Filter to only duplicates
    const duplicates = Array.from(pathMap.entries())
        .filter(([_, sources]) => sources.length > 1);

    if (duplicates.length === 0) {
        endpointMergeList.innerHTML = `
            <div class="empty-state">No duplicate endpoints found across specs ✓</div>
            <div style="margin-top: 16px; padding: 16px; background: #EEF2FF; border-radius: 8px; border: 2px solid #4F46E5;">
                <h4 style="margin: 0 0 8px 0; color: #4338CA;">💡 Smart Consolidation</h4>
                <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 0.9rem;">
                    Combine different endpoints from multiple specs into a single unified endpoint.
                </p>
                <button type="button" onclick="showConsolidationBuilder()" class="btn-scan" style="width: 100%;">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14"></path>
                    </svg>
                    Create Consolidated Endpoint
                </button>
            </div>
        `;
        return;
    }

    // Render duplicate endpoint items
    duplicates.forEach(([pathKey, sources]) => {
        const [method, path] = pathKey.split(' ', 2);
        const configKey = pathKey;

        if (!endpointMergeConfig[configKey]) {
            endpointMergeConfig[configKey] = {
                method: 'merge',
                sources: sources.map(s => s.index),
                consolidationType: 'duplicate'
            };
        }

        const item = document.createElement('div');
        item.className = 'endpoint-merge-item';
        item.innerHTML = `
            <div class="endpoint-path">
                <span style="color: #10B981; font-weight: 700;">${method}</span> ${path}
            </div>
            <div class="endpoint-specs">
                ${sources.map(s => `<span class="spec-tag">${s.spec.title || s.spec.fileName}</span>`).join('')}
            </div>
            <div class="merge-strategy-selector">
                <label>Merge Strategy:</label>
                <select onchange="updateMergeStrategy('${pathKey.replace(/'/g, "\\'")}', this.value)">
                    <option value="merge" ${endpointMergeConfig[configKey].method === 'merge' ? 'selected' : ''}>
                        Smart Merge (combine parameters & responses)
                    </option>
                    <option value="consolidate" ${endpointMergeConfig[configKey].method === 'consolidate' ? 'selected' : ''}>
                        ⚡ Consolidate into Single Endpoint
                    </option>
                    <option value="keep-first" ${endpointMergeConfig[configKey].method === 'keep-first' ? 'selected' : ''}>
                        Keep First Spec Only
                    </option>
                    <option value="keep-all" ${endpointMergeConfig[configKey].method === 'keep-all' ? 'selected' : ''}>
                        Keep All as Separate Operations
                    </option>
                    <option value="skip" ${endpointMergeConfig[configKey].method === 'skip' ? 'selected' : ''}>
                        Skip This Endpoint
                    </option>
                </select>
            </div>
            <div id="consolidation-${configKey.replace(/\s+/g, '-')}" style="display: none; margin-top: 12px;">
                <!-- Consolidation options will appear here -->
            </div>
        `;
        endpointMergeList.appendChild(item);
    });

    // Add consolidation builder button
    const consolidationSection = document.createElement('div');
    consolidationSection.style.marginTop = '16px';
    consolidationSection.innerHTML = `
        <div style="padding: 16px; background: #EEF2FF; border-radius: 8px; border: 2px solid #4F46E5;">
            <h4 style="margin: 0 0 8px 0; color: #4338CA;">💡 Smart Consolidation</h4>
            <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 0.9rem;">
                Combine different endpoints from multiple specs into a single unified endpoint.
            </p>
            <button type="button" onclick="showConsolidationBuilder()" class="btn-scan" style="width: 100%;">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"></path>
                </svg>
                Create Consolidated Endpoint
            </button>
        </div>
    `;
    endpointMergeList.appendChild(consolidationSection);

    // Save to session storage
    sessionStorage.setItem(STORAGE_KEYS.ENDPOINT_MERGE, JSON.stringify(endpointMergeConfig));
}

function updateMergeStrategy(pathKey, strategy) {
    if (!endpointMergeConfig[pathKey]) {
        endpointMergeConfig[pathKey] = { sources: [] };
    }
    endpointMergeConfig[pathKey].method = strategy;
    sessionStorage.setItem(STORAGE_KEYS.ENDPOINT_MERGE, JSON.stringify(endpointMergeConfig));
}

// Add payload mapping
document.getElementById('addPayloadMapping')?.addEventListener('click', function () {
    addPayloadMapping();
});

function addPayloadMapping() {
    const payloadMappingList = document.getElementById('payloadMappingList');

    if (parsedAPIs.length < 2) {
        alert('Upload at least 2 specs to create payload mappings');
        return;
    }

    const mappingId = Date.now();
    const mapping = {
        id: mappingId,
        sourceSpec: 0,
        targetSpec: 1,
        sourceField: '',
        targetField: '',
        transformFn: 'direct'
    };

    payloadMappings.push(mapping);
    renderPayloadMapping(mapping, payloadMappingList);

    sessionStorage.setItem(STORAGE_KEYS.PAYLOAD_MAPPINGS, JSON.stringify(payloadMappings));
}

function renderPayloadMapping(mapping, container) {
    const item = document.createElement('div');
    item.className = 'payload-mapping-item';
    item.dataset.mappingId = mapping.id;

    const specOptions = parsedAPIs.map((api, idx) =>
        `<option value="${idx}" ${mapping.sourceSpec === idx ? 'selected' : ''}>${api.title || api.fileName}</option>`
    ).join('');

    const targetSpecOptions = parsedAPIs.map((api, idx) =>
        `<option value="${idx}" ${mapping.targetSpec === idx ? 'selected' : ''}>${api.title || api.fileName}</option>`
    ).join('');

    item.innerHTML = `
        <button class="btn-remove-mapping" onclick="removePayloadMapping(${mapping.id})">✕ Remove</button>
        <div class="mapping-row">
            <div class="mapping-field">
                <label>Source Spec</label>
                <select onchange="updateMapping(${mapping.id}, 'sourceSpec', parseInt(this.value))">
                    ${specOptions}
                </select>
            </div>
            <div class="mapping-arrow">→</div>
            <div class="mapping-field">
                <label>Target Spec</label>
                <select onchange="updateMapping(${mapping.id}, 'targetSpec', parseInt(this.value))">
                    ${targetSpecOptions}
                </select>
            </div>
        </div>
        <div class="mapping-row">
            <div class="mapping-field">
                <label>Source Field Path</label>
                <input type="text" placeholder="e.g., user.email" value="${mapping.sourceField || ''}"
                    onchange="updateMapping(${mapping.id}, 'sourceField', this.value)">
            </div>
            <div class="mapping-arrow">→</div>
            <div class="mapping-field">
                <label>Target Field Path</label>
                <input type="text" placeholder="e.g., userEmail" value="${mapping.targetField || ''}"
                    onchange="updateMapping(${mapping.id}, 'targetField', this.value)">
            </div>
        </div>
        <div style="margin-top: 8px;">
            <label style="font-size: 0.8rem; color: #6B7280;">Transformation:</label>
            <select onchange="updateMapping(${mapping.id}, 'transformFn', this.value)"
                style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 0.85rem;">
                <option value="direct" ${mapping.transformFn === 'direct' ? 'selected' : ''}>Direct mapping (no transformation)</option>
                <option value="toString" ${mapping.transformFn === 'toString' ? 'selected' : ''}>Convert to String</option>
                <option value="toNumber" ${mapping.transformFn === 'toNumber' ? 'selected' : ''}>Convert to Number</option>
                <option value="toUpperCase" ${mapping.transformFn === 'toUpperCase' ? 'selected' : ''}>To Uppercase</option>
                <option value="toLowerCase" ${mapping.transformFn === 'toLowerCase' ? 'selected' : ''}>To Lowercase</option>
                <option value="custom" ${mapping.transformFn === 'custom' ? 'selected' : ''}>Custom transformation</option>
            </select>
        </div>
    `;

    container.appendChild(item);
}

function updateMapping(mappingId, field, value) {
    const mapping = payloadMappings.find(m => m.id === mappingId);
    if (mapping) {
        mapping[field] = value;
        sessionStorage.setItem(STORAGE_KEYS.PAYLOAD_MAPPINGS, JSON.stringify(payloadMappings));
    }
}

function removePayloadMapping(mappingId) {
    payloadMappings = payloadMappings.filter(m => m.id !== mappingId);
    const item = document.querySelector(`[data-mapping-id="${mappingId}"]`);
    if (item) {
        item.remove();
    }
    sessionStorage.setItem(STORAGE_KEYS.PAYLOAD_MAPPINGS, JSON.stringify(payloadMappings));
}

// Load saved configurations
function loadSavedConfigurations() {
    const savedMergeConfig = sessionStorage.getItem(STORAGE_KEYS.ENDPOINT_MERGE);
    if (savedMergeConfig) {
        endpointMergeConfig = JSON.parse(savedMergeConfig);
    }

    const savedMappings = sessionStorage.getItem(STORAGE_KEYS.PAYLOAD_MAPPINGS);
    if (savedMappings) {
        payloadMappings = JSON.parse(savedMappings);
        const payloadMappingList = document.getElementById('payloadMappingList');
        if (payloadMappingList) {
            payloadMappingList.innerHTML = '';
            payloadMappings.forEach(mapping => renderPayloadMapping(mapping, payloadMappingList));
        }
    }
}

// Load configurations on page load
window.addEventListener('load', loadSavedConfigurations);

// Consolidation Builder
let consolidationRules = [];

function showConsolidationBuilder() {
    // Create modal for consolidation builder
    const modal = document.createElement('div');
    modal.id = 'consolidationModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1200px;">
            <div class="modal-header">
                <h2>⚡ Consolidate 2 Endpoints into 1</h2>
                <button onclick="closeConsolidationModal()" class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="consolidation-builder">
                    <div class="info-banner" style="background: #FEF3C7; border-color: #F59E0B;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <div>
                            <strong style="color: #92400E;">Path Consolidation: 2 → 1</strong>
                            <p style="color: #78350F;">Merge 2 different endpoint paths (e.g., <code>GET /users/{id}</code> and <code>GET /profile/{id}</code>) into a single unified path (e.g., <code>GET /api/user-profile/{id}</code>). The new endpoint will call both original endpoints and merge their responses.</p>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Step 1: Select 2 Endpoints to Merge</h3>
                        <p style="color: #6B7280; margin-bottom: 16px;">
                            Choose exactly 2 endpoints from your uploaded specs. They will be combined into a single new endpoint.
                        </p>

                        <div class="two-endpoint-selector">
                            <div class="endpoint-selector-box">
                                <h4>Endpoint 1</h4>
                                <select id="endpoint1Selector" class="input-field" onchange="updateConsolidationPreview()">
                                    <option value="">Select first endpoint...</option>
                                </select>
                                <div id="endpoint1Details" class="endpoint-details"></div>
                            </div>

                            <div class="merge-arrow-box">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                                <span style="color: #4F46E5; font-weight: 700; font-size: 1.1rem;">MERGE INTO</span>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                </svg>
                            </div>

                            <div class="endpoint-selector-box">
                                <h4>Endpoint 2</h4>
                                <select id="endpoint2Selector" class="input-field" onchange="updateConsolidationPreview()">
                                    <option value="">Select second endpoint...</option>
                                </select>
                                <div id="endpoint2Details" class="endpoint-details"></div>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Step 2: Define Consolidated Endpoint</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="option-label">New Unified Path</label>
                                <input type="text" id="consolidatedPath" class="input-field"
                                    placeholder="/api/consolidated/{id}"
                                    onchange="updateConsolidationPreview()">
                                <small class="input-hint">This single path will replace both original paths</small>
                            </div>
                            <div class="form-group">
                                <label class="option-label">HTTP Method</label>
                                <select id="consolidatedMethod" class="input-field" onchange="updateConsolidationPreview()">
                                    <option value="get">GET</option>
                                    <option value="post">POST</option>
                                    <option value="put">PUT</option>
                                    <option value="patch">PATCH</option>
                                    <option value="delete">DELETE</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="option-label">Summary</label>
                            <input type="text" id="consolidatedSummary" class="input-field"
                                placeholder="e.g., Get complete user profile with additional data">
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Step 3: Configure How to Merge</h3>
                        <div class="consolidation-rules">
                            <label class="checkbox-label">
                                <input type="checkbox" id="mergeParameters" checked>
                                <div>
                                    <strong>Merge Parameters</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Combine all parameters from both endpoints (path, query, header)
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="mergeResponses" checked>
                                <div>
                                    <strong>Merge Response Bodies</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Combine response fields from both endpoints into a single response object
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="generateOrchestrationCode" checked>
                                <div>
                                    <strong>Generate Orchestration Code</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Create Java/TypeScript code that calls both original endpoints and merges results
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="parallelCalls">
                                <div>
                                    <strong>Parallel API Calls</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Call both endpoints concurrently for better performance
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="addSourceTracking">
                                <div>
                                    <strong>Track Data Sources</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Add metadata to indicate which endpoint each field came from
                                    </small>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>📊 Consolidation Preview</h3>
                        <div id="consolidationPreviewBox" class="consolidation-preview">
                            <div class="preview-empty">
                                Select 2 endpoints to see consolidation preview
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="closeConsolidationModal()" class="btn-secondary">Cancel</button>
                <button onclick="applyConsolidation()" class="btn-primary">
                    Apply Consolidation
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Populate endpoint selection
    populateEndpointSelection();
}

function populateEndpointSelection() {
    const selector1 = document.getElementById('endpoint1Selector');
    const selector2 = document.getElementById('endpoint2Selector');

    if (!selector1 || !selector2) return;

    // Clear and populate both selectors
    [selector1, selector2].forEach(selector => {
        selector.innerHTML = '<option value="">Select endpoint...</option>';

        parsedAPIs.forEach((api, apiIndex) => {
            if (!api.operations) return;

            const optgroup = document.createElement('optgroup');
            optgroup.label = api.title || api.fileName;

            api.operations.forEach((op, opIndex) => {
                const option = document.createElement('option');
                option.value = `${apiIndex}-${opIndex}`;
                option.textContent = `${op.method.toUpperCase()} ${op.path}`;
                optgroup.appendChild(option);
            });

            selector.appendChild(optgroup);
        });
    });
}

// State for consolidated endpoint editing
let consolidatedEndpointState = {
    headers: [],
    queryParams: [],
    pathParams: [],
    requestBodyFields: [],
    responseFields: []
};

function updateConsolidationPreview() {
    const endpoint1Value = document.getElementById('endpoint1Selector')?.value;
    const endpoint2Value = document.getElementById('endpoint2Selector')?.value;
    const consolidatedPath = document.getElementById('consolidatedPath')?.value;
    const consolidatedMethod = document.getElementById('consolidatedMethod')?.value;

    // Update endpoint details
    updateEndpointDetails('endpoint1Details', endpoint1Value);
    updateEndpointDetails('endpoint2Details', endpoint2Value);

    // Update preview
    const previewBox = document.getElementById('consolidationPreviewBox');
    if (!previewBox) return;

    if (!endpoint1Value || !endpoint2Value) {
        previewBox.innerHTML = '<div class="preview-empty">Select 2 endpoints to see consolidation preview</div>';
        consolidatedEndpointState = { headers: [], queryParams: [], pathParams: [], requestBodyFields: [], responseFields: [] };
        return;
    }

    const [api1Idx, op1Idx] = endpoint1Value.split('-').map(Number);
    const [api2Idx, op2Idx] = endpoint2Value.split('-').map(Number);

    const endpoint1 = parsedAPIs[api1Idx].operations[op1Idx];
    const endpoint2 = parsedAPIs[api2Idx].operations[op2Idx];
    const api1Name = parsedAPIs[api1Idx].title || parsedAPIs[api1Idx].fileName;
    const api2Name = parsedAPIs[api2Idx].title || parsedAPIs[api2Idx].fileName;

    // Merge and deduplicate all parameters
    mergeEndpointParameters(endpoint1, endpoint2, api1Name, api2Name);

    // Merge request body fields
    mergeRequestBodyFields(endpoint1, endpoint2, api1Name, api2Name);

    // Merge response fields
    mergeResponseFields(endpoint1, endpoint2, api1Name, api2Name);

    // Render the interactive preview
    renderConsolidationPreview(previewBox, endpoint1, endpoint2, api1Idx, api2Idx, consolidatedPath, consolidatedMethod);
}

function mergeEndpointParameters(ep1, ep2, source1, source2) {
    const params1 = ep1.parameters || [];
    const params2 = ep2.parameters || [];

    // Reset state
    consolidatedEndpointState.headers = [];
    consolidatedEndpointState.queryParams = [];
    consolidatedEndpointState.pathParams = [];

    const paramMap = new Map();

    // Add params from endpoint 1
    params1.forEach(p => {
        const key = `${p.in}:${p.name}`;
        paramMap.set(key, {
            ...p,
            source: source1,
            enabled: true,
            defaultValue: p.default || ''
        });
    });

    // Add/merge params from endpoint 2
    params2.forEach(p => {
        const key = `${p.in}:${p.name}`;
        if (paramMap.has(key)) {
            const existing = paramMap.get(key);
            existing.sources = [existing.source, source2];
            existing.required = existing.required || p.required;
        } else {
            paramMap.set(key, {
                ...p,
                source: source2,
                enabled: true,
                defaultValue: p.default || ''
            });
        }
    });

    // Categorize by type
    paramMap.forEach((param, key) => {
        if (param.in === 'header') {
            consolidatedEndpointState.headers.push(param);
        } else if (param.in === 'query') {
            consolidatedEndpointState.queryParams.push(param);
        } else if (param.in === 'path') {
            consolidatedEndpointState.pathParams.push(param);
        }
    });
}

function mergeRequestBodyFields(ep1, ep2, source1, source2) {
    consolidatedEndpointState.requestBodyFields = [];

    const addFieldsFromBody = (body, source) => {
        if (!body?.content?.['application/json']?.schema) return;
        const schema = body.content['application/json'].schema;
        const required = schema.required || [];

        if (schema.properties) {
            Object.entries(schema.properties).forEach(([name, prop]) => {
                const existing = consolidatedEndpointState.requestBodyFields.find(f => f.name === name);
                if (existing) {
                    existing.sources = existing.sources || [existing.source];
                    existing.sources.push(source);
                } else {
                    consolidatedEndpointState.requestBodyFields.push({
                        name,
                        type: prop.type || 'string',
                        description: prop.description || '',
                        required: required.includes(name),
                        source,
                        enabled: true,
                        defaultValue: prop.default || ''
                    });
                }
            });
        }
    };

    addFieldsFromBody(ep1.requestBody, source1);
    addFieldsFromBody(ep2.requestBody, source2);
}

function mergeResponseFields(ep1, ep2, source1, source2) {
    consolidatedEndpointState.responseFields = [];

    const addFieldsFromResponse = (responses, source) => {
        const successResponse = responses?.['200'] || responses?.['201'];
        if (!successResponse?.content?.['application/json']?.schema) return;
        const schema = successResponse.content['application/json'].schema;

        if (schema.properties) {
            Object.entries(schema.properties).forEach(([name, prop]) => {
                const existing = consolidatedEndpointState.responseFields.find(f => f.name === name);
                if (existing) {
                    existing.sources = existing.sources || [existing.source];
                    existing.sources.push(source);
                } else {
                    consolidatedEndpointState.responseFields.push({
                        name,
                        type: prop.type || 'string',
                        description: prop.description || '',
                        source,
                        enabled: true
                    });
                }
            });
        }
    };

    addFieldsFromResponse(ep1.responses, source1);
    addFieldsFromResponse(ep2.responses, source2);
}

function renderConsolidationPreview(container, ep1, ep2, api1Idx, api2Idx, path, method) {
    const api1Name = parsedAPIs[api1Idx].title || parsedAPIs[api1Idx].fileName;
    const api2Name = parsedAPIs[api2Idx].title || parsedAPIs[api2Idx].fileName;

    container.innerHTML = `
        <div class="consolidation-preview-content">
            <!-- Summary Header -->
            <div class="preview-header" style="background: #ECFDF5; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="margin: 0; color: #10B981; font-size: 1rem;">
                    ✓ Consolidating 2 Endpoints → 1
                </h4>
                <div style="margin-top: 8px; font-size: 0.85rem; color: #374151;">
                    <code>${ep1.method.toUpperCase()} ${ep1.path}</code> + <code>${ep2.method.toUpperCase()} ${ep2.path}</code>
                    → <strong>${(method || 'GET').toUpperCase()} ${path || '/api/consolidated'}</strong>
                </div>
            </div>

            <!-- Headers Section -->
            <div class="editable-section" style="margin-bottom: 16px;">
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h5 style="margin: 0; color: #4F46E5;">🔗 Headers (${consolidatedEndpointState.headers.length})</h5>
                    <button type="button" class="btn-small" onclick="addConsolidatedHeader()">+ Add Header</button>
                </div>
                <div id="consolidatedHeadersList" class="editable-list">
                    ${renderEditableHeaders()}
                </div>
            </div>

            <!-- Query Parameters Section -->
            <div class="editable-section" style="margin-bottom: 16px;">
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h5 style="margin: 0; color: #4F46E5;">❓ Query Parameters (${consolidatedEndpointState.queryParams.length})</h5>
                    <button type="button" class="btn-small" onclick="addConsolidatedQueryParam()">+ Add Param</button>
                </div>
                <div id="consolidatedQueryParamsList" class="editable-list">
                    ${renderEditableQueryParams()}
                </div>
            </div>

            <!-- Path Parameters Section -->
            ${consolidatedEndpointState.pathParams.length > 0 ? `
            <div class="editable-section" style="margin-bottom: 16px;">
                <div class="section-header" style="margin-bottom: 8px;">
                    <h5 style="margin: 0; color: #4F46E5;">📍 Path Parameters (${consolidatedEndpointState.pathParams.length})</h5>
                </div>
                <div id="consolidatedPathParamsList" class="editable-list">
                    ${renderEditablePathParams()}
                </div>
            </div>
            ` : ''}

            <!-- Request Body Section -->
            <div class="editable-section" style="margin-bottom: 16px;">
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h5 style="margin: 0; color: #059669;">📤 Request Body Fields (${consolidatedEndpointState.requestBodyFields.length})</h5>
                    <button type="button" class="btn-small" onclick="addConsolidatedRequestField()">+ Add Field</button>
                </div>
                <div id="consolidatedRequestBodyList" class="editable-list">
                    ${renderEditableRequestBody()}
                </div>
            </div>

            <!-- Response Section -->
            <div class="editable-section" style="margin-bottom: 16px;">
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h5 style="margin: 0; color: #DC2626;">📥 Response Fields (${consolidatedEndpointState.responseFields.length})</h5>
                    <button type="button" class="btn-small" onclick="addConsolidatedResponseField()">+ Add Field</button>
                </div>
                <div id="consolidatedResponseList" class="editable-list">
                    ${renderEditableResponse()}
                </div>
            </div>
        </div>
    `;
}

function renderEditableHeaders() {
    if (consolidatedEndpointState.headers.length === 0) {
        return '<div class="empty-message" style="color: #6B7280; font-style: italic; padding: 8px;">No headers found. Click "+ Add Header" to add one.</div>';
    }

    return consolidatedEndpointState.headers.map((h, idx) => `
        <div class="editable-item" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: ${h.enabled ? '#F9FAFB' : '#FEE2E2'}; border-radius: 4px; margin-bottom: 4px;">
            <input type="checkbox" ${h.enabled ? 'checked' : ''} onchange="toggleConsolidatedItem('headers', ${idx}, this.checked)" title="Include in consolidated endpoint">
            <input type="text" value="${h.name}" class="input-small" style="width: 150px;" onchange="updateConsolidatedItem('headers', ${idx}, 'name', this.value)" placeholder="Header name">
            <input type="text" value="${h.defaultValue || ''}" class="input-small" style="width: 120px;" onchange="updateConsolidatedItem('headers', ${idx}, 'defaultValue', this.value)" placeholder="Default value">
            <label style="font-size: 0.75rem; display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" ${h.required ? 'checked' : ''} onchange="updateConsolidatedItem('headers', ${idx}, 'required', this.checked)"> Required
            </label>
            <span class="source-badge" style="font-size: 0.7rem; background: #E0E7FF; color: #4338CA; padding: 2px 6px; border-radius: 4px;">${h.sources ? h.sources.join(', ') : h.source}</span>
            <button type="button" class="btn-remove-small" onclick="removeConsolidatedItem('headers', ${idx})" title="Remove">×</button>
        </div>
    `).join('');
}

function renderEditableQueryParams() {
    if (consolidatedEndpointState.queryParams.length === 0) {
        return '<div class="empty-message" style="color: #6B7280; font-style: italic; padding: 8px;">No query parameters found.</div>';
    }

    return consolidatedEndpointState.queryParams.map((p, idx) => `
        <div class="editable-item" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: ${p.enabled ? '#F9FAFB' : '#FEE2E2'}; border-radius: 4px; margin-bottom: 4px;">
            <input type="checkbox" ${p.enabled ? 'checked' : ''} onchange="toggleConsolidatedItem('queryParams', ${idx}, this.checked)">
            <input type="text" value="${p.name}" class="input-small" style="width: 120px;" onchange="updateConsolidatedItem('queryParams', ${idx}, 'name', this.value)" placeholder="Param name">
            <select class="input-small" style="width: 80px;" onchange="updateConsolidatedItem('queryParams', ${idx}, 'type', this.value)">
                <option value="string" ${(p.schema?.type || p.type) === 'string' ? 'selected' : ''}>string</option>
                <option value="integer" ${(p.schema?.type || p.type) === 'integer' ? 'selected' : ''}>integer</option>
                <option value="boolean" ${(p.schema?.type || p.type) === 'boolean' ? 'selected' : ''}>boolean</option>
                <option value="array" ${(p.schema?.type || p.type) === 'array' ? 'selected' : ''}>array</option>
            </select>
            <input type="text" value="${p.defaultValue || ''}" class="input-small" style="width: 100px;" onchange="updateConsolidatedItem('queryParams', ${idx}, 'defaultValue', this.value)" placeholder="Default">
            <label style="font-size: 0.75rem; display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" ${p.required ? 'checked' : ''} onchange="updateConsolidatedItem('queryParams', ${idx}, 'required', this.checked)"> Req
            </label>
            <span class="source-badge" style="font-size: 0.7rem; background: #E0E7FF; color: #4338CA; padding: 2px 6px; border-radius: 4px;">${p.source}</span>
            <button type="button" class="btn-remove-small" onclick="removeConsolidatedItem('queryParams', ${idx})">×</button>
        </div>
    `).join('');
}

function renderEditablePathParams() {
    return consolidatedEndpointState.pathParams.map((p, idx) => `
        <div class="editable-item" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #F9FAFB; border-radius: 4px; margin-bottom: 4px;">
            <span style="font-weight: 600;">{${p.name}}</span>
            <select class="input-small" style="width: 80px;" onchange="updateConsolidatedItem('pathParams', ${idx}, 'type', this.value)">
                <option value="string" ${(p.schema?.type || p.type) === 'string' ? 'selected' : ''}>string</option>
                <option value="integer" ${(p.schema?.type || p.type) === 'integer' ? 'selected' : ''}>integer</option>
            </select>
            <span class="source-badge" style="font-size: 0.7rem; background: #E0E7FF; color: #4338CA; padding: 2px 6px; border-radius: 4px;">${p.source}</span>
        </div>
    `).join('');
}

function renderEditableRequestBody() {
    if (consolidatedEndpointState.requestBodyFields.length === 0) {
        return '<div class="empty-message" style="color: #6B7280; font-style: italic; padding: 8px;">No request body fields found.</div>';
    }

    return consolidatedEndpointState.requestBodyFields.map((f, idx) => `
        <div class="editable-item" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: ${f.enabled ? '#F0FDF4' : '#FEE2E2'}; border-radius: 4px; margin-bottom: 4px;">
            <input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="toggleConsolidatedItem('requestBodyFields', ${idx}, this.checked)">
            <input type="text" value="${f.name}" class="input-small" style="width: 120px;" onchange="updateConsolidatedItem('requestBodyFields', ${idx}, 'name', this.value)" placeholder="Field name">
            <select class="input-small" style="width: 80px;" onchange="updateConsolidatedItem('requestBodyFields', ${idx}, 'type', this.value)">
                <option value="string" ${f.type === 'string' ? 'selected' : ''}>string</option>
                <option value="integer" ${f.type === 'integer' ? 'selected' : ''}>integer</option>
                <option value="number" ${f.type === 'number' ? 'selected' : ''}>number</option>
                <option value="boolean" ${f.type === 'boolean' ? 'selected' : ''}>boolean</option>
                <option value="object" ${f.type === 'object' ? 'selected' : ''}>object</option>
                <option value="array" ${f.type === 'array' ? 'selected' : ''}>array</option>
            </select>
            <input type="text" value="${f.defaultValue || ''}" class="input-small" style="width: 100px;" onchange="updateConsolidatedItem('requestBodyFields', ${idx}, 'defaultValue', this.value)" placeholder="Default">
            <label style="font-size: 0.75rem; display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" ${f.required ? 'checked' : ''} onchange="updateConsolidatedItem('requestBodyFields', ${idx}, 'required', this.checked)"> Req
            </label>
            <span class="source-badge" style="font-size: 0.7rem; background: #D1FAE5; color: #065F46; padding: 2px 6px; border-radius: 4px;">${f.sources ? f.sources.join(', ') : f.source}</span>
            <button type="button" class="btn-remove-small" onclick="removeConsolidatedItem('requestBodyFields', ${idx})">×</button>
        </div>
    `).join('');
}

function renderEditableResponse() {
    if (consolidatedEndpointState.responseFields.length === 0) {
        return '<div class="empty-message" style="color: #6B7280; font-style: italic; padding: 8px;">No response fields found.</div>';
    }

    return consolidatedEndpointState.responseFields.map((f, idx) => `
        <div class="editable-item" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: ${f.enabled ? '#FEF2F2' : '#E5E7EB'}; border-radius: 4px; margin-bottom: 4px;">
            <input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="toggleConsolidatedItem('responseFields', ${idx}, this.checked)">
            <input type="text" value="${f.name}" class="input-small" style="width: 120px;" onchange="updateConsolidatedItem('responseFields', ${idx}, 'name', this.value)" placeholder="Field name">
            <select class="input-small" style="width: 80px;" onchange="updateConsolidatedItem('responseFields', ${idx}, 'type', this.value)">
                <option value="string" ${f.type === 'string' ? 'selected' : ''}>string</option>
                <option value="integer" ${f.type === 'integer' ? 'selected' : ''}>integer</option>
                <option value="number" ${f.type === 'number' ? 'selected' : ''}>number</option>
                <option value="boolean" ${f.type === 'boolean' ? 'selected' : ''}>boolean</option>
                <option value="object" ${f.type === 'object' ? 'selected' : ''}>object</option>
                <option value="array" ${f.type === 'array' ? 'selected' : ''}>array</option>
            </select>
            <span class="source-badge" style="font-size: 0.7rem; background: #FEE2E2; color: #991B1B; padding: 2px 6px; border-radius: 4px;">${f.sources ? f.sources.join(', ') : f.source}</span>
            <button type="button" class="btn-remove-small" onclick="removeConsolidatedItem('responseFields', ${idx})">×</button>
        </div>
    `).join('');
}

// Event handlers for editing consolidated items
window.toggleConsolidatedItem = function(category, index, enabled) {
    consolidatedEndpointState[category][index].enabled = enabled;
    refreshConsolidatedList(category);
};

window.updateConsolidatedItem = function(category, index, field, value) {
    consolidatedEndpointState[category][index][field] = value;
};

window.removeConsolidatedItem = function(category, index) {
    consolidatedEndpointState[category].splice(index, 1);
    refreshConsolidatedList(category);
};

window.addConsolidatedHeader = function() {
    consolidatedEndpointState.headers.push({
        name: 'X-Custom-Header',
        in: 'header',
        required: false,
        enabled: true,
        defaultValue: '',
        source: 'Custom'
    });
    refreshConsolidatedList('headers');
};

window.addConsolidatedQueryParam = function() {
    consolidatedEndpointState.queryParams.push({
        name: 'customParam',
        in: 'query',
        type: 'string',
        required: false,
        enabled: true,
        defaultValue: '',
        source: 'Custom'
    });
    refreshConsolidatedList('queryParams');
};

window.addConsolidatedRequestField = function() {
    consolidatedEndpointState.requestBodyFields.push({
        name: 'customField',
        type: 'string',
        required: false,
        enabled: true,
        defaultValue: '',
        source: 'Custom'
    });
    refreshConsolidatedList('requestBodyFields');
};

window.addConsolidatedResponseField = function() {
    consolidatedEndpointState.responseFields.push({
        name: 'customField',
        type: 'string',
        enabled: true,
        source: 'Custom'
    });
    refreshConsolidatedList('responseFields');
};

function refreshConsolidatedList(category) {
    const listId = {
        'headers': 'consolidatedHeadersList',
        'queryParams': 'consolidatedQueryParamsList',
        'pathParams': 'consolidatedPathParamsList',
        'requestBodyFields': 'consolidatedRequestBodyList',
        'responseFields': 'consolidatedResponseList'
    }[category];

    const listElement = document.getElementById(listId);
    if (!listElement) return;

    const renderFn = {
        'headers': renderEditableHeaders,
        'queryParams': renderEditableQueryParams,
        'pathParams': renderEditablePathParams,
        'requestBodyFields': renderEditableRequestBody,
        'responseFields': renderEditableResponse
    }[category];

    listElement.innerHTML = renderFn();

    // Update section header count
    updateConsolidationSectionCounts();
}

function updateConsolidationSectionCounts() {
    // Update counts in section headers if needed
    const previewBox = document.getElementById('consolidationPreviewBox');
    if (!previewBox) return;

    // The counts are embedded in the headers, so we just need to make sure the state is reflected
}

function updateEndpointDetails(elementId, endpointValue) {
    const detailsDiv = document.getElementById(elementId);
    if (!detailsDiv) return;

    if (!endpointValue) {
        detailsDiv.innerHTML = '';
        return;
    }

    const [apiIdx, opIdx] = endpointValue.split('-').map(Number);
    const api = parsedAPIs[apiIdx];
    const operation = api.operations[opIdx];
    const params = operation.parameters || [];

    detailsDiv.innerHTML = `
        <div style="margin-top: 8px; padding: 8px; background: #F9FAFB; border-radius: 4px; font-size: 0.85rem;">
            <div style="margin-bottom: 4px;"><strong>From:</strong> ${api.title || api.fileName}</div>
            <div style="margin-bottom: 4px;"><strong>Parameters:</strong> ${params.length}</div>
            <div><strong>Summary:</strong> ${operation.summary || 'No summary'}</div>
        </div>
    `;
}

function applyConsolidation() {
    const endpoint1Value = document.getElementById('endpoint1Selector')?.value;
    const endpoint2Value = document.getElementById('endpoint2Selector')?.value;
    const consolidatedPath = document.getElementById('consolidatedPath')?.value;
    const consolidatedMethod = document.getElementById('consolidatedMethod')?.value;
    const consolidatedSummary = document.getElementById('consolidatedSummary')?.value;

    if (!endpoint1Value || !endpoint2Value) {
        alert('Please select exactly 2 endpoints to consolidate');
        return;
    }

    if (!consolidatedPath) {
        alert('Please provide a path for the consolidated endpoint');
        return;
    }

    // Parse selected endpoints
    const [api1Idx, op1Idx] = endpoint1Value.split('-').map(Number);
    const [api2Idx, op2Idx] = endpoint2Value.split('-').map(Number);

    const api1 = parsedAPIs[api1Idx];
    const api2 = parsedAPIs[api2Idx];
    const operation1 = api1.operations[op1Idx];
    const operation2 = api2.operations[op2Idx];

    // Get consolidation rules from checkboxes
    const rules = {
        mergeParameters: document.getElementById('mergeParameters')?.checked || false,
        mergeResponses: document.getElementById('mergeResponses')?.checked || false,
        generateOrchestrationCode: document.getElementById('generateOrchestrationCode')?.checked || false,
        parallelCalls: document.getElementById('parallelCalls')?.checked || false,
        addSourceTracking: document.getElementById('addSourceTracking')?.checked || false
    };

    // Use the edited state from the interactive UI (only enabled items)
    const enabledHeaders = consolidatedEndpointState.headers.filter(h => h.enabled);
    const enabledQueryParams = consolidatedEndpointState.queryParams.filter(p => p.enabled);
    const enabledPathParams = consolidatedEndpointState.pathParams.filter(p => p.enabled !== false);
    const enabledRequestBodyFields = consolidatedEndpointState.requestBodyFields.filter(f => f.enabled);
    const enabledResponseFields = consolidatedEndpointState.responseFields.filter(f => f.enabled);

    // Build merged parameters from edited state
    const mergedParameters = [
        ...enabledHeaders.map(h => ({ ...h, in: 'header' })),
        ...enabledQueryParams.map(p => ({ ...p, in: 'query' })),
        ...enabledPathParams.map(p => ({ ...p, in: 'path' }))
    ];

    // Create consolidation configuration with edited fields
    const consolidationKey = `CONSOLIDATED_${Date.now()}`;
    const consolidation = {
        id: consolidationKey,
        path: consolidatedPath,
        method: consolidatedMethod,
        summary: consolidatedSummary || `Consolidated endpoint combining ${operation1.path} and ${operation2.path}`,
        endpoint1: {
            apiIndex: api1Idx,
            opIndex: op1Idx,
            api: api1.title || api1.fileName,
            operation: {
                method: operation1.method,
                path: operation1.path,
                summary: operation1.summary,
                parameters: operation1.parameters,
                requestBody: operation1.requestBody,
                responses: operation1.responses
            }
        },
        endpoint2: {
            apiIndex: api2Idx,
            opIndex: op2Idx,
            api: api2.title || api2.fileName,
            operation: {
                method: operation2.method,
                path: operation2.path,
                summary: operation2.summary,
                parameters: operation2.parameters,
                requestBody: operation2.requestBody,
                responses: operation2.responses
            }
        },
        // Use the user-edited merged data
        mergedParameters: mergedParameters,
        mergedHeaders: enabledHeaders,
        mergedQueryParams: enabledQueryParams,
        mergedPathParams: enabledPathParams,
        mergedRequestBodyFields: enabledRequestBodyFields,
        mergedResponseFields: enabledResponseFields,
        rules: rules,
        type: '2-to-1-consolidation',
        createdAt: new Date().toISOString()
    };

    // Save consolidation
    consolidationRules.push(consolidation);
    sessionStorage.setItem('consolidation_rules', JSON.stringify(consolidationRules));

    // Add to endpoint merge config
    endpointMergeConfig[consolidationKey] = {
        method: 'consolidate',
        consolidation: consolidation
    };
    sessionStorage.setItem(STORAGE_KEYS.ENDPOINT_MERGE, JSON.stringify(endpointMergeConfig));

    // Show success message with details
    const successMessage = `✅ Consolidation Created!

📍 Original Endpoints:
  1. ${operation1.method.toUpperCase()} ${operation1.path}
     From: ${api1.title || api1.fileName}

  2. ${operation2.method.toUpperCase()} ${operation2.path}
     From: ${api2.title || api2.fileName}

➡️ Consolidated Into:
  ${consolidatedMethod.toUpperCase()} ${consolidatedPath}

✨ Merged Features:
  • ${mergedParameters.length} parameters (combined)
  • ${rules.parallelCalls ? 'Parallel' : 'Sequential'} API calls
  • ${rules.mergeResponses ? 'Merged' : 'Separate'} responses
  • ${rules.generateOrchestrationCode ? 'With' : 'Without'} orchestration code`;

    alert(successMessage);

    // Close modal
    closeConsolidationModal();

    // Show saved consolidations
    displaySavedConsolidations();
}

function displaySavedConsolidations() {
    const consolidationsList = document.getElementById('consolidationsList');
    if (!consolidationsList) return;

    consolidationsList.innerHTML = '';

    if (consolidationRules.length === 0) {
        consolidationsList.innerHTML = '<p style="color: #6B7280; text-align: center; padding: 20px;">No consolidated endpoints created yet. Click the button below to create one.</p>';
        return;
    }

    // Add saved consolidations to the list
    consolidationRules.forEach(consolidation => {
        if (consolidation.type !== '2-to-1-consolidation') return;

        const item = document.createElement('div');
        item.className = 'endpoint-merge-item';
        item.style.borderColor = '#10B981';
        item.style.background = '#ECFDF5';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div style="flex: 1;">
                    <div style="color: #10B981; font-weight: 700; font-size: 0.9rem; margin-bottom: 8px;">
                        ⚡ CONSOLIDATED ENDPOINT
                    </div>
                    <div class="endpoint-path">
                        <span style="color: #10B981; font-weight: 700;">${consolidation.method.toUpperCase()}</span>
                        ${consolidation.path}
                    </div>
                </div>
                <button onclick="removeConsolidation('${consolidation.id}')"
                    style="background: #FEE2E2; color: #DC2626; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">
                    Remove
                </button>
            </div>

            <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
                <div style="font-size: 0.85rem; color: #6B7280; margin-bottom: 6px;">Combines:</div>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center;">
                    <div style="background: #F3F4F6; padding: 8px; border-radius: 4px; font-size: 0.85rem;">
                        <div style="font-weight: 600; color: #374151; margin-bottom: 2px;">
                            ${consolidation.endpoint1.operation.method.toUpperCase()} ${consolidation.endpoint1.operation.path}
                        </div>
                        <div style="color: #6B7280; font-size: 0.75rem;">${consolidation.endpoint1.api}</div>
                    </div>
                    <div style="color: #10B981; font-weight: 700;">+</div>
                    <div style="background: #F3F4F6; padding: 8px; border-radius: 4px; font-size: 0.85rem;">
                        <div style="font-weight: 600; color: #374151; margin-bottom: 2px;">
                            ${consolidation.endpoint2.operation.method.toUpperCase()} ${consolidation.endpoint2.operation.path}
                        </div>
                        <div style="color: #6B7280; font-size: 0.75rem;">${consolidation.endpoint2.api}</div>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <span class="spec-tag" style="background: #DBEAFE;">
                    ${consolidation.mergedParameters.length} params
                </span>
                ${consolidation.rules.parallelCalls ? '<span class="spec-tag" style="background: #D1FAE5;">⚡ Parallel</span>' : ''}
                ${consolidation.rules.mergeResponses ? '<span class="spec-tag" style="background: #FEF3C7;">📦 Merged Response</span>' : ''}
                ${consolidation.rules.generateOrchestrationCode ? '<span class="spec-tag" style="background: #E0E7FF;">🔧 With Code</span>' : ''}
            </div>
        `;

        consolidationsList.appendChild(item);
    });
}

function removeConsolidation(consolidationId) {
    if (!confirm('Remove this consolidation?')) return;

    consolidationRules = consolidationRules.filter(c => c.id !== consolidationId);
    sessionStorage.setItem('consolidation_rules', JSON.stringify(consolidationRules));

    delete endpointMergeConfig[consolidationId];
    sessionStorage.setItem(STORAGE_KEYS.ENDPOINT_MERGE, JSON.stringify(endpointMergeConfig));

    // Refresh display
    scanForDuplicateEndpoints();
}

function closeConsolidationModal() {
    const modal = document.getElementById('consolidationModal');
    if (modal) {
        modal.remove();
    }
}

// Create Main Service from Client Specs
document.getElementById('createMainFromClients')?.addEventListener('click', function () {
    if (parsedAPIs.length < 2) {
        alert('Please upload at least 2 client API specs to create a consolidated main service');
        return;
    }
    showMainServiceBuilder();
});

function showMainServiceBuilder() {
    const modal = document.createElement('div');
    modal.id = 'mainServiceModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1400px;">
            <div class="modal-header">
                <h2>🏗️ Create Main Service from Clients</h2>
                <button onclick="closeMainServiceModal()" class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="main-service-builder">
                    <div class="info-banner">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <div>
                            <strong>Build a Gateway/Aggregator Service</strong>
                            <p>Create a new main API that acts as a unified gateway, consolidating endpoints from multiple client services.
                            This generates both the OpenAPI spec and orchestration code.</p>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>📋 Main Service Information</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="option-label">Service Name</label>
                                <input type="text" id="mainServiceName" class="input-field"
                                    placeholder="e.g., Unified API Gateway" value="Unified API Gateway">
                            </div>
                            <div class="form-group">
                                <label class="option-label">Service Version</label>
                                <input type="text" id="mainServiceVersion" class="input-field"
                                    placeholder="1.0.0" value="1.0.0">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="option-label">Base Path Prefix</label>
                            <input type="text" id="mainServiceBasePath" class="input-field"
                                placeholder="/api/v1" value="/api/v1">
                            <small class="input-hint">All consolidated endpoints will be prefixed with this path</small>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>🔄 Select Client Services to Include</h3>
                        <div id="clientServicesList" class="client-services-list">
                            <!-- Populated dynamically -->
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>⚙️ Consolidation Strategy</h3>
                        <div class="strategy-options">
                            <label class="strategy-option">
                                <input type="radio" name="consolidationStrategy" value="all-endpoints" checked>
                                <div class="strategy-info">
                                    <strong>Include All Endpoints</strong>
                                    <small>Expose all endpoints from selected client services</small>
                                </div>
                            </label>
                            <label class="strategy-option">
                                <input type="radio" name="consolidationStrategy" value="selective">
                                <div class="strategy-info">
                                    <strong>Selective Endpoints</strong>
                                    <small>Choose specific endpoints to include (opens endpoint selector)</small>
                                </div>
                            </label>
                            <label class="strategy-option">
                                <input type="radio" name="consolidationStrategy" value="merge-similar">
                                <div class="strategy-info">
                                    <strong>Auto-Merge Similar Endpoints</strong>
                                    <small>Automatically consolidate endpoints with similar purposes</small>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>🛠️ Generated Components</h3>
                        <div class="consolidation-rules">
                            <label class="checkbox-label">
                                <input type="checkbox" id="generateMainSpec" checked disabled>
                                <div>
                                    <strong>Main Service OpenAPI Spec</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Consolidated OpenAPI specification for the main service
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="generateOrchestration" checked>
                                <div>
                                    <strong>Service Orchestration Layer</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Java code that routes requests to appropriate client services
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="generateClientSDKs" checked>
                                <div>
                                    <strong>Client SDK Integrations</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Auto-inject client SDKs for calling downstream services
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="generateResponseAggregation" checked>
                                <div>
                                    <strong>Response Aggregation Logic</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Code to merge responses from multiple services
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="generateCircuitBreaker">
                                <div>
                                    <strong>Circuit Breaker & Resilience</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Add Resilience4j circuit breaker for fault tolerance
                                    </small>
                                </div>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="generateCaching">
                                <div>
                                    <strong>Response Caching</strong>
                                    <small style="display: block; color: #6B7280; margin-top: 4px;">
                                        Cache responses from client services for better performance
                                    </small>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>📊 Preview</h3>
                        <div id="mainServicePreview" class="service-preview">
                            <div class="preview-stat">
                                <strong>0</strong>
                                <span>Selected Services</span>
                            </div>
                            <div class="preview-stat">
                                <strong>0</strong>
                                <span>Total Endpoints</span>
                            </div>
                            <div class="preview-stat">
                                <strong>0</strong>
                                <span>Unique Schemas</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="closeMainServiceModal()" class="btn-secondary">Cancel</button>
                <button onclick="generateMainService()" class="btn-primary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    Generate Main Service
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    populateClientServicesList();
    updateMainServicePreview();
}

function populateClientServicesList() {
    const container = document.getElementById('clientServicesList');
    if (!container) return;

    container.innerHTML = '';

    parsedAPIs.forEach((api, index) => {
        const serviceCard = document.createElement('div');
        serviceCard.className = 'client-service-card';

        const endpointCount = api.operations?.length || 0;
        const schemaCount = Array.isArray(api.schemas) ? api.schemas.length : (api.schemas ? Object.keys(api.schemas).length : 0);

        serviceCard.innerHTML = `
            <div class="service-card-header">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1;">
                    <input type="checkbox" class="client-service-checkbox" data-api-index="${index}"
                        onchange="updateMainServicePreview()"
                        style="width: 20px; height: 20px; cursor: pointer; accent-color: #4F46E5;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1rem; color: #111827; margin-bottom: 4px;">
                            ${api.title || api.fileName}
                        </div>
                        <div style="font-size: 0.85rem; color: #6B7280;">
                            ${api.description || 'No description'}
                        </div>
                    </div>
                </label>
                <div class="service-stats">
                    <span class="stat-badge">${endpointCount} endpoints</span>
                    <span class="stat-badge">${schemaCount} schemas</span>
                </div>
            </div>
            <div class="service-card-details">
                <div style="font-size: 0.8rem; color: #6B7280;">
                    <strong>Base URL:</strong> ${api.baseUrl || api.servers?.[0]?.url || 'Not specified'}
                </div>
            </div>
        `;

        container.appendChild(serviceCard);
    });
}

function updateMainServicePreview() {
    const selected = document.querySelectorAll('.client-service-checkbox:checked');
    const previewContainer = document.getElementById('mainServicePreview');
    if (!previewContainer) return;

    let totalEndpoints = 0;
    let totalSchemas = 0;

    selected.forEach(checkbox => {
        const apiIndex = parseInt(checkbox.dataset.apiIndex);
        const api = parsedAPIs[apiIndex];
        totalEndpoints += api.operations?.length || 0;
        totalSchemas += Array.isArray(api.schemas) ? api.schemas.length : (api.schemas ? Object.keys(api.schemas).length : 0);
    });

    previewContainer.innerHTML = `
        <div class="preview-stat">
            <strong>${selected.length}</strong>
            <span>Selected Services</span>
        </div>
        <div class="preview-stat">
            <strong>${totalEndpoints}</strong>
            <span>Total Endpoints</span>
        </div>
        <div class="preview-stat">
            <strong>${totalSchemas}</strong>
            <span>Unique Schemas</span>
        </div>
    `;
}

function generateMainService() {
    const selected = document.querySelectorAll('.client-service-checkbox:checked');

    if (selected.length < 2) {
        alert('Please select at least 2 client services to create a main service');
        return;
    }

    const serviceName = document.getElementById('mainServiceName')?.value || 'Unified API Gateway';
    const serviceVersion = document.getElementById('mainServiceVersion')?.value || '1.0.0';
    const basePath = document.getElementById('mainServiceBasePath')?.value || '/api/v1';

    const strategy = document.querySelector('input[name="consolidationStrategy"]:checked')?.value || 'all-endpoints';

    const options = {
        generateOrchestration: document.getElementById('generateOrchestration')?.checked || false,
        generateClientSDKs: document.getElementById('generateClientSDKs')?.checked || false,
        generateResponseAggregation: document.getElementById('generateResponseAggregation')?.checked || false,
        generateCircuitBreaker: document.getElementById('generateCircuitBreaker')?.checked || false,
        generateCaching: document.getElementById('generateCaching')?.checked || false
    };

    // Collect selected client services
    const selectedServices = [];
    selected.forEach(checkbox => {
        const apiIndex = parseInt(checkbox.dataset.apiIndex);
        selectedServices.push({
            index: apiIndex,
            api: parsedAPIs[apiIndex]
        });
    });

    // Build the consolidated main service spec
    const mainServiceSpec = buildMainServiceSpec(serviceName, serviceVersion, basePath, selectedServices, strategy);

    // Save the configuration
    const mainServiceConfig = {
        serviceName,
        serviceVersion,
        basePath,
        strategy,
        options,
        selectedServices: selectedServices.map(s => s.index),
        spec: mainServiceSpec,
        createdAt: new Date().toISOString()
    };

    sessionStorage.setItem('main_service_config', JSON.stringify(mainServiceConfig));

    // Show success and options
    closeMainServiceModal();
    showMainServiceSuccess(mainServiceSpec, mainServiceConfig);
}

function buildMainServiceSpec(serviceName, version, basePath, selectedServices, strategy) {
    const spec = {
        openapi: '3.1.0',
        info: {
            title: serviceName,
            version: version,
            description: `Consolidated API Gateway aggregating ${selectedServices.length} client services`
        },
        servers: [
            {
                url: basePath,
                description: 'Main API Gateway'
            }
        ],
        paths: {},
        components: {
            schemas: {}
        },
        'x-gateway-config': {
            clientServices: selectedServices.map(s => ({
                name: s.api.title || s.api.fileName,
                baseUrl: s.api.baseUrl || s.api.servers?.[0]?.url,
                endpoints: s.api.operations?.length || 0
            }))
        }
    };

    // Add all endpoints from selected services
    selectedServices.forEach((service, serviceIndex) => {
        const api = service.api;

        // Add schemas
        if (api.schemas) {
            // Handle both array and object formats for schemas
            const schemasArray = Array.isArray(api.schemas)
                ? api.schemas
                : Object.entries(api.schemas).map(([name, schema]) => ({ name, schema }));

            schemasArray.forEach(schemaItem => {
                const schemaName = `${api.title || 'Service' + serviceIndex}_${schemaItem.name || 'Schema'}`;
                spec.components.schemas[schemaName] = schemaItem.schema || schemaItem;
            });
        }

        // Add operations
        if (api.operations) {
            api.operations.forEach(operation => {
                const path = operation.path;
                const method = operation.method.toLowerCase();

                if (!spec.paths[path]) {
                    spec.paths[path] = {};
                }

                spec.paths[path][method] = {
                    summary: operation.summary || `${method.toUpperCase()} ${path}`,
                    description: operation.description || `Proxied from ${api.title || api.fileName}`,
                    operationId: operation.operationId || `${method}_${path.replace(/\//g, '_')}`,
                    parameters: operation.parameters || [],
                    responses: operation.responses || {
                        '200': {
                            description: 'Successful response'
                        }
                    },
                    'x-client-service': api.title || api.fileName,
                    'x-original-path': path
                };

                // Add request body if exists
                if (operation.requestBody) {
                    spec.paths[path][method].requestBody = operation.requestBody;
                }
            });
        }
    });

    return spec;
}

function showMainServiceSuccess(spec, config) {
    const modal = document.createElement('div');
    modal.id = 'successModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h2>✅ Main Service Created Successfully!</h2>
                <button onclick="closeSuccessModal()" class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="success-summary">
                    <div class="success-icon">🎉</div>
                    <h3>${config.serviceName}</h3>
                    <p>Version ${config.serviceVersion}</p>

                    <div class="success-stats">
                        <div class="stat-item">
                            <strong>${config.selectedServices.length}</strong>
                            <span>Client Services</span>
                        </div>
                        <div class="stat-item">
                            <strong>${Object.keys(spec.paths).length}</strong>
                            <span>Endpoints</span>
                        </div>
                        <div class="stat-item">
                            <strong>${Object.keys(spec.components.schemas).length}</strong>
                            <span>Schemas</span>
                        </div>
                    </div>
                </div>

                <div class="action-buttons">
                    <button onclick="downloadMainServiceSpec()" class="btn-action">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download Main Service Spec
                    </button>
                    <button onclick="previewMainServiceSpec()" class="btn-action">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Preview Spec
                    </button>
                    <button onclick="generateMainServiceSDK()" class="btn-action btn-primary">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                        Generate Full Stack SDK
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function downloadMainServiceSpec() {
    const config = JSON.parse(sessionStorage.getItem('main_service_config'));
    if (!config) return;

    const yaml = jsyaml.dump(config.spec, { indent: 2 });
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = config.serviceName.toLowerCase().replace(/\s+/g, '-');
    a.download = `${filename}-main-service.yaml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function previewMainServiceSpec() {
    const config = JSON.parse(sessionStorage.getItem('main_service_config'));
    if (!config) return;

    const yaml = jsyaml.dump(config.spec, { indent: 2 });
    const modal = document.getElementById('specPreviewModal');
    const infoDiv = document.getElementById('specPreviewInfo');
    const contentPre = document.getElementById('specPreviewContent');

    infoDiv.innerHTML = `
        <strong>Service:</strong> ${config.serviceName}<br>
        <strong>Version:</strong> ${config.serviceVersion}<br>
        <strong>Client Services:</strong> ${config.selectedServices.length}<br>
        <strong>Total Endpoints:</strong> ${Object.keys(config.spec.paths).length}
    `;

    contentPre.textContent = yaml;
    modal.classList.remove('hidden');
}

function generateMainServiceSDK() {
    const config = JSON.parse(sessionStorage.getItem('main_service_config'));
    if (!config) return;

    // Convert spec to YAML and trigger upload flow
    const yaml = jsyaml.dump(config.spec, { indent: 2 });
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const file = new File([blob], 'main-service.yaml', { type: 'text/yaml' });

    // Close success modal
    closeSuccessModal();

    // Switch to upload mode
    document.getElementById('uploadModeBtn').click();

    // Trigger file upload
    setTimeout(() => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const fileInput = document.getElementById('openApiFile');
        fileInput.files = dataTransfer.files;
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
        document.getElementById('uploadModeCard').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function closeMainServiceModal() {
    const modal = document.getElementById('mainServiceModal');
    if (modal) modal.remove();
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) modal.remove();
}

// Workflow Navigation Functions
function proceedToSpecManager() {
    const strategy = document.querySelector('input[name="aggregationStrategy"]:checked')?.value;
    selectedStrategy = strategy || 'aggregator';

    // Hide strategy step
    document.getElementById('aggregationStrategyStep').classList.add('hidden');

    if (strategy === 'aggregator') {
        // Show aggregator config step
        document.getElementById('aggregatorConfigStep').classList.remove('hidden');

        // Hide main generate button in aggregation mode (SDK options are in aggregatorPreviewStep)
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) generateBtn.classList.add('hidden');

        // Populate aggregator API list
        updateAggregatorApiList();
        populateAggregatorHeaderConfig();
        displaySavedConsolidations();

        // Scroll to view
        document.getElementById('aggregatorConfigStep').scrollIntoView({ behavior: 'smooth' });
    } else if (strategy === 'main-plus-clients') {
        // Show main+clients config step
        document.getElementById('mainClientConfigStep').classList.remove('hidden');

        // Show main generate button in main+clients mode
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) generateBtn.classList.remove('hidden');

        // Populate API list
        updateAPIList();
        extractAllHeaders();
        populateHeaderConfig();

        // Scroll to view
        document.getElementById('mainClientConfigStep').scrollIntoView({ behavior: 'smooth' });
    }
}

function showAggregationStrategyStep() {
    // Hide all other steps (with null checks)
    const aggregatorConfigStep = document.getElementById('aggregatorConfigStep');
    const mainClientConfigStep = document.getElementById('mainClientConfigStep');
    const aggregationLogicStep = document.getElementById('aggregationLogicStep');
    const aggregatorPreviewStep = document.getElementById('aggregatorPreviewStep');
    const aggregationStrategyStep = document.getElementById('aggregationStrategyStep');

    if (aggregatorConfigStep) aggregatorConfigStep.classList.add('hidden');
    if (mainClientConfigStep) mainClientConfigStep.classList.add('hidden');
    if (aggregationLogicStep) aggregationLogicStep.classList.add('hidden');
    if (aggregatorPreviewStep) aggregatorPreviewStep.classList.add('hidden');

    // Show strategy selection step
    if (aggregationStrategyStep) {
        aggregationStrategyStep.classList.remove('hidden');
        aggregationStrategyStep.scrollIntoView({ behavior: 'smooth' });
    }
}

function backToStrategy() {
    // Hide all config steps (with null checks)
    const aggregatorConfigStep = document.getElementById('aggregatorConfigStep');
    const mainClientConfigStep = document.getElementById('mainClientConfigStep');
    const aggregationLogicStep = document.getElementById('aggregationLogicStep');
    const aggregationStrategyStep = document.getElementById('aggregationStrategyStep');

    if (aggregatorConfigStep) aggregatorConfigStep.classList.add('hidden');
    if (mainClientConfigStep) mainClientConfigStep.classList.add('hidden');
    if (aggregationLogicStep) aggregationLogicStep.classList.add('hidden');

    // Show strategy step
    if (aggregationStrategyStep) {
        aggregationStrategyStep.classList.remove('hidden');
        aggregationStrategyStep.scrollIntoView({ behavior: 'smooth' });
    }
}

function proceedToAggregationLogic() {
    // Validate that at least one consolidation exists
    if (consolidationRules.length === 0) {
        alert('Please create at least one consolidated endpoint (2-to-1) before proceeding');
        return;
    }

    // Hide aggregator config, show aggregation logic step (with null checks)
    const aggregatorConfigStep = document.getElementById('aggregatorConfigStep');
    const aggregationLogicStep = document.getElementById('aggregationLogicStep');

    if (aggregatorConfigStep) aggregatorConfigStep.classList.add('hidden');

    if (aggregationLogicStep) {
        aggregationLogicStep.classList.remove('hidden');

        // Populate consolidations summary
        populateConsolidationsSummary();

        aggregationLogicStep.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn('aggregationLogicStep element not found, skipping to preview');
        // If the element doesn't exist, go directly to preview
        proceedToPreview();
    }
}

function populateConsolidationsSummary() {
    const summaryDiv = document.getElementById('consolidationsSummary');
    if (!summaryDiv) return;

    summaryDiv.innerHTML = '';

    console.log('Consolidation rules:', consolidationRules);

    if (consolidationRules.length === 0) {
        summaryDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #FEF3C7; border-radius: 8px; border: 2px dashed #F59E0B;">
                <div style="font-size: 2rem; margin-bottom: 12px;">⚠️</div>
                <div style="color: #92400E; font-weight: 600; margin-bottom: 8px;">No consolidations found!</div>
                <div style="color: #78350F; font-size: 0.9rem;">
                    Please go back to Step 2 and create at least one consolidated endpoint (2-to-1).
                </div>
            </div>
        `;
        return;
    }

    const consolidations = consolidationRules.filter(r => r.type === '2-to-1-consolidation');

    if (consolidations.length === 0) {
        summaryDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #FEF3C7; border-radius: 8px; border: 2px dashed #F59E0B;">
                <div style="font-size: 2rem; margin-bottom: 12px;">⚠️</div>
                <div style="color: #92400E; font-weight: 600; margin-bottom: 8px;">No consolidations found!</div>
                <div style="color: #78350F; font-size: 0.9rem;">
                    Please go back to Step 2 and create at least one consolidated endpoint (2-to-1).
                </div>
            </div>
        `;
        return;
    }

    consolidations.forEach((consolidation, index) => {
        const item = document.createElement('div');
        item.className = 'consolidation-summary-item';
        item.innerHTML = `
            <h5>
                <span class="method-badge">${consolidation.method.toUpperCase()}</span>
                <code>${consolidation.path}</code>
            </h5>
            <div style="font-size: 0.85rem; color: #6B7280; margin-bottom: 8px;">
                ${consolidation.summary || 'Consolidated endpoint'}
            </div>
            <div class="endpoints-combined">
                <div class="endpoint-box">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #374151;">
                        ${consolidation.endpoint1.operation.method.toUpperCase()} ${consolidation.endpoint1.operation.path}
                    </div>
                    <div style="font-size: 0.75rem; color: #6B7280;">
                        From: ${consolidation.endpoint1.api}
                    </div>
                </div>
                <div class="arrow">+</div>
                <div class="endpoint-box">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #374151;">
                        ${consolidation.endpoint2.operation.method.toUpperCase()} ${consolidation.endpoint2.operation.path}
                    </div>
                    <div style="font-size: 0.75rem; color: #6B7280;">
                        From: ${consolidation.endpoint2.api}
                    </div>
                </div>
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                ${consolidation.rules.mergeParameters ? '<span class="spec-tag" style="background: #DBEAFE;">📋 Merge Params</span>' : ''}
                ${consolidation.rules.mergeResponses ? '<span class="spec-tag" style="background: #D1FAE5;">📦 Merge Response</span>' : ''}
                ${consolidation.rules.parallelCalls ? '<span class="spec-tag" style="background: #FEF3C7;">⚡ Parallel</span>' : ''}
                ${consolidation.rules.generateOrchestrationCode ? '<span class="spec-tag" style="background: #E0E7FF;">🔧 With Code</span>' : ''}
            </div>
        `;
        summaryDiv.appendChild(item);
    });

    // Add summary count
    const countDiv = document.createElement('div');
    countDiv.style.cssText = 'margin-top: 16px; padding: 12px; background: #EEF2FF; border-radius: 6px; text-align: center; font-weight: 600; color: #4F46E5;';
    countDiv.textContent = `Total: ${consolidations.length} consolidated endpoint${consolidations.length > 1 ? 's' : ''}`;
    summaryDiv.appendChild(countDiv);
}

function backToAggregatorConfig() {
    document.getElementById('aggregatorPreviewStep').classList.add('hidden');
    document.getElementById('aggregatorConfigStep').classList.remove('hidden');
    document.getElementById('aggregatorConfigStep').scrollIntoView({ behavior: 'smooth' });
}

function proceedToGenerate() {
    // For main+clients, skip to SDK generation
    // Hide workflow and show the generate button
    document.getElementById('mainClientConfigStep').classList.add('hidden');
    alert('Configuration complete! Scroll down and click "Generate SDK" to create your Quarkus Full Stack project.');
}

// Helper functions for aggregator
function updateAggregatorApiList() {
    const apiList = document.getElementById('aggregatorApiList');
    if (!apiList) return;

    apiList.innerHTML = '';

    if (parsedAPIs.length === 0) {
        apiList.innerHTML = '<p style="color: #6B7280; text-align: center; padding: 20px;">No specs uploaded yet.</p>';
        return;
    }

    parsedAPIs.forEach((api, index) => {
        const item = document.createElement('div');
        item.className = 'api-item';
        item.innerHTML = `
            <div class="api-item-info" style="flex: 1;">
                <div class="api-item-title">${api.title || 'Untitled API'}</div>
                <div class="api-item-meta">
                    ${api.operations.length} operations • ${api.fileName}
                </div>
            </div>
            <span class="api-badge client">🔗 Client</span>
        `;
        apiList.appendChild(item);
    });
}

function populateAggregatorHeaderConfig() {
    const headerConfig = document.getElementById('aggregatorHeaderConfig');
    if (!headerConfig) return;

    headerConfig.innerHTML = '';

    extractAllHeaders();

    // Only use headers that are actually detected from the specs
    // Don't add hardcoded default headers that aren't in the client specs
    const allHeadersList = Array.from(allHeaders);

    // Show message if no headers found
    if (allHeadersList.length === 0) {
        headerConfig.innerHTML = `
            <div class="no-headers-message" style="padding: 16px; color: #6B7280; text-align: center; font-style: italic;">
                No header parameters found in the uploaded specs.<br>
                <small>Use "Add Custom Header" to manually add headers for propagation.</small>
            </div>
        `;
        return;
    }

    allHeadersList.forEach((headerName, index) => {
        // Default to propagate: true for all detected headers
        const config = selectedHeaders[headerName] || { propagate: true, transform: false };
        if (!selectedHeaders[headerName]) {
            selectedHeaders[headerName] = config;
        }

        const item = document.createElement('div');
        item.className = 'header-item';
        item.innerHTML = `
            <div class="header-name-column">
                <input type="checkbox" id="agg-header-${index}" ${config.propagate ? 'checked' : ''}
                    onchange="updateHeaderConfig('${headerName}', 'propagate', this.checked)">
                <label for="agg-header-${index}" class="header-label">${headerName}</label>
            </div>
            <div class="header-source-badge">
                <span class="badge badge-detected">🔍 From Spec</span>
            </div>
        `;
        headerConfig.appendChild(item);
    });
}

function addAggregatorCustomHeader() {
    const headerName = prompt('Enter custom header name:');
    if (headerName && headerName.trim()) {
        allHeaders.add(headerName.trim());
        populateAggregatorHeaderConfig();
    }
}

async function proceedToPreview() {
    console.log('proceedToPreview called, consolidationRules:', consolidationRules);

    // Validate consolidations
    if (consolidationRules.length === 0) {
        alert('Please create at least one consolidated endpoint (2-to-1) before proceeding');
        return;
    }

    try {
        // Build aggregated spec directly from consolidation rules
        console.log('Building consolidated spec...');
        aggregatedSpecPreview = buildConsolidatedSpec();
        console.log('Built spec:', aggregatedSpecPreview);

        // Ensure multiSpecConfig is visible (parent container)
        const multiSpecConfig = document.getElementById('multiSpecConfig');
        if (multiSpecConfig) {
            multiSpecConfig.classList.remove('hidden');
            console.log('multiSpecConfig made visible');
        }

        // Hide aggregator config, show preview step
        const configStep = document.getElementById('aggregatorConfigStep');
        const previewStep = document.getElementById('aggregatorPreviewStep');
        const previewStep2 = document.getElementById('previewStep');
        console.log('Config step element:', configStep);
        console.log('Preview step element:', previewStep);
        console.log('Preview step classes before:', previewStep?.className);

        if (configStep) {
            configStep.classList.add('hidden');
           // configStep.style.display = 'none';
        }
        // Hide previewStep (which doesn't have SDK type options) in aggregation mode
        if (previewStep2) {
            previewStep2.classList.remove('hidden');
            console.log('previewStep hidden in aggregation mode');
        }
        if (previewStep) {
            previewStep.classList.remove('hidden');
          //  previewStep.style.display = 'block';
            console.log('aggregatorPreviewStep made visible, classes:', previewStep.className);
        } else {
            console.error('aggregatorPreviewStep element not found!');
            return;
        }

        // Populate consolidations summary
        console.log('Populating consolidations summary...');
        populateConsolidationsSummary();

        // Populate preview
        console.log('Populating aggregator preview...');
        populateAggregatorPreview(aggregatedSpecPreview);

        // Initialize SDK type radio button listeners in preview step
        console.log('Initializing SDK radio listeners...');
        initSDKRadioListeners();
        updateJavaOptionsVisibility();

        // Scroll to view
        console.log('Scrolling to preview step...');
        setTimeout(() => {
            if (previewStep) {
                previewStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);

        console.log('Preview setup complete!');
    } catch (error) {
        alert('Error generating preview: ' + error.message);
        console.error('Preview error:', error);
    }
}

function buildConsolidatedSpec() {
    const consolidations = consolidationRules.filter(r => r.type === '2-to-1-consolidation');
    const enableApiCallTracking = document.getElementById('enableApiCallTracking')?.checked || false;

    // Create base spec
    const spec = {
        openapi: '3.0.0',
        info: {
            title: 'Consolidated API',
            version: '1.0.0',
            description: 'Aggregated API specification created from multiple sources',
            'x-consolidations': consolidations.length,
            'x-source-apis': parsedAPIs.map(api => api.title || api.fileName)
        },
        servers: [],
        paths: {},
        components: {
            schemas: {},
            securitySchemes: {}
        }
    };

    // Add paths from consolidations
    consolidations.forEach(consolidation => {
        const path = consolidation.path;
        const method = consolidation.method.toLowerCase();

        if (!spec.paths[path]) {
            spec.paths[path] = {};
        }

        // Build consolidated operation
        let descriptionText = `This endpoint calls both:\n- ${consolidation.endpoint1.operation.method.toUpperCase()} ${consolidation.endpoint1.operation.path} (${consolidation.endpoint1.api})\n- ${consolidation.endpoint2.operation.method.toUpperCase()} ${consolidation.endpoint2.operation.path} (${consolidation.endpoint2.api})\n\nAnd merges their responses into a unified result.`;

        if (enableApiCallTracking) {
            descriptionText += '\n\n**API Call Tracking:**\nThis endpoint tracks API calls using correlation ID and API name for monitoring workflow execution.';
        }

        const operation = {
            summary: consolidation.summary || `Consolidated endpoint combining data from ${consolidation.endpoint1.api} and ${consolidation.endpoint2.api}`,
            description: descriptionText,
            operationId: consolidation.operationId || `consolidated_${method}_${path.replace(/\//g, '_').replace(/[{}]/g, '')}`,
            'x-consolidation': {
                sources: [
                    {
                        api: consolidation.endpoint1.api,
                        method: consolidation.endpoint1.operation.method,
                        path: consolidation.endpoint1.operation.path
                    },
                    {
                        api: consolidation.endpoint2.api,
                        method: consolidation.endpoint2.operation.method,
                        path: consolidation.endpoint2.operation.path
                    }
                ]
            }
        };

        // Add API call tracking extension if enabled (annotation-based, configured via properties)
        if (enableApiCallTracking) {
            operation['x-api-call-tracking'] = {
                enabled: true,
                groupBy: ['correlationId', 'apiName'],
                description: 'Track how many times each API is called per workflow execution',
                implementation: {
                    method: 'logging',
                    correlationIdHeader: 'X-Correlation-ID',
                    propagateToUpstream: true,
                    logLevel: 'INFO',
                    logFormat: {
                        template: 'API_CALL | correlation_id={correlationId} | api_name={apiName} | method={method} | path={path} | status={status} | duration_ms={duration}'
                    }
                }
            };
        }

        operation.parameters = consolidation.mergedParameters || [];
        operation.responses = {
            '200': {
                description: 'Successful consolidated response',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                data: {
                                    type: 'object',
                                    description: 'Merged data from both endpoints'
                                },
                                sources: {
                                    type: 'array',
                                    items: {
                                        type: 'string'
                                    },
                                    description: 'Source APIs that provided data'
                                }
                            }
                        }
                    }
                }
            },
            '500': {
                description: 'Error from backend services'
            }
        };

        spec.paths[path][method] = operation;
    });

    // Add servers from original specs
    const allServers = new Set();
    parsedAPIs.forEach(api => {
        const apiSpec = api.spec || api;
        if (apiSpec && apiSpec.servers && Array.isArray(apiSpec.servers)) {
            apiSpec.servers.forEach(server => {
                allServers.add(JSON.stringify(server));
            });
        }
    });

    if (allServers.size === 0) {
        // Add a default server if none found
        spec.servers = [{ url: 'https://api.example.com' }];
    } else {
        spec.servers = Array.from(allServers).map(s => JSON.parse(s));
    }

    // Add schemas from original specs
    parsedAPIs.forEach(api => {
        const apiSpec = api.spec || api;
        if (apiSpec && apiSpec.components?.schemas) {
            Object.entries(apiSpec.components.schemas).forEach(([schemaName, schema]) => {
                const prefixedName = `${api.title || 'api'}_${schemaName}`;
                spec.components.schemas[prefixedName] = schema;
            });
        }
    });

    console.log('Built consolidated spec:', spec);
    console.log('Parsed APIs:', parsedAPIs);
    return spec;
}

function backToSpecManager() {
    document.getElementById('previewStep').classList.add('hidden');
    document.getElementById('specificationManagerStep').classList.remove('hidden');
    document.getElementById('specificationManagerStep').scrollIntoView({ behavior: 'smooth' });
}

function populatePreview(spec, specName, co2Enabled) {
    // Populate summary stats
    const summaryDiv = document.getElementById('previewSummary');
    const pathCount = Object.keys(spec.paths || {}).length;
    const schemaCount = Object.keys(spec.components?.schemas || {}).length;
    const sourceCount = spec.info?.['x-aggregated-from']?.length || parsedAPIs.length;

    summaryDiv.innerHTML = `
        <div class="summary-stat">
            <strong>${sourceCount}</strong>
            <span>Source APIs</span>
        </div>
        <div class="summary-stat">
            <strong>${pathCount}</strong>
            <span>Total Endpoints</span>
        </div>
        <div class="summary-stat">
            <strong>${schemaCount}</strong>
            <span>Schemas</span>
        </div>
        <div class="summary-stat">
            <strong>${selectedStrategy === 'merge-all' ? 'Auto' : 'Manual'}</strong>
            <span>Merge Strategy</span>
        </div>
    `;

    // Set initial tab to summary
    switchPreviewTab('summary');
}

function switchPreviewTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.preview-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(tab)) {
            btn.classList.add('active');
        }
    });

    const contentDiv = document.getElementById('previewTabContent');

    if (tab === 'summary') {
        const pathsArray = Object.entries(aggregatedSpecPreview.paths || {});
        const endpoints = pathsArray.flatMap(([path, methods]) =>
            Object.keys(methods).map(method => ({ method: method.toUpperCase(), path }))
        );

        contentDiv.innerHTML = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                <h4 style="color: #111827; margin-bottom: 16px;">Endpoints Summary</h4>
                <div style="display: grid; gap: 8px;">
                    ${endpoints.map(ep => `
                        <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #4F46E5;">
                            <strong style="color: #10B981;">${ep.method}</strong>
                            <code style="color: #4F46E5;">${ep.path}</code>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (tab === 'yaml') {
        const yamlContent = jsyaml.dump(aggregatedSpecPreview, { indent: 2, lineWidth: -1 });
        contentDiv.innerHTML = `<pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${yamlContent}</pre>`;
    } else if (tab === 'changes') {
        const changes = analyzeChanges();
        contentDiv.innerHTML = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                <h4 style="color: #111827; margin-bottom: 16px;">Changes & Merges</h4>
                <ul class="changes-list">
                    ${changes.map(change => `
                        <li class="${change.type}">
                            <strong>${change.title}</strong>
                            <p style="margin: 4px 0 0 0; color: #6B7280; font-size: 0.9rem;">${change.description}</p>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
}

function analyzeChanges() {
    const changes = [];

    // Count merged endpoints
    const mergedCount = Object.keys(endpointMergeConfig).length;
    if (mergedCount > 0) {
        changes.push({
            type: 'info',
            title: `${mergedCount} Endpoints Configured`,
            description: `Custom merge strategies applied to ${mergedCount} duplicate endpoints`
        });
    }

    // Count source specs
    changes.push({
        type: 'success',
        title: `Merged ${parsedAPIs.length} Specifications`,
        description: `Combined ${parsedAPIs.map(api => api.title || api.fileName).join(', ')}`
    });

    // Check for consolidations
    const consolidations = consolidationRules.filter(r => r.type === '2-to-1-consolidation');
    if (consolidations.length > 0) {
        changes.push({
            type: 'info',
            title: `${consolidations.length} Path Consolidations`,
            description: `Created ${consolidations.length} new consolidated endpoints (2→1)`
        });
    }

    // Payload mappings
    if (payloadMappings.length > 0) {
        changes.push({
            type: 'info',
            title: `${payloadMappings.length} Payload Mappings`,
            description: `Configured field transformations between services`
        });
    }

    return changes;
}

function downloadAggregatedSpecNow() {
    if (!aggregatedSpecPreview) {
        alert('No aggregated spec available');
        return;
    }

    const specName = document.getElementById('aggregatedSpecName')?.value || 'unified-api';
    const yaml = jsyaml.dump(aggregatedSpecPreview, { indent: 2 });
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${specName}-aggregated.yaml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Show notification
    alert(`✓ Downloaded: ${specName}-aggregated.yaml`);
}

function populateAggregatorPreview(spec) {
    console.log('populateAggregatorPreview called with spec:', spec);

    // Populate summary stats
    const summaryDiv = document.getElementById('previewSummaryAggregator');
    if (summaryDiv) {
        const pathCount = Object.keys(spec.paths || {}).length;
        const schemaCount = Object.keys(spec.components?.schemas || {}).length;
        const consolidationCount = consolidationRules.filter(r => r.type === '2-to-1-consolidation').length;

        summaryDiv.innerHTML = `
            <div class="summary-stat">
                <strong>${consolidationCount}</strong>
                <span>Consolidated Endpoints</span>
            </div>
            <div class="summary-stat">
                <strong>${pathCount}</strong>
                <span>Total Paths</span>
            </div>
            <div class="summary-stat">
                <strong>${schemaCount}</strong>
                <span>Schemas</span>
            </div>
            <div class="summary-stat">
                <strong>${parsedAPIs.length}</strong>
                <span>Source APIs</span>
            </div>
        `;
    } else {
        console.error('previewSummaryAggregator element not found');
    }

    // Set initial tab to summary
    switchAggregatorPreviewTab('summary');
}

function switchAggregatorPreviewTab(tab) {
    console.log('switchAggregatorPreviewTab called with tab:', tab);
    console.log('aggregatedSpecPreview:', aggregatedSpecPreview);

    // Update tab buttons
    document.querySelectorAll('.preview-tab').forEach(btn => {
        btn.classList.remove('active');
        const btnText = btn.textContent.toLowerCase();
        if ((tab === 'summary' && btnText.includes('summary')) ||
            (tab === 'yaml' && btnText.includes('spec')) ||
            (tab === 'code' && btnText.includes('code'))) {
            btn.classList.add('active');
        }
    });

    const contentDiv = document.getElementById('previewTabContentAggregator');
    if (!contentDiv) {
        console.error('previewTabContentAggregator element not found');
        return;
    }

    console.log('contentDiv found, displaying tab:', tab);

    // Check if spec preview exists
    if (!aggregatedSpecPreview) {
        console.error('aggregatedSpecPreview is not defined');
        contentDiv.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #EF4444;">
                <h3>Preview not available</h3>
                <p>The consolidated spec preview is not ready. Please try again.</p>
            </div>
        `;
        return;
    }

    if (tab === 'summary') {
        const pathsArray = Object.entries(aggregatedSpecPreview.paths || {});
        const endpoints = pathsArray.flatMap(([path, methods]) =>
            Object.keys(methods).map(method => ({
                method: method.toUpperCase(),
                path,
                hasTracking: methods[method]['x-api-call-tracking']?.enabled || false
            }))
        );

        const trackingEnabled = endpoints.some(ep => ep.hasTracking);

        contentDiv.innerHTML = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                <h4 style="color: #111827; margin-bottom: 16px;">Consolidated Endpoints</h4>
                ${trackingEnabled ? `
                    <div style="background: #ECFDF5; border: 2px solid #10B981; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; color: #059669;">
                            <span style="font-size: 1.2rem;">📊</span>
                            <strong>API Call Tracking Enabled (Logging-based)</strong>
                        </div>
                        <div style="margin-top: 8px; font-size: 0.9rem; color: #047857;">
                            <div>• <strong>Method:</strong> Structured logging with INFO level</div>
                            <div>• <strong>Grouped by:</strong> Correlation ID and API Name</div>
                            <div>• <strong>Log format:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8rem;">API_CALL | correlation_id={id} | api_name={name} | method={method} | path={path} | status={code} | duration_ms={ms}</code></div>
                            <div>• <strong>Aggregation query:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8rem;">SELECT correlation_id, api_name, COUNT(*) FROM api_logs GROUP BY correlation_id, api_name</code></div>
                            <div>• <strong>Metrics export:</strong> Prometheus at <code style="background: white; padding: 2px 6px; border-radius: 3px;">/metrics</code></div>
                        </div>
                    </div>
                ` : ''}
                <div style="display: grid; gap: 8px;">
                    ${endpoints.length > 0 ? endpoints.map(ep => `
                        <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #10B981;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <strong style="color: #10B981;">${ep.method}</strong>
                                <code style="color: #4F46E5;">${ep.path}</code>
                                ${ep.hasTracking ? '<span style="background: #ECFDF5; color: #059669; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; margin-left: auto;">📊 Tracked</span>' : ''}
                            </div>
                        </div>
                    `).join('') : '<div style="padding: 20px; text-align: center; color: #6B7280;">No endpoints found in consolidated spec</div>'}
                </div>
            </div>
        `;
        console.log('Summary tab content set, endpoints count:', endpoints.length);
    } else if (tab === 'yaml') {
        const yamlContent = jsyaml.dump(aggregatedSpecPreview, { indent: 2, lineWidth: -1 });
        contentDiv.innerHTML = `<pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${yamlContent}</pre>`;
    } else if (tab === 'code') {
        // Get selected SDK type
        const selectedSDK = document.querySelector('input[name="sdkType"]:checked')?.value || 'react';
        const sdkNames = {
            'react': 'React + Redux SDK',
            'quarkus-fullstack': 'Quarkus Full Stack',
            'spring-boot-client': 'Spring Boot Client',
            'quarkus-client': 'Quarkus Client'
        };

        contentDiv.innerHTML = `
            <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                <div style="background: #EEF2FF; border: 2px solid #4F46E5; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #4F46E5; margin-bottom: 8px;">
                        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                        <strong style="font-size: 1.1rem;">Code Preview: ${sdkNames[selectedSDK]}</strong>
                    </div>
                    <p style="color: #6366F1; margin: 0; font-size: 0.9rem;">
                        Select your SDK type below, then click "Generate SDK" to create the complete code package
                    </p>
                </div>

                <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                    <h4 style="color: #111827; margin: 0 0 12px 0;">📦 What will be generated:</h4>
                    <ul style="color: #6B7280; line-height: 1.8; margin: 0; padding-left: 20px;">
                        ${selectedSDK === 'react' ? `
                            <li>TypeScript API client with type definitions</li>
                            <li>RTK Query endpoints and hooks</li>
                            <li>Redux store configuration</li>
                            <li>React hooks for all API operations</li>
                        ` : selectedSDK === 'quarkus-fullstack' ? `
                            <li>Quarkus REST backend application</li>
                            <li>JAX-RS resource classes</li>
                            <li>REST client interface</li>
                            <li>Request/Response DTOs</li>
                            <li>Header propagation configuration</li>
                            <li>application.properties with settings</li>
                        ` : selectedSDK === 'spring-boot-client' ? `
                            <li>Spring Boot REST client library</li>
                            <li>RestTemplate/WebClient configuration</li>
                            <li>Request/Response DTOs</li>
                            <li>Service interfaces</li>
                            <li>Auto-configuration classes</li>
                        ` : `
                            <li>Quarkus REST client interface</li>
                            <li>MicroProfile REST Client configuration</li>
                            <li>Request/Response DTOs</li>
                            <li>Header propagation</li>
                            <li>application.properties</li>
                        `}
                    </ul>
                </div>

                ${aggregatedSpecPreview.paths && Object.keys(aggregatedSpecPreview.paths).length > 0 ? `
                    <div style="margin-top: 20px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                        <h4 style="color: #111827; margin: 0 0 12px 0;">🔌 API Endpoints (${Object.keys(aggregatedSpecPreview.paths).length})</h4>
                        <div style="display: grid; gap: 8px;">
                            ${Object.entries(aggregatedSpecPreview.paths).map(([path, methods]) =>
            Object.keys(methods).map(method => `
                                    <div style="font-family: monospace; font-size: 0.9rem; padding: 8px; background: white; border-radius: 4px; border: 1px solid #E5E7EB;">
                                        <span style="color: #10B981; font-weight: bold;">${method.toUpperCase()}</span>
                                        <span style="color: #6B7280;">${path}</span>
                                    </div>
                                `).join('')
        ).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

async function proceedToGeneration() {
    try {
        // Download the spec first
        downloadAggregatedSpecNow();

        // Get the selected SDK type - check both sdkType and sdkTypePreview
        let selectedSDK = document.querySelector('input[name="sdkType"]:checked')?.value;
        if (!selectedSDK) {
            selectedSDK = document.querySelector('input[name="sdkTypePreview"]:checked')?.value;
        }

        if (!selectedSDK) {
            alert('Please select an SDK type to generate');
            return;
        }

        // Show progress
        progressContainer.classList.remove('hidden');
        progressText.textContent = 'Generating SDK from consolidated spec...';
        progressBar.style.width = '0%';

        // Convert aggregated spec to YAML
        const specYAML = jsyaml.dump(aggregatedSpecPreview, { indent: 2, lineWidth: -1 });

        // Get form values
        const moduleName = moduleNameInput.value || 'api';
        const baseURL = baseURLInput.value || '';
        const groupId = document.getElementById('groupId')?.value || document.getElementById('groupIdPreview')?.value || '';
        const artifactId = document.getElementById('artifactId')?.value || document.getElementById('artifactIdPreview')?.value || '';

        // Create generator instance
        const generator = new window.SDKGenerator();

        // Parse the aggregated spec into the expected format
        progressBar.style.width = '20%';
        progressText.textContent = 'Parsing consolidated spec...';
        const parsedAPI = await generator.parseOpenAPISpec(specYAML, 'aggregated-spec.yaml', baseURL);

        // Generate SDK based on selected type
        progressBar.style.width = '30%';
        progressText.textContent = `Generating ${selectedSDK} SDK...`;

        let files;
        const javaPackage = document.getElementById('packageName')?.value || document.getElementById('packageNamePreview')?.value || 'com.example.api';
        const javaVersion = document.getElementById('javaVersion')?.value || document.getElementById('javaVersionPreview')?.value || '21';

        const javaOptions = {
            packageName: javaPackage,
            groupId: groupId || 'com.example',
            artifactId: artifactId || moduleName,
            javaVersion: javaVersion
        };

        switch (selectedSDK) {
            case 'react':
                files = await generator.generateSDK(parsedAPI, moduleName);
                break;
            case 'quarkus-fullstack':
                files = await generator.generateQuarkus(parsedAPI, javaOptions);
                break;
            case 'spring-boot-client':
                files = await generator.generateSpringBoot(parsedAPI, javaOptions);
                break;
            case 'quarkus-client':
                files = await generator.generateQuarkusClient(parsedAPI, javaOptions);
                break;
            default:
                files = await generator.generateSDK(parsedAPI, moduleName);
        }

        // Create ZIP file
        progressBar.style.width = '60%';
        progressText.textContent = 'Creating ZIP archive...';

        const zip = new JSZip();
        const sdkFolder = zip.folder(`${moduleName}-${selectedSDK}`);

        // Add all generated files to the zip
        for (const [filename, content] of Object.entries(files)) {
            sdkFolder.file(filename, content);
        }

        // Generate ZIP blob
        progressBar.style.width = '85%';
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        progressBar.style.width = '100%';
        progressText.textContent = 'SDK generated successfully!';

        // Download the generated SDK
        setTimeout(() => {
            const url = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${moduleName}-${selectedSDK}-sdk.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Hide progress and show success
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                successContainer.classList.remove('hidden');
                const previewStep = document.getElementById('aggregatorPreviewStep');
                if (previewStep) previewStep.classList.add('hidden');
                const previewStep2 = document.getElementById('previewStep');
                if (previewStep2) previewStep2.classList.add('hidden');
            }, 1000);
        }, 500);

    } catch (error) {
        console.error('Generation error:', error);
        errorContainer.classList.remove('hidden');
        errorText.textContent = `Error generating SDK: ${error.message}`;
        progressContainer.classList.add('hidden');
    }
}
