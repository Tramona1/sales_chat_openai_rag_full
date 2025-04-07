import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../../utils/errorHandling';
import { getAllVectorStoreItems, clearVectorStore, addToVectorStore, VectorStoreItem } from '../../../../utils/vectorStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', code: 'method_not_allowed' } });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Document ID is required', code: 'invalid_request' } });
  }

  try {
    // Get all documents
    const allDocuments = getAllVectorStoreItems();
    
    // Find the document to delete
    const documentIndex = allDocuments.findIndex(item => 
      item.metadata?.source === id || // Using source as ID
      (item as any).id === id // In case we add real IDs in the future
    );
    
    if (documentIndex === -1) {
      return res.status(404).json({ error: { message: 'Document not found', code: 'not_found' } });
    }
    
    // Remove the document from the array
    const updatedDocuments = [
      ...allDocuments.slice(0, documentIndex),
      ...allDocuments.slice(documentIndex + 1)
    ];
    
    // Clear the vector store and add back all documents except the deleted one
    clearVectorStore();
    addToVectorStore(updatedDocuments);
    
    // Return success
    return res.status(200).json({ 
      success: true, 
      message: 'Document deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 