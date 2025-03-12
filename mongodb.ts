
// MongoDB Client for browser environment
// This file provides interfaces for TypeScript types
// The actual MongoDB functionality is handled through Stitch SDK in script.ts

// Type definitions
interface SiteMapping {
  key: string;
  value: string;
}

interface MappingUpdateResult {
  success: boolean;
  message?: string;
}

// Connection URL - replace with your actual MongoDB connection URL
const url = process.env.MONGODB_URI || '';
const dbName = 'site_mappings_db';
const collectionName = 'site_mappings';

let cachedDb: Db | null = null;

// Connect to MongoDB
async function connectToDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }
  
  try {
    const client = await MongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as any); // Cast as any for TypeScript compatibility
    
    const db = client.db(dbName);
    cachedDb = db;
    console.log('Successfully connected to MongoDB');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

// Get all site mappings
async function getAllMappings(): Promise<Record<string, string>> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection(collectionName);
    const mappings = await collection.find({}).toArray();
    
    // Convert to key-value object
    const mappingsObject: Record<string, string> = {};
    mappings.forEach((mapping: SiteMapping) => {
      mappingsObject[mapping.key] = mapping.value;
    });
    
    return mappingsObject;
  } catch (error) {
    console.error('Error getting mappings:', error);
    throw error;
  }
}

// Add or update site mappings
async function updateMappings(mappings: Record<string, string>): Promise<MappingUpdateResult> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection(collectionName);
    
    // Delete existing mappings
    await collection.deleteMany({});
    
    // Insert new mappings
    if (Object.keys(mappings).length > 0) {
      const mappingsArray = Object.entries(mappings).map(([key, value]) => ({
        key,
        value
      }));
      
      await collection.insertMany(mappingsArray);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating mappings:', error);
    throw error;
  }
}

// Optional: API for a backend service
interface ApiRequest {
  method: string;
  body: any;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => any;
}

async function createApiHandler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method === 'GET') {
      const mappings = await getAllMappings();
      return res.json({ success: true, data: mappings });
    } else if (req.method === 'POST') {
      const result = await updateMappings(req.body);
      return res.json({ success: true, message: 'Mappings updated successfully' });
    } else {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

export {
  connectToDatabase,
  getAllMappings,
  updateMappings,
  createApiHandler
};
