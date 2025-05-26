export class SiteImporter {
    constructor(siteMappingsContainer, addSiteMappingRow, validateInputs, countSiteMappings, mappingError) {
        this.siteMappingsContainer = siteMappingsContainer;
        this.addSiteMappingRow = addSiteMappingRow;
        this.validateInputs = validateInputs;
        this.countSiteMappings = countSiteMappings;
        this.mappingError = mappingError;
        this.uploadArea = document.getElementById('upload-or-drag-drop');
        
        // Initialize drag and drop events
        this.initDragAndDrop();
    }

    initDragAndDrop() {
        if (!this.uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => {
                this.uploadArea.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => {
                this.uploadArea.classList.remove('drag-over');
            });
        });

        this.uploadArea.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFile(file);
            }
        });

        // Click to upload - only when expanded
        this.uploadArea.addEventListener('click', () => {
            if (this.uploadArea.classList.contains('expanded')) {
                this.importMappings();
            }
        });
    }

    handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.json')) {
            this.showNotification('Please upload a JSON file.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const mappings = JSON.parse(content);

                // Validate the JSON structure
                if (typeof mappings !== 'object' || mappings === null) {
                    throw new Error('Invalid JSON format: must be an object');
                }

                // Clear existing mappings
                this.siteMappingsContainer.innerHTML = '';

                // Add each mapping
                Object.entries(mappings).forEach(([key, value]) => {
                    if (typeof key === 'string' && typeof value === 'string') {
                        this.addSiteMappingRow(key.trim().toLowerCase(), value.trim(), false);
                    }
                });

                // Update counts and validate
                this.countSiteMappings();
                this.validateInputs();

                // Show success message
                this.showNotification('Import successful!', 'success');
                
                // Reset the import area
                const importContainer = document.querySelector('.import-site-data-container');
                const siteMappingsHeader = document.getElementById('site-mappings-header');
                const siteMappingsContainer = document.getElementById('site-mappings-container');
                
                if (importContainer) importContainer.style.display = 'none';
                if (siteMappingsHeader) siteMappingsHeader.style.display = 'block';
                if (siteMappingsContainer) siteMappingsContainer.style.display = 'block';
                
            } catch (error) {
                console.error('Import error:', error);
                this.showNotification('Error importing file. Please ensure it\'s a valid JSON format.', 'error');
            }
        };

        reader.onerror = () => {
            this.showNotification('Error reading file.', 'error');
        };

        reader.readAsText(file);
    }

    importMappings() {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';

        // Add file input to document
        document.body.appendChild(fileInput);

        // Handle file selection
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.handleFile(file);
            }
        });

        // Trigger file selection
        fileInput.click();

        // Clean up
        fileInput.addEventListener('blur', () => {
            document.body.removeChild(fileInput);
        });
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.color = 'white';
        notification.style.zIndex = '1000';
        notification.style.textAlign = 'center';

        if (type === 'success') {
            notification.style.backgroundColor = '#27ae60';
        } else {
            notification.style.backgroundColor = '#e74c3c';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }
} 