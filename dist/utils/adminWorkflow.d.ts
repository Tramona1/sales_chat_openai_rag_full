/**
 * Admin Workflow Module
 *
 * This module handles the admin approval workflow for document ingestion,
 * including pending document storage, approval/rejection, and BM25 stats updates.
 */
import { EnhancedMetadata, PendingDocumentMetadata } from '../types/metadata';
interface StoredPendingDocument {
    id: string;
    metadata: PendingDocumentMetadata;
    text: string;
    embedding?: number[];
    chunks?: Array<{
        text: string;
        embedding?: number[];
        metadata?: any;
    }>;
    hasContextualChunks: boolean;
    submittedAt: string;
}
interface ApprovalDecision {
    approved: boolean;
    reviewerComments?: string;
    reviewedBy?: string;
}
interface ContextualChunk {
    text: string;
    metadata?: {
        isStructured?: boolean;
        infoType?: string;
        context?: {
            description?: string;
            keyPoints?: string[];
            isDefinition?: boolean;
            containsExample?: boolean;
            relatedTopics?: string[];
        };
    };
}
/**
 * Get all pending documents
 */
export declare function getPendingDocuments(): Promise<StoredPendingDocument[]>;
/**
 * Add a document to the pending queue
 * @param text The document text
 * @param metadata Document metadata
 * @param embedding Optional document embedding
 * @param contextualChunks Optional array of contextual chunks
 * @returns Document ID
 */
export declare function addToPendingDocuments(text: string, metadata: EnhancedMetadata, embedding?: number[] | null, contextualChunks?: ContextualChunk[] | null): Promise<string>;
/**
 * Get a specific pending document by ID
 */
export declare function getPendingDocumentById(id: string): Promise<StoredPendingDocument | null>;
/**
 * Approve or reject a pending document
 * This is a critical function that ensures BM25 corpus statistics are updated
 * when a document is approved and added to the vector store.
 */
export declare function approveOrRejectDocument(id: string, decision: ApprovalDecision): Promise<boolean>;
/**
 * Update BM25 corpus statistics after new documents are added
 */
export declare function updateBM25CorpusStatistics(): Promise<void>;
/**
 * Remove a document from the pending queue
 */
export declare function removePendingDocument(id: string): Promise<boolean>;
/**
 * Check for potential conflicts with existing content
 */
export declare function checkForContentConflicts(metadata: EnhancedMetadata, text: string): Promise<{
    hasConflicts: boolean;
    conflictingDocIds: string[];
}>;
/**
 * Get statistics about pending documents
 */
export declare function getPendingDocumentsStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
}>;
export {};
