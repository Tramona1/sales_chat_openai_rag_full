import { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { logInfo, logError } from '@/utils/logger';
import { withAdminAuth } from '@/utils/auth';

/**
 * API handler for retrieving all unique tags from document chunks metadata
 * GET: Return a list of all unique tags used across documents
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
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

export default withAdminAuth(handler); 