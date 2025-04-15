import { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/utils/supabaseClient';

export default async function handler(req, res) {
  try {
    // Create a Supabase client
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(500).json({ error: 'Failed to initialize Supabase client' });
    }
    
    // Test direct connection to database
    const { data: connectionTest, error: connectionError } = await supabase.rpc('test_connection');
    
    if (connectionError) {
      return res.status(500).json({ 
        error: 'Database connection test failed', 
        details: connectionError.message,
        code: connectionError.code
      });
    }
    
    // Test simple query
    const { data: docsData, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .limit(5);
    
    // Test direct SQL execution with the hybrid_search RPC
    let hybridSearchStatus = 'not_tested';
    let hybridSearchError = null;
    
    try {
      // Create a mock embedding
      const mockEmbedding = Array(768).fill(0.1);
      
      const { data: hybridData, error: hybridError } = await supabase.rpc('hybrid_search', {
        query_text: 'test query',
        query_embedding: mockEmbedding,
        match_count: 5,
        match_threshold: 0.1,
        vector_weight: 0.5,
        keyword_weight: 0.5,
        filter: null
      });
      
      if (hybridError) {
        hybridSearchStatus = 'error';
        hybridSearchError = {
          message: hybridError.message,
          code: hybridError.code,
          details: hybridError.details
        };
      } else {
        hybridSearchStatus = 'success';
      }
    } catch (err) {
      hybridSearchStatus = 'exception';
      hybridSearchError = {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : null
      };
    }
    
    // Return diagnostic information
    return res.status(200).json({
      supabase: {
        connected: true,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        connection_test: connectionTest,
      },
      environment: process.env.NODE_ENV,
      tests: {
        documents_query: {
          success: !docsError,
          count: docsData?.length || 0,
          error: docsError ? docsError.message : null
        },
        hybrid_search: {
          status: hybridSearchStatus,
          error: hybridSearchError
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in debug-supabase API:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
} 