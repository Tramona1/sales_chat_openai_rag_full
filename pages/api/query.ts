import { NextApiRequest, NextApiResponse } from 'next';
import { performHybridSearch } from '../../utils/hybridSearch';
import { rerank } from '../../utils/reranking';
import { expandQuery } from '../../utils/queryExpansion';
import { analyzeQuery, getRetrievalParameters } from '../../utils/queryAnalysis';
import { logError, standardizeApiErrorResponse } from '../../utils/errorHandling';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Only POST requests are accepted' 
    });
  }

  try {
    const { query, options } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'Query parameter is required and must be a string' 
      });
    }
    
    const clientOptions = options || {};
    
    // Step 1: Analyze the query to determine optimal retrieval strategy
    const queryAnalysis = await analyzeQuery(query);
    
    // Step 2: Get optimized retrieval parameters based on analysis
    const retrievalParams = getRetrievalParameters(queryAnalysis);
    
    // Step 3: Prepare the final search options by merging client options and
    // retrieval parameters (client options take precedence)
    const searchOptions = {
      ...retrievalParams,
      ...clientOptions,
      // Metadata filtering
      filter: {
        ...clientOptions.filter,
        // Apply category filter if not overridden by client
        ...(clientOptions.filter?.categories ? {} : {
          categories: retrievalParams.categoryFilter.categories,
          strictCategoryMatch: retrievalParams.categoryFilter.strict
        }),
        // Apply technical level range if not overridden by client
        ...(clientOptions.filter?.technicalLevel ? {} : {
          technicalLevelMin: retrievalParams.technicalLevelRange.min,
          technicalLevelMax: retrievalParams.technicalLevelRange.max
        })
      }
    };
    
    console.log('[Query Routing] Analysis:', {
      query,
      primaryCategory: queryAnalysis.primaryCategory,
      queryType: queryAnalysis.queryType, 
      entities: queryAnalysis.entities.map(e => e.name),
      hybridRatio: searchOptions.hybridRatio
    });
    
    // Step 4: Expand query if needed
    let processedQuery = query;
    try {
      const expandedResult = await expandQuery(query);
      processedQuery = expandedResult.expandedQuery;
    } catch (err) {
      console.error('Error expanding query, using original:', err);
    }
    
    // Step 5: Perform hybrid search with optimal parameters
    const searchResults = await performHybridSearch(
      processedQuery, 
      searchOptions.limit || 10,
      searchOptions.hybridRatio || 0.5,
      searchOptions.filter
    );
    
    // Step 6: Apply re-ranking if enabled
    let finalResults = searchResults;
    if (searchOptions.rerank) {
      const rerankCount = searchOptions.rerankCount || 20;
      const enhancedResults = searchResults.map(result => ({
        ...result,
        // Add required metadata field for HybridSearchResult
        metadata: {
          matchesCategory: true,
          categoryBoost: 0,
          technicalLevelMatch: 1
        }
      }));
      finalResults = await rerank(query, enhancedResults, rerankCount);
    }
    
    // Add metadata about the query processing
    const response = {
      results: finalResults,
      metadata: {
        originalQuery: query,
        processedQuery: processedQuery !== query ? processedQuery : undefined,
        strategy: {
          primaryCategory: queryAnalysis.primaryCategory,
          queryType: queryAnalysis.queryType,
          entityCount: queryAnalysis.entities.length,
          hybridRatio: searchOptions.hybridRatio,
          usedQueryExpansion: searchOptions.expandQuery,
          usedReranking: searchOptions.rerank
        },
        timing: {
          total: 0 // Will be calculated by the client
        }
      }
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    logError('Error processing query', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 