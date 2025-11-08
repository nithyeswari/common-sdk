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

// Toggle Java options visibility based on SDK type selection
function updateJavaOptionsVisibility() {
    const springBootChecked = document.querySelector('input[value="spring-boot"]').checked;
    const quarkusChecked = document.querySelector('input[value="quarkus"]').checked;
    const quarkusFullstackChecked = document.querySelector('input[value="quarkus-fullstack"]').checked;
    const springBootClientChecked = document.querySelector('input[value="spring-boot-client"]').checked;
    const quarkusClientChecked = document.querySelector('input[value="quarkus-client"]').checked;

    if (springBootChecked || quarkusChecked || quarkusFullstackChecked || springBootClientChecked || quarkusClientChecked) {
        javaOptions.classList.remove('hidden');
    } else {
        javaOptions.classList.add('hidden');
    }
}

// Add event listeners to SDK type checkboxes
sdkTypeCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateJavaOptionsVisibility);
});

// Toggle aggregator options visibility
document.getElementById('enableAggregator')?.addEventListener('change', function() {
    const aggregatorOptions = document.getElementById('aggregatorOptions');
    if (this.checked) {
        aggregatorOptions.classList.remove('hidden');
    } else {
        aggregatorOptions.classList.add('hidden');
    }
});

// State for multi-spec configuration
let parsedAPIs = [];
let allHeaders = new Set();
let selectedHeaders = {};
let mainAPIIndex = 0;

// SessionStorage keys
const STORAGE_KEYS = {
    SPECS: 'openapi_specs',
    MAIN_INDEX: 'main_api_index',
    HEADERS: 'selected_headers',
    BUSINESS_LOGIC: 'business_logic'
};

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

    // Show multi-spec config UI
    showSpecsManager();

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

    // Default headers that should always be propagated
    const defaultHeaders = [
        { name: 'Authorization', propagate: true, transform: false },
        { name: 'X-Request-ID', propagate: true, transform: false },
        { name: 'X-Correlation-ID', propagate: true, transform: false },
        { name: 'X-Tenant-ID', propagate: true, transform: false }
    ];

    // Merge with detected headers
    const allHeadersList = Array.from(allHeaders);
    defaultHeaders.forEach(h => {
        if (!allHeadersList.includes(h.name)) {
            allHeadersList.unshift(h.name);
        }
    });

    // Initialize selectedHeaders from saved data or defaults
    allHeadersList.forEach(headerName => {
        if (!selectedHeaders[headerName]) {
            const defaultHeader = defaultHeaders.find(h => h.name === headerName);
            selectedHeaders[headerName] = {
                propagate: defaultHeader ? defaultHeader.propagate : false,
                transform: false
            };
        }
    });

    allHeadersList.forEach((headerName, index) => {
        const config = selectedHeaders[headerName] || { propagate: false, transform: false };

        const item = document.createElement('div');
        item.className = 'header-item';
        item.innerHTML = `
            <div>
                <input type="checkbox" id="header-${index}" ${config.propagate ? 'checked' : ''}
                    onchange="updateHeaderConfig('${headerName}', 'propagate', this.checked)">
                <label for="header-${index}" class="header-label" style="margin-left: 8px;">${headerName}</label>
            </div>
            <div>
                <label class="header-label">
                    <input type="checkbox" id="transform-${index}" ${config.transform ? 'checked' : ''}
                        onchange="updateHeaderConfig('${headerName}', 'transform', this.checked)">
                    Add transformation
                </label>
            </div>
            <div style="min-width: 80px; text-align: center;">
                ${allHeaders.has(headerName) ? '🔍 Detected' : '⭐ Default'}
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

// Handle form submission
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

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

        // Get selected SDK types
        const selectedSDKTypes = Array.from(sdkTypeCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        if (selectedSDKTypes.length === 0) {
            throw new Error('Please select at least one SDK type');
        }

        const moduleName = moduleNameInput.value || 'api';
        const baseURL = baseURLInput.value || undefined;

        // Get Java options if needed
        const javaPackage = document.getElementById('packageName').value || 'com.example.api';
        const groupId = document.getElementById('groupId').value || 'com.example';
        const artifactId = document.getElementById('artifactId').value || 'api-service';
        const javaVersion = document.getElementById('javaVersion').value || '21';

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

            // Aggregate all specs
            aggregatedSpec = await generator.aggregateSpecs(parsedAPIs, {
                name: aggregatedSpecName,
                enableCO2Tracking: enableCO2Tracking
            });

            console.log('Aggregated spec:', aggregatedSpec);
            console.log(`Aggregated ${parsedAPIs.length} specifications`);

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
                const specYaml = jsyaml.dump(aggregatedSpec);
                const previewWindow = window.open('', '_blank');
                previewWindow.document.write(`
                    <html>
                    <head>
                        <title>Aggregated Spec Preview - ${aggregatedSpecName}</title>
                        <style>
                            body { font-family: 'Courier New', monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
                            pre { white-space: pre-wrap; word-wrap: break-word; }
                            h1 { color: #4FC3F7; }
                            .info { background: #2d2d30; padding: 10px; border-left: 3px solid #4FC3F7; margin-bottom: 20px; }
                        </style>
                    </head>
                    <body>
                        <h1>Aggregated OpenAPI Specification</h1>
                        <div class="info">
                            <strong>Name:</strong> ${aggregatedSpecName}<br>
                            <strong>Source APIs:</strong> ${parsedAPIs.length}<br>
                            <strong>CO2 Tracking:</strong> ${enableCO2Tracking ? 'Enabled' : 'Disabled'}
                        </div>
                        <pre>${specYaml}</pre>
                    </body>
                    </html>
                `);
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
});

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
