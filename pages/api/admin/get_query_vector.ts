// pages/api/admin/get_query_vector.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { embedText } from '../../../utils/embeddingClient';
import { getSupabaseAdmin } from '../../../utils/supabaseClient';
import { logError, logInfo } from '../../../utils/logger';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';

/**
 * API endpoint to generate vector embeddings for query text
 * Used for debugging and analysis in the admin dashboard
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    // Get query text from request body
    const { queryText } = req.body;

    if (!queryText || typeof queryText !== 'string') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Query text is required and must be a string'
      });
    }

    if (queryText.length > 10000) {
      return res.status(400).json({
        error: 'Text too long',
        message: 'Query text must be less than 10,000 characters'
      });
    }

    logInfo(`[API] Generating query vector for text (${queryText.length} chars)`);

    // Generate embedding vector using the RETRIEVAL_QUERY task type
    const vector = await embedText(queryText, 'RETRIEVAL_QUERY');
    
    // Log embedding dimensions for monitoring
    logInfo(`[API] Generated query vector with ${vector.length} dimensions`);
    
    // Track API usage in database
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('api_call_logs').insert({
          service: 'gemini',
          api_function: 'embedding',
          status: 'success',
          metadata: { 
            purpose: 'admin_query_vector_generation', 
            text_length: queryText.length 
          }
        });
      }
    } catch (logErr) {
      // Don't fail the request if logging fails
      console.error('Failed to log API call:', logErr);
    }

    // Return the vector
    return res.status(200).json({
      vector,
      dimension: vector.length,
      queryLength: queryText.length
    });

  } catch (error) {
    logError('[API] Error generating query vector:', error);
    
    // Track error in database
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('api_call_logs').insert({
          service: 'gemini',
          api_function: 'embedding',
          status: 'error',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    } catch (logErr) {
      // Don't fail the request if logging fails
      console.error('Failed to log API error:', logErr);
    }
    
    return res.status(500).json(standardizeApiErrorResponse(error));
  }
} 