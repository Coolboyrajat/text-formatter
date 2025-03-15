
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

// Server-side code (Only runs if this file is executed with Node.js)
if (typeof window === 'undefined') {
    const express = require('express');
    const path = require('path');
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Serve static files
    app.use(express.static(__dirname));

    // Send index.html for the root route
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
}

// Default mappings that will always be available and preserved
const defaultSiteNameMapping = {
    'anilos': 'Anilos',
    'analvids': 'AnalVids',
    'btb': 'BigTitsBoss',
    'blacksonblondes': 'BlacksOnBlondes',
    'brazzersexxtra': 'BrazzersExxtra',
    'brattymilf': 'BrattyMILF',
    'brattysis': 'BrattySis',
    'clubsweethearts': 'ClubSweethearts',
    'clips4sale': 'Clips4Sale',
    'dirtyauditions': 'DirtyAuditions',
    'dorcelclub': 'DorcelClub',
    'evilangel': 'EvilAngel',
    'exploitedteens': 'ExploitedTeens',
    'familyxxx': 'FamilyXXX',
    'hookuphotshot': 'HookupHotshot',
    'julesjorder': 'JulesJordan',
    'loan4k': 'Loan4K',
    'maturenl': 'MatureNL',
    'mysisterhotfriend': 'MySistersHotFriend',
    'mydirtyhobby': 'MyDirtyHobby',
    'mypervyfamily': 'MyPervyFamily',
    'nublies': 'Nubiles',
    'pornbox': 'PornBox',
    'pornfidelity': 'PornFidelity',
    'pornmegaload': 'PornMegaLoad',
    'pornworld': 'PornWorld',
    'povmasters': 'POVMasters',
    'sexart': 'SexArt',
    'sexmex': 'SexMex',
    'swallowed': 'Swallowed',
    'thepovgod': 'ThePOVGod',
    'youthlust': 'YouthLust'
};
// App class to encapsulate application logic
class VideoFilenameFormatter {
    constructor() {
        this.siteNameMapping = Object.assign({}, defaultSiteNameMapping);
        this.pendingSort = false;
        this.sortTimeout = null;
        this.isOnline = navigator.onLine;
        this.db = null;
        this.siteCollection = null;
        // Initialize DOM elements
        this.connectionStatus = document.getElementById('connection-status');
        this.formatBtn = document.getElementById('format-btn');
        this.inputText = document.getElementById('input-text');
        this.resultElement = document.getElementById('result');
        this.outputContainer = document.getElementById('output-container');
        this.copyBtnContainer = document.getElementById('copy-btn-container');
        this.manageSitesBtn = document.getElementById('manage-sites-btn');
        this.siteModal = document.getElementById('site-modal');
        this.closeModalBtn = document.querySelector('.close');
        this.siteMappingsContainer = document.getElementById('site-mappings-container');
        this.addSiteBtn = document.getElementById('add-site-btn');
        this.saveSitesBtn = document.getElementById('save-sites-btn');
        this.mappingError = document.getElementById('mapping-error');
        this.themeToggle = document.getElementById('theme-toggle');
        this.themeIcon = document.getElementById('theme-icon');
        // Initialize event listeners
        this.initEventListeners();
        this.updateConnectionStatus();
        // Apply saved theme if available
        this.initTheme();
        // Initialize database connection
        this.initMongoDB().then(() => {
            console.log('MongoDB initialization complete');
        }).catch(err => {
            console.error('MongoDB initialization failed:', err);
            // Fall back to local storage
            this.loadSavedMappings();
        });
    }
    initEventListeners() {
        this.formatBtn.addEventListener('click', () => this.formatHandler());

        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearInputHandler());
            // Initially hide clear button
            clearBtn.style.display = 'none';
        }
        
        // Add input event listener for clear button visibility
        this.inputText.addEventListener('input', () => this.updateClearButtonVisibility());

        this.manageSitesBtn.addEventListener('click', () => {
            this.populateSiteMappings();
            this.mappingError.style.display = 'none';
            this.siteModal.style.display = 'block';
        });
        this.closeModalBtn.addEventListener('click', () => {
            this.siteModal.style.display = 'none';
        });
        window.addEventListener('click', (event) => {
            if (event.target === this.siteModal) {
                this.siteModal.style.display = 'none';
            }
        });
        this.addSiteBtn.addEventListener('click', () => {
            this.addEmptySiteRow();
        });
        this.saveSitesBtn.addEventListener('click', () => this.saveSiteMappingsHandler());
        // Network status listeners
        window.addEventListener('online', () => {
            this.updateConnectionStatus();
            // Try to sync with DB when we come back online
            this.initMongoDB();
        });
        window.addEventListener('offline', () => this.updateConnectionStatus());
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    updateConnectionStatus() {
        this.isOnline = navigator.onLine;
        
        // For MongoDB connection check
        if (this.isOnline && this.siteCollection) {
            this.connectionStatus.className = 'connection-status online';
            this.connectionStatus.textContent = 'Connected to DB';
        }
        else if (this.isOnline) {
            this.connectionStatus.className = 'connection-status online';
            this.connectionStatus.textContent = 'Online (Local Mode)';
        }
        else {
            this.connectionStatus.className = 'connection-status offline';
            this.connectionStatus.textContent = 'Offline';
        }
        
        // Show a temporary notification when connection status changes
        this.connectionStatus.classList.remove('collapsed');

        // Auto-hide the connection status after 5 seconds
        setTimeout(() => {
            this.connectionStatus.classList.add('collapsed');
        }, 5000);

        // Add hover behavior to show full status
        this.connectionStatus.addEventListener('mouseenter', () => {
            this.connectionStatus.classList.remove('collapsed');
        });

        this.connectionStatus.addEventListener('mouseleave', () => {
            if (!this.connectionStatus.classList.contains('collapsed')) {
                setTimeout(() => {
                    this.connectionStatus.classList.add('collapsed');
                }, 2000);
            }
        });
    }
    initMongoDB() {
        return __awaiter(this, void 0, void 0, function* () {
            // Always load local storage first for immediate response
            this.loadSavedMappings();
            
            if (!this.isOnline) {
                console.log('Offline mode: Using local storage and default mappings');
                this.connectionStatus.textContent = 'Offline';
                this.connectionStatus.className = 'connection-status offline';
                return;
            }
            
            // MongoDB Atlas App ID - Replace with your actual ID when deploying
            const APP_ID = 'your-actual-mongodb-app-id';
            
            try {
                // Initialize MongoDB using our helper
                const result = yield window.MongoDBHelper.init(APP_ID);
                
                if (result.success) {
                    this.siteCollection = true; // Just a flag to indicate we're connected
                    this.connectionStatus.textContent = 'Connected to MongoDB';
                    this.connectionStatus.className = 'connection-status online';
                    console.log('Connected to MongoDB Atlas');
                    
                    // Fetch mappings from database
                    yield this.loadMappingsFromDB();
                } else {
                    console.log('Using local storage only:', result.message);
                    this.connectionStatus.textContent = 'Offline';
                    this.connectionStatus.className = 'connection-status offline';
                }
            } catch (error) {
                console.error('MongoDB connection error:', error);
                this.connectionStatus.textContent = 'Offline';
                this.connectionStatus.className = 'connection-status offline';
            }
        });
    }
    loadMappingsFromDB() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isOnline || !window.MongoDBHelper.isConnected()) {
                // Fall back to local storage if offline or not connected
                this.loadSavedMappings();
                return;
            }
            
            try {
                const result = yield window.MongoDBHelper.getAllMappings();
                
                if (result.success && result.data) {
                    // Create a combined mapping with defaults and DB mappings
                    const combinedMappings = Object.assign(Object.assign({}, defaultSiteNameMapping), result.data);
                    
                    // Sort the combined mappings alphabetically
                    const sortedKeys = Object.keys(combinedMappings).sort();
                    this.siteNameMapping = {};
                    
                    // Rebuild the mapping with sorted keys
                    sortedKeys.forEach(key => {
                        this.siteNameMapping[key] = combinedMappings[key];
                    });
                    
                    console.log('Loaded mappings from MongoDB');
                }
            } catch (error) {
                console.error('Error loading mappings from MongoDB:', error);
                // Fall back to local storage
                this.loadSavedMappings();
            }
        });
    }
    saveMappingsToDB(mappings) {
        return __awaiter(this, void 0, void 0, function* () {
            // Always save to local storage for offline access
            localStorage.setItem('siteNameMappings', JSON.stringify(mappings));
            
            if (!this.isOnline || !window.MongoDBHelper.isConnected()) {
                // If offline or not connected, we already saved to localStorage
                return false;
            }
            
            try {
                const result = yield window.MongoDBHelper.saveMappings(mappings);
                
                if (result.success) {
                    console.log('Saved mappings to MongoDB');
                    return true;
                } else {
                    console.error('Failed to save to MongoDB:', result.message);
                    return false;
                }
            } catch (error) {
                console.error('Error saving mappings to MongoDB:', error);
                return false;
            }
        });
    }
    loadSavedMappings() {
        const savedMappings = localStorage.getItem('siteNameMappings');
        if (savedMappings) {
            try {
                // Load saved mappings
                const parsedMappings = JSON.parse(savedMappings);
                // Create a combined mapping with defaults and saved mappings
                const combinedMappings = Object.assign(Object.assign({}, defaultSiteNameMapping), parsedMappings);
                // Sort the combined mappings alphabetically
                const sortedKeys = Object.keys(combinedMappings).sort();
                this.siteNameMapping = {};
                // Rebuild the mapping with sorted keys
                sortedKeys.forEach(key => {
                    this.siteNameMapping[key] = combinedMappings[key];
                });
                console.log('Loaded mappings from localStorage');
            }
            catch (e) {
                console.error("Error loading saved mappings:", e);
            }
        }
    }
    formatVideoInfo(input) {
        if (!input.trim())
            return "";
            
        // Split by both commas and newlines
        const files = input.split(/[,\n]/).map(file => file.trim()).filter(Boolean);
        
        // Process each file
        return files.map(file => {
            // Determine if file has spaces or periods as separators
            const hasSpaces = file.includes(' ') && file.split(' ').length > 3;
            const hasPeriods = file.includes('.') && file.split('.').length > 3;
            
            if (!hasSpaces && !hasPeriods) {
                return `[Error] Invalid filename format: ${file}`;
            }
            
            let siteName, date, title, resolution;
            
            if (hasPeriods) {
                // Handle period-separated format (original logic)
                const parts = file.split('.');
                
                // Check for unmapped site name, but continue processing anyway
                const siteKey = parts[0].toLowerCase();
                siteName = siteKey in this.siteNameMapping
                    ? this.siteNameMapping[siteKey]
                    : parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                    
                date = parts.slice(1, 4).join('.');
                const has4K = parts.some(part => part.toLowerCase() === '4k');
                const performerParts = parts.slice(4).filter(part => 
                    part.toLowerCase() !== '4k' && 
                    !['2160p', '1080p', '720p', '480p'].includes(part.toLowerCase())
                );
                title = performerParts.map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(' ');
                
                // Determine resolution
                resolution = '1080p';
                if (has4K) {
                    resolution = '[2160p][4K]';
                } else {
                    const resolutionMap = {
                        '2160p': '[2160p]',
                        '1080p': '1080p',
                        '720p': '720p',
                        '480p': '480p'
                    };
                    for (const part of parts) {
                        const lowerPart = part.toLowerCase();
                        if (lowerPart in resolutionMap) {
                            resolution = resolutionMap[lowerPart];
                            break;
                        }
                    }
                }
            } else {
                // Handle space-separated format (new logic)
                const parts = file.split(' ');
                
                // Site name is the first part
                const siteKey = parts[0].toLowerCase();
                siteName = siteKey in this.siteNameMapping
                    ? this.siteNameMapping[siteKey]
                    : parts[0];
                
                // Try to detect if the next 3 parts are dates
                const datePattern = /^(\d{2})$/;  // Match 2 digits
                let dateIndex = -1;
                
                // Look for 3 consecutive date parts
                for (let i = 1; i < parts.length - 2; i++) {
                    if (datePattern.test(parts[i]) && 
                        datePattern.test(parts[i+1]) && 
                        datePattern.test(parts[i+2])) {
                        dateIndex = i;
                        break;
                    }
                }
                
                if (dateIndex > 0) {
                    // Format date parts with periods
                    date = [parts[dateIndex], parts[dateIndex+1], parts[dateIndex+2]].join('.');
                    
                    // Title starts after date parts
                    const titleParts = parts.slice(dateIndex + 3).filter(part => {
                        const lowerPart = part.toLowerCase();
                        return !['xxx', 'mp4', 'mkv', 'wmv', 'mp4-wrb'].includes(lowerPart) &&
                               !lowerPart.includes('1080p') &&
                               !lowerPart.includes('2160p') &&
                               !lowerPart.includes('720p') &&
                               !lowerPart.includes('480p');
                    });
                    
                    title = titleParts.join(' ');
                } else {
                    // Fallback: assume no date format, just studio and title
                    title = parts.slice(1).join(' ');
                    date = 'XX.XX.XX'; // Placeholder
                }
                
                // Detect resolution
                resolution = '1080p'; // Default
                if (file.toLowerCase().includes('2160p') || file.toLowerCase().includes('4k')) {
                    resolution = '[2160p][4K]';
                } else if (file.toLowerCase().includes('1080p')) {
                    resolution = '1080p';
                } else if (file.toLowerCase().includes('720p')) {
                    resolution = '720p';
                } else if (file.toLowerCase().includes('480p')) {
                    resolution = '480p';
                }
            }
            
            // Make sure we don't duplicate the resolution in the title
            const titleParts = title.split(' ');
            const containsResolution = titleParts.some(part => 
                part.toLowerCase() === resolution.toLowerCase() || 
                part.toLowerCase() === '1080p' ||
                part.toLowerCase() === '2160p' ||
                part.toLowerCase() === '720p' ||
                part.toLowerCase() === '480p' ||
                part.toLowerCase() === '4k'
            );
            
            if (containsResolution) {
                // Remove resolution from title to avoid duplication
                const filteredTitle = titleParts.filter(part => 
                    part.toLowerCase() !== resolution.toLowerCase() &&
                    part.toLowerCase() !== '1080p' &&
                    part.toLowerCase() !== '2160p' &&
                    part.toLowerCase() !== '720p' &&
                    part.toLowerCase() !== '480p' &&
                    part.toLowerCase() !== '4k'
                ).join(' ');
                
                return `[${siteName}] - ${date} - ${filteredTitle} ${resolution}.mp4`;
            } else {
                return `[${siteName}] - ${date} - ${title} ${resolution}.mp4`;
            }
        }).join('\n');
    }
    
    handleUnmappedSites(unmappedSites, originalInput) {
        // Open the site modal
        this.populateSiteMappings();
        this.siteModal.style.display = 'block';
        
        // Add alert message
        const alertDiv = document.createElement('div');
        alertDiv.className = 'unmapped-sites-alert';
        alertDiv.innerHTML = `<strong>New site names detected!</strong><br>Please provide display names for the following site keys:`;
        
        // Get current site mappings to check which ones are already in the modal
        const currentRows = this.siteMappingsContainer.querySelectorAll('.site-row');
        const currentKeys = Array.from(currentRows).map(row => 
            row.querySelector('.site-key').value.toLowerCase());
        
        // Add the unmapped sites to the modal if they don't already exist
        unmappedSites.forEach(site => {
            if (!currentKeys.includes(site)) {
                const row = this.addSiteMappingRow(site, '', true);
                row.classList.add('highlight-row');
                
                // Focus on the value input of the first unmapped site
                if (site === unmappedSites[0]) {
                    setTimeout(() => {
                        const valueInput = row.querySelector('.site-value');
                        valueInput.focus();
                    }, 300);
                }
            }
        });
        
        // Insert alert before the site mappings container
        const modalContent = document.querySelector('.modal-content');
        modalContent.insertBefore(alertDiv, this.siteMappingsContainer);
        
        // Modify save button to handle the pending format operation
        const originalSaveBtnClickHandler = this.saveSitesBtn.onclick;
        this.saveSitesBtn.onclick = () => {
            // Check if all unmapped sites have values
            let allMapped = true;
            unmappedSites.forEach(site => {
                const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
                let found = false;
                rows.forEach(row => {
                    const keyInput = row.querySelector('.site-key');
                    const valueInput = row.querySelector('.site-value');
                    if (keyInput.value.toLowerCase() === site && valueInput.value.trim()) {
                        found = true;
                    }
                });
                if (!found) allMapped = false;
            });
            
            if (allMapped) {
                // Save the mappings
                this.saveSiteMappingsHandler().then(() => {
                    // Remove the alert
                    if (alertDiv.parentNode) {
                        alertDiv.parentNode.removeChild(alertDiv);
                    }
                    
                    // Reset the save button handler
                    this.saveSitesBtn.onclick = originalSaveBtnClickHandler;
                    
                    // Re-run the format operation
                    const result = this.formatVideoInfo(originalInput);
                    this.displayFormattedResult(result);
                });
            } else {
                // Show error if not all unmapped sites have values
                this.mappingError.textContent = 'Please provide display names for all unmapped sites.';
                this.mappingError.style.display = 'block';
            }
        };
        
        return ""; // Return empty string as we're handling the display in the modal
    }
    
    displayFormattedResult(result) {
        this.copyBtnContainer.innerHTML = '';
        this.resultElement.innerHTML = '';
        
        if (result && result.trim()) {
            // Split the result into lines
            const lines = result.split('\n').filter(line => line.trim());
            
            if (lines.length > 0) {
                const resultFragment = document.createDocumentFragment();
                
                // Create numbered lines with copy buttons
                lines.forEach((line, index) => {
                    const lineContainer = document.createElement('div');
                    lineContainer.className = 'result-line';
                    
                    // Line number
                    const lineNumber = document.createElement('span');
                    lineNumber.className = 'line-number';
                    lineNumber.textContent = `${index + 1}. `;
                    
                    // Line content
                    const lineContent = document.createElement('span');
                    lineContent.className = 'line-content';
                    lineContent.textContent = line;
                    
                    // Line copy button
                    const lineCopyBtn = document.createElement('button');
                    lineCopyBtn.className = 'line-copy-btn';
                    lineCopyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
                    lineCopyBtn.title = "Copy this line";
                    lineCopyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(line).then(() => {
                            lineCopyBtn.classList.add('copied');
                            setTimeout(() => {
                                lineCopyBtn.classList.remove('copied');
                            }, 2000);
                        });
                    });
                    
                    // Append elements to line container
                    lineContainer.appendChild(lineNumber);
                    lineContainer.appendChild(lineContent);
                    lineContainer.appendChild(lineCopyBtn);
                    
                    // Add line to result
                    resultFragment.appendChild(lineContainer);
                });
                
                this.resultElement.appendChild(resultFragment);
                this.outputContainer.style.display = 'block';
                
                // Add copy all button if there are multiple lines or even just one valid line
                if (!result.includes('[Error]')) {
                    this.copyBtnContainer.appendChild(this.createCopyButton(lines.join('\n')));
                }
            } else {
                this.resultElement.textContent = 'No valid input provided.';
                this.outputContainer.style.display = 'block';
            }
        } else {
            this.resultElement.textContent = 'No valid input provided.';
            this.outputContainer.style.display = 'block';
        }
    }

    clearInputHandler() {
        this.inputText.value = '';
        this.outputContainer.style.display = 'none';
        this.updateClearButtonVisibility();
    }
    
    updateClearButtonVisibility() {
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.style.display = this.inputText.value.trim() ? 'inline-block' : 'none';
        }
    }
    formatHandler() {
        const input = this.inputText.value;
        const result = this.formatVideoInfo(input);
        
        // If there is a result, display it
        if (result !== undefined && result !== null) {
            this.displayFormattedResult(result);
        }
    }
    
    createCopyButton(text) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.id = 'copy-btn';
        copyBtn.textContent = 'Copy All to Clipboard';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text || '').then(() => {
                const originalText = copyBtn.textContent || '';
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
            });
        });
        return copyBtn;
    }
    sortSiteMappings() {
        if (this.pendingSort)
            return;
        this.pendingSort = true;
        const container = this.siteMappingsContainer;
        const rows = Array.from(container.querySelectorAll('.site-row'));
        if (rows.length <= 1) {
            this.pendingSort = false;
            return;
        }
        rows.forEach(row => {
            const rect = row.getBoundingClientRect();
            row.dataset.startY = rect.top;
        });
        rows.sort((a, b) => {
            const keyA = a.querySelector('.site-key').value.toLowerCase();
            const keyB = b.querySelector('.site-key').value.toLowerCase();
            return keyA.localeCompare(keyB);
        });
        rows.forEach(row => row.remove());
        rows.forEach(row => { container.appendChild(row); });
        rows.forEach(row => {
            const rect = row.getBoundingClientRect();
            const startY = parseFloat(row.dataset.startY);
            const endY = rect.top;
            const deltaY = startY - endY;
            row.style.transform = `translateY(${deltaY}px)`;
            row.style.opacity = '0.7';
            void row.offsetWidth;
            row.style.transform = 'translateY(0)';
            row.style.opacity = '1';
        });
        setTimeout(() => { this.pendingSort = false; }, 500);
    }
    populateSiteMappings() {
        this.siteMappingsContainer.innerHTML = '';
        const entries = Object.entries(this.siteNameMapping).sort((a, b) => a[0].localeCompare(b[0]));
        entries.forEach(([key, value]) => {
            this.addSiteMappingRow(key, value, false);
        });
    }
    validateInputs() {
        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
        let hasError = false;
        let hasVisibleInput = false;

        rows.forEach(row => {
            const keyInput = row.querySelector('.site-key');
            const valueInput = row.querySelector('.site-value');
            const keyVal = keyInput.value.trim();
            const valueVal = valueInput.value.trim();

            // Only validate if not currently focused
            if (!keyInput.matches(':focus') && !valueInput.matches(':focus')) {
                if ((keyVal && !valueVal) || (!keyVal && valueVal)) {
                    hasError = true;
                }
            } else {
                hasVisibleInput = true;
            }
        });

        // Only show error if there's an error and no inputs are currently focused
        this.mappingError.style.display = (hasError && !hasVisibleInput) ? 'block' : 'none';
        return !hasError;
    }
    addSiteMappingRow(key = '', value = '', isNew = true) {
        const row = document.createElement('div');
        row.className = 'site-row';
        
        // Create key input wrapper
        const keyWrapper = document.createElement('div');
        keyWrapper.className = 'input-wrapper';
        
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'site-key';
        keyInput.placeholder = 'Site Key';
        keyInput.value = key;
        
        // Create clear button for key input
        const keyClearBtn = document.createElement('button');
        keyClearBtn.className = 'clear-input';
        keyClearBtn.textContent = '×';
        keyClearBtn.type = 'button';
        keyClearBtn.addEventListener('click', () => {
            keyInput.value = '';
            keyInput.focus();
            this.validateInputs();
        });

        // Create arrow element
        const arrow = document.createElement('span');
        arrow.className = 'mapping-arrow';
        arrow.textContent = '→';

        // Create value input wrapper
        const valueWrapper = document.createElement('div');
        valueWrapper.className = 'input-wrapper';
        
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'site-value';
        valueInput.placeholder = 'Display Name';
        valueInput.value = value;
        
        // Create clear button for value input
        const valueClearBtn = document.createElement('button');
        valueClearBtn.className = 'clear-input';
        valueClearBtn.textContent = '×';
        valueClearBtn.type = 'button';
        valueClearBtn.addEventListener('click', () => {
            valueInput.value = '';
            valueInput.focus();
            this.validateInputs();
        });
        
        // Track inputs focus for validation
        keyInput.addEventListener('focus', () => {
            // Hide error message during input focus
            this.mappingError.style.display = 'none';
            // Reset borders during focus
            keyInput.style.border = '1px solid var(--border-color)';
            valueInput.style.border = '1px solid var(--border-color)';
        });

        valueInput.addEventListener('focus', () => {
            // Hide error message during input focus
            this.mappingError.style.display = 'none';
            // Reset borders during focus
            keyInput.style.border = '1px solid var(--border-color)';
            valueInput.style.border = '1px solid var(--border-color)';
        });

        // Only validate when user actually leaves both fields
        keyInput.addEventListener('blur', (e) => {
            // Check if the focus is moving to the clear button or the other input field
            if (!row.contains(e.relatedTarget)) {
                this.validateInputs();
            }
        });

        valueInput.addEventListener('blur', (e) => {
            // Check if the focus is moving to the clear button or the other input field
            if (!row.contains(e.relatedTarget)) {
                this.validateInputs();
            }
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'X';
        removeBtn.addEventListener('click', () => {
            row.style.opacity = '0';
            setTimeout(() => {
                row.remove();
                this.validateInputs();
            }, 300);
        });
        // Append elements to their wrappers
        keyWrapper.appendChild(keyInput);
        keyWrapper.appendChild(keyClearBtn);
        valueWrapper.appendChild(valueInput);
        valueWrapper.appendChild(valueClearBtn);
        
        // Append wrappers and other elements to row
        row.appendChild(keyWrapper);
        row.appendChild(arrow);
        row.appendChild(valueWrapper);
        row.appendChild(removeBtn);
        if (isNew) {
            this.siteMappingsContainer.appendChild(row);
            if (key !== '' && value !== '') {
                if (this.sortTimeout) {
                    clearTimeout(this.sortTimeout);
                }
                this.sortTimeout = window.setTimeout(() => {
                    this.sortSiteMappings();
                }, 300);
            }
        }
        else {
            this.siteMappingsContainer.appendChild(row);
        }
        return row;
    }
    addEmptySiteRow() {
        // Check if there are any incomplete rows before adding a new one
        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
        let canAddNew = true;
        rows.forEach(row => {
            const keyVal = row.querySelector('.site-key').value.trim();
            const valueVal = row.querySelector('.site-value').value.trim();
            if ((!keyVal && valueVal) || (keyVal && !valueVal) || (!keyVal && !valueVal)) {
                canAddNew = false;
                // Focus on the first empty input
                if (!keyVal) {
                    row.querySelector('.input-wrapper .site-key').focus();
                }
                else {
                    row.querySelector('.input-wrapper .site-value').focus();
                }
            }
        });
        if (!canAddNew) {
            this.mappingError.style.display = 'block';
            return null;
        }
        this.mappingError.style.display = 'none';
        const row = this.addSiteMappingRow('', '', true);
        const keyInput = row.querySelector('.site-key');
        keyInput.focus();
        return row;
    }
    saveSiteMappingsHandler() {
        return __awaiter(this, void 0, void 0, function* () {
            const newMappings = {};
            const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
            let hasError = false;
            rows.forEach(row => {
                const key = row.querySelector('.input-wrapper .site-key').value.trim();
                const value = row.querySelector('.input-wrapper .site-value').value.trim();
                if (!key && !value)
                    return;
                if (!key || !value) {
                    hasError = true;
                    row.style.borderLeft = '3px solid #e74c3c';
                    if (!key)
                        row.querySelector('.input-wrapper .site-key').style.border = '1px solid #e74c3c';
                    if (!value)
                        row.querySelector('.input-wrapper .site-value').style.border = '1px solid #e74c3c';
                    return;
                }
                row.style.borderLeft = 'none';
                row.querySelector('.input-wrapper .site-key').style.border = '1px solid #ddd';
                row.querySelector('.input-wrapper .site-value').style.border = '1px solid #ddd';
                newMappings[key] = value;
            });
            if (hasError) {
                this.mappingError.style.display = 'block';
                return;
            }
            this.mappingError.style.display = 'none';
            // Create a final mapping that keeps the default mappings and adds/updates user mappings
            const customMappings = {};
            Object.keys(newMappings).sort().forEach(key => {
                // Store only the custom mappings (ones that differ from defaults or are new)
                if (defaultSiteNameMapping[key] !== newMappings[key] || !(key in defaultSiteNameMapping)) {
                    customMappings[key] = newMappings[key];
                }
            });
            // Save to database or localStorage based on connection status
            let savedToDb = false;
            if (this.isOnline) {
                savedToDb = yield this.saveMappingsToDB(customMappings);
            }
            // Always save to localStorage as a backup
            localStorage.setItem('siteNameMappings', JSON.stringify(customMappings));
            // Update the working mapping with all values
            this.siteNameMapping = {};
            // First add defaults
            for (const [key, value] of Object.entries(defaultSiteNameMapping)) {
                this.siteNameMapping[key] = value;
            }
            // Then add/override with custom values
            for (const [key, value] of Object.entries(newMappings)) {
                this.siteNameMapping[key] = value;
            }
            // Sort the full mapping
            const sortedMapping = {};
            Object.keys(this.siteNameMapping).sort().forEach(key => {
                sortedMapping[key] = this.siteNameMapping[key];
            });
            this.siteNameMapping = sortedMapping;
            // Show a message to notify the user about the update
            const updateNotice = document.createElement('div');
            updateNotice.style.backgroundColor = '#27ae60';
            updateNotice.style.color = 'white';
            updateNotice.style.padding = '10px';
            updateNotice.style.borderRadius = '4px';
            updateNotice.style.marginTop = '10px';
            updateNotice.style.textAlign = 'center';
            updateNotice.innerHTML = `Site mappings updated! <br>The mappings are now saved ${savedToDb ? 'to database' : 'locally'}.`;
            this.siteMappingsContainer.parentNode.insertBefore(updateNotice, this.siteMappingsContainer.nextSibling);
            setTimeout(() => {
                updateNotice.style.opacity = '0';
                updateNotice.style.transition = 'opacity 0.5s ease';
                setTimeout(() => updateNotice.remove(), 500);
            }, 3000);
            // Repopulate to ensure alphabetical order
            this.populateSiteMappings();
            this.siteModal.style.display = 'none';
        });
    }
    initTheme() {
        // Check for saved theme preference or use device preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        // Apply theme
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.body.classList.add('dark-mode');
            this.updateThemeIcon(true);
        }
    }
    toggleTheme() {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        this.updateThemeIcon(isDarkMode);
    }
    updateThemeIcon(isDarkMode) {
        if (window.updateThemeIcon) {
            window.updateThemeIcon(isDarkMode, this.themeIcon);
        } else {
            // Fallback implementation if window.updateThemeIcon is not available
            if (isDarkMode) {
                this.themeIcon.innerHTML = `
                    <path d="M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36c-0.98,1.37-2.58,2.26-4.4,2.26
                    c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3z"/>
                `;
            } else {
                this.themeIcon.innerHTML = `
                    <path d="M12,18c-3.3,0-6-2.7-6-6s2.7-6,6-6s6,2.7,6,6S15.3,18,12,18zM12,8c-2.2,0-4,1.8-4,4c0,2.2,1.8,4,4,4c2.2,0,4-1.8,4-4C16,9.8,14.2,8,12,8z"/>
                    <path d="M12,4c-0.6,0-1-0.4-1-1V1c0-0.6,0.4-1,1-1s1,0.4,1,1v2C13,3.6,12.6,4,12,4z"/>
                    <path d="M12,24c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1s1,0.4,1,1v2C13,23.6,12.6,24,12,24z"/>
                    <path d="M5.6,6.6c-0.3,0-0.5-0.1-0.7-0.3L3.5,4.9c-0.4-0.4-0.4-1,0-1.4s1-0.4,1.4,0l1.4,1.4c0.4,0.4,0.4,1,0,1.4C6.2,6.5,5.9,6.6,5.6,6.6z"/>
                    <path d="M19.8,20.8c-0.3,0-0.5-0.1-0.7-0.3l-1.4-1.4c-0.4-0.4-0.4-1,0-1.4s1-0.4,1.4,0l1.4,1.4c0.4,0.4,0.4,1,0,1.4C20.3,20.7,20,20.8,19.8,20.8z"/>
                    <path d="M4,13H2c-0.6,0-1-0.4-1-1s0.4-1,1-1h2c0.6,0,1,0.4,1,1S4.6,13,4,13z"/>
                    <path d="M22,13h-2c-0.6,0-1-0.4-1-1s0.4-1,1-1h2c0.6,0,1,0.4,1,1S22.6,13,22,13z"/>
                    <path d="M4.2,20.8c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1,0-1.4l1.4-1.4c0.4-0.4,1-0.4,1.4,0s0.4,1,0,1.4l-1.4,1.4C4.7,20.7,4.5,20.8,4.2,20.8z"/>
                    <path d="M18.4,6.6c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1,0-1.4l1.4-1.4c0.4-0.4,1-0.4,1.4,0s0.4,1,0,1.4l-1.4,1.4C18.9,6.5,18.6,6.6,18.4,6.6z"/>
                `;
            }
        }
    }
}
// Initialize the application when DOM is loaded (only in browser environment)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        new VideoFilenameFormatter();
    });
}
