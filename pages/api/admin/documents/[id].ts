import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../../utils/errorHandling';
import { 
  VectorStoreItem, 
  getAllVectorStoreItems, 
  addToVectorStore,
  vectorStore
} from '../../../../utils/vectorStore';
import { embedText } from '../../../../utils/openaiClient';
import path from 'path';
import fs from 'fs';

// Constants for batch processing
const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
const BATCH_INDEX_FILE = path.join(process.cwd(), 'data', 'batch_index.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
  } catch (error) {
    console.error('Error in document API:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
}

// Get a specific document
async function handleGetDocument(
  req: NextApiRequest, 
  res: NextApiResponse,
  id: string
) {
  // Get all documents
  const vectorStoreItems = getAllVectorStoreItems();
  
  // Find the requested document
  const document = vectorStoreItems.find(item => 
    item.metadata?.source === id
  );
  
  if (!document) {
    return res.status(404).json({ 
      error: { 
        message: 'Document not found', 
        code: 'document_not_found' 
      } 
    });
  }
  
  return res.status(200).json({
    id: document.metadata?.source || id,
    source: document.metadata?.source || 'Unknown Source',
    text: document.text || '',
    metadata: document.metadata || {}
  });
}

// Update a document
async function handleUpdateDocument(
  req: NextApiRequest, 
  res: NextApiResponse,
  id: string
) {
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
  const documentIndex = vectorStore.findIndex(item => 
    item.metadata?.source === id
  );
  
  if (documentIndex === -1) {
    return res.status(404).json({ 
      error: { 
        message: 'Document not found', 
        code: 'document_not_found' 
      } 
    });
  }
  
  // Get the existing document
  const existingDocument = vectorStore[documentIndex];
  
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
        source: id,
        batch: batchId,
        // Update timestamps
        lastUpdated: now,
      }
    };
    
    // Remove the old document directly from the vector store
    vectorStore.splice(documentIndex, 1);
    
    // Add the updated document to the vector store
    // This will also save changes to disk
    addToVectorStore(updatedDocument);
    
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
              item.metadata?.source !== id
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
      items: vectorStore,
      lastUpdated: Date.now()
    }, null, 2));
    
    console.log(`Document ${id} updated successfully`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Document updated successfully',
      id,
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
}

// Delete a document
async function handleDeleteDocument(
  req: NextApiRequest, 
  res: NextApiResponse,
  id: string
) {
  console.log(`Deleting document with ID: ${id}`);
  
  // Find the document in the actual vector store
  const documentIndex = vectorStore.findIndex(item => 
    item.metadata?.source === id
  );
  
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
    const documentToDelete = vectorStore[documentIndex];
    const batchId = documentToDelete.metadata?.batch;
    
    // Remove the document from the vector store
    vectorStore.splice(documentIndex, 1);
    
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
              item.metadata?.source !== id
            );
            
            // Write the updated batch
            fs.writeFileSync(batchFile, JSON.stringify(updatedBatchItems, null, 2));
            console.log(`Updated batch ${batchId} after removing document ${id}`);
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
      items: vectorStore,
      lastUpdated: Date.now()
    }, null, 2));
    
    console.log(`Document ${id} deleted successfully`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Document deleted successfully',
      id
    });
    
  } catch (error) {
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