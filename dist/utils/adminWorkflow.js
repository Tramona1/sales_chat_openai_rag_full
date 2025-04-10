"use strict";
/**
 * Admin Workflow Module
 *
 * This module handles the admin approval workflow for document ingestion,
 * including pending document storage, approval/rejection, and BM25 stats updates.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingDocuments = getPendingDocuments;
exports.addToPendingDocuments = addToPendingDocuments;
exports.getPendingDocumentById = getPendingDocumentById;
exports.approveOrRejectDocument = approveOrRejectDocument;
exports.updateBM25CorpusStatistics = updateBM25CorpusStatistics;
exports.removePendingDocument = removePendingDocument;
exports.checkForContentConflicts = checkForContentConflicts;
exports.getPendingDocumentsStats = getPendingDocumentsStats;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const errorHandling_1 = require("./errorHandling");
const vectorStore_1 = require("./vectorStore");
const bm25_1 = require("./bm25");
const documentCategories_1 = require("./documentCategories");
// File paths for storing pending documents
const PENDING_DIR = path_1.default.join(process.cwd(), 'data', 'pending');
const PENDING_INDEX_FILE = path_1.default.join(PENDING_DIR, 'pending_index.json');
/**
 * Initialize the pending documents directory
 */
async function initPendingDir() {
    try {
        await promises_1.default.mkdir(PENDING_DIR, { recursive: true });
        // Create pending index file if it doesn't exist
        try {
            await promises_1.default.access(PENDING_INDEX_FILE);
        }
        catch (_a) {
            await promises_1.default.writeFile(PENDING_INDEX_FILE, JSON.stringify({ items: [] }));
        }
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to initialize pending documents directory', error);
    }
}
/**
 * Get all pending documents
 */
async function getPendingDocuments() {
    await initPendingDir();
    try {
        const indexData = await promises_1.default.readFile(PENDING_INDEX_FILE, 'utf8');
        const index = JSON.parse(indexData);
        return index.items || [];
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to get pending documents', error);
        return [];
    }
}
/**
 * Add a document to the pending queue
 */
