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
 * This function ensures BM25 corpus statistics are updated and all Gemini-generated metadata is preserved
 */
async function addApprovedDocumentToVectorStore(
  pendingDoc: StoredPendingDocument
): Promise<void> {
  try {
    // Extract document information
    const { id, text, embedding, metadata } = pendingDoc;

    // Create a properly typed metadata object that preserves all Gemini-generated fields
    const enhancedMetadata: Record<string, any> = {
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
      } catch (error) {
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
    const vectorStoreItem: VectorStoreItem = {
      id: id,
      text: text,
      embedding: embedding || [], // Use provided embedding or empty array
      metadata: enhancedMetadata
    };

    // Add item to vector store
    await addToVectorStore(vectorStoreItem);

    // Update BM25 corpus statistics in the background
    updateBM25CorpusStatistics().catch(error => {
      console.error('Error updating BM25 corpus statistics:', error);
    });

    // Log success with fields preserved
    console.log(`Document ${id} added to vector store with AI-generated metadata:`, 
      Object.keys(enhancedMetadata).join(', '));
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