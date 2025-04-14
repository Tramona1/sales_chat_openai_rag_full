import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';
// Remove imports for file-based workflow
// import { 
//   getPendingDocuments, 
//   getPendingDocumentsStats 
// } from '../../../utils/adminWorkflow';
import { getSupabaseAdmin } from '../../../utils/supabaseClient'; // Import Supabase client
import { logError, logInfo } from '../../../utils/logger'; // Import logger

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: { 
        message: 'Method Not Allowed',
        code: 'method_not_allowed'
      } 
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { type } = req.query;

    // --- TODO: Reimplement stats endpoint using Supabase aggregation if needed --- 
    // if (type === 'stats') {
    //   // Return stats about pending documents from Supabase
    //   // const stats = await getPendingDocumentsStatsFromSupabase(); 
    //   // return res.status(200).json(stats);
    //   return res.status(501).json({ error: 'Stats endpoint not implemented for Supabase yet.' });
    // } else {
      // --- Fetch pending documents from Supabase --- 
      logInfo('Fetching pending documents from Supabase');

      let query = supabase
        .from('documents')
        .select('id, title, source, created_at, metadata') // Select necessary fields including metadata
        .eq('approved', false); // Filter for pending documents

      // Basic filtering options (apply directly to Supabase query)
      const { status, category } = req.query;
      
      // Filter by category if specified (assuming metadata->>primaryCategory exists)
      if (category && typeof category === 'string' && category !== 'all') {
        query = query.eq('metadata->>primaryCategory', category);
      }
      // Note: Filtering by status = 'pending' is implicitly handled by .eq('approved', false)

      // Get limit and pagination
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit - 1; // Supabase range is inclusive

      query = query.range(startIndex, endIndex);
      query = query.order('created_at', { ascending: false });

      // Execute query to get documents
      const { data: documentsData, error: documentsError } = await query;

      if (documentsError) {
        logError('Error fetching pending documents from Supabase', documentsError);
        throw documentsError;
      }

      // Get total count for pagination (run a separate count query)
      let countQuery = supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('approved', false);
      
      if (category && typeof category === 'string' && category !== 'all') {
        countQuery = countQuery.eq('metadata->>primaryCategory', category);
      }
      
      const { count, error: countError } = await countQuery;

      if (countError) {
        logError('Error fetching pending document count from Supabase', countError);
        throw countError;
      }
      const totalDocs = count || 0;

      // Format documents slightly for frontend compatibility (if needed)
      // The PendingDocument interface expects url, contentPreview, status 
      // which are not directly in the Supabase 'documents' table as queried.
      // We need to adapt the frontend or this API response.
      // For now, let's adapt the response to somewhat match.
      const formattedDocs = (documentsData || []).map(doc => ({
        id: doc.id,
        title: doc.title || doc.source || 'Untitled', 
        url: doc.metadata?.source_url || '', // Attempt to get URL from metadata
        contentPreview: doc.metadata?.summary?.substring(0, 200) || 'No preview available', // Use summary as preview
        status: 'pending', // Hardcode as pending since we queried approved=false
        createdAt: doc.created_at,
        metadata: doc.metadata || {} // Pass the full metadata object
      }));

      return res.status(200).json({
        documents: formattedDocs,
        total: totalDocs,
        page,
        limit,
        totalPages: Math.ceil(totalDocs / limit)
      });
    // }
  } catch (error) {
    console.error('Error handling pending documents request:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 