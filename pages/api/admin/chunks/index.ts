/**
 * @file API endpoint for document chunk operations
 * @description Provides CRUD operations for chunks, including listing with filters
 * 
 * NO AUTHENTICATION: Authentication is disabled to fix 404/401 errors in Vercel.
 * In a production environment, this would need proper authentication.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { logInfo, logError } from '@/utils/logger';

/**
 * API handler for listing document chunks with pagination and filtering
 * GET: Retrieve chunks with optional filtering by document ID, search term, etc.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add expanded CORS headers for better compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Extract query parameters
    const {
      document_id,
      search,
      limit = '50',
      page = '1',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // Initialize Supabase client
    const supabase = getSupabaseAdmin();
    
    // Start building the query
    let query = supabase
      .from('document_chunks')
      .select('id, document_id, chunk_index, text, metadata, created_at', { count: 'exact' });
    
    // Apply filters if provided
    if (document_id) {
      logInfo(`Filtering chunks by document_id: ${document_id}`);
      query = query.eq('document_id', document_id);
    }
    
    if (search && typeof search === 'string') {
      logInfo(`Searching chunks for text: ${search}`);
      query = query.ilike('text', `%${search}%`);
    }
    
    // Apply sorting
    query = query.order(sort_by as string, { ascending: sort_order === 'asc' });
    
    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);
    
    // Execute the query
    const { data: chunks, error, count } = await query;
    
    if (error) {
      logError('Error fetching chunks:', error);
      return res.status(500).json({ error: 'Failed to fetch chunks' });
    }
    
    // Format and return results
    const totalChunks = count || 0;
    const totalPages = Math.ceil(totalChunks / limitNum);
    
    return res.status(200).json({
      chunks,
      pagination: {
        total: totalChunks,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    logError('Error handling chunks request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export the handler directly without authentication wrapper
export default handler; 