async function addToPendingDocuments(text, metadata, embedding) {
    await initPendingDir();
    try {
        // Create a pending document with a unique ID
        const id = `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        // Create pending document metadata
        const pendingMetadata = {
            ...metadata,
            submittedAt: new Date().toISOString(),
            reviewStatus: 'pending'
        };
        // Create the stored document
        const pendingDocument = {
            id,
            metadata: pendingMetadata,
            text,
            embedding,
            submittedAt: new Date().toISOString()
        };
        // Get current pending documents
        const pendingDocs = await getPendingDocuments();
        // Add new document
        pendingDocs.push(pendingDocument);
        // Save updated index
        await promises_1.default.writeFile(PENDING_INDEX_FILE, JSON.stringify({ items: pendingDocs }, null, 2));
        console.log(`Added document ${id} to pending queue`);
        return id;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to add document to pending queue', error);
        throw error;
    }
}
/**
 * Get a specific pending document by ID
 */
async function getPendingDocumentById(id) {
    const pendingDocs = await getPendingDocuments();
    return pendingDocs.find(doc => doc.id === id) || null;
}
/**
 * Approve or reject a pending document
 * This is a critical function that ensures BM25 corpus statistics are updated
 * when a document is approved and added to the vector store.
 */
async function approveOrRejectDocument(id, decision) {
    try {
        // Get the pending document
        const pendingDoc = await getPendingDocumentById(id);
        if (!pendingDoc) {
            console.error(`Pending document ${id} not found`);
            return false;
        }
        // Get all pending documents
        const pendingDocs = await getPendingDocuments();
        // Update the document status
        const updatedDocs = pendingDocs.map(doc => {
            if (doc.id === id) {
                return {
                    ...doc,
                    metadata: {
                        ...doc.metadata,
                        reviewStatus: decision.approved ? 'approved' : 'rejected',
                        reviewComments: decision.reviewerComments || '',
                        reviewedBy: decision.reviewedBy || 'admin',
                        reviewedAt: new Date().toISOString(),
                        approved: decision.approved
                    }
                };
            }
            return doc;
        });
        // Save updated index
        await promises_1.default.writeFile(PENDING_INDEX_FILE, JSON.stringify({ items: updatedDocs }, null, 2));
        if (decision.approved) {
            // If approved, add to vector store
            await addApprovedDocumentToVectorStore(pendingDoc);
        }
        console.log(`Document ${id} ${decision.approved ? 'approved' : 'rejected'}`);
        return true;
    }
    catch (error) {
        (0, errorHandling_1.logError)(`Failed to ${decision.approved ? 'approve' : 'reject'} document ${id}`, error);
        return false;
    }
}
/**
 * Add an approved document to the vector store
 * This function ensures BM25 corpus statistics are updated and all Gemini-generated metadata is preserved
 */
async function addApprovedDocumentToVectorStore(pendingDoc) {
    try {
        // Extract document information
        const { id, text, embedding, metadata } = pendingDoc;
        // Create a properly typed metadata object that preserves all Gemini-generated fields
        const enhancedMetadata = {
            ...metadata,
            approvedAt: new Date().toISOString()
        };
        // Make sure all category fields are properly structured for search
        if (!enhancedMetadata.category && enhancedMetadata.primaryCategory) {
            enhancedMetadata.category = enhancedMetadata.primaryCategory;
        }
        // Ensure technical level is within range
        if (enhancedMetadata.technicalLevel !== undefined) {
            let techLevel = Number(enhancedMetadata.technicalLevel);
            if (isNaN(techLevel)) {
                techLevel = 5; // Default middle level
            }
            enhancedMetadata.technicalLevel = Math.max(1, Math.min(10, techLevel));
        }
        // Ensure entities are stored as a JSON string for vector store
        if (enhancedMetadata.entities && typeof enhancedMetadata.entities !== 'string') {
            try {
                enhancedMetadata.entities = JSON.stringify(enhancedMetadata.entities);
            }
            catch (error) {
                console.error('Error stringifying entities:', error);
                // If there's an error, provide at least an empty object
                enhancedMetadata.entities = '{}';
            }
        }
        // Process array fields for better searchability
        const arrayFields = [
            'keywords',
            'secondaryCategories',
            'industryCategories',
            'functionCategories',
            'useCases'
        ];
        // Convert arrays to strings for storage compatibility
        arrayFields.forEach(field => {
            if (Array.isArray(enhancedMetadata[field])) {
                enhancedMetadata[`${field}_str`] = enhancedMetadata[field].join(', ');
            }
        });
        // Create vector store item with final metadata
        const vectorStoreItem = {
            id: id,
            text: text,
            embedding: embedding || [], // Use provided embedding or empty array
            metadata: enhancedMetadata
        };
        // Add item to vector store
        await (0, vectorStore_1.addToVectorStore)(vectorStoreItem);
        // Update BM25 corpus statistics in the background
        updateBM25CorpusStatistics().catch(error => {
            console.error('Error updating BM25 corpus statistics:', error);
        });
        // Log success with fields preserved
        console.log(`Document ${id} added to vector store with AI-generated metadata:`, Object.keys(enhancedMetadata).join(', '));
    }
    catch (error) {
        (0, errorHandling_1.logError)(`Failed to add approved document ${pendingDoc.id} to vector store`, error);
        throw error;
    }
}
/**
 * Update BM25 corpus statistics after new documents are added
 */
async function updateBM25CorpusStatistics() {
    try {
        // Import vector store functions to get all items
        const { getAllVectorStoreItems } = require('./vectorStore');
        // Get all vector store items
        const allItems = getAllVectorStoreItems();
        console.log(`Updating BM25 corpus statistics with ${allItems.length} documents`);
        // Calculate corpus statistics
        const corpusStats = await (0, bm25_1.calculateCorpusStatistics)(allItems);
        // Save updated statistics
        await (0, bm25_1.saveCorpusStatistics)(corpusStats);
        console.log('BM25 corpus statistics updated successfully');
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to update BM25 corpus statistics', error);
        throw error;
    }
}
/**
 * Remove a document from the pending queue
 */
async function removePendingDocument(id) {
    try {
        const pendingDocs = await getPendingDocuments();
        const filteredDocs = pendingDocs.filter(doc => doc.id !== id);
        if (filteredDocs.length === pendingDocs.length) {
            // Document not found
            return false;
        }
        await promises_1.default.writeFile(PENDING_INDEX_FILE, JSON.stringify({ items: filteredDocs }, null, 2));
        console.log(`Removed document ${id} from pending queue`);
        return true;
    }
    catch (error) {
        (0, errorHandling_1.logError)(`Failed to remove document ${id} from pending queue`, error);
        return false;
    }
}
/**
 * Check for potential conflicts with existing content
 */
async function checkForContentConflicts(metadata, text) {
    try {
        // Check only for specific sensitive categories
        const sensitiveCategories = [
            documentCategories_1.DocumentCategoryType.PRICING,
            documentCategories_1.DocumentCategoryType.CUSTOMER,
            documentCategories_1.DocumentCategoryType.COMPETITORS,
            documentCategories_1.DocumentCategoryType.INTERNAL_POLICY
        ];
        if (!sensitiveCategories.includes(metadata.primaryCategory)) {
            // Non-sensitive category, no conflict check needed
            return { hasConflicts: false, conflictingDocIds: [] };
        }
        // Get all vector store items
        const { getAllVectorStoreItems } = require('./vectorStore');
        const allItems = getAllVectorStoreItems();
        // Filter to items with the same category
        const sameCategory = allItems.filter((item) => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.category) === metadata.primaryCategory; });
        // TODO: Implement more sophisticated conflict detection logic
        // For now, just check if the document mentions any relevant entities
        // Extract entities from current document
        const entityNames = metadata.entities
            .filter(e => e.confidence !== 'uncertain')
            .map(e => e.name.toLowerCase());
        // Look for potential conflicts
        const conflictingDocs = sameCategory.filter((item) => {
            // Check if the item mentions any of our entities
            return entityNames.some(entity => item.text.toLowerCase().includes(entity));
        });
        const conflictingIds = conflictingDocs.map((item) => { var _a; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) || ''; });
        return {
            hasConflicts: conflictingIds.length > 0,
            conflictingDocIds: conflictingIds.filter(Boolean)
        };
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to check for content conflicts', error);
        return { hasConflicts: false, conflictingDocIds: [] };
    }
}
/**
 * Get statistics about pending documents
 */
async function getPendingDocumentsStats() {
    try {
        const pendingDocs = await getPendingDocuments();
        const byCategory = {};
        const byStatus = {};
        pendingDocs.forEach(doc => {
            // Count by category
            const category = doc.metadata.primaryCategory;
            byCategory[category] = (byCategory[category] || 0) + 1;
            // Count by status
            const status = doc.metadata.reviewStatus;
            byStatus[status] = (byStatus[status] || 0) + 1;
        });
        return {
            total: pendingDocs.length,
            byCategory,
            byStatus
        };
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to get pending documents stats', error);
        return {
            total: 0,
            byCategory: {},
            byStatus: {}
        };
    }
}
