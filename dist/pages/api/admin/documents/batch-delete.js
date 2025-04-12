"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const errorHandling_1 = require("../../../../utils/errorHandling");
const vectorStore_1 = require("../../../../utils/vectorStore");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Constants for batch processing
const VECTOR_STORE_DIR = path_1.default.join(process.cwd(), 'data', 'vector_batches');
const BATCH_INDEX_FILE = path_1.default.join(process.cwd(), 'data', 'batch_index.json');
async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: {
                message: 'Method Not Allowed',
                code: 'method_not_allowed'
            }
        });
    }
    // Extract the document IDs from the request body
    const { documentIds } = req.body;
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
            error: {
                message: 'Document IDs are required and must be an array',
                code: 'invalid_request'
            }
        });
    }
    console.log(`Batch deleting ${documentIds.length} documents`);
    try {
        // Get all vector store items
        const allDocuments = (0, vectorStore_1.getAllVectorStoreItems)();
        // Track which IDs were found and deleted
        const deletedIds = [];
        const notFoundIds = [];
        // Create a map to track which batches need to be updated
        const batchUpdates = {};
        // Filter out the documents to delete
        const documentsToKeep = allDocuments.filter(item => {
            var _a, _b, _c;
            const documentId = (_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source;
            // If this is one of the documents to delete
            if (documentId && documentIds.includes(documentId)) {
                deletedIds.push(documentId);
                // Track batches that need updating
                const batchId = (_b = item.metadata) === null || _b === void 0 ? void 0 : _b.batch;
                if (batchId) {
                    if (!batchUpdates[batchId]) {
                        batchUpdates[batchId] = {
                            batchId,
                            documentsToKeep: []
                        };
                    }
                }
                return false; // Remove this document
            }
            // If it has a batch ID, store it for batch updates
            const batchId = (_c = item.metadata) === null || _c === void 0 ? void 0 : _c.batch;
            if (batchId) {
                if (!batchUpdates[batchId]) {
                    batchUpdates[batchId] = {
                        batchId,
                        documentsToKeep: []
                    };
                }
                batchUpdates[batchId].documentsToKeep.push(item);
            }
            return true; // Keep this document
        });
        // Find which IDs weren't found
        notFoundIds.push(...documentIds.filter(id => !deletedIds.includes(id)));
        // Check if we found and deleted any documents
        if (deletedIds.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'None of the specified documents were found',
                    code: 'documents_not_found',
                    details: { requestedIds: documentIds }
                }
            });
        }
        // Update the batch files if applicable
        if (fs_1.default.existsSync(BATCH_INDEX_FILE)) {
            try {
                // Read the batch index
                const indexData = JSON.parse(fs_1.default.readFileSync(BATCH_INDEX_FILE, 'utf-8'));
                const activeBatches = indexData.activeBatches || [];
                // Update each affected batch
                for (const batchId of Object.keys(batchUpdates)) {
                    if (activeBatches.includes(batchId)) {
                        const batchFile = path_1.default.join(VECTOR_STORE_DIR, `batch_${batchId}.json`);
                        if (fs_1.default.existsSync(batchFile)) {
                            // Write the updated batch with only the kept documents
                            fs_1.default.writeFileSync(batchFile, JSON.stringify(batchUpdates[batchId].documentsToKeep, null, 2));
                            console.log(`Updated batch ${batchId} after removing documents`);
                        }
                    }
                }
            }
            catch (batchError) {
                console.error('Error updating batch files during batch deletion:', batchError);
                // Continue with main deletion even if batch updates fail
            }
        }
        // Manually save the updated documents to the single vectorStore.json file
        const singleStoreFile = path_1.default.join(process.cwd(), 'data', 'vectorStore.json');
        fs_1.default.writeFileSync(singleStoreFile, JSON.stringify({
            items: documentsToKeep,
            lastUpdated: Date.now()
        }, null, 2));
        // Update the in-memory vector store to reflect the changes
        try {
            // Assign the documents directly to the vectorStore array
            vectorStore_1.vectorStore.length = 0; // Clear the array
            documentsToKeep.forEach(item => vectorStore_1.vectorStore.push(item));
            console.log(`Vector store updated with ${documentsToKeep.length} remaining documents`);
        }
        catch (error) {
            console.error('Error updating vector store in memory:', error);
        }
        console.log(`Deleted ${deletedIds.length} documents, keeping ${documentsToKeep.length} documents`);
        // Return the results
        return res.status(200).json({
            success: true,
            message: `Successfully deleted ${deletedIds.length} document(s)`,
            deletedCount: deletedIds.length,
            deletedIds,
            notFoundIds,
            totalDocuments: documentsToKeep.length
        });
    }
    catch (error) {
        console.error('Error during batch delete:', error);
        const errorResponse = (0, errorHandling_1.standardizeApiErrorResponse)(error);
        return res.status(500).json(errorResponse);
    }
}
