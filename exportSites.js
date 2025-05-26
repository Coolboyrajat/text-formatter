export class SiteExporter {
    constructor(siteMappingsContainer) {
        this.siteMappingsContainer = siteMappingsContainer;
    }

    exportMappings() {
        // Create a JSON object with the current mappings
        const mappings = {};
        const rows = this.siteMappingsContainer.querySelectorAll('.site-row');
        rows.forEach(row => {
            const key = row.querySelector('.site-key').value.trim().toLowerCase();
            const value = row.querySelector('.site-value').value.trim();
            if (key && value) {
                mappings[key] = value;
            }
        });

        // Convert the mappings to a JSON string with proper formatting
        const jsonContent = JSON.stringify(mappings, null, 2);

        // Create a Blob with the JSON content
        const blob = new Blob([jsonContent], { type: 'application/json' });

        // Create a temporary URL for the Blob
        const url = window.URL.createObjectURL(blob);

        // Create a temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.download = 'site-mappings.json';

        // Append the link to the document, click it, and remove it
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the temporary URL
        window.URL.revokeObjectURL(url);
    }
} 