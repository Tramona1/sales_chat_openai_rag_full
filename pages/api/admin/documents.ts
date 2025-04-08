import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';
import { getAllVectorStoreItems, VectorStoreItem } from '../../../utils/vectorStore';

// Extended metadata interface that includes common date fields
interface ExtendedMetadata {
  source?: string;
  lastUpdated?: string | number;
  timestamp?: string | number;
  createdAt?: string | number;
  [key: string]: any; // Allow any other properties
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', code: 'method_not_allowed' } });
  }

  try {
    // Get search parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const searchTerm = req.query.search ? (req.query.search as string).toLowerCase() : '';
    const contentType = req.query.contentType as string | undefined;
    const recentlyApproved = req.query.recentlyApproved === 'true';
    
    // Get documents from vector store
    console.log('Fetching vector store items...');
    const vectorStoreItems = getAllVectorStoreItems();
    console.log(`Retrieved ${vectorStoreItems.length} vector store items`);
    
    // Sort items by lastUpdated date (newest first) or any available date field
    console.log('Sorting items by recency...');
    const sortedItems = [...vectorStoreItems].sort((a, b) => {
      // Get timestamp from item metadata, trying different common date fields
      const getTimestamp = (item: VectorStoreItem): number => {
        if (!item.metadata) return 0;
        
        // Cast to our extended metadata type
        const meta = item.metadata as ExtendedMetadata;
        
        // Try different date fields in order of preference
        const dateField = meta.lastUpdated || meta.timestamp || meta.createdAt;
        
        if (dateField) {
          try {
            return new Date(dateField).getTime();
          } catch (e) {
            return 0;
          }
        }
        
        return 0;
      };
      
      const timestampA = getTimestamp(a);
      const timestampB = getTimestamp(b);
      
      // Sort newest first
      return timestampB - timestampA;
    });
    
    // If we have a search term, filter the items before limiting
    let filteredItems = sortedItems;
    if (searchTerm) {
      console.log(`Searching for "${searchTerm}" in ${sortedItems.length} documents`);
      filteredItems = sortedItems.filter(item => {
        // Search in text content
        const textMatch = item.text && item.text.toLowerCase().includes(searchTerm);
        
        // Search in source
        const sourceMatch = item.metadata?.source && 
          (item.metadata.source as string).toLowerCase().includes(searchTerm);
        
        // Search in other metadata fields that might contain relevant information
        const metadataMatch = item.metadata && Object.entries(item.metadata).some(([key, value]) => {
          // Skip source since we already checked it
          if (key === 'source') return false;
          
          // Check if the value is a string and contains the search term
          return typeof value === 'string' && value.toLowerCase().includes(searchTerm);
        });
        
        return textMatch || sourceMatch || metadataMatch;
      });
      console.log(`Found ${filteredItems.length} matching documents`);
    }
    
    // Filter by content type if specified
    if (contentType && contentType !== 'all') {
      filteredItems = filteredItems.filter(item => {
        // Safely check if contentType exists in metadata
        const itemContentType = item.metadata && (item.metadata as any).contentType;
        return itemContentType === contentType;
      });
      console.log(`Filtered to ${filteredItems.length} documents with content type: ${contentType}`);
    }
    
    // Filter recently approved items if requested
    if (recentlyApproved) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      filteredItems = filteredItems.filter(item => {
        const approvalDate = item.metadata?.approvedAt 
          ? new Date(item.metadata.approvedAt) 
          : item.metadata?.lastUpdated 
            ? new Date(item.metadata.lastUpdated)
            : null;
        
        return approvalDate && approvalDate > oneDayAgo;
      });
      console.log(`Filtered to ${filteredItems.length} recently approved documents`);
    }
    
    // Get the total count before applying the limit
    const totalFilteredCount = filteredItems.length;
    
    // Apply the limit
    const limitedItems = filteredItems.slice(0, limit);
    
    // Transform items to the format expected by the UI
    console.log(`Processing ${limitedItems.length} items for UI display`);
    const documents = limitedItems.map((item: VectorStoreItem) => ({
      id: item.metadata?.source || `doc-${Math.random().toString(36).substring(7)}`,
      source: item.metadata?.source || 'Unknown Source',
      text: item.text || '',
      metadata: {
        ...item.metadata,
        // Ensure source is always available
        source: item.metadata?.source || 'Unknown Source',
      }
    }));
    
    console.log(`Returning ${documents.length} documents to client (total available: ${totalFilteredCount})`);
    
    // Return the documents
    return res.status(200).json({
      documents,
      total: totalFilteredCount,
      limit
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 