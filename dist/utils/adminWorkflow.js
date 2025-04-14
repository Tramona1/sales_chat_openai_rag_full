/**
 * Admin Workflow Module
 *
 * This module handles the admin approval workflow for document ingestion,
 * including pending document storage, approval/rejection, and BM25 stats updates.
 */
const fs = require('fs/promises');
const path = require('path');
import { v4 as uuidv4 } from 'uuid';
import { logError, logInfo } from './logger';
import { DocumentCategoryType } from './documentCategories';
import { getSupabaseAdmin } from './supabaseClient';
import crypto from 'crypto';
/**
 * Approve or reject a pending document
 * NOTE: This function is becoming less relevant as the API endpoints now directly
 * update Supabase. It primarily handles the vector store addition on approval.
 * The file-based status update part is removed.
 */
export async function approveOrRejectDocument(id, decision) {
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
        if (decision.approved) {
            // If approved, add to vector store
            await addApprovedDocumentToVectorStore(pendingDoc);
        }
        console.log(`Document ${id} ${decision.approved ? 'approved' : 'rejected'}`);
        return true;
    }
    catch (error) {
        logError(`Failed to ${decision.approved ? 'approve' : 'reject'} document ${id}`, error);
        return false;
    }
}
/**
 * Add an approved document to the vector store
 */
async function addApprovedDocumentToVectorStore(pendingDoc) {
    try {
        // Generate a proper UUID for the document
        const documentUuid = uuidv4();
        logInfo(`Converting pending document ID ${pendingDoc.id} to UUID ${documentUuid} for storage`);
        // Import the document processor
        const { processDocument } = await import('./documentProcessor');
        // Process the document using the unified document processor
        const result = await processDocument(pendingDoc.text, pendingDoc.metadata.source || 'admin', undefined, // No MIME type since we already have the text
        {
            documentId: documentUuid, // Use the new UUID instead of pendingDoc.id
            useCaching: true
        });
        if (!result.success) {
            throw new Error(`Document processing failed: ${result.error}`);
        }
        logInfo(`Document ${documentUuid} successfully processed and added to vector store`);
        logInfo(`Created ${result.chunkCount} chunks with context`);
        // After successful processing, update BM25 statistics
        // await updateBM25CorpusStatistics(); // REMOVED - FTS function does not exist / not needed
    }
    catch (error) {
        logError('Error adding document to vector store:', error);
        throw error;
    }
}
/**
 * Get a specific pending document by ID
 */
export async function getPendingDocumentById(id) {
    const pendingDocs = await getPendingDocuments();
    return pendingDocs.find(doc => doc.id === id) || null;
}
/**
 * Check for potential conflicts with existing content
 */
export async function checkForContentConflicts(metadata, text) {
    try {
        // Check only for specific sensitive categories based on the CURRENT enum
        const sensitiveCategories = [
            // DocumentCategoryType.PRICING, // Invalid
            // DocumentCategoryType.CUSTOMER, // Invalid
            // DocumentCategoryType.COMPETITORS, // Invalid
            // DocumentCategoryType.INTERNAL_POLICY, // Invalid
            // Add valid sensitive categories from the current enum if needed
            DocumentCategoryType.PAYROLL,
            DocumentCategoryType.COMPLIANCE, // Was INTERNAL_POLICY
            DocumentCategoryType.SECURITY_PRIVACY,
            DocumentCategoryType.HR_MANAGEMENT // Potentially sensitive employee data
            // Add others as appropriate based on the enum definition and sensitivity
        ];
        if (!metadata.primaryCategory || !sensitiveCategories.includes(metadata.primaryCategory)) {
            // Non-sensitive category, no conflict check needed
            return { hasConflicts: false, conflictingDocIds: [] };
        }
        // Get all vector store items
        const { getAllVectorStoreItems } = require('./vectorStore');
        const allItems = getAllVectorStoreItems();
        // Filter to items with the same category
        const sameCategory = allItems.filter((item) => item.metadata?.category === metadata.primaryCategory);
        // Extract entities from current document
        const entityNames = metadata.entities && Array.isArray(metadata.entities)
            ? metadata.entities
                .filter(e => e.confidence !== 'uncertain')
                .map(e => e.name.toLowerCase())
            : [];
        // Look for potential conflicts
        const conflictingDocs = sameCategory.filter((item) => {
            // Check if the item mentions any of our entities
            return entityNames.some(entity => item.text && item.text.toLowerCase().includes(entity));
        });
        const conflictingIds = conflictingDocs.map((item) => item.metadata?.source || '');
        return {
            hasConflicts: conflictingIds.length > 0,
            conflictingDocIds: conflictingIds.filter(Boolean)
        };
    }
    catch (error) {
        logError('Failed to check for content conflicts', error);
        return { hasConflicts: false, conflictingDocIds: [] };
    }
}
/**
 * Get statistics about pending documents
 */
