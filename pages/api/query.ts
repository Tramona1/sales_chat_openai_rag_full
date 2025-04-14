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
import { DocumentCategoryType } from '../../utils/documentCategories';
import { analyzeVisualQuery } from '../../utils/queryAnalysis';
import { MultiModalSearchResult, RankedSearchResult, MultiModalRerankOptions } from '../../utils/reranking';
import { HybridSearchFilter } from '../../utils/hybridSearch';
import { QueryEntity } from '../../utils/queryAnalysis';

// TEMPORARY FIX: Hardcode feature flags
const FEATURE_FLAGS = {
  contextualReranking: true,
  contextualEmbeddings: true,
  multiModalSearch: true,
  enhancedAnswerGeneration: true
};

// Define a type for the modules we'll import dynamically
interface DynamicModules {
  hybridSearch: any;
  fallbackSearch: any;
  rerankWithGemini: any;
  analyzeQuery: any;
  generateAnswer: any;
  performMultiModalSearch?: any;
  performFtsSearch?: any;
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
    const { rerankWithGemini } = await import('../../utils/reranking');
    const { analyzeQuery } = await import('../../utils/queryAnalysis');
    const { generateAnswer } = await import('../../utils/answerGeneration');

    // Import Supabase-specific modules if available
    let supabaseModules: Partial<DynamicModules> = {};
    if (isSupabaseConnected) {
      try {
        const { performMultiModalSearch } = await import('../../utils/multiModalProcessing');
        const { performFtsSearch } = await import('../../utils/ftsSearch');

        supabaseModules = {
          performMultiModalSearch,
          performFtsSearch
        };
      } catch (importError) {
        logError('Error importing Supabase-specific modules:', importError);
      }
    }

