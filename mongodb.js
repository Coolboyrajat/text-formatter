"use strict";
// MongoDB Client for browser environment
// This file provides interfaces for TypeScript types
// The actual MongoDB functionality is handled through Stitch SDK in script.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
exports.getAllMappings = getAllMappings;
exports.updateMappings = updateMappings;
exports.createApiHandler = createApiHandler;
// Connection URL - replace with your actual MongoDB connection URL
const url = process.env.MONGODB_URI || '';
const dbName = 'site_mappings_db';
const collectionName = 'site_mappings';
let cachedDb = null;
// Connect to MongoDB
function connectToDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        if (cachedDb) {
            return cachedDb;
        }
        try {
            const client = yield MongoClient.connect(url, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }); // Cast as any for TypeScript compatibility
            const db = client.db(dbName);
            cachedDb = db;
            console.log('Successfully connected to MongoDB');
            return db;
        }
        catch (error) {
            console.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    });
}
// Get all site mappings
function getAllMappings() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const db = yield connectToDatabase();
            const collection = db.collection(collectionName);
            const mappings = yield collection.find({}).toArray();
            // Convert to key-value object
            const mappingsObject = {};
            mappings.forEach((mapping) => {
                mappingsObject[mapping.key] = mapping.value;
            });
            return mappingsObject;
        }
        catch (error) {
            console.error('Error getting mappings:', error);
            throw error;
        }
    });
}
// Add or update site mappings
function updateMappings(mappings) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const db = yield connectToDatabase();
            const collection = db.collection(collectionName);
            // Delete existing mappings
            yield collection.deleteMany({});
            // Insert new mappings
            if (Object.keys(mappings).length > 0) {
                const mappingsArray = Object.entries(mappings).map(([key, value]) => ({
                    key,
                    value
                }));
                yield collection.insertMany(mappingsArray);
            }
            return { success: true };
        }
        catch (error) {
            console.error('Error updating mappings:', error);
            throw error;
        }
    });
}
function createApiHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (req.method === 'GET') {
                const mappings = yield getAllMappings();
                return res.json({ success: true, data: mappings });
            }
            else if (req.method === 'POST') {
                const result = yield updateMappings(req.body);
                return res.json({ success: true, message: 'Mappings updated successfully' });
            }
            else {
                return res.status(405).json({ success: false, message: 'Method not allowed' });
            }
        }
        catch (error) {
            console.error('API error:', error);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });
}
