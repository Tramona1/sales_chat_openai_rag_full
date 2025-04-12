import type { NextApiRequest, NextApiResponse } from 'next';
import { analyzeQuery, getRetrievalParameters } from '../../utils/queryAnalysis';
import { standardizeApiErrorResponse } from '../../utils/errorHandling';
import { logError, logInfo, logDebug, logWarning } from '../../utils/logger';
import * as modelConfig from '../../utils/modelConfig';
// TEMPORARY FIX: Hardcode feature flags instead of importing
// import { isFeatureEnabled } from '../../utils/featureFlags';
import { recordMetric } from '../../utils/performanceMonitoring';
import { MultiModalVectorStoreItem } from '../../types/vectorStore';
import { testSupabaseConnection } from '../../utils/supabaseClient';

// TEMPORARY FIX: Hardcode feature flags
const FEATURE_FLAGS = {
  contextualReranking: true,
  contextualEmbeddings: true,
  multiModalSearch: true
};

// Define a type for the modules we'll import dynamically
interface DynamicModules {
  hybridSearch: any;
  fallbackSearch: any;
  rerank: any;
  analyzeQuery: any;
  generateAnswer: any;
  performMultiModalSearch?: any;
  performVectorSearch?: any;
  performBM25Search?: any;
  [key: string]: any;
}

