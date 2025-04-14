import type { NextApiRequest, NextApiResponse } from 'next';
import { getEmbeddingClient, embedText } from '../../../utils/embeddingClient';
import { getSupabaseAdmin } from '../../../utils/supabaseClient';
import { logError, logInfo } from '../../../utils/logger';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';

/**
 * API endpoint to generate vector embeddings for arbitrary text
 * Used by the admin dashboard for debugging and development
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method not allowed', 
      details: 'Only POST requests are supported' 
    });
  }

  try {
    // Get text from request body
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        message: 'Bad request', 
        details: 'Text is required and must be a string' 
      });
    }

    if (text.length > 10000) {
      return res.status(400).json({ 
        message: 'Text too long', 
        details: 'Text must be less than 10,000 characters' 
      });
    }

    logInfo(`[API] Generating vector for text (${text.length} chars)`);
    
    // Generate embedding vector
    const vector = await embedText(text, 'RETRIEVAL_QUERY');
    
    // Log embedding dimensions for monitoring
    logInfo(`[API] Generated vector with ${vector.length} dimensions`);
    
    // Track API usage in database if possible
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('api_call_logs').insert({
          service: 'gemini',
          api_function: 'embedding',
          status: 'success',
          metadata: { purpose: 'admin_vector_generation', text_length: text.length }
        });
      }
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('Failed to log API call:', logError);
    }

    // Return the vector
    return res.status(200).json({
      vector,
      dimensions: vector.length,
      model: getEmbeddingClient().getProvider(),
      text_length: text.length
    });

  } catch (error) {
    logError('[API] Error generating vector:', error);
    
    // Track error in database if possible
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
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('Failed to log API error:', logError);
    }
    
    return res.status(500).json(standardizeApiErrorResponse(error));
  }
} 