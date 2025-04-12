import { NextApiRequest, NextApiResponse } from 'next';
import fsPromises from 'fs/promises';
import fs from 'fs';
import { getAllVectorStoreItems, VectorStoreItem } from '../../../utils/vectorStore';
import path from 'path';
import { logError } from '../../../utils/logger';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';

// Interface for expected request body
interface ResolveConflictRequest {
  conflictTopic: string;
  entityName?: string;
  preferredDocId: string;
  deprecatedDocIds: string[];
}

/**
 * API endpoint to resolve content conflicts in the knowledge base
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { 
      conflictTopic, 
      entityName, 
      preferredDocId, 
      deprecatedDocIds 
    } = req.body as ResolveConflictRequest;

    // Validate required fields
    if (!preferredDocId) {
      return res.status(400).json({ message: 'Missing required field: preferredDocId' });
    }

    if (!Array.isArray(deprecatedDocIds)) {
      return res.status(400).json({ message: 'deprecatedDocIds must be an array' });
    }

    // Get vector store data
    const vectorStoreItems = await getAllVectorStoreItems();
    
    // Find preferred document
    const preferredDoc = vectorStoreItems.find((item: VectorStoreItem) => item.metadata?.source === preferredDocId);
    if (!preferredDoc) {
      return res.status(404).json({ message: 'Preferred document not found' });
    }
    
    // Mark preferred document as authoritative
    if (!preferredDoc.metadata) preferredDoc.metadata = {};
    preferredDoc.metadata.isAuthoritative = 'true';
    
    // Update last edited timestamp
    preferredDoc.metadata.lastUpdated = new Date().toISOString();
    
    // Track which documents were marked as deprecated
    const markedDocIds: string[] = [];
    
    // Mark deprecated documents
    for (const deprecatedId of deprecatedDocIds) {
      const deprecatedDoc = vectorStoreItems.find((item: VectorStoreItem) => item.metadata?.source === deprecatedId);
      if (deprecatedDoc) {
        if (!deprecatedDoc.metadata) deprecatedDoc.metadata = {};
        deprecatedDoc.metadata.isDeprecated = 'true';
        deprecatedDoc.metadata.deprecatedBy = preferredDocId;
        deprecatedDoc.metadata.deprecatedAt = new Date().toISOString();
        markedDocIds.push(deprecatedId);
      }
    }
    
    // Save the updated vector store to disk
    const vectorStorePath = path.join(process.cwd(), 'data', 'vectorStore.json');
    fs.writeFileSync(
      vectorStorePath, 
      JSON.stringify({ 
        items: vectorStoreItems,
        lastUpdated: Date.now()
      }, null, 2)
    );
    
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
  } catch (error) {
    logError('Error resolving conflict:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
}

// Helper function for batch save (included directly to avoid import errors)
function saveVectorStore() {
  try {
    // Implement batch save logic here if needed
    console.log('Batch save function called');
  } catch (error) {
    console.error('Error saving vector store batches:', error);
  }
} 