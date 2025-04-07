/**
 * Admin Workflow Module
 * 
 * This module handles the admin approval workflow for document ingestion,
 * including pending document storage, approval/rejection, and BM25 stats updates.
 */

import fs from 'fs/promises';
import path from 'path';
import { 
  EnhancedMetadata, 
  PendingDocumentMetadata
} from '../types/metadata';
import { logError } from './errorHandling';
import { 
  addToVectorStore, 
  VectorStoreItem 
} from './vectorStore';
import { calculateCorpusStatistics, saveCorpusStatistics } from './bm25';
import { DocumentCategoryType, QualityControlFlag } from './documentCategories';

// File paths for storing pending documents
const PENDING_DIR = path.join(process.cwd(), 'data', 'pending');
const PENDING_INDEX_FILE = path.join(PENDING_DIR, 'pending_index.json');

// Interface for pending document in storage
interface StoredPendingDocument {
  id: string;
  metadata: PendingDocumentMetadata;
  text: string;
  embedding?: number[];
  submittedAt: string;
}

// Interface for approval decision
interface ApprovalDecision {
  approved: boolean;
  reviewerComments?: string;
  reviewedBy?: string;
}

/**
 * Initialize the pending documents directory
 */
async function initPendingDir(): Promise<void> {
  try {
    await fs.mkdir(PENDING_DIR, { recursive: true });
    
    // Create pending index file if it doesn't exist
    try {
      await fs.access(PENDING_INDEX_FILE);
    } catch {
      await fs.writeFile(PENDING_INDEX_FILE, JSON.stringify({ items: [] }));
    }
  } catch (error) {
    logError('Failed to initialize pending documents directory', error);
  }
}

/**
 * Get all pending documents
 */
export async function getPendingDocuments(): Promise<StoredPendingDocument[]> {
  await initPendingDir();
  
  try {
    const indexData = await fs.readFile(PENDING_INDEX_FILE, 'utf8');
    const index = JSON.parse(indexData);
    return index.items || [];
  } catch (error) {
    logError('Failed to get pending documents', error);
    return [];
  }
}

/**
 * Add a document to the pending queue
 */
