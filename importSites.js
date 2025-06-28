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

                // Process the imported mappings
                this.processMappings(mappings);
                
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

    // Process imported mappings with duplicate checking
    processMappings(mappings) {
        // Get current mappings
        const currentMappings = this.getCurrentMappings();
        
        // Track duplicates and conflicts
        const exactDuplicates = [];
        const partialMatches = [];
        const newMappings = {};
        
        // Check each imported mapping
        Object.entries(mappings).forEach(([key, value]) => {
            if (typeof key !== 'string' || typeof value !== 'string') return;
            
            const normalizedKey = key.trim().toLowerCase();
            const normalizedValue = value.trim();
            
            // Check for exact duplicates (both key and value match)
            if (currentMappings[normalizedKey] === normalizedValue) {
                exactDuplicates.push({ key: normalizedKey, value: normalizedValue });
            }
            // Check for partial matches (either key or value matches)
            else if (currentMappings[normalizedKey] || this.valueExistsInMappings(normalizedValue, currentMappings)) {
                partialMatches.push({
                    importedKey: normalizedKey,
                    importedValue: normalizedValue,
                    existingValue: currentMappings[normalizedKey],
                    existingKey: this.getKeyByValue(normalizedValue, currentMappings)
                });
            } 
            // New mapping
            else {
                newMappings[normalizedKey] = normalizedValue;
            }
        });
        
        // If there are partial matches, show merge options
        if (partialMatches.length > 0) {
            this.showMergeOptions(partialMatches, newMappings, exactDuplicates);
        } else {
            // Add new mappings directly
            this.addNewMappings(newMappings);
            
            // Show duplicates popup if any were found
            if (exactDuplicates.length > 0) {
                this.showDuplicatesPopup(exactDuplicates, Object.keys(newMappings).length);
            } else {
                this.showNotification(`Import complete: ${Object.keys(newMappings).length} mappings added`, 'success');
                this.resetImportArea();
            }
        }
    }
    
    // Get current mappings from the UI
    getCurrentMappings() {
        const mappings = {};
        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
        
        rows.forEach(row => {
            const key = row.querySelector('.site-key').value.trim().toLowerCase();
            const value = row.querySelector('.site-value').value.trim();
            if (key && value) {
                mappings[key] = value;
            }
        });
        
        return mappings;
    }
    
    // Check if a value exists in the mappings
    valueExistsInMappings(value, mappings) {
        return Object.values(mappings).some(v => v === value);
    }
    
    // Get key by value in mappings
    getKeyByValue(value, mappings) {
        for (const [key, val] of Object.entries(mappings)) {
            if (val === value) return key;
        }
        return null;
    }
    
    // Show merge options for partial matches
    showMergeOptions(partialMatches, newMappings, exactDuplicates) {
        // Create modal container
        const mergeModal = document.createElement('div');
        mergeModal.className = 'modal';
        mergeModal.style.display = 'block';
        mergeModal.style.zIndex = '1001';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '600px';
        
        // Add header
        const header = document.createElement('div');
        header.innerHTML = `
            <h2>Resolve Conflicts</h2>
            <p>The following site mappings have conflicts with existing entries.</p>
        `;
        
        // Create conflicts table
        const conflictsTable = document.createElement('div');
        conflictsTable.className = 'conflicts-table';
        conflictsTable.style.maxHeight = '300px';
        conflictsTable.style.overflowY = 'auto';
        conflictsTable.style.marginBottom = '20px';
        
        // Add table header
        conflictsTable.innerHTML = `
            <div class="conflicts-row header" style="display: grid; grid-template-columns: 0.1fr 1fr 1fr 1fr; font-weight: bold; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                <div style="padding-left: 1rem;">#</div>
                <div style="padding-left: 1rem;">Imported</div>
                <div style="padding-left: 1rem;">Existing</div>
                <div style="padding-left: 1rem;">Action</div>
            </div>
        `;
        
        // Add each conflict row
        partialMatches.forEach((match, index) => {
            const conflictRow = document.createElement('div');
            conflictRow.className = 'conflicts-row';
            conflictRow.style.display = 'grid';
            conflictRow.style.gridTemplateColumns = '0.1fr 1fr 1fr 1fr';
            conflictRow.style.padding = '10px 0';
            conflictRow.style.borderBottom = '1px solid var(--border-color)';
            
            // Number cell - using the same class as formatted results
            const numberCell = document.createElement('span');
            numberCell.className = 'line-number';
            numberCell.style.paddingLeft = '1rem';
            numberCell.textContent = `${index + 1}. `;
            
            // Imported mapping
            const importedCell = document.createElement('div');
            importedCell.innerHTML = `<strong>${match.importedKey}</strong> → ${match.importedValue}`;
            importedCell.style.paddingLeft = '1rem';
            
            // Existing mapping
            const existingCell = document.createElement('div');
            existingCell.style.paddingLeft = '1rem';
            if (match.existingValue) {
                existingCell.innerHTML = `<strong>${match.importedKey}</strong> → ${match.existingValue}`;
            } else if (match.existingKey) {
                existingCell.innerHTML = `<strong>${match.existingKey}</strong> → ${match.importedValue}`;
            }
            
            // Action cell with radio buttons
            const actionCell = document.createElement('div');
            actionCell.style.paddingLeft = '1rem';
            
            // Merge options
            // Only show merge options if there's a key conflict (same key, different values)
            if (match.existingValue) {
                // Merge Existing with New
                const mergeExistingWithNewLabel = document.createElement('label');
                mergeExistingWithNewLabel.style.display = 'block';
                mergeExistingWithNewLabel.style.marginBottom = '5px';
                
                const mergeExistingWithNewRadio = document.createElement('input');
                mergeExistingWithNewRadio.type = 'radio';
                mergeExistingWithNewRadio.name = `conflict-${index}`;
                mergeExistingWithNewRadio.value = 'merge-existing-new';
                
                mergeExistingWithNewLabel.appendChild(mergeExistingWithNewRadio);
                mergeExistingWithNewLabel.appendChild(document.createTextNode(' Merge Existing with New'));
                
                // Merge New with Existing
                const mergeNewWithExistingLabel = document.createElement('label');
                mergeNewWithExistingLabel.style.display = 'block';
                mergeNewWithExistingLabel.style.marginBottom = '5px';
                
                const mergeNewWithExistingRadio = document.createElement('input');
                mergeNewWithExistingRadio.type = 'radio';
                mergeNewWithExistingRadio.name = `conflict-${index}`;
                mergeNewWithExistingRadio.value = 'merge-new-existing';
                
                mergeNewWithExistingLabel.appendChild(mergeNewWithExistingRadio);
                mergeNewWithExistingLabel.appendChild(document.createTextNode(' Merge New with Existing'));
                
                actionCell.appendChild(mergeExistingWithNewLabel);
                actionCell.appendChild(mergeNewWithExistingLabel);
            }
            
            // Keep both option
            const keepBothLabel = document.createElement('label');
            keepBothLabel.style.display = 'block';
            keepBothLabel.style.marginBottom = '5px';
            
            const keepBothRadio = document.createElement('input');
            keepBothRadio.type = 'radio';
            keepBothRadio.name = `conflict-${index}`;
            keepBothRadio.value = 'keep-both';
            keepBothRadio.checked = true;
            
            keepBothLabel.appendChild(keepBothRadio);
            keepBothLabel.appendChild(document.createTextNode(' Keep Both'));
            
            // Replace existing option
            const replaceLabel = document.createElement('label');
            replaceLabel.style.display = 'block';
            replaceLabel.style.marginBottom = '5px';
            
            const replaceRadio = document.createElement('input');
            replaceRadio.type = 'radio';
            replaceRadio.name = `conflict-${index}`;
            replaceRadio.value = 'replace';
            
            replaceLabel.appendChild(replaceRadio);
            replaceLabel.appendChild(document.createTextNode(' Replace Existing'));
            
            actionCell.appendChild(keepBothLabel);
            actionCell.appendChild(replaceLabel);
            
            // Add cells to row
            conflictRow.appendChild(numberCell);
            conflictRow.appendChild(importedCell);
            conflictRow.appendChild(existingCell);
            conflictRow.appendChild(actionCell);
            
            // Add row to table
            conflictsTable.appendChild(conflictRow);
        });
        
        // Add buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '20px';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'clear-btn';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(mergeModal);
            this.resetImportArea();
        });
        
        const importButton = document.createElement('button');
        importButton.textContent = 'Import with Selected Options';
        importButton.className = 'save-sites-btn';
        importButton.addEventListener('click', () => {
            // Process each conflict based on selected option
            partialMatches.forEach((match, index) => {
                const selectedOption = document.querySelector(`input[name="conflict-${index}"]:checked`).value;
                
                if (selectedOption === 'keep-both') {
                    // Add the imported mapping (keep both)
                    newMappings[match.importedKey] = match.importedValue;
                } else if (selectedOption === 'replace') {
                    // Replace existing with imported
                    newMappings[match.importedKey] = match.importedValue;
                    
                    // If there was a key conflict, we need to mark the existing row for removal
                    if (match.existingValue) {
                        // Find and mark the row with this key for removal
                        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
                        rows.forEach(row => {
                            const key = row.querySelector('.site-key').value.trim().toLowerCase();
                            if (key === match.importedKey) {
                                row.classList.add('to-be-removed');
                            }
                        });
                    }
                } else if (selectedOption === 'merge-existing-new') {
                    // Merge existing value with new value
                    if (match.existingValue) {
                        const mergedValue = `${match.existingValue} ${match.importedValue}`;
                        newMappings[match.importedKey] = mergedValue;
                        
                        // Mark existing row for removal
                        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
                        rows.forEach(row => {
                            const key = row.querySelector('.site-key').value.trim().toLowerCase();
                            if (key === match.importedKey) {
                                row.classList.add('to-be-removed');
                            }
                        });
                    }
                } else if (selectedOption === 'merge-new-existing') {
                    // Merge new value with existing value
                    if (match.existingValue) {
                        const mergedValue = `${match.importedValue} ${match.existingValue}`;
                        newMappings[match.importedKey] = mergedValue;
                        
                        // Mark existing row for removal
                        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
                        rows.forEach(row => {
                            const key = row.querySelector('.site-key').value.trim().toLowerCase();
                            if (key === match.importedKey) {
                                row.classList.add('to-be-removed');
                            }
                        });
                    }
                }
            });
            
            // Remove marked rows
            const rowsToRemove = this.siteMappingsContainer.querySelectorAll('.site-row.to-be-removed');
            rowsToRemove.forEach(row => row.remove());
            
            // Add new mappings
            this.addNewMappings(newMappings);
            
            // Show duplicates popup if any were found
            if (exactDuplicates.length > 0) {
                this.showDuplicatesPopup(exactDuplicates, Object.keys(newMappings).length);
            } else {
                this.showNotification(`Import complete: ${Object.keys(newMappings).length} mappings added`, 'success');
                this.resetImportArea();
            }
            
            // Close modal and reset import area
            document.body.removeChild(mergeModal);
        });
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(importButton);
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(conflictsTable);
        modalContent.appendChild(buttonContainer);
        mergeModal.appendChild(modalContent);
        
        // Add to document
        document.body.appendChild(mergeModal);
    }
    
    // Add new mappings to the site mappings container
    addNewMappings(newMappings) {
        // Remove any empty rows
        const emptyRows = this.siteMappingsContainer.querySelectorAll('.site-row');
        emptyRows.forEach(row => {
            const key = row.querySelector('.site-key').value.trim();
            const value = row.querySelector('.site-value').value.trim();
            if (!key && !value) {
                row.remove();
            }
        });
        
        // Add each new mapping
        Object.entries(newMappings).forEach(([key, value]) => {
            this.addSiteMappingRow(key, value, false);
        });
        
        // Update counts and validate
        this.countSiteMappings(true);
        this.validateInputs();
        
        // Trigger save to persist changes
        const saveBtn = document.getElementById('save-sites-btn');
        if (saveBtn && Object.keys(newMappings).length > 0) {
            saveBtn.click();
        }
    }
    
    // Reset the import area
    resetImportArea() {
        const importContainer = document.querySelector('.import-site-data-container');
        const siteMappingsHeader = document.getElementById('site-mappings-header');
        const siteMappingsContainer = document.getElementById('site-mappings-container');
        const pasteTextarea = document.getElementById('paste-as-json-textarea');
        
        if (importContainer) importContainer.style.display = 'none';
        if (siteMappingsHeader) siteMappingsHeader.style.display = 'block';
        if (siteMappingsContainer) siteMappingsContainer.style.display = 'block';
        if (pasteTextarea) pasteTextarea.value = '';
        
        // Reset expanded/hidden classes
        if (this.uploadArea) {
            this.uploadArea.classList.remove('expanded', 'hidden', 'drag-over');
        }
        
        const pasteAsJson = document.getElementById('paste-as-json');
        if (pasteAsJson) {
            pasteAsJson.classList.remove('expanded', 'hidden');
        }
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

    // Show popup with skipped duplicates
    showDuplicatesPopup(duplicates, newMappingsCount) {
        // Create modal container
        const duplicatesModal = document.createElement('div');
        duplicatesModal.className = 'modal';
        duplicatesModal.style.display = 'block';
        duplicatesModal.style.zIndex = '1001';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content duplicates-modal';
        modalContent.style.maxWidth = '500px';
        
        // Add header
        const header = document.createElement('div');
        header.innerHTML = `
            <h2>Skipped Duplicates</h2>
            <p>${duplicates.length} duplicate mapping${duplicates.length !== 1 ? 's were' : ' was'} skipped because they already exist.</p>
            <p>${newMappingsCount} new mapping${newMappingsCount !== 1 ? 's were' : ' was'} added successfully.</p>
        `;
        
        // Create duplicates table
        const duplicatesTable = document.createElement('div');
        duplicatesTable.className = 'conflicts-table';
        duplicatesTable.style.maxHeight = '300px';
        duplicatesTable.style.overflowY = 'auto';
        duplicatesTable.style.marginBottom = '20px';
        
        // Add table header
        duplicatesTable.innerHTML = `
            <div class="conflicts-row header" style="display: grid; grid-template-columns: 0.1fr 1fr 1fr; font-weight: bold; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                <div style="padding-left: 1rem;">#</div>
                <div style="padding-left: 1rem;">Site Key</div>
                <div style="padding-left: 1rem;">Display Name</div>
            </div>
        `;
        
        // Add each duplicate row
        duplicates.forEach((duplicate, index) => {
            const duplicateRow = document.createElement('div');
            duplicateRow.className = 'conflicts-row';
            duplicateRow.style.display = 'grid';
            duplicateRow.style.gridTemplateColumns = '0.1fr 1fr 1fr';
            duplicateRow.style.padding = '10px 0';
            duplicateRow.style.borderBottom = '1px solid var(--border-color)';
            
            // Number cell - using the same class as formatted results
            const numberCell = document.createElement('span');
            numberCell.className = 'line-number';
            numberCell.style.paddingLeft = '1rem';
            numberCell.textContent = `${index + 1}. `;
            
            // Key cell
            const keyCell = document.createElement('div');
            keyCell.textContent = duplicate.key;
            keyCell.style.paddingLeft = '1rem';
            
            // Value cell
            const valueCell = document.createElement('div');
            valueCell.textContent = duplicate.value;
            valueCell.style.paddingLeft = '1rem';
            
            // Add cells to row
            duplicateRow.appendChild(numberCell);
            duplicateRow.appendChild(keyCell);
            duplicateRow.appendChild(valueCell);
            
            // Add row to table
            duplicatesTable.appendChild(duplicateRow);
        });
        
        // Add OK button
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.marginTop = '20px';
        
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = 'save-sites-btn';
        okButton.addEventListener('click', () => {
            document.body.removeChild(duplicatesModal);
            this.resetImportArea();
        });
        
        buttonContainer.appendChild(okButton);
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(duplicatesTable);
        modalContent.appendChild(buttonContainer);
        duplicatesModal.appendChild(modalContent);
        
        // Add to document
        document.body.appendChild(duplicatesModal);
    }
} 