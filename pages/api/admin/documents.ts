import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';
import { getAllVectorStoreItems, VectorStoreItem } from '../../../utils/vectorStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', code: 'method_not_allowed' } });
  }

  try {
    // Get the limit parameter (default to 100)
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    
    // Get documents from vector store
    console.log('Fetching vector store items...');
    const vectorStoreItems = getAllVectorStoreItems();
    console.log(`Retrieved ${vectorStoreItems.length} vector store items`);
    
    // Transform items to the format expected by the UI
    console.log(`Processing up to ${limit} items for UI display`);
    const documents = vectorStoreItems.slice(0, limit).map((item: VectorStoreItem) => ({
      id: item.metadata?.source || `doc-${Math.random().toString(36).substring(7)}`,
      source: item.metadata?.source || 'Unknown Source',
      text: item.text || '',
      metadata: {
        ...item.metadata,
        // Ensure source is always available
        source: item.metadata?.source || 'Unknown Source',
      }
    }));
    
    console.log(`Returning ${documents.length} documents to client`);
    
    // Return the documents
    return res.status(200).json({
      documents,
      total: vectorStoreItems.length,
      limit
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 