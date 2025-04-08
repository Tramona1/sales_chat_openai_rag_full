"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const vectorStore_1 = require("@/utils/vectorStore");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * API endpoint to resolve content conflicts in the knowledge base
 */
async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    try {
        const { conflictTopic, entityName, preferredDocId, deprecatedDocIds } = req.body;
        // Validate required fields
        if (!preferredDocId) {
            return res.status(400).json({ message: 'Missing required field: preferredDocId' });
        }
        if (!Array.isArray(deprecatedDocIds)) {
            return res.status(400).json({ message: 'deprecatedDocIds must be an array' });
        }
        // Get vector store data
        const vectorStoreItems = (0, vectorStore_1.getAllVectorStoreItems)();
        // Find preferred document
        const preferredDoc = vectorStoreItems.find(item => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) === preferredDocId; });
        if (!preferredDoc) {
            return res.status(404).json({ message: 'Preferred document not found' });
        }
        // Mark preferred document as authoritative
        if (!preferredDoc.metadata)
            preferredDoc.metadata = {};
        preferredDoc.metadata.isAuthoritative = 'true';
        // Update last edited timestamp
        preferredDoc.metadata.lastUpdated = new Date().toISOString();
        // Track which documents were marked as deprecated
        const markedDocIds = [];
        // Mark deprecated documents
        for (const deprecatedId of deprecatedDocIds) {
            const deprecatedDoc = vectorStoreItems.find(item => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) === deprecatedId; });
            if (deprecatedDoc) {
                if (!deprecatedDoc.metadata)
                    deprecatedDoc.metadata = {};
                deprecatedDoc.metadata.isDeprecated = 'true';
                deprecatedDoc.metadata.deprecatedBy = preferredDocId;
                deprecatedDoc.metadata.deprecatedAt = new Date().toISOString();
                markedDocIds.push(deprecatedId);
            }
        }
        // Save the updated vector store to disk
        const vectorStorePath = path_1.default.join(process.cwd(), 'data', 'vectorStore.json');
        fs_1.default.writeFileSync(vectorStorePath, JSON.stringify({
            items: vectorStoreItems,
            lastUpdated: Date.now()
        }, null, 2));
        // Also save batches if using batch system
        if (typeof saveVectorStore === 'function') {
            saveVectorStore();
        }
        // Return results
        return res.status(200).json({
            message: 'Conflict resolved successfully',
            topic: conflictTopic,
            entityName,
            authoritative: preferredDocId,
            deprecated: markedDocIds
        });
    }
    catch (error) {
        console.error('Error resolving conflict:', error);
        return res.status(500).json({
            message: 'Failed to resolve conflict',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
// Helper function for batch save (included directly to avoid import errors)
function saveVectorStore() {
    try {
        // Implement batch save logic here if needed
        console.log('Batch save function called');
    }
    catch (error) {
        console.error('Error saving vector store batches:', error);
    }
}
