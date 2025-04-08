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
        // Filter out the documents to delete
        const documentsToKeep = allDocuments.filter(item => {
            var _a;
            const documentId = (_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source;
            // If this is one of the documents to delete
            if (documentId && documentIds.includes(documentId)) {
                deletedIds.push(documentId);
                return false; // Remove this document
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
        // Manually save the updated documents
        // Save to the single vectorStore.json file
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
