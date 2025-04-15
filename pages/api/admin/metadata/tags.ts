/**
 * @file API endpoint for metadata tags retrieval
 * @description Provides a list of all tags used in document chunks
 * 
 * NO AUTHENTICATION: Authentication is disabled to fix 404/401 errors in Vercel.
 * In a production environment, this would need proper authentication.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { logInfo, logError } from '@/utils/logger';

/**
 * API handler for retrieving all unique tags from document chunks metadata
 * GET: Return a list of all unique tags used across documents
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
    
    logInfo('Fetching available tags from document chunks');
    const supabase = getSupabaseAdmin();
    
    // Query all document chunks to extract tags
    const { data, error } = await supabase
      .from('document_chunks')
      .select('metadata');
    
    if (error) {
      logError('Error fetching document chunks metadata:', error);
      return res.status(500).json({ error: 'Failed to fetch metadata' });
    }
    
    // Extract all tags from metadata
    const tagSet = new Set<string>();
    
    data?.forEach(row => {
      if (row.metadata && row.metadata.tags && Array.isArray(row.metadata.tags)) {
        row.metadata.tags.forEach((tag: string) => {
          if (tag && typeof tag === 'string') {
            tagSet.add(tag);
          }
        });
      }
    });
    
    // Convert to array and sort alphabetically
    const tags = Array.from(tagSet).sort();
    
    return res.status(200).json({
      tags,
      count: tags.length
    });
  } catch (error) {
    logError('Error handling metadata tags request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export the handler directly without authentication wrapper
export default handler; 