// Import at runtime to avoid TypeScript import resolution issues
async function importModules(): Promise<DynamicModules> {
  try {
    // Check if Supabase is configured and connected
    const isSupabaseConnected = await testSupabaseConnection();
    
    if (!isSupabaseConnected) {
      logError('Supabase is not connected, some features may not work correctly');
    }
    
    // Import the modules we need
    const { hybridSearch, fallbackSearch } = await import('../../utils/hybridSearch');
    const { rerank } = await import('../../utils/reranking');
    const { analyzeQuery } = await import('../../utils/queryAnalysis');
    const { generateAnswer } = await import('../../utils/answerGeneration');
    
    // Import Supabase-specific modules if available
    let supabaseModules: Partial<DynamicModules> = {};
    if (isSupabaseConnected) {
      try {
        const { performMultiModalSearch } = await import('../../utils/multiModalProcessing');
        const { performVectorSearch } = await import('../../utils/vectorSearch');
        const { performBM25Search } = await import('../../utils/bm25Search');
        
        supabaseModules = {
          performMultiModalSearch,
          performVectorSearch,
          performBM25Search
        };
      } catch (importError) {
        logError('Error importing Supabase-specific modules:', importError);
      }
    }
    
    return {
      hybridSearch,
      fallbackSearch,
      rerank,
      analyzeQuery,
      generateAnswer,
      ...supabaseModules
    };
  } catch (error) {
    console.error('Error importing modules:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();
  
  // Only allow POST method
  if (req.method !== 'POST') {
    recordMetric('api', 'query', Date.now() - startTime, false, { error: 'Method not allowed' });
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Verify Supabase connection
    const isSupabaseConnected = await testSupabaseConnection();
    if (!isSupabaseConnected) {
      logWarning('Supabase connection failed, falling back to local data if available');
    } else {
      logInfo('Supabase connected successfully');
    }
    
    // Load modules dynamically
    const modules = await importModules();
    
    // Extract query parameters
    const { 
      query, 
      limit = 5, 
      useContextualRetrieval = true,
      includeSourceDocuments = false,
      includeSourceCitations = true,
      conversationHistory = '',
      searchMode = 'hybrid',
      includeVisualContent = false,
      visualTypes = [] 
    } = req.body;
    
    // Validate query
    if (!query || typeof query !== 'string') {
      recordMetric('api', 'query', Date.now() - startTime, false, { error: 'Invalid query' });
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }
    
    // Track query timing
    const retrievalStartTime = Date.now();
    
    // Analyze query and determine the best search strategy
    const queryAnalysis = await modules.analyzeQuery(query);
    
    // Check if contextual retrieval is enabled by feature flags
    // TEMPORARY FIX: Use hardcoded flags instead of isFeatureEnabled
    const contextualRetrievalEnabled = FEATURE_FLAGS.contextualReranking && 
                                       FEATURE_FLAGS.contextualEmbeddings &&
                                       useContextualRetrieval;
    
    // Flag to check if we should use multi-modal search
    // TEMPORARY FIX: Use hardcoded flags instead of isFeatureEnabled
    const useMultiModal = includeVisualContent && 
                          FEATURE_FLAGS.multiModalSearch && 
                          'performMultiModalSearch' in modules;
    
    let searchResults;
    let searchError = null;
    
    logInfo(`Performing ${searchMode} search for query: "${query}"`);
    
    // Choose search strategy based on inputs and feature flags
    try {
      if (useMultiModal) {
        // Use multi-modal search if visual content is requested
        if (!modules.performMultiModalSearch) {
          throw new Error('Multi-modal search requested but not available');
        }
        
        searchResults = await modules.performMultiModalSearch(query, {
          limit: Math.max(limit * 3, 15), // Retrieve more than needed for reranking
          includeVisualContent,
          visualTypes: visualTypes as any[]
        });
      } else if (searchMode === 'hybrid') {
        // Use hybrid search as default
        searchResults = await modules.hybridSearch(query, { 
          limit: Math.max(limit * 3, 15) // Retrieve more than needed for reranking
        });
      } else if (searchMode === 'vector' && modules.performVectorSearch) {
        // Use vector search if specified
        searchResults = await modules.performVectorSearch(query, Math.max(limit * 3, 15));
      } else if (searchMode === 'bm25' && modules.performBM25Search) {
        // Use BM25 search if specified
        searchResults = await modules.performBM25Search(query, Math.max(limit * 3, 15));
      } else {
        // Default to hybrid search
        searchResults = await modules.hybridSearch(query, { 
          limit: Math.max(limit * 3, 15)
        });
      }
    } catch (error) {
      // Log search error
      const errorMessage = error instanceof Error ? error.message : 'Unknown search error';
      logError(`Search error (${searchMode} mode):`, error);
      searchError = error instanceof Error ? error : new Error(errorMessage);
      
      // Try fallback search if primary search fails
      try {
        logInfo('Attempting fallback keyword search');
        searchResults = await modules.fallbackSearch(query);
      } catch (fallbackError) {
        logError('Fallback search also failed:', fallbackError);
        // Continue with empty results - we'll handle this below
      }
    }
    
    const retrievalDuration = Date.now() - retrievalStartTime;
    
    // If no results, return early
    if (!searchResults || (Array.isArray(searchResults) ? searchResults.length === 0 : Object.keys(searchResults).length === 0)) {
      recordMetric('api', 'query', Date.now() - startTime, false, { 
        error: searchError ? searchError.message : 'No results found',
        retrievalDuration 
      });
      return res.status(404).json({ 
        error: 'No results found for query', 
        query, 
        timings: { retrievalMs: retrievalDuration }
      });
    }
    
    // Rerank results if contextual retrieval is enabled
    const rerankStartTime = Date.now();
    let rerankedResults;
    
    if (contextualRetrievalEnabled) {
      // Use contextual information in reranking
      rerankedResults = await modules.rerank(query, Array.isArray(searchResults) ? searchResults : Object.values(searchResults), limit, {
        useContextualInfo: true,
        includeExplanations: false
      });
    } else {
      // Use standard reranking
      rerankedResults = await modules.rerank(query, Array.isArray(searchResults) ? searchResults : Object.values(searchResults), limit);
    }
    
    const rerankDuration = Date.now() - rerankStartTime;
    
    // Generate an answer from the results
    const answerStartTime = Date.now();
    
    // Check if we have valid results before processing
    if (!rerankedResults || !Array.isArray(rerankedResults) || rerankedResults.length === 0) {
      logWarning('No reranked results available, returning empty response');
      return res.status(404).json({ 
        error: 'No results found after reranking', 
        query, 
        timings: { 
          retrievalMs: retrievalDuration,
          rerankingMs: rerankDuration
        }
      });
    }
    
    // Process the search results for answer generation with better error handling
    const searchContext = rerankedResults.map((result: any, index: number) => {
      // Handle potentially malformed results by providing defaults
      if (!result) {
        logWarning(`Result at index ${index} is undefined or null, using default values`);
        return {
          text: 'No content available',
          source: 'Unknown',
          score: 0,
          metadata: {}
        };
      }

      // Extract the item safely
      const item = result.item || result;
      
      if (!item) {
        logWarning(`Item at index ${index} could not be extracted, using default values`);
        return {
          text: 'No content available',
          source: 'Unknown',
          score: result.score || 0,
          metadata: {}
        };
      }

      // Extract visual content if available and requested
      let visualContent = null;
      if (includeVisualContent && 
          item.visualContent && 
          Array.isArray(item.visualContent)) {
        visualContent = item.visualContent.map((vc: any) => ({
          type: vc.type || 'unknown',
          description: vc.description || '',
          text: vc.extractedText || ''
        }));
      }
      
      // Format the chunk for the answer generation with safe fallbacks
      return {
        text: item.text || item.content || 'No content available',
        source: (item.metadata && item.metadata.source) || item.source || 'Unknown',
        score: result.score || 0,
        metadata: item.metadata || {},
        visualContent
      };
    });
    
    // Get system prompt for this query
    const systemPrompt = modelConfig.getSystemPromptForQuery(query);
    
    // Generate the answer
    const answer = await modules.generateAnswer(
      query,
      searchContext,
      {
        systemPrompt,
        includeSourceCitations,
        maxSourcesInAnswer: includeSourceDocuments ? limit : 3,
        conversationHistory: conversationHistory || '',
      }
    );
    
    const answerDuration = Date.now() - answerStartTime;
    const totalDuration = Date.now() - startTime;
    
    // Record success metrics
    recordMetric('api', 'query', totalDuration, true, {
      queryLength: query.length,
      resultCount: rerankedResults.length,
      retrievalDuration,
      rerankDuration,
      answerDuration
    });
    
    // Prepare the response
    const response = {
      answer,
      query,
      timings: {
        totalMs: totalDuration,
        retrievalMs: retrievalDuration,
        rerankingMs: rerankDuration,
        answerGenerationMs: answerDuration
      }
    };
    
    // Add source documents if requested
    if (includeSourceDocuments) {
      // Add source documents to the response
      Object.assign(response, { 
        sourceDocuments: rerankedResults.map((result: any) => {
          const item = result.item || result;
          return {
            text: item.text || item.content || '',
            source: item.metadata?.source || item.source || 'Unknown',
            score: result.score,
            metadata: item.metadata || {}
          };
        })
      });
    }
    
    return res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error processing query';
    
    // Log the error
    logError('Error processing query:', error);
    
    // Record error metrics
    recordMetric('api', 'query', Date.now() - startTime, false, {
      error: errorMessage
    });
    
    // Return a standardized error response
    return res.status(500).json({
      error: 'Error processing your query',
      message: errorMessage
    });
  }
} 