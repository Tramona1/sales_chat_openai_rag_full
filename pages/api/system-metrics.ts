import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getCacheStats } from '../../utils/caching';
import { standardizeApiErrorResponse } from '../../utils/errorHandling';
import { getSupabaseAdmin } from '../../utils/supabaseClient';
import { logInfo, logError, logWarning } from '../../utils/logger';

// --- Placeholder Cost Constants (NEEDS ADJUSTMENT BASED ON ACTUAL PRICING & USAGE) ---
// These are illustrative values per CALL, not per token. Accuracy depends on average call complexity.
const ESTIMATED_COST_PER_GEMINI_CHAT_CALL = 0.0001; // Example: $0.01 per 100 calls
const ESTIMATED_COST_PER_GEMINI_EMBEDDING_CALL = 0.00002; // Example: $0.01 per 500 calls 
const ESTIMATED_COST_PER_GEMINI_ANALYSIS_CALL = 0.00015; // Added Example Cost
const ESTIMATED_COST_PER_GEMINI_ANSWER_CALL = 0.0002;   // Added Example Cost
const ESTIMATED_COST_PER_GEMINI_RERANK_CALL = 0.0001;   // Added Example Cost
// ---------------------------------------------------------------------------------

// --- Helper Function to Query API Call Logs ---
async function getApiCallStatsFromDb(): Promise<any> {
  const supabase = getSupabaseAdmin();
  // Initialize with defaults OUTSIDE the try block
  const apiStats = {
    geminiChatSuccess: 0, geminiChatError: 0,
    geminiEmbeddingSuccess: 0, geminiEmbeddingError: 0,
    geminiQueryAnalysisSuccess: 0, geminiQueryAnalysisError: 0,
    geminiAnswerGenerationSuccess: 0, geminiAnswerGenerationError: 0,
    geminiRerankingSuccess: 0, geminiRerankingError: 0,
  };

  if (!supabase) {
    logWarning('[System Metrics] Supabase client not available. API call stats will be zero.');
    return apiStats; // Return defaults
  }

  try {
    logInfo('[System Metrics] Fetching API call statistics from api_call_logs table...');
    // Fetch individual logs (potentially add a time filter later if needed for performance)
    const { data, error } = await supabase
      .from('api_call_logs')
      .select('api_function, status') // Select only needed columns
      .eq('service', 'gemini'); // Filter for Gemini service
      // Potential future optimization: .gte('timestamp', thirtyDaysAgoISOString)

    if (error) {
      logError('[System Metrics] Error fetching API call stats from DB:', error);
      return apiStats; // Return defaults on error
    }

    // Aggregate counts in JS
    if (data) {
      for (const row of data) {
        const func = row.api_function;
        const status = row.status;

        if (func === 'chat_completion') {
          if (status === 'success') apiStats.geminiChatSuccess++;
          else if (status === 'error') apiStats.geminiChatError++;
        } else if (func === 'embedding') {
          if (status === 'success') apiStats.geminiEmbeddingSuccess++;
          else if (status === 'error') apiStats.geminiEmbeddingError++;
        } else if (func === 'query_analysis') {
          if (status === 'success') apiStats.geminiQueryAnalysisSuccess++;
          else if (status === 'error') apiStats.geminiQueryAnalysisError++;
        } else if (func === 'answer_generation') {
          if (status === 'success') apiStats.geminiAnswerGenerationSuccess++;
          else if (status === 'error') apiStats.geminiAnswerGenerationError++;
        } else if (func === 'rerank') {
          if (status === 'success') apiStats.geminiRerankingSuccess++;
          else if (status === 'error') apiStats.geminiRerankingError++;
        }
      }
    }
    logInfo(`[System Metrics] Aggregated API stats from DB. Chat: ${apiStats.geminiChatSuccess}S/${apiStats.geminiChatError}E. Embedding: ${apiStats.geminiEmbeddingSuccess}S/${apiStats.geminiEmbeddingError}E. Analysis: ${apiStats.geminiQueryAnalysisSuccess}S/${apiStats.geminiQueryAnalysisError}E. AnswerGen: ${apiStats.geminiAnswerGenerationSuccess}S/${apiStats.geminiAnswerGenerationError}E. Rerank: ${apiStats.geminiRerankingSuccess}S/${apiStats.geminiRerankingError}E.`);

  } catch (err) {
    logError('[System Metrics] Unexpected error querying API call stats from DB:', err);
    // Return defaults on unexpected errors
  }

  return apiStats;
}
// --- End Helper Function ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Get vector store statistics from Supabase
    let vectorStoreStats = { 
      totalItems: 0,
      documents: 0,
      chunks: 0
    };
    
    try {
      logInfo('Fetching document statistics from Supabase');
      
      const supabase = getSupabaseAdmin();
      
      // Get document count
      const { count: documentCount, error: docError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
      
      if (docError) {
        throw new Error(`Error counting documents: ${docError.message}`);
      }
      
      // Get chunk count
      const { count: chunkCount, error: chunkError } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true });
      
      if (chunkError) {
        throw new Error(`Error counting document chunks: ${chunkError.message}`);
      }
      
      vectorStoreStats = {
        totalItems: chunkCount || 0,
        documents: documentCount || 0,
        chunks: chunkCount || 0
      };
      
      logInfo(`Retrieved document statistics: ${documentCount} documents, ${chunkCount} chunks`);
    } catch (dbError) {
      logError('Error fetching Supabase document statistics:', dbError);
      // Continue with zeros, don't fail the main endpoint
    }
    
    // Get caching statistics
    const cachingStats = getCacheStats();
    
    // Get feedback data size
    let feedbackStats = { count: 0, lastUpdated: null, sizeBytes: 0 };
    
    // Calculate recent query metrics from feedback data
    let recentQueriesMetrics = {
      last24Hours: 0,
      last7Days: 0, 
      avgResponseTime: 0
    };
    
    let performanceMetrics = {
      averageQueryTime: 0,
      totalQueries: 0
    };
    
    try {
      const supabase = getSupabaseAdmin(); // Ensure client is available
      if (supabase) {
        // Get total feedback count (assuming 'feedback' table is used)
        // TODO: Confirm which feedback table to use ('feedback' or 'user_feedback')
        const { count: feedbackCount, error: feedbackError } = await supabase
          .from('feedback') // ADJUST TABLE NAME if needed
          .select('*', { count: 'exact', head: true });
        if (feedbackError) logError('[System Metrics] Error counting feedback:', feedbackError);
        else feedbackStats.count = feedbackCount || 0;

        // Get query counts and average time from query_logs
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Get total query count and overall average time
        const { data: totalData, error: totalError } = await supabase
            .from('query_logs')
            .select('count:id, avg_time:execution_time_ms', { count: 'exact' }); // Aggregate directly

        if (totalError) {
            logError('[System Metrics] Error fetching total query stats:', totalError);
        } else if (totalData && totalData.length > 0) {
            performanceMetrics.totalQueries = totalData[0].count || 0;
            // Calculate average time from all execution_time_ms values if needed separately
            // For simplicity, we might just rely on the overall avg if the DB provides it easily.
            // Let's query average separately for more control:
            const { data: avgData, error: avgError } = await supabase
              .rpc('get_average_query_time'); // Assuming an RPC exists or query directly

            if (avgError) logError('[System Metrics] Error fetching average query time:', avgError);
            else if (avgData) performanceMetrics.averageQueryTime = avgData || 0; // Adjust based on RPC return

             // For system status display, let's use the average from the DB if available
             // Otherwise, keep it 0
             recentQueriesMetrics.avgResponseTime = performanceMetrics.averageQueryTime / 1000; // Convert ms to s
        }


        // Get 24h count
        const { count: count24h, error: error24h } = await supabase
            .from('query_logs')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneDayAgo);
        if (error24h) logError('[System Metrics] Error counting queries (24h):', error24h);
        else recentQueriesMetrics.last24Hours = count24h || 0;

        // Get 7d count
        const { count: count7d, error: error7d } = await supabase
            .from('query_logs')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', sevenDaysAgo);
        if (error7d) logError('[System Metrics] Error counting queries (7d):', error7d);
        else recentQueriesMetrics.last7Days = count7d || 0;


      } else {
         logWarning('[System Metrics] Supabase client not available for feedback/query stats.');
      }
    } catch (statsError) {
        logError('[System Metrics] Error fetching feedback/query stats from DB:', statsError);
    }
    
    // Get performance metrics from Supabase if available
    // let performanceMetrics = {
    //   averageQueryTime: 0,
    //   totalQueries: 0
    // };
    
    // --- Get API Call Stats from DB ---
    // Initialize apiCallStats BEFORE the try block
    let apiCallStats = {
        geminiChatSuccess: 0, geminiChatError: 0,
        geminiEmbeddingSuccess: 0, geminiEmbeddingError: 0,
        geminiQueryAnalysisSuccess: 0, geminiQueryAnalysisError: 0,
        geminiAnswerGenerationSuccess: 0, geminiAnswerGenerationError: 0,
        geminiRerankingSuccess: 0, geminiRerankingError: 0,
    };
    try {
        apiCallStats = await getApiCallStatsFromDb();
    } catch(dbQueryError) {
        logError('[System Metrics] Failed to get API call stats from DB wrapper:', dbQueryError);
        // apiCallStats remains zeros
    }
    // --- End Get API Call Stats ---

    // Calculate totals
    const totalGeminiChatCalls = apiCallStats.geminiChatSuccess + apiCallStats.geminiChatError;
    const totalGeminiEmbeddingCalls = apiCallStats.geminiEmbeddingSuccess + apiCallStats.geminiEmbeddingError; 
    const totalGeminiQueryAnalysisCalls = apiCallStats.geminiQueryAnalysisSuccess + apiCallStats.geminiQueryAnalysisError;
    const totalGeminiAnswerGenCalls = apiCallStats.geminiAnswerGenerationSuccess + apiCallStats.geminiAnswerGenerationError;
    const totalGeminiRerankingCalls = apiCallStats.geminiRerankingSuccess + apiCallStats.geminiRerankingError;

    // Calculate estimated costs - ADD COSTS FOR NEW TYPES
    const estimatedChatCost = totalGeminiChatCalls * ESTIMATED_COST_PER_GEMINI_CHAT_CALL;
    const estimatedEmbeddingCost = totalGeminiEmbeddingCalls * ESTIMATED_COST_PER_GEMINI_EMBEDDING_CALL;
    const estimatedAnalysisCost = totalGeminiQueryAnalysisCalls * ESTIMATED_COST_PER_GEMINI_ANALYSIS_CALL;
    const estimatedAnswerGenCost = totalGeminiAnswerGenCalls * ESTIMATED_COST_PER_GEMINI_ANSWER_CALL;
    const estimatedRerankCost = totalGeminiRerankingCalls * ESTIMATED_COST_PER_GEMINI_RERANK_CALL;

    const totalEstimatedCost = estimatedChatCost + estimatedEmbeddingCost + estimatedAnalysisCost + estimatedAnswerGenCost + estimatedRerankCost;
    // --- End Cost Calculation ---

    // Combine all stats
    const systemMetrics = {
      vectorStore: vectorStoreStats,
      caching: cachingStats,
      feedback: feedbackStats,
      queries: recentQueriesMetrics,
      performance: performanceMetrics,
      apiCalls: { 
          geminiChatSuccess: apiCallStats.geminiChatSuccess || 0,
          geminiChatError: apiCallStats.geminiChatError || 0,
          totalGeminiChatCalls: totalGeminiChatCalls,
          estimatedChatCost: parseFloat(estimatedChatCost.toFixed(4)),
          geminiEmbeddingSuccess: apiCallStats.geminiEmbeddingSuccess || 0,
          geminiEmbeddingError: apiCallStats.geminiEmbeddingError || 0,
          totalGeminiEmbeddingCalls: totalGeminiEmbeddingCalls,
          estimatedEmbeddingCost: parseFloat(estimatedEmbeddingCost.toFixed(4)),
          geminiQueryAnalysisSuccess: apiCallStats.geminiQueryAnalysisSuccess || 0,
          geminiQueryAnalysisError: apiCallStats.geminiQueryAnalysisError || 0,
          totalGeminiQueryAnalysisCalls: totalGeminiQueryAnalysisCalls,
          estimatedAnalysisCost: parseFloat(estimatedAnalysisCost.toFixed(4)),
          geminiAnswerGenerationSuccess: apiCallStats.geminiAnswerGenerationSuccess || 0,
          geminiAnswerGenerationError: apiCallStats.geminiAnswerGenerationError || 0,
          totalGeminiAnswerGenerationCalls: totalGeminiAnswerGenCalls,
          estimatedAnswerGenCost: parseFloat(estimatedAnswerGenCost.toFixed(4)),
          geminiRerankingSuccess: apiCallStats.geminiRerankingSuccess || 0,
          geminiRerankingError: apiCallStats.geminiRerankingError || 0,
          totalGeminiRerankingCalls: totalGeminiRerankingCalls,
          estimatedRerankCost: parseFloat(estimatedRerankCost.toFixed(4)),
          totalEstimatedCost: parseFloat(totalEstimatedCost.toFixed(4))
      },
      lastUpdated: new Date().toISOString()
    };
    
    logInfo('Successfully retrieved system metrics (using DB for API calls, feedback count, query stats)');
    return res.status(200).json(systemMetrics);
  } catch (error) {
    logError('Error retrieving system metrics:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 