    return {
      hybridSearch,
      fallbackSearch,
      rerankWithGemini,
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
    const retrievalParams = getRetrievalParameters(queryAnalysis);

    // --- FIX: Construct the search filter manually ---
    const searchFilter: HybridSearchFilter = queryAnalysis.applyMetadataFiltering ? {
        primaryCategory: queryAnalysis.primaryCategory as DocumentCategoryType,
        secondaryCategories: queryAnalysis.secondaryCategories as DocumentCategoryType[],
        technicalLevelMin: Math.max(1, (retrievalParams.technicalLevelRange?.min || 1) - 1),
        technicalLevelMax: Math.min(10, (retrievalParams.technicalLevelRange?.max || 3) + 1),
        // Use entities directly from queryAnalysis, mapping to names with explicit types and filtering undefined
        requiredEntities: queryAnalysis.entities?.map((entity: QueryEntity) => entity.name).filter((name: string | undefined) => !!name) as string[]
    } : {};

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

    let searchResultsResponse: any;
    let searchError = null;

    logInfo(`Performing ${searchMode} search for query: "${query}"`);

    // Choose search strategy based on inputs and feature flags
    try {
      if (useMultiModal) {
        // Use multi-modal search if visual content is requested
        if (!modules.performMultiModalSearch) {
          throw new Error('Multi-modal search requested but not available');
        }

        searchResultsResponse = await modules.performMultiModalSearch(query, {
          limit: Math.max(limit * 3, 15), // Retrieve more than needed for reranking
          includeVisualContent,
          visualTypes: visualTypes as any[]
        });
      } else if (searchMode === 'hybrid' || searchMode === 'vector') {
        // Use hybrid search for both hybrid and vector modes
        // For 'vector' mode, we can set vectorWeight to 1.0 to make it pure vector search
        const vectorWeight = searchMode === 'vector' ? 1.0 : 0.3;
        const keywordWeight = searchMode === 'vector' ? 0.0 : 0.7;
        const matchThreshold = 0.2;

        searchResultsResponse = await modules.hybridSearch(query, {
          limit: Math.max(limit * 3, 15),
          vectorWeight,
          keywordWeight,
          matchThreshold,
          // Pass the constructed filter object
          filter: Object.keys(searchFilter).length > 0 ? searchFilter : undefined
        });
      } else if (searchMode === 'fts' || searchMode === 'keyword') {
        // Use FTS search if specified (renamed from bm25 to fts)
        if (!modules.performFtsSearch) {
          throw new Error('FTS search requested but not available');
        }

        searchResultsResponse = await modules.performFtsSearch(query, {
          limit: Math.max(limit * 3, 15)
        });
      } else {
        // Default to hybrid search (with consistent parameters)
        searchResultsResponse = await modules.hybridSearch(query, {
          limit: Math.max(limit * 3, 15),
          vectorWeight: 0.3, // Emphasis on keywords for consistent retrieval
          keywordWeight: 0.7, // Emphasis on keywords for consistent retrieval
          matchThreshold: 0.2, // Lower threshold for better recall
          // Pass the constructed filter object
          filter: Object.keys(searchFilter).length > 0 ? searchFilter : undefined
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
        const fallbackResultsArray = await modules.fallbackSearch(query);
        searchResultsResponse = { results: fallbackResultsArray || [] };
      } catch (fallbackError) {
        logError('Fallback search also failed:', fallbackError);
        searchResultsResponse = { results: [] }; // Ensure it's an object with empty results
      }
    }

    const retrievalDuration = Date.now() - retrievalStartTime;

    // Extract the actual results array from the response object
    const actualSearchResults = searchResultsResponse?.results || [];

    // *** NEW LOGGING POINT 3 ***
    logInfo(`[QueryAPI] routeQuery returned. Results array length: ${actualSearchResults?.length ?? 'undefined/null'}`);
    // Log first result ID if exists (using actualSearchResults)
    if (actualSearchResults && actualSearchResults.length > 0) {
      // Ensure we access the ID correctly based on its structure
      logInfo(`[QueryAPI] routeQuery first result ID: ${actualSearchResults[0]?.id}`);
    } else {
      logInfo(`[QueryAPI] routeQuery returned no results or results array is empty/null.`);
    }
    // --- End Logging Point 3 ---


    // --- ADDED CHECK: Handle empty results BEFORE logging/mapping ---
    if (!actualSearchResults || actualSearchResults.length === 0) {
      logWarning('[QueryAPI] No results found from hybridSearch/fallback, returning 404.');
      recordMetric('api', 'query', Date.now() - startTime, false, {
        error: searchError ? searchError.message : 'No results found',
        retrievalDuration
      });
      return res.status(404).json({
        error: 'No results found for query',
        query,
        timings: { retrievalMs: retrievalDuration }
      });
    } // --- END ADDED CHECK ---

    // --- DEBUG LOGGING (Now safe because array is not empty) ---
    logDebug('[QueryAPI] Before map - actualSearchResults type:', typeof actualSearchResults);
    logDebug('[QueryAPI] Before map - actualSearchResults isArray:', Array.isArray(actualSearchResults));
    logDebug('[QueryAPI] Before map - actualSearchResults length:', actualSearchResults?.length);
    try {
      // Log only IDs and scores for brevity and safety
      logDebug('[QueryAPI] Before map - actualSearchResults content (IDs/Scores):',
        JSON.stringify(actualSearchResults.map((r: any) => ({ id: r?.id, score: r?.score })))
      );
    } catch (e) {
      logError('[QueryAPI] Failed to stringify actualSearchResults summary');
    }
    // --- END DEBUG LOGGING ---

    // Rerank results
    const rerankStartTime = Date.now();
    let rerankedResults: RankedSearchResult[];

    // Prepare results for reranker input - Mapping is now safe
    const resultsForReranker: MultiModalSearchResult[] = actualSearchResults
      .map((result: any, index: number) => ({
        item: {
          // Add null checks for robustness, though the array should be valid now
          id: result?.id || `initial-result-${index}`,
          text: result?.text || result?.originalText || '',
          metadata: result?.metadata || {},
          visualContent: result?.visualContent || result?.metadata?.visualContent
        },
        score: result?.score || 0
      }));

    if (contextualRetrievalEnabled && resultsForReranker.length > 0) {
      logInfo(`Reranking ${resultsForReranker.length} results for query: "${query}"`);

      // Analyze query for visual focus
      const visualAnalysis = analyzeVisualQuery(query);

      // Prepare reranking options
      const rerankOptions: MultiModalRerankOptions = {
        limit: limit,
        includeScores: true,
        useVisualContext: true,
        visualFocus: visualAnalysis.isVisualQuery,
        visualTypes: visualAnalysis.visualTypes,
        timeoutMs: 5000
      };

      // Call the new reranker function
      rerankedResults = await modules.rerankWithGemini(
        query,
        resultsForReranker,
        rerankOptions
      );

    } else {
      logInfo(`Skipping reranking for query: "${query}"`);
      rerankedResults = resultsForReranker
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit)
        .map(r => ({
            ...r,
            originalScore: r.score,
            explanation: 'Reranking skipped',
            item: {
              ...r.item,
              metadata: {
                ...r.item.metadata,
                rerankScore: r.score,
                originalScore: r.score
              }
            }
        }));
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
      // let visualContent = null;
      // if (includeVisualContent &&
      //     item.visualContent &&
      //     Array.isArray(item.visualContent)) {
      //   visualContent = item.visualContent.map((vc: any) => ({
      //     type: vc.type || 'unknown',
      //     description: vc.description || '',
      //     text: vc.extractedText || ''
      //   }));
      // }

      // Format the chunk for the answer generation with safe fallbacks
      return {
        text: item.text || item.content || 'No content available',
        source: (item.metadata && item.metadata.source) || item.source || 'Unknown',
        score: result.score || 0,
        metadata: item.metadata || {},
      };
    });

    // *** NEW DETAILED CONTEXT LOGGING ***
    logInfo(`[QueryAPI] Context being passed to generateAnswer (${searchContext.length} items):`);
    searchContext.forEach((item, index) => {
      logInfo(`[QueryAPI] Context Item ${index + 1}: Source: ${item.source}, Score: ${item.score?.toFixed(4)}, Text Preview: "${item.text.substring(0, 200)}..."`);
      // Uncomment for full text if needed, but can be very verbose:
      // logDebug(`[QueryAPI] Context Item ${index + 1} Full Text:`, item.text);
    });
    // *** END DETAILED CONTEXT LOGGING ***

    // Get system prompt for this query
    const systemPrompt = modelConfig.getSystemPromptForQuery(query);

    // Generate the answer
    const answer = await modules.generateAnswer(
      query,
      searchContext,
      {
        systemPrompt,
        includeSourceCitations, // Assuming this is the correct prop name
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
      answer, // Assign the string directly
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