"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const errorHandling_1 = require("../../../../utils/errorHandling");
const vectorStore_1 = require("../../../../utils/vectorStore");
const openaiClient_1 = require("../../../../utils/openaiClient");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Constants for batch processing
const VECTOR_STORE_DIR = path_1.default.join(process.cwd(), 'data', 'vector_batches');
const BATCH_INDEX_FILE = path_1.default.join(process.cwd(), 'data', 'batch_index.json');
async function handler(req, res) {
    // Get document ID from the URL
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({
            error: {
                message: 'Document ID is required',
                code: 'missing_document_id'
            }
        });
    }
    try {
        // Handle different HTTP methods
        switch (req.method) {
            case 'GET':
                return await handleGetDocument(req, res, id);
            case 'PUT':
                return await handleUpdateDocument(req, res, id);
            case 'DELETE':
                return await handleDeleteDocument(req, res, id);
            default:
                return res.status(405).json({
                    error: {
                        message: 'Method Not Allowed',
                        code: 'method_not_allowed'
                    }
                });
        }
    }
    catch (error) {
        console.error('Error in document API:', error);
        const errorResponse = (0, errorHandling_1.standardizeApiErrorResponse)(error);
        return res.status(500).json(errorResponse);
    }
}
// Get a specific document
async function handleGetDocument(req, res, id) {
    var _a, _b;
    // Get all documents
    const vectorStoreItems = (0, vectorStore_1.getAllVectorStoreItems)();
    // Find the requested document
    const document = vectorStoreItems.find(item => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) === id; });
    if (!document) {
        return res.status(404).json({
            error: {
                message: 'Document not found',
                code: 'document_not_found'
            }
        });
    }
    return res.status(200).json({
        id: ((_a = document.metadata) === null || _a === void 0 ? void 0 : _a.source) || id,
        source: ((_b = document.metadata) === null || _b === void 0 ? void 0 : _b.source) || 'Unknown Source',
        text: document.text || '',
        metadata: document.metadata || {}
    });
}
// Update a document
async function handleUpdateDocument(req, res, id) {
    var _a;
    const { text, metadata } = req.body;
    if (!text) {
        return res.status(400).json({
            error: {
                message: 'Document text is required',
                code: 'missing_document_text'
            }
        });
    }
    console.log(`Updating document with ID: ${id}`);
    // Find the document in the actual vector store
    const documentIndex = vectorStore_1.vectorStore.findIndex(item => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) === id; });
    if (documentIndex === -1) {
        return res.status(404).json({
            error: {
                message: 'Document not found',
                code: 'document_not_found'
            }
        });
    }
    // Get the existing document
    const existingDocument = vectorStore_1.vectorStore[documentIndex];
    // Determine if we need to regenerate the embedding (text has changed)
    const needsNewEmbedding = existingDocument.text !== text;
    try {
        // Generate new embeddings if needed
        let embedding = existingDocument.embedding;
        if (needsNewEmbedding) {
            console.log('Text changed, generating new embeddings...');
            embedding = await (0, openaiClient_1.embedText)(text);
            console.log('New embeddings generated');
        }
        // Update timestamp
        const now = new Date().toISOString();
        // Track original batch ID
        const batchId = (_a = existingDocument.metadata) === null || _a === void 0 ? void 0 : _a.batch;
        // Create updated document
        const updatedDocument = {
            text,
            embedding,
            metadata: {
                ...metadata,
                // Always preserve the source identifier and batch
                source: id,
                batch: batchId,
                // Update timestamps
                lastUpdated: now,
            }
        };
        // Remove the old document directly from the vector store
        vectorStore_1.vectorStore.splice(documentIndex, 1);
        // Add the updated document to the vector store
        // This will also save changes to disk
        (0, vectorStore_1.addToVectorStore)(updatedDocument);
        // Update batch files directly if needed
        if (batchId && fs_1.default.existsSync(BATCH_INDEX_FILE)) {
            try {
                // Read the batch index
                const indexData = JSON.parse(fs_1.default.readFileSync(BATCH_INDEX_FILE, 'utf-8'));
                const activeBatches = indexData.activeBatches || [];
                // If this batch exists, update it directly
                if (activeBatches.includes(batchId)) {
                    const batchFile = path_1.default.join(VECTOR_STORE_DIR, `batch_${batchId}.json`);
                    if (fs_1.default.existsSync(batchFile)) {
                        // Read the batch
                        const batchItems = JSON.parse(fs_1.default.readFileSync(batchFile, 'utf-8'));
                        // Remove the old document from the batch
                        const filteredBatchItems = batchItems.filter((item) => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) !== id; });
                        // Add the updated document to the batch
                        filteredBatchItems.push(updatedDocument);
                        // Write the updated batch
                        fs_1.default.writeFileSync(batchFile, JSON.stringify(filteredBatchItems, null, 2));
                        console.log(`Updated document in batch ${batchId}`);
                    }
                }
            }
            catch (batchError) {
                console.error('Error updating batch file during document update:', batchError);
            }
        }
        // Also ensure the single file is updated as a backup
        const singleStoreFile = path_1.default.join(process.cwd(), 'data', 'vectorStore.json');
        fs_1.default.writeFileSync(singleStoreFile, JSON.stringify({
            items: vectorStore_1.vectorStore,
            lastUpdated: Date.now()
        }, null, 2));
        console.log(`Document ${id} updated successfully`);
        return res.status(200).json({
            success: true,
            message: 'Document updated successfully',
            id,
            embeddingUpdated: needsNewEmbedding
        });
    }
    catch (error) {
        console.error('Error updating document:', error);
        return res.status(500).json({
            error: {
                message: 'Failed to update document',
                code: 'update_failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
}
// Delete a document
async function handleDeleteDocument(req, res, id) {
    var _a;
    console.log(`Deleting document with ID: ${id}`);
    // Find the document in the actual vector store
    const documentIndex = vectorStore_1.vectorStore.findIndex(item => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) === id; });
    if (documentIndex === -1) {
        return res.status(404).json({
            error: {
                message: 'Document not found',
                code: 'document_not_found'
            }
        });
    }
    try {
        // Get the document to track which batch it belongs to
        const documentToDelete = vectorStore_1.vectorStore[documentIndex];
        const batchId = (_a = documentToDelete.metadata) === null || _a === void 0 ? void 0 : _a.batch;
        // Remove the document from the vector store
        vectorStore_1.vectorStore.splice(documentIndex, 1);
        // Update the batches if applicable
        if (batchId && fs_1.default.existsSync(BATCH_INDEX_FILE)) {
            try {
                // Read the batch index
                const indexData = JSON.parse(fs_1.default.readFileSync(BATCH_INDEX_FILE, 'utf-8'));
                const activeBatches = indexData.activeBatches || [];
                // If this batch exists, update it
                if (activeBatches.includes(batchId)) {
                    const batchFile = path_1.default.join(VECTOR_STORE_DIR, `batch_${batchId}.json`);
                    if (fs_1.default.existsSync(batchFile)) {
                        // Read the batch, remove the document, write it back
                        const batchItems = JSON.parse(fs_1.default.readFileSync(batchFile, 'utf-8'));
                        const updatedBatchItems = batchItems.filter((item) => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) !== id; });
                        // Write the updated batch
                        fs_1.default.writeFileSync(batchFile, JSON.stringify(updatedBatchItems, null, 2));
                        console.log(`Updated batch ${batchId} after removing document ${id}`);
                    }
                }
            }
            catch (batchError) {
                console.error('Error updating batch file during document deletion:', batchError);
                // Continue with main deletion even if batch update fails
            }
        }
        // Save the updated vector store to the single file as well (as backup)
        const singleStoreFile = path_1.default.join(process.cwd(), 'data', 'vectorStore.json');
        fs_1.default.writeFileSync(singleStoreFile, JSON.stringify({
            items: vectorStore_1.vectorStore,
            lastUpdated: Date.now()
        }, null, 2));
        console.log(`Document ${id} deleted successfully`);
        return res.status(200).json({
            success: true,
            message: 'Document deleted successfully',
            id
        });
    }
    catch (error) {
        console.error('Error deleting document:', error);
        return res.status(500).json({
            error: {
                message: 'Failed to delete document',
                code: 'delete_failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
}
