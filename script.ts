
// Type definitions
interface SiteMapping {
    [key: string]: string;
}

interface MongoDBDocument {
    key: string;
    value: string;
}

interface FetchResult<T> {
    ok: boolean;
    value?: T;
    error?: Error;
}

// Default mappings that will always be available and preserved
const defaultSiteNameMapping: SiteMapping = {
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
    private siteNameMapping: SiteMapping = { ...defaultSiteNameMapping };
    private pendingSort: boolean = false;
    private sortTimeout: number | null = null;
    private isOnline: boolean = navigator.onLine;
    private db: any = null;
    private siteCollection: any = null;
    
    // DOM Elements
    private connectionStatus: HTMLElement;
    private formatBtn: HTMLElement;
    private inputText: HTMLTextAreaElement;
    private resultElement: HTMLElement;
    private outputContainer: HTMLElement;
    private copyBtnContainer: HTMLElement;
    private manageSitesBtn: HTMLElement;
    private siteModal: HTMLElement;
    private closeModalBtn: HTMLElement;
    private siteMappingsContainer: HTMLElement;
    private addSiteBtn: HTMLElement;
    private saveSitesBtn: HTMLElement;
    private mappingError: HTMLElement;
    private themeToggle: HTMLElement;
    private themeIcon: HTMLElement;
    
    constructor() {
        // Initialize DOM elements
        this.connectionStatus = document.getElementById('connection-status') as HTMLElement;
        this.formatBtn = document.getElementById('format-btn') as HTMLElement;
        this.inputText = document.getElementById('input-text') as HTMLTextAreaElement;
        this.resultElement = document.getElementById('result') as HTMLElement;
        this.outputContainer = document.getElementById('output-container') as HTMLElement;
        this.copyBtnContainer = document.getElementById('copy-btn-container') as HTMLElement;
        this.manageSitesBtn = document.getElementById('manage-sites-btn') as HTMLElement;
        this.siteModal = document.getElementById('site-modal') as HTMLElement;
        this.closeModalBtn = document.querySelector('.close') as HTMLElement;
        this.siteMappingsContainer = document.getElementById('site-mappings-container') as HTMLElement;
        this.addSiteBtn = document.getElementById('add-site-btn') as HTMLElement;
        this.saveSitesBtn = document.getElementById('save-sites-btn') as HTMLElement;
        this.mappingError = document.getElementById('mapping-error') as HTMLElement;
        this.themeToggle = document.getElementById('theme-toggle') as HTMLElement;
        this.themeIcon = document.getElementById('theme-icon') as HTMLElement;
        
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
    
    private initEventListeners(): void {
        this.formatBtn.addEventListener('click', () => this.formatHandler());
        
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
    
    private updateConnectionStatus(): void {
        this.isOnline = navigator.onLine;
        
        // For MongoDB connection check
        if (this.isOnline && this.siteCollection) {
            this.connectionStatus.className = 'connection-status online';
            this.connectionStatus.textContent = 'Connected to DB';
        } else if (this.isOnline) {
            this.connectionStatus.className = 'connection-status online';
            this.connectionStatus.textContent = 'Online (Local Mode)';
        } else {
            this.connectionStatus.className = 'connection-status offline';
            this.connectionStatus.textContent = 'Offline';
        }
        
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
    
    private async initMongoDB(): Promise<void> {
        try {
            if (!this.isOnline) {
                console.log('Offline mode: Using local storage and default mappings');
                return;
            }
            
            // MongoDB Atlas App ID - Replace this with your actual App ID from MongoDB Atlas
            const APP_ID = 'your-mongodb-atlas-app-id';  // ← IMPORTANT: Replace with your real App ID
            
            if (!APP_ID || APP_ID === 'your-mongodb-atlas-app-id') {
                console.log('No MongoDB App ID configured, using local storage');
                this.connectionStatus.textContent = 'MongoDB not configured';
                this.connectionStatus.className = 'connection-status offline';
                this.loadSavedMappings();
                return;
            }
            
            // Initialize the MongoDB Stitch App Client
            const client = (window as any).Stitch.initializeDefaultAppClient(APP_ID);
            
            // Get a client for MongoDB Service with anonymous authentication
            const mongodb = client.getServiceClient(
                (window as any).Stitch.RemoteMongoClient.factory,
                'mongodb-atlas'
            );
            
            // Get database and collection
            this.db = mongodb.db('site_mappings_db');
            this.siteCollection = this.db.collection('site_mappings');
            
            // Try to authenticate anonymously
            await client.auth.loginWithCredential(new (window as any).Stitch.AnonymousCredential());
            console.log('Connected to MongoDB Atlas');
            this.connectionStatus.textContent = 'Connected to MongoDB';
            this.connectionStatus.className = 'connection-status online';
            
            // Fetch mappings from database
            await this.loadMappingsFromDB();
        } catch (error) {
            console.error('MongoDB connection error:', error);
            this.connectionStatus.textContent = 'MongoDB Connection Failed';
            this.connectionStatus.className = 'connection-status offline';
            // Fall back to local storage
            this.loadSavedMappings();
        }
    }
    
    private async loadMappingsFromDB(): Promise<void> {
        if (!this.isOnline || !this.siteCollection) {
            // Fall back to local storage if offline or not connected
            this.loadSavedMappings();
            return;
        }
        
        try {
            const dbMappings = await this.siteCollection.find({}).toArray();
            
            if (dbMappings && dbMappings.length > 0) {
                // Convert array of documents to a key-value object
                const dbMappingsObj: SiteMapping = {};
                dbMappings.forEach((mapping: MongoDBDocument) => {
                    dbMappingsObj[mapping.key] = mapping.value;
                });
                
                // Create a combined mapping with defaults and DB mappings
                const combinedMappings = {...defaultSiteNameMapping, ...dbMappingsObj};
                
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
    }
    
    private async saveMappingsToDB(mappings: SiteMapping): Promise<boolean> {
        if (!this.isOnline || !this.siteCollection) {
            // Fall back to local storage if offline
            localStorage.setItem('siteNameMappings', JSON.stringify(mappings));
            return false;
        }
        
        try {
            // First, delete all existing custom mappings
            await this.siteCollection.deleteMany({});
            
            // Then insert all new mappings
            const mappingsArray = Object.entries(mappings).map(([key, value]) => ({
                key: key,
                value: value
            }));
            
            if (mappingsArray.length > 0) {
                await this.siteCollection.insertMany(mappingsArray);
            }
            
            console.log('Saved mappings to MongoDB');
            return true;
        } catch (error) {
            console.error('Error saving mappings to MongoDB:', error);
            // Fall back to local storage
            localStorage.setItem('siteNameMappings', JSON.stringify(mappings));
            return false;
        }
    }
    
    private loadSavedMappings(): void {
        const savedMappings = localStorage.getItem('siteNameMappings');
        if (savedMappings) {
            try {
                // Load saved mappings
                const parsedMappings = JSON.parse(savedMappings) as SiteMapping;
                
                // Create a combined mapping with defaults and saved mappings
                const combinedMappings = {...defaultSiteNameMapping, ...parsedMappings};
                
                // Sort the combined mappings alphabetically
                const sortedKeys = Object.keys(combinedMappings).sort();
                this.siteNameMapping = {};
                
                // Rebuild the mapping with sorted keys
                sortedKeys.forEach(key => {
                    this.siteNameMapping[key] = combinedMappings[key];
                });
                
                console.log('Loaded mappings from localStorage');
            } catch(e) {
                console.error("Error loading saved mappings:", e);
            }
        }
    }
    
    private formatVideoInfo(input: string): string {
        if (!input.trim()) return "";
        return input.split(',').map(file => file.trim()).filter(Boolean).map(file => {
            const parts = file.split('.');
            if (parts.length < 5) return `[Error] Invalid filename format: ${file}`;
            
            const siteName = parts[0] in this.siteNameMapping 
                ? this.siteNameMapping[parts[0]] 
                : parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                
            const date = parts.slice(1, 4).join('.');
            const has4K = parts.some(part => part.toLowerCase() === '4k');
            const performerParts = parts.slice(4, parts.length - 1).filter(part => part.toLowerCase() !== '4k');
            const performers = performerParts.map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(' ');
            
            let resolution = '1080p';
            if (has4K) {
                resolution = '[2160p][4K]';
            } else {
                const resolutionMap: { [key: string]: string } = {
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
            
            // Make sure we don't duplicate the resolution in the filename
            const filenameParts = performers.split(' ');
            const containsResolution = filenameParts.some(part => 
                part.toLowerCase() === resolution.toLowerCase());
            
            if (containsResolution) {
                // If performers already contains the resolution, remove it to avoid duplication
                const filteredPerformers = filenameParts.filter(part => 
                    part.toLowerCase() !== resolution.toLowerCase()).join(' ');
                return `[${siteName}] - ${date} - ${filteredPerformers} ${resolution}.mp4`;
            } else {
                return `[${siteName}] - ${date} - ${performers} ${resolution}.mp4`;
            }
        }).join('\n');
    }
    
    private formatHandler(): void {
        const input = this.inputText.value;
        const result = this.formatVideoInfo(input);
        this.copyBtnContainer.innerHTML = '';
        
        if (result) {
            this.resultElement.textContent = result;
            this.outputContainer.style.display = 'block';
            if (!result.includes('[Error]') && result !== 'No valid input provided.') {
                this.copyBtnContainer.appendChild(this.createCopyButton());
            }
        } else {
            this.resultElement.textContent = 'No valid input provided.';
            this.outputContainer.style.display = 'block';
        }
    }
    
    private createCopyButton(): HTMLButtonElement {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.id = 'copy-btn';
        copyBtn.textContent = 'Copy to Clipboard';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.resultElement.textContent || '').then(() => {
                const originalText = copyBtn.textContent || '';
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = originalText }, 2000);
            });
        });
        return copyBtn;
    }
    
    private sortSiteMappings(): void {
        if (this.pendingSort) return;
        this.pendingSort = true;
        
        const container = this.siteMappingsContainer;
        const rows = Array.from(container.querySelectorAll('.site-row'));
        
        if (rows.length <= 1) {
            this.pendingSort = false;
            return;
        }
        
        rows.forEach(row => {
            const rect = row.getBoundingClientRect();
            (row as any).dataset.startY = rect.top;
        });
        
        rows.sort((a, b) => {
            const keyA = (a.querySelector('.site-key') as HTMLInputElement).value.toLowerCase();
            const keyB = (b.querySelector('.site-key') as HTMLInputElement).value.toLowerCase();
            return keyA.localeCompare(keyB);
        });
        
        rows.forEach(row => row.remove());
        rows.forEach(row => { container.appendChild(row) });
        
        rows.forEach(row => {
            const rect = row.getBoundingClientRect();
            const startY = parseFloat((row as any).dataset.startY);
            const endY = rect.top;
            const deltaY = startY - endY;
            (row as HTMLElement).style.transform = `translateY(${deltaY}px)`;
            (row as HTMLElement).style.opacity = '0.7';
            void row.offsetWidth;
            (row as HTMLElement).style.transform = 'translateY(0)';
            (row as HTMLElement).style.opacity = '1';
        });
        
        setTimeout(() => { this.pendingSort = false }, 500);
    }
    
    private populateSiteMappings(): void {
        this.siteMappingsContainer.innerHTML = '';
        const entries = Object.entries(this.siteNameMapping).sort((a, b) => a[0].localeCompare(b[0]));
        entries.forEach(([key, value]) => {
            this.addSiteMappingRow(key, value, false);
        });
    }
    
    private validateInputs(): boolean {
        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
        let hasError = false;
        
        rows.forEach(row => {
            const keyVal = (row.querySelector('.site-key') as HTMLInputElement).value.trim();
            const valueVal = (row.querySelector('.site-value') as HTMLInputElement).value.trim();
            
            if ((keyVal && !valueVal) || (!keyVal && valueVal)) {
                hasError = true;
            }
        });
        
        this.mappingError.style.display = hasError ? 'block' : 'none';
        return !hasError;
    }
    
    private addSiteMappingRow(key: string = '', value: string = '', isNew: boolean = true): HTMLElement {
        const row = document.createElement('div');
        row.className = 'site-row';
        
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'site-key';
        keyInput.placeholder = 'Site Key';
        keyInput.value = key;
        
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'site-value';
        valueInput.placeholder = 'Display Name';
        valueInput.value = value;
        
        // Track if both fields have lost focus
        let keyInputHasFocus = false;
        let valueInputHasFocus = false;
        
        // Add validation for key/value pair
        const validateRow = () => {
            // Only validate when both fields have lost focus
            if (!keyInputHasFocus && !valueInputHasFocus) {
                const keyVal = keyInput.value.trim();
                const valueVal = valueInput.value.trim();
                
                // If one field has value but the other doesn't, show error
                if ((keyVal && !valueVal) || (!keyVal && valueVal)) {
                    if (keyVal && !valueVal) {
                        valueInput.style.border = '1px solid #e74c3c';
                    }
                    
                    if (!keyVal && valueVal) {
                        keyInput.style.border = '1px solid #e74c3c';
                    }
                    
                    this.mappingError.style.display = 'block';
                } else {
                    // If both fields have values or both are empty, don't show error
                    keyInput.style.border = '1px solid var(--border-color)';
                    valueInput.style.border = '1px solid var(--border-color)';
                    this.mappingError.style.display = 'none';
                }
            }
        };
        
        keyInput.addEventListener('focus', () => {
            keyInputHasFocus = true;
            // Hide error message during typing
            this.mappingError.style.display = 'none';
            // Reset borders during typing
            keyInput.style.border = '1px solid var(--border-color)';
            valueInput.style.border = '1px solid var(--border-color)';
        });
        
        valueInput.addEventListener('focus', () => {
            valueInputHasFocus = true;
            // Hide error message during typing
            this.mappingError.style.display = 'none';
            // Reset borders during typing
            keyInput.style.border = '1px solid var(--border-color)';
            valueInput.style.border = '1px solid var(--border-color)';
        });
        
        keyInput.addEventListener('blur', () => {
            keyInputHasFocus = false;
            setTimeout(validateRow, 100); // Small delay to check if other field is focused
        });
        
        valueInput.addEventListener('blur', () => {
            valueInputHasFocus = false;
            setTimeout(validateRow, 100); // Small delay to check if other field is focused
        });
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'X';
        removeBtn.addEventListener('click', () => {
            (row as HTMLElement).style.opacity = '0';
            setTimeout(() => {
                row.remove();
                this.validateInputs();
            }, 300);
        });
        
        row.appendChild(keyInput);
        row.appendChild(valueInput);
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
        } else {
            this.siteMappingsContainer.appendChild(row);
        }
        
        return row;
    }
    
    private addEmptySiteRow(): HTMLElement | null {
        // Check if there are any incomplete rows before adding a new one
        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
        let canAddNew = true;
        
        rows.forEach(row => {
            const keyVal = (row.querySelector('.site-key') as HTMLInputElement).value.trim();
            const valueVal = (row.querySelector('.site-value') as HTMLInputElement).value.trim();
            if ((!keyVal && valueVal) || (keyVal && !valueVal) || (!keyVal && !valueVal)) {
                canAddNew = false;
                // Focus on the first empty input
                if (!keyVal) {
                    (row.querySelector('.site-key') as HTMLInputElement).focus();
                } else {
                    (row.querySelector('.site-value') as HTMLInputElement).focus();
                }
            }
        });
        
        if (!canAddNew) {
            this.mappingError.style.display = 'block';
            return null;
        }
        
        this.mappingError.style.display = 'none';
        const row = this.addSiteMappingRow('', '', true);
        const keyInput = row.querySelector('.site-key') as HTMLInputElement;
        keyInput.focus();
        return row;
    }
    
    private async saveSiteMappingsHandler(): Promise<void> {
        const newMappings: SiteMapping = {};
        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
        let hasError = false;
        
        rows.forEach(row => {
            const key = (row.querySelector('.site-key') as HTMLInputElement).value.trim();
            const value = (row.querySelector('.site-value') as HTMLInputElement).value.trim();
            
            if (!key && !value) return;
            
            if (!key || !value) {
                hasError = true;
                (row as HTMLElement).style.borderLeft = '3px solid #e74c3c';
                if (!key) (row.querySelector('.site-key') as HTMLElement).style.border = '1px solid #e74c3c';
                if (!value) (row.querySelector('.site-value') as HTMLElement).style.border = '1px solid #e74c3c';
                return;
            }
            
            (row as HTMLElement).style.borderLeft = 'none';
            (row.querySelector('.site-key') as HTMLElement).style.border = '1px solid #ddd';
            (row.querySelector('.site-value') as HTMLElement).style.border = '1px solid #ddd';
            newMappings[key] = value;
        });
        
        if (hasError) {
            this.mappingError.style.display = 'block';
            return;
        }
        
        this.mappingError.style.display = 'none';
        
        // Create a final mapping that keeps the default mappings and adds/updates user mappings
        const customMappings: SiteMapping = {};
        Object.keys(newMappings).sort().forEach(key => {
            // Store only the custom mappings (ones that differ from defaults or are new)
            if (defaultSiteNameMapping[key] !== newMappings[key] || !(key in defaultSiteNameMapping)) {
                customMappings[key] = newMappings[key];
            }
        });
        
        // Save to database or localStorage based on connection status
        let savedToDb = false;
        if (this.isOnline) {
            savedToDb = await this.saveMappingsToDB(customMappings);
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
        const sortedMapping: SiteMapping = {};
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
    }
    
    private initTheme(): void {
        // Check for saved theme preference or use device preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Apply theme
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.body.classList.add('dark-mode');
            this.updateThemeIcon(true);
        }
    }
    
    private toggleTheme(): void {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        this.updateThemeIcon(isDarkMode);
    }
    
    private updateThemeIcon(isDarkMode: boolean): void {
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

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoFilenameFormatter();
});