export async function addToPendingDocuments(
  text: string,
  metadata: EnhancedMetadata,
  embedding?: number[]
): Promise<string> {
  await initPendingDir();
  
  try {
    // Create a pending document with a unique ID
    const id = `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create pending document metadata
    const pendingMetadata: PendingDocumentMetadata = {
      ...metadata,
      submittedAt: new Date().toISOString(),
      reviewStatus: 'pending'
    };
    
    // Create the stored document
    const pendingDocument: StoredPendingDocument = {
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
    await fs.writeFile(
      PENDING_INDEX_FILE, 
      JSON.stringify({ items: pendingDocs }, null, 2)
    );
    
    console.log(`Added document ${id} to pending queue`);
    return id;
  } catch (error) {
    logError('Failed to add document to pending queue', error);
    throw error;
  }
}

/**
 * Get a specific pending document by ID
 */
export async function getPendingDocumentById(id: string): Promise<StoredPendingDocument | null> {
  const pendingDocs = await getPendingDocuments();
  return pendingDocs.find(doc => doc.id === id) || null;
}

/**
 * Approve or reject a pending document
 * This is a critical function that ensures BM25 corpus statistics are updated 
 * when a document is approved and added to the vector store.
 */
export async function approveOrRejectDocument(
  id: string,
  decision: ApprovalDecision
): Promise<boolean> {
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
    await fs.writeFile(
      PENDING_INDEX_FILE, 
      JSON.stringify({ items: updatedDocs }, null, 2)
    );
    
    if (decision.approved) {
      // If approved, add to vector store
      await addApprovedDocumentToVectorStore(pendingDoc);
    }
    
    console.log(`Document ${id} ${decision.approved ? 'approved' : 'rejected'}`);
    return true;
  } catch (error) {
    logError(`Failed to ${decision.approved ? 'approve' : 'reject'} document ${id}`, error);
    return false;
  }
}

/**
 * Add an approved document to the vector store
 * This function ensures BM25 corpus statistics are updated
 */
async function addApprovedDocumentToVectorStore(
  pendingDoc: StoredPendingDocument
): Promise<void> {
  try {
    // Create vector store item from pending document
    const vectorItem: VectorStoreItem = {
      text: pendingDoc.text,
      embedding: pendingDoc.embedding || [], // Empty if not provided, will be generated by addToVectorStore
      metadata: {
        source: pendingDoc.metadata.source,
        batch: `batch_${Date.now()}`,
        // Add category to metadata for future filtering
        category: pendingDoc.metadata.primaryCategory,
        // Include additional metadata for smart retrieval
        technicalLevel: pendingDoc.metadata.technicalLevel,
        entities: pendingDoc.metadata.entities.map(e => e.name).join(','),
        keywords: pendingDoc.metadata.keywords.join(','),
        summary: pendingDoc.metadata.summary
      }
    };
    
    // Add to vector store - this will generate embeddings if needed
    await addToVectorStore(vectorItem);
    console.log(`Added approved document ${pendingDoc.id} to vector store`);
    
    // Update BM25 corpus statistics
    await updateBM25CorpusStatistics();
  } catch (error) {
    logError(`Failed to add approved document ${pendingDoc.id} to vector store`, error);
    throw error;
  }
}

/**
 * Update BM25 corpus statistics after new documents are added
 */
export async function updateBM25CorpusStatistics(): Promise<void> {
  try {
    // Import vector store functions to get all items
    const { getAllVectorStoreItems } = require('./vectorStore');
    
    // Get all vector store items
    const allItems = getAllVectorStoreItems();
    
    console.log(`Updating BM25 corpus statistics with ${allItems.length} documents`);
    
    // Calculate corpus statistics
    const corpusStats = await calculateCorpusStatistics(allItems);
    
    // Save updated statistics
    await saveCorpusStatistics(corpusStats);
    
    console.log('BM25 corpus statistics updated successfully');
  } catch (error) {
    logError('Failed to update BM25 corpus statistics', error);
    throw error;
  }
}

/**
 * Remove a document from the pending queue
 */
export async function removePendingDocument(id: string): Promise<boolean> {
  try {
    const pendingDocs = await getPendingDocuments();
    const filteredDocs = pendingDocs.filter(doc => doc.id !== id);
    
    if (filteredDocs.length === pendingDocs.length) {
      // Document not found
      return false;
    }
    
    await fs.writeFile(
      PENDING_INDEX_FILE, 
      JSON.stringify({ items: filteredDocs }, null, 2)
    );
    
    console.log(`Removed document ${id} from pending queue`);
    return true;
  } catch (error) {
    logError(`Failed to remove document ${id} from pending queue`, error);
    return false;
  }
}

/**
 * Check for potential conflicts with existing content
 */
export async function checkForContentConflicts(
  metadata: EnhancedMetadata,
  text: string
): Promise<{ hasConflicts: boolean; conflictingDocIds: string[] }> {
  try {
    // Check only for specific sensitive categories
    const sensitiveCategories = [
      DocumentCategoryType.PRICING,
      DocumentCategoryType.CUSTOMER,
      DocumentCategoryType.COMPETITORS,
      DocumentCategoryType.INTERNAL_POLICY
    ];
    
    if (!sensitiveCategories.includes(metadata.primaryCategory)) {
      // Non-sensitive category, no conflict check needed
      return { hasConflicts: false, conflictingDocIds: [] };
    }
    
    // Get all vector store items
    const { getAllVectorStoreItems } = require('./vectorStore');
    const allItems = getAllVectorStoreItems();
    
    // Filter to items with the same category
    const sameCategory = allItems.filter((item: VectorStoreItem) => 
      item.metadata?.category === metadata.primaryCategory
    );
    
    // TODO: Implement more sophisticated conflict detection logic
    // For now, just check if the document mentions any relevant entities
    
    // Extract entities from current document
    const entityNames = metadata.entities
      .filter(e => e.confidence !== 'uncertain')
      .map(e => e.name.toLowerCase());
      
    // Look for potential conflicts
    const conflictingDocs = sameCategory.filter((item: VectorStoreItem) => {
      // Check if the item mentions any of our entities
      return entityNames.some(entity => 
        item.text.toLowerCase().includes(entity)
      );
    });
    
    const conflictingIds = conflictingDocs.map((item: VectorStoreItem) => item.metadata?.source || '');
    
    return {
      hasConflicts: conflictingIds.length > 0,
      conflictingDocIds: conflictingIds.filter(Boolean)
    };
  } catch (error) {
    logError('Failed to check for content conflicts', error);
    return { hasConflicts: false, conflictingDocIds: [] };
  }
}

/**
 * Get statistics about pending documents
 */
export async function getPendingDocumentsStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  try {
    const pendingDocs = await getPendingDocuments();
    
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
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
  } catch (error) {
    logError('Failed to get pending documents stats', error);
    return {
      total: 0,
      byCategory: {},
      byStatus: {}
    };
  }
} 