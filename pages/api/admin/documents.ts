import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';
import { logInfo, logError } from '../../../utils/logger';
import { supabaseAdmin } from '../../../utils/supabaseClient';

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
    
    logInfo('Fetching documents from Supabase');
    
    // Build the query
    let query = supabaseAdmin
      .from('documents')
      .select(`
        id,
        title,
        source_url,
        mime_type,
        created_at,
        updated_at,
        metadata,
        document_chunks (
          id,
          chunk_index,
          content,
          metadata
        )
      `);
    
    // Apply search term filter if provided
    if (searchTerm) {
      logInfo(`Filtering by search term: ${searchTerm}`);
      query = query.or(`title.ilike.%${searchTerm}%,source_url.ilike.%${searchTerm}%,document_chunks.content.ilike.%${searchTerm}%`);
    }
    
    // Apply content type filter if provided
    if (contentType && contentType !== 'all') {
      logInfo(`Filtering by content type: ${contentType}`);
      query = query.eq('mime_type', contentType);
    }
    
    // Apply recently approved filter if requested
    if (recentlyApproved) {
      logInfo('Filtering recently approved documents');
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      query = query.gt('updated_at', oneDayAgo.toISOString());
    }
    
    // Execute the query
    const { data: documentsData, error: documentsError, count } = await query
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (documentsError) {
      throw documentsError;
    }
    
    logInfo(`Retrieved ${documentsData?.length || 0} documents from Supabase`);
    
    // Format documents for the UI
    const documents = documentsData?.map(doc => {
      // Get a sample of the document content from its chunks
      const firstChunk = doc.document_chunks && doc.document_chunks.length > 0 
        ? doc.document_chunks[0].content 
        : '';
      
      return {
        id: doc.id,
        source: doc.title || doc.source_url || 'Unknown Source',
        text: firstChunk,
        metadata: {
          ...doc.metadata,
          source: doc.title || doc.source_url || 'Unknown Source',
          mimeType: doc.mime_type,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
          chunkCount: doc.document_chunks?.length || 0
        }
      };
    }) || [];
    
    // Return the documents
    logInfo(`Returning ${documents.length} documents to client`);
    return res.status(200).json({
      documents,
      total: count || documents.length,
      limit
    });
  } catch (error) {
    logError('Error fetching documents:', error);
    return res.status(500).json(standardizeApiErrorResponse(error));
  }
}