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

// Import default mappings
import { defaultSiteNameMapping } from './siteMappings.js';

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
        // Initialize event listeners
        this.initEventListeners();
        this.updateConnectionStatus();
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
        
        // Add input event listener for clear button visibility and auto newline
        this.inputText.addEventListener('input', (e) => {
            this.updateClearButtonVisibility();
            
            // Only add newline if the input is not empty and doesn't end with newline
            const value = e.target.value;
            if (value && !value.endsWith('\n')) {
                e.target.value = value + '\n';
                // Move cursor to the end
                e.target.selectionStart = e.target.value.length;
                e.target.selectionEnd = e.target.value.length;
            }
        });

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

         // Search functionality
         const searchBox = document.getElementById('search-box');
         const noResultText = document.getElementById('no-result');
         searchBox.addEventListener('input', () => {
            const searchTerm = searchBox.value.trim().toLowerCase();
            const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
            let hasVisibleRows = false;
            rows.forEach(row => {
                const siteKey = row.querySelector('.site-key').value.toLowerCase();
                const displayName = row.querySelector('.site-value').value.toLowerCase();
                const isMatch = siteKey.includes(searchTerm) || displayName.includes(searchTerm);
                row.style.display = isMatch ? 'flex' : 'none';
                hasVisibleRows = hasVisibleRows || isMatch;
            });
            // Show "No Result" if no rows are visible
            noResultText.style.display = hasVisibleRows ? 'none' : 'block';
         });
    }
    countSiteMappings() {
        // Get all the site mapping rows
        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
        // Count them
        const count = rows.length;
        // Update the total-sites-count element
        const totalCountElement = document.getElementById('total-sites-count');
        if (totalCountElement)
            totalCountElement.textContent = count.toString();
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
        
        // First, check for unmapped site names
        const unmappedSites = [];
        const uniqueSiteKeys = new Set();
        
        files.forEach(file => {
            // Check if this is the new format: "Site - Performer - Title (DD.MM.YYYY)"
            const newFormatMatch = file.match(/^([^-]+)\s*-\s*.+\s*\((\d{2})\.(\d{2})\.(\d{4})\)/);
            
            // Check if this is the bracket format: "[Site] (Performer) MM-DD-YY"
            const bracketFormatMatch = file.match(/^\[([^\]]+)\]\s*\(([^)]+)\)\s*(\d{2})-(\d{2})-(\d{2})/);
            
            if (newFormatMatch) {
                const siteKey = newFormatMatch[1].trim().toLowerCase();
                if (!(siteKey in this.siteNameMapping) && !uniqueSiteKeys.has(siteKey)) {
                    uniqueSiteKeys.add(siteKey);
                    unmappedSites.push(siteKey);
                }
            } else if (bracketFormatMatch) {
                const siteKey = bracketFormatMatch[1].trim().toLowerCase();
                if (!(siteKey in this.siteNameMapping) && !uniqueSiteKeys.has(siteKey)) {
                    uniqueSiteKeys.add(siteKey);
                    unmappedSites.push(siteKey);
                }
            } else {
                // Support both period and space delimited formats for traditional format
                const parts = file.includes('.') ? file.split('.') : file.split(' ');
                if (parts.length >= 5) {
                    const siteKey = parts[0].toLowerCase();
                    if (!(siteKey in this.siteNameMapping) && !uniqueSiteKeys.has(siteKey)) {
                        uniqueSiteKeys.add(siteKey);
                        unmappedSites.push(siteKey);
                    }
                }
            }
        });
        
        // If there are unmapped sites, show modal for mapping them
        if (unmappedSites.length > 0) {
            return this.handleUnmappedSites(unmappedSites, input);
        }
        
        // Process input if all sites are mapped
        return files.map(file => {
            // Check if this is the new format: "Site - Performer - Title (DD.MM.YYYY)"
            const newFormatMatch = file.match(/^([^-]+)\s*-\s*(.+?)\s*\((\d{2})\.(\d{2})\.(\d{4})\)(.*)\.([^.]+)$/);
            
            // Check if this is the bracket format: "[Site] (Performer) MM-DD-YY"
            const bracketFormatMatch = file.match(/^\[([^\]]+)\]\s*\(([^)]+)\)\s*(\d{2})-(\d{2})-(\d{2}).*?(XXX)?.*?(?:\(([^)]*)\))?.*?\.([^.]+)$/i);
            
            if (bracketFormatMatch) {
                // Process bracket format
                const site = bracketFormatMatch[1].trim();
                const performer = bracketFormatMatch[2].trim();
                const month = bracketFormatMatch[3];
                const day = bracketFormatMatch[4];
                const year = bracketFormatMatch[5];
                const hasXXX = !!bracketFormatMatch[6];
                const additionalInfo = bracketFormatMatch[7] || '';
                const extension = bracketFormatMatch[8].toLowerCase();
                
                // Format date properly in YY.MM.DD format
                // Reverse the order to match the expected output format: DD.MM.YY
                const date = `${year}.${month}.${day}`;
                
                // Get proper site name from mapping
                const siteName = site.toLowerCase() in this.siteNameMapping
                    ? this.siteNameMapping[site.toLowerCase()]
                    : site;
                
                // Determine resolution
                let resolution = '1080p';
                if (additionalInfo) {
                    if (additionalInfo.toLowerCase().includes('4k') || additionalInfo.toLowerCase().includes('2160p')) {
                        resolution = '[2160p][4K]';
                    } else if (additionalInfo.toLowerCase().includes('720p')) {
                        resolution = '720p';
                    } else if (additionalInfo.toLowerCase().includes('480p')) {
                        resolution = '480p';
                    }
                }
                
                // Format performer name properly (capitalize each word)
                const formattedPerformer = performer
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                
                // OnlyFans format handling
                const isTonightsGirlfriend = siteName.toLowerCase() === 'tonightsgirlfriend';
                
                // For TonightsGirlfriend, include the dash after site name
                return `[${siteName}] - ${date} - ${formattedPerformer} ${resolution}.${extension}`;
            }
            else if (newFormatMatch) {
                // Process new format
                const site = newFormatMatch[1].trim();
                const siteName = site.toLowerCase() in this.siteNameMapping
                    ? this.siteNameMapping[site.toLowerCase()]
                    : site.charAt(0).toUpperCase() + site.slice(1);
                
                const restOfTitle = newFormatMatch[2].trim();
                const day = newFormatMatch[3];
                const month = newFormatMatch[4];
                const year = newFormatMatch[5].slice(2); // Extract last 2 digits of year
                const additionalInfo = newFormatMatch[6].trim();
                const extension = newFormatMatch[7].toLowerCase();
                
                // Format date properly in YY.MM.DD format
                const date = `${year}.${month}.${day}`;
                
                // Parse additional tags like rq, 1080p, etc.
                const tags = [];
                if (additionalInfo) {
                    const tagMatches = additionalInfo.match(/\b(rq|4k|1080p|720p|480p|2160p)\b/gi);
                    if (tagMatches) {
                        tagMatches.forEach(tag => {
                            const normalizedTag = tag.toLowerCase();
                            if (!tags.includes(normalizedTag)) tags.push(normalizedTag);
                        });
                    }
                }
                
                // Determine resolution or quality tags
                let resolution = '1080p';
                if (tags.includes('4k') || tags.includes('2160p')) {
                    resolution = '[2160p][4K]';
                } else if (tags.includes('1080p')) {
                    resolution = '1080p';
                } else if (tags.includes('720p')) {
                    resolution = '720p';
                } else if (tags.includes('480p')) {
                    resolution = '480p';
                }
                
                // Add rq tag if present and remove resolution if it's the default 1080p
                let qualityInfo = tags.includes('rq') ? ' [rq]' : '';
                let finalResolution = resolution;
                
                // If rq tag is present and resolution is the default 1080p, don't include the resolution
                if (tags.includes('rq') && resolution === '1080p') {
                    finalResolution = '';
                } else {
                    finalResolution = resolution + ' ';
                }
                
                return `[${siteName}] - ${date} - ${restOfTitle}${finalResolution}${qualityInfo}.${extension}`;
            }
            
            // Handle traditional format
            const parts = file.includes('.') ? file.split('.') : file.split(' ');
            if (parts.length < 5)
                return `[Error] Invalid filename format: ${file}`;
                
            const siteName = parts[0] in this.siteNameMapping
                ? this.siteNameMapping[parts[0]]
                : parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                
            // Format date properly (with periods for most sites, spaces for OnlyFans)
            const dateElements = parts.slice(1, 4);
            // Use spaces for OnlyFans date format, periods for all other sites
            const date = parts[0].toLowerCase() === 'onlyfans' ? 
                dateElements.join(' ') : dateElements.join('.');
            
            const has4K = parts.some(part => part.toLowerCase() === '4k');
            
            // Determine original file extension
            let originalExtension = 'mp4'; // Default
            for (const part of parts) {
                // Check for file extensions or patterns like WMV-LEWD
                if (/^(mp4|wmv|avi|mov|mkv)$/i.test(part)) {
                    originalExtension = part.toLowerCase();
                    break;
                } else if (/^(mp4|wmv|avi|mov|mkv)-\w+$/i.test(part)) {
                    // Extract extension from patterns like WMV-LEWD
                    originalExtension = part.split('-')[0].toLowerCase();
                    break;
                }
            }
            
            // Get all parts except for resolution and file extension
            const performerParts = parts.slice(4).filter(part => 
                !['4k', 'xxx', '1080p', '2160p', '720p', '480p', 'mp4', 'wmv', 'avi', 'mov', 'mkv', '[xc]'].includes(part.toLowerCase()) && 
                !/(mp4|wmv|avi|mov|mkv)-\w+/i.test(part)); // Filter out extension-XXX patterns
                
            const performers = performerParts.map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(' ');
            
            let resolution = '1080p';
            
            // Check for 2160p or 4K in the parts
            const has2160p = parts.some(part => part.toLowerCase() === '2160p');
            
            if (has4K || has2160p) {
                resolution = '[2160p][4K]';
            }
            else {
                const resolutionMap = {
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
            
            // Check if [rq] tag is present in filename
            const hasRqTag = parts.some(part => part.toLowerCase() === 'rq' || part.toLowerCase() === '[rq]');
            
            // Make sure we don't duplicate the resolution in the filename
            const filenameParts = performers.split(' ');
            const containsResolution = filenameParts.some(part => part.toLowerCase() === resolution.toLowerCase());
            
            // Skip 1080p resolution if rq tag is present
            let finalResolution = resolution;
            if (hasRqTag && resolution === '1080p') {
                finalResolution = '';
                // Add [rq] tag
                return `[${siteName}] - ${date} ${parts[0].toLowerCase() === 'onlyfans' ? '' : '- '}${performers} [rq].${originalExtension}`;
            } else {
                if (containsResolution) {
                    // If performers already contains the resolution, remove it to avoid duplication
                    const filteredPerformers = filenameParts.filter(part => part.toLowerCase() !== resolution.toLowerCase()).join(' ');
                    return `[${siteName}] - ${date} ${parts[0].toLowerCase() === 'onlyfans' ? '' : '- '}${filteredPerformers} ${finalResolution}${hasRqTag ? ' [rq]' : ''}.${originalExtension}`;
                }
                else {
                    return `[${siteName}] - ${date} ${parts[0].toLowerCase() === 'onlyfans' ? '' : '- '}${performers} ${finalResolution}${hasRqTag ? ' [rq]' : ''}.${originalExtension}`;
                }
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
        
        // Deduplicate unmapped sites before adding to modal
        const uniqueUnmappedSites = [...new Set(unmappedSites.map(site => site.toLowerCase()))];
        
        // Add the unique unmapped sites to the modal if they don't already exist
        uniqueUnmappedSites.forEach(site => {
            if (!currentKeys.includes(site)) {
                const row = this.addSiteMappingRow(site, '', true);
                row.classList.add('highlight-row');
                
                // Focus on the value input of the first unmapped site
                if (site === uniqueUnmappedSites[0]) {
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
            let hasError = false;
            
            unmappedSites.forEach(site => {
                const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
                let found = false;
                rows.forEach(row => {
                    const keyInput = row.querySelector('.site-key');
                    const valueInput = row.querySelector('.site-value');
                    if (keyInput.value.toLowerCase() === site.toLowerCase()) {
                        if (valueInput.value.trim()) {
                            found = true;
                        } else {
                            hasError = true;
                            row.style.borderLeft = '3px solid #e74c3c';
                            valueInput.style.border = '1px solid #e74c3c';
                        }
                    }
                });
                if (!found) allMapped = false;
            });
            
            if (hasError) {
                this.mappingError.textContent = 'Please provide display names for all unmapped sites.';
                this.mappingError.style.display = 'block';
                return;
            }
            
            if (allMapped) {
                // Save the mappings
                this.saveSiteMappingsHandler().then((success) => {
                    if (success) {
                        // Remove the alert
                        if (alertDiv.parentNode) {
                            alertDiv.parentNode.removeChild(alertDiv);
                        }
                        
                        // Reset the save button handler
                        this.saveSitesBtn.onclick = originalSaveBtnClickHandler;
                        
                        // Re-run the format operation
                        const result = this.formatVideoInfo(originalInput);
                        this.displayFormattedResult(result);
                        
                        // Close the modal
                        this.siteModal.style.display = 'none';
                    }
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
                    const copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
                    const tickIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
                    lineCopyBtn.innerHTML = copyIcon;
                    lineCopyBtn.title = "Copy this line";
                    lineCopyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(line).then(() => {
                            lineCopyBtn.classList.add('copied');
                            lineCopyBtn.innerHTML = tickIcon;
                            setTimeout(() => {
                                lineCopyBtn.classList.remove('copied');
                                lineCopyBtn.innerHTML = copyIcon;
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
        
        // Create copy text with icon
        const copySpan = document.createElement('span');
        copySpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="margin-right: 5px; vertical-align: middle;"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy All to Clipboard';
        
        // Create success text with icon
        const copiedSpan = document.createElement('span');
        copiedSpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="margin-right: 5px; vertical-align: middle;"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Copied!';
        
        copyBtn.appendChild(copySpan);
        
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text || '').then(() => {
                copySpan.style.display = 'none';
                copiedSpan.style.display = 'inline';
                copyBtn.appendChild(copiedSpan);
                
                setTimeout(() => { 
                    copiedSpan.style.display = 'none';
                    copySpan.style.display = 'inline';
                }, 2000);
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
        this.countSiteMappings();
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
                this.countSiteMappings();
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
        this.countSiteMappings();
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
                const key = row.querySelector('.input-wrapper .site-key').value.trim().toLowerCase(); // Ensure lowercase for consistency
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
                this.mappingError.textContent = 'Both site key and display name are required.';
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
            
            // Save to database if online
            let savedToDb = false;
            if (this.isOnline && this.siteCollection) {
                try {
                    savedToDb = yield this.saveMappingsToDB(customMappings);
                } catch (error) {
                    console.error('Error saving to database:', error);
                }
            }
            
            // Always save to localStorage as a backup
            try {
                localStorage.setItem('siteNameMappings', JSON.stringify(customMappings));
            } catch (error) {
                console.error('Error saving to localStorage:', error);
            }
            
            // Update the working mapping with all values
            this.siteNameMapping = Object.assign({}, defaultSiteNameMapping, newMappings);
            
            // Sort the full mapping
            const sortedKeys = Object.keys(this.siteNameMapping).sort();
            const sortedMapping = {};
            sortedKeys.forEach(key => {
                sortedMapping[key] = this.siteNameMapping[key];
            });
            this.siteNameMapping = sortedMapping;
            
            // Show success message
            const updateNotice = document.createElement('div');
            updateNotice.style.backgroundColor = '#27ae60';
            updateNotice.style.color = 'white';
            updateNotice.style.padding = '10px';
            updateNotice.style.borderRadius = '4px';
            updateNotice.style.marginTop = '10px';
            updateNotice.style.textAlign = 'center';
            updateNotice.innerHTML = `Site mappings updated! <br>The mappings are now saved ${savedToDb ? 'to database' : 'locally'}.`;
            this.siteMappingsContainer.parentNode.insertBefore(updateNotice, this.siteMappingsContainer.nextSibling);
            
            // Remove notice after delay
            setTimeout(() => {
                updateNotice.style.opacity = '0';
                updateNotice.style.transition = 'opacity 0.5s ease';
                setTimeout(() => updateNotice.remove(), 500);
            }, 3000);
            
            // Repopulate to ensure alphabetical order and close modal
            this.populateSiteMappings();
            this.siteModal.style.display = 'none';
            this.countSiteMappings();
            
            return true; // Indicate successful save
        });
    }
}
// Initialize the application when DOM is loaded (only in browser environment)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        new VideoFilenameFormatter();
    });
}
