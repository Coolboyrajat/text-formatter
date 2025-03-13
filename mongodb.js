
"use strict";

// MongoDB integration for browser environment
window.MongoDBHelper = (function() {
    // Database connection info
    const dbName = 'site_mappings_db';
    const collectionName = 'site_mappings';
    
    // Cache for database connection
    let db = null;
    let collection = null;
    let client = null;
    
    // Check if we're online
    const isOnline = () => navigator.onLine;
    
    // Initialize the MongoDB connection
    async function init(appId) {
        if (!isOnline() || !appId || appId === 'your-mongodb-atlas-app-id' || appId === 'your-actual-mongodb-app-id') {
            console.log('MongoDB Helper: Offline mode or no App ID');
            return { success: false, message: 'Offline mode or App ID not configured' };
        }
        
        try {
            // Initialize the MongoDB Stitch App Client
            client = window.Stitch.initializeDefaultAppClient(appId);
            
            // Get MongoDB service client
            const mongodb = client.getServiceClient(
                window.Stitch.RemoteMongoClient.factory,
                'mongodb-atlas'
            );
            
            // Get database and collection
            db = mongodb.db(dbName);
            collection = db.collection(collectionName);
            
            // Try to authenticate anonymously
            await client.auth.loginWithCredential(new window.Stitch.AnonymousCredential());
            console.log('MongoDB Helper: Connected to Atlas');
            
            return { success: true, message: 'Connected to MongoDB' };
        } catch (error) {
            console.error('MongoDB Helper: Connection error', error);
            return { success: false, message: 'Connection failed', error };
        }
    }
    
    // Get all mappings from the database
    async function getAllMappings() {
        if (!isOnline() || !collection) {
            return { success: false, data: {} };
        }
        
        try {
            const mappings = await collection.find({}).toArray();
            
            // Convert array of documents to object
            const mappingsObject = {};
            if (mappings && mappings.length > 0) {
                mappings.forEach(mapping => {
                    mappingsObject[mapping.key] = mapping.value;
                });
            }
            
            return { success: true, data: mappingsObject };
        } catch (error) {
            console.error('MongoDB Helper: Error getting mappings', error);
            return { success: false, error };
        }
    }
    
    // Save mappings to the database
    async function saveMappings(mappings) {
        if (!isOnline() || !collection) {
            return { success: false, message: 'Not connected to MongoDB' };
        }
        
        try {
            // Delete existing mappings
            await collection.deleteMany({});
            
            // Convert object to array of documents
            const mappingsArray = Object.entries(mappings).map(([key, value]) => ({
                key,
                value
            }));
            
            // Insert new mappings if there are any
            if (mappingsArray.length > 0) {
                await collection.insertMany(mappingsArray);
            }
            
            return { success: true, message: 'Mappings saved to MongoDB' };
        } catch (error) {
            console.error('MongoDB Helper: Error saving mappings', error);
            return { success: false, error };
        }
    }
    
    // Check connection status
    function isConnected() {
        return isOnline() && collection !== null;
    }
    
    // Public API
    return {
        init,
        getAllMappings,
        saveMappings,
        isConnected
    };
})();
