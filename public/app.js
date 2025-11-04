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

// Update file name display
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = file.name;
        fileName.classList.add('selected');
    } else {
        fileName.textContent = 'Choose OpenAPI file (YAML or JSON)';
        fileName.classList.remove('selected');
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
        const file = fileInput.files[0];
        if (!file) {
            throw new Error('Please select a file');
        }

        const moduleName = moduleNameInput.value || 'api';
        const baseURL = baseURLInput.value || undefined;

        // Read file content
        progressBar.style.width = '20%';
        const fileContent = await file.text();

        // Parse OpenAPI spec
        progressBar.style.width = '40%';
        progressText.textContent = 'Parsing OpenAPI specification...';

        const generator = new window.SDKGenerator();
        const parsedAPI = await generator.parseOpenAPISpec(fileContent, file.name, baseURL);

        console.log('Parsed API:', parsedAPI);
        console.log(`Found ${parsedAPI.operations.length} operations`);
        console.log(`Found ${parsedAPI.schemas.length} schemas`);

        // Generate SDK files
        progressBar.style.width = '60%';
        progressText.textContent = 'Generating SDK files...';

        const sdkFiles = await generator.generateSDK(parsedAPI, moduleName);

        console.log('Generated files:', Object.keys(sdkFiles));

        // Create ZIP file
        progressBar.style.width = '80%';
        progressText.textContent = 'Creating ZIP archive...';

        const zip = new JSZip();

        // Add all generated files to zip
        for (const [filename, content] of Object.entries(sdkFiles)) {
            zip.file(filename, content);
        }

        // Generate ZIP blob
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        // Download the file
        progressBar.style.width = '90%';
        progressText.textContent = 'Preparing download...';

        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${moduleName}-sdk.zip`;
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
            fileName.textContent = 'Choose OpenAPI file (YAML or JSON)';
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
