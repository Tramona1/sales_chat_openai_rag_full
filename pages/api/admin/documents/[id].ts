import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../../utils/errorHandling';
import { 
  getAllVectorStoreItems, 
  addToVectorStore,
  getVectorStoreSize,
  VectorStoreItem
} from '../../../../utils/vectorStore';
import { embedText } from '../../../../utils/openaiClient';
import path from 'path';
import fs from 'fs';
import { logError } from '../../../../utils/logger';

// Constants for batch processing
const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
const BATCH_INDEX_FILE = path.join(process.cwd(), 'data', 'batch_index.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const documentId = id as string;

  if (!documentId || typeof documentId !== 'string') {
    return res.status(400).json({ 
      error: { 
        message: 'Document ID is required', 
        code: 'missing_document_id' 
      } 
    });
  }

  try {
    // Method handling switch statement
    switch (req.method) {
      case 'GET':
        return handleGetDocument(req, res, documentId);
      case 'PUT':
        return handleUpdateDocument(req, res, documentId);
      case 'DELETE':
        return handleDeleteDocument(req, res, documentId);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error(`Error handling request for document ${documentId}:`, error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
}

// GET handler: Fetch a single document by ID
async function handleGetDocument(req: NextApiRequest, res: NextApiResponse, documentId: string) {
  try {
    const vectorStoreItems = await getAllVectorStoreItems();
    const document = vectorStoreItems.find((item: VectorStoreItem) => 
      item.metadata?.source === documentId
    );

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.status(200).json(document);
  } catch (error) {
    logError('Error fetching document:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
}

// PUT handler: Update a document
async function handleUpdateDocument(req: NextApiRequest, res: NextApiResponse, documentId: string) {
  try {
    const { text, metadata } = req.body;

    if (!text || !metadata) {
      return res.status(400).json({ message: 'Missing text or metadata in request body' });
    }
    
    console.log(`Updating document with ID: ${documentId}`);
    
    const allItems = await getAllVectorStoreItems();
    const documentIndex = allItems.findIndex((item: VectorStoreItem) => item.metadata?.source === documentId);

    if (documentIndex === -1) {
      return res.status(404).json({ message: 'Document not found for update' });
    }
    
    // Get the existing document
    const existingDocument = allItems[documentIndex];
    
    // Determine if we need to regenerate the embedding (text has changed)
    const needsNewEmbedding = existingDocument.text !== text;
    
    try {
      // Generate new embeddings if needed
      let embedding = existingDocument.embedding;
      
      if (needsNewEmbedding) {
        console.log('Text changed, generating new embeddings...');
        embedding = await embedText(text);
        console.log('New embeddings generated');
      }
      
      // Update timestamp
      const now = new Date().toISOString();
      
      // Track original batch ID
      const batchId = existingDocument.metadata?.batch;
      
      // Create updated document
      const updatedDocument: VectorStoreItem = {
        text,
        embedding,
        metadata: {
          ...metadata,
          // Always preserve the source identifier and batch
          source: documentId,
          batch: batchId,
          // Update timestamps
          lastUpdated: now,
        }
      };
      
      // Remove the old document directly from the vector store
      allItems.splice(documentIndex, 1);
      
      // Add the updated document to the vector store
      // This will also save changes to disk
      await addToVectorStore(updatedDocument);
      
      // Update batch files directly if needed
      if (batchId && fs.existsSync(BATCH_INDEX_FILE)) {
        try {
          // Read the batch index
          const indexData = JSON.parse(fs.readFileSync(BATCH_INDEX_FILE, 'utf-8'));
          const activeBatches = indexData.activeBatches || [];
          
          // If this batch exists, update it directly
          if (activeBatches.includes(batchId)) {
            const batchFile = path.join(VECTOR_STORE_DIR, `batch_${batchId}.json`);
            
            if (fs.existsSync(batchFile)) {
              // Read the batch
              const batchItems = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
              
              // Remove the old document from the batch
              const filteredBatchItems = batchItems.filter((item: VectorStoreItem) => 
                item.metadata?.source !== documentId
              );
              
              // Add the updated document to the batch
              filteredBatchItems.push(updatedDocument);
              
              // Write the updated batch
              fs.writeFileSync(batchFile, JSON.stringify(filteredBatchItems, null, 2));
              console.log(`Updated document in batch ${batchId}`);
            }
          }
        } catch (batchError) {
          console.error('Error updating batch file during document update:', batchError);
        }
      }
      
      // Also ensure the single file is updated as a backup
      const singleStoreFile = path.join(process.cwd(), 'data', 'vectorStore.json');
      fs.writeFileSync(singleStoreFile, JSON.stringify({ 
        items: allItems,
        lastUpdated: Date.now()
      }, null, 2));
      
      console.log(`Document ${documentId} updated successfully`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Document updated successfully',
        id: documentId,
        embeddingUpdated: needsNewEmbedding
      });
      
    } catch (error) {
      console.error('Error updating document:', error);
      return res.status(500).json({ 
        error: { 
          message: 'Failed to update document', 
          code: 'update_failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      });
    }
  } catch (error) {
    logError('Error updating document:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
}

// DELETE handler: Remove a document
async function handleDeleteDocument(req: NextApiRequest, res: NextApiResponse, documentId: string) {
  try {
    console.log(`Deleting document with ID: ${documentId}`);
    
    const allItems = await getAllVectorStoreItems();
    const documentIndex = allItems.findIndex((item: VectorStoreItem) => item.metadata?.source === documentId);

    if (documentIndex === -1) {
      return res.status(404).json({ message: 'Document not found for deletion' });
    }

    // Get the document to track which batch it belongs to
    const documentToDelete = allItems[documentIndex];
    const batchId = documentToDelete.metadata?.batch;
    
    // Remove the document from the vector store
    allItems.splice(documentIndex, 1);
    
    // Update the batches if applicable
    if (batchId && fs.existsSync(BATCH_INDEX_FILE)) {
      try {
        // Read the batch index
        const indexData = JSON.parse(fs.readFileSync(BATCH_INDEX_FILE, 'utf-8'));
        const activeBatches = indexData.activeBatches || [];
        
        // If this batch exists, update it
        if (activeBatches.includes(batchId)) {
          const batchFile = path.join(VECTOR_STORE_DIR, `batch_${batchId}.json`);
          
          if (fs.existsSync(batchFile)) {
            // Read the batch, remove the document, write it back
            const batchItems = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
            const updatedBatchItems = batchItems.filter((item: VectorStoreItem) => 
              item.metadata?.source !== documentId
            );
            
            // Write the updated batch
            fs.writeFileSync(batchFile, JSON.stringify(updatedBatchItems, null, 2));
            console.log(`Updated batch ${batchId} after removing document ${documentId}`);
          }
        }
      } catch (batchError) {
        console.error('Error updating batch file during document deletion:', batchError);
        // Continue with main deletion even if batch update fails
      }
    }
    
    // Save the updated vector store to the single file as well (as backup)
    const singleStoreFile = path.join(process.cwd(), 'data', 'vectorStore.json');
    fs.writeFileSync(singleStoreFile, JSON.stringify({ 
      items: allItems,
      lastUpdated: Date.now()
    }, null, 2));
    
    console.log(`Document ${documentId} deleted successfully`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Document deleted successfully',
      id: documentId
    });
    
  } catch (error) {
    logError('Error deleting document:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 