export async function getPendingDocumentsStats() {
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
        logError('Failed to get pending documents stats', error);
        return {
            total: 0,
            byCategory: {},
            byStatus: {}
        };
    }
}
/**
 * Get all pending documents from storage
 * @returns Array of pending documents
 */
export async function getPendingDocuments() {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('approved', false)
            .order('created_at', { ascending: false });
        if (error) {
            logError('Error fetching pending documents', error);
            return [];
        }
        // Convert the Supabase documents to our internal format
        return data.map((doc) => ({
            id: doc.id,
            text: doc.content,
            metadata: doc.metadata || {},
            embedding: doc.embedding,
            hasContextualChunks: Boolean(doc.has_chunks),
            submittedAt: doc.created_at
        }));
    }
    catch (error) {
        logError('Error in getPendingDocuments', error);
        return [];
    }
}
/**
 * Add a document to the pending documents queue
 * @param text Document text content
 * @param metadata Document metadata
 * @param embedding Optional embedding for the document
 * @returns The ID of the created pending document
 */
export async function addToPendingDocuments(text, metadata, embedding) {
    try {
        // Generate a unique ID for the document
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        // Store the document in Supabase
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('documents')
            .insert({
            id,
            content: text,
            metadata,
            embedding,
            approved: false,
            created_at: timestamp,
            updated_at: timestamp
        });
        if (error) {
            logError('Error adding pending document', error);
            throw new Error(`Failed to add document to pending queue: ${error.message}`);
        }
        logInfo('Document added to pending queue', { id });
        return id;
    }
    catch (error) {
        logError('Error in addToPendingDocuments', error);
        throw new Error('Failed to add document to pending queue');
    }
}
// TODO: Add more categories as needed
// Example: Add more specific categories if needed
function mapCategoryToDocumentCategoryType(category) {
    switch (category) {
        case 'Hiring & Onboarding':
            return DocumentCategoryType.HIRING; // Or ONBOARDING if more specific
        case 'Payroll & Compliance':
            return DocumentCategoryType.PAYROLL; // Or COMPLIANCE
        case 'Employee Management':
            return DocumentCategoryType.HR_MANAGEMENT;
        // Map old categories to new/general ones
        case 'Pricing':
            return DocumentCategoryType.GENERAL;
        case 'Customer Stories': // Assuming this was the intent of CUSTOMER
            return DocumentCategoryType.GENERAL;
        case 'Competitor Info': // Assuming this was the intent of COMPETITORS
            return DocumentCategoryType.GENERAL;
        case 'Internal Policy': // Map to COMPLIANCE
            return DocumentCategoryType.COMPLIANCE;
        default:
            return DocumentCategoryType.GENERAL;
    }
}
// Example list of categories that require manager approval
const requiresManagerApprovalCategories = [
    DocumentCategoryType.PAYROLL,
    DocumentCategoryType.COMPLIANCE, // Use valid enum member
    DocumentCategoryType.SECURITY_PRIVACY // Use valid enum member
    // Old invalid categories removed
];
