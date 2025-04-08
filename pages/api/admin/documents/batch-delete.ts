import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../../utils/errorHandling';
import { getAllVectorStoreItems, vectorStore } from '../../../../utils/vectorStore';
import path from 'path';
import fs from 'fs';

// Constants for batch processing
const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
const BATCH_INDEX_FILE = path.join(process.cwd(), 'data', 'batch_index.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const allDocuments = getAllVectorStoreItems();
    
    // Track which IDs were found and deleted
    const deletedIds: string[] = [];
    const notFoundIds: string[] = [];
    
    // Create a map to track which batches need to be updated
    const batchUpdates: Record<string, {
      batchId: string,
      documentsToKeep: any[]
    }> = {};
    
    // Filter out the documents to delete
    const documentsToKeep = allDocuments.filter(item => {
      const documentId = item.metadata?.source;
      
      // If this is one of the documents to delete
      if (documentId && documentIds.includes(documentId)) {
        deletedIds.push(documentId);
        
        // Track batches that need updating
        const batchId = item.metadata?.batch;
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
      const batchId = item.metadata?.batch;
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
    if (fs.existsSync(BATCH_INDEX_FILE)) {
      try {
        // Read the batch index
        const indexData = JSON.parse(fs.readFileSync(BATCH_INDEX_FILE, 'utf-8'));
        const activeBatches = indexData.activeBatches || [];
        
        // Update each affected batch
        for (const batchId of Object.keys(batchUpdates)) {
          if (activeBatches.includes(batchId)) {
            const batchFile = path.join(VECTOR_STORE_DIR, `batch_${batchId}.json`);
            
            if (fs.existsSync(batchFile)) {
              // Write the updated batch with only the kept documents
              fs.writeFileSync(batchFile, JSON.stringify(batchUpdates[batchId].documentsToKeep, null, 2));
              console.log(`Updated batch ${batchId} after removing documents`);
            }
          }
        }
      } catch (batchError) {
        console.error('Error updating batch files during batch deletion:', batchError);
        // Continue with main deletion even if batch updates fail
      }
    }
    
    // Manually save the updated documents to the single vectorStore.json file
    const singleStoreFile = path.join(process.cwd(), 'data', 'vectorStore.json');
    fs.writeFileSync(singleStoreFile, JSON.stringify({ 
      items: documentsToKeep,
      lastUpdated: Date.now()
    }, null, 2));
    
    // Update the in-memory vector store to reflect the changes
    try {
      // Assign the documents directly to the vectorStore array
      (vectorStore as any).length = 0; // Clear the array
      documentsToKeep.forEach(item => (vectorStore as any).push(item));
      
      console.log(`Vector store updated with ${documentsToKeep.length} remaining documents`);
    } catch (error) {
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
    
  } catch (error) {
    console.error('Error during batch delete:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 