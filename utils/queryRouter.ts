/**
 * Query Router Module
 * 
 * This module provides functionality to route queries to the appropriate retrieval strategy
 * based on query analysis, metadata, and category information.
 */

import { DocumentCategoryType } from './documentCategories';
import { analyzeQuery, QueryAnalysis, getRetrievalParameters } from './queryAnalysis';
import { 
  performHybridSearch,
  HybridSearchResult,
  SearchResult
} from './hybridSearch';
import { rerank } from './reranking';
import { expandQuery } from './queryExpansion';
import { logError } from './errorHandling';

// Interface for search options
export interface RouterSearchOptions {
  limit?: number;
  useQueryExpansion?: boolean;
  useReranking?: boolean;
  rerankCount?: number;
  applyMetadataFiltering?: boolean;
  fallbackToGeneral?: boolean;
  debug?: boolean;
}

// Default search options
const DEFAULT_SEARCH_OPTIONS: RouterSearchOptions = {
  limit: 10,
  useQueryExpansion: true,
  useReranking: true,
  rerankCount: 5,
  applyMetadataFiltering: true,
  fallbackToGeneral: true,
  debug: false
};

// Add a type alias for compatibility
type SearchResults = SearchResult[] | HybridSearchResult[];

/**
 * Routes a query through the intelligent retrieval pipeline
 * 
 * This function:
 * 1. Analyzes the query to determine categories, type, etc.
 * 2. Derives optimal retrieval parameters
 * 3. Optionally expands the query
 * 4. Performs a hybrid search with metadata filtering
 * 5. Optionally re-ranks the results
 * 
 * @param query The user query
 * @param options Search options
 * @returns The search results
 */
export async function routeQuery(
  query: string,
  options: RouterSearchOptions = {}
): Promise<{
  results: SearchResults;
  queryAnalysis: QueryAnalysis;
  processingTime: {
    analysis: number;
    expansion?: number;
    search: number;
    reranking?: number;
    total: number;
  };
}> {
  // Merge options with defaults
  const searchOptions = { ...DEFAULT_SEARCH_OPTIONS, ...options };
  const startTime = Date.now();
  let currentTime = startTime;
  
  try {
    // Step 1: Analyze query
    const analysisStartTime = currentTime;
    const queryAnalysis = await analyzeQuery(query);
    const analysisTime = Date.now() - analysisStartTime;
    currentTime = Date.now();
    
    if (searchOptions.debug) {
      console.log(`Query analysis completed in ${analysisTime}ms`);
      console.log('Primary category:', queryAnalysis.primaryCategory);
      console.log('Query type:', queryAnalysis.queryType);
      console.log('Technical level:', queryAnalysis.technicalLevel);
    }
    
    // Step 2: Get retrieval parameters based on analysis
    const retrievalParams = getRetrievalParameters(queryAnalysis);
    
    // Step 3: Optionally expand the query
    let expandedQuery = query;
    let expansionTime = 0;
    
    if (searchOptions.useQueryExpansion && retrievalParams.expandQuery) {
      const expansionStartTime = currentTime;
      const expansion = await expandQuery(query, {
        useSemanticExpansion: true,
        maxExpandedTerms: 3,
        enableCaching: true
      });
      expandedQuery = expansion.expandedQuery;
      expansionTime = Date.now() - expansionStartTime;
      currentTime = Date.now();
      
      if (searchOptions.debug) {
        console.log(`Query expansion completed in ${expansionTime}ms`);
        console.log('Expanded query:', expandedQuery);
        console.log('Added terms:', expansion.addedTerms);
      }
    }
    
    // Step 4: Perform search with parameters derived from analysis
    const searchStartTime = currentTime;
    
    // Create a filter object that is compatible with hybrid search
    const searchFilter = searchOptions.applyMetadataFiltering ? {
      // More lenient approach - only filter if we're very confident
      categories: retrievalParams.categoryFilter?.strict ? 
        retrievalParams.categoryFilter?.categories || [] : 
        [], // No category filtering unless strict mode
      strictCategoryMatch: false, // Always use lenient category matching
      // Widen the technical level range by 1 in each direction to be more inclusive
      technicalLevelMin: Math.max(1, (retrievalParams.technicalLevelRange?.min || 1) - 1),
      technicalLevelMax: Math.min(5, (retrievalParams.technicalLevelRange?.max || 5) + 1)
    } : undefined;
    
    const searchResults = await performHybridSearch(
      expandedQuery,
      searchOptions.limit || 10,
      retrievalParams.hybridRatio,
      searchFilter
    );
    
    const searchTime = Date.now() - searchStartTime;
    currentTime = Date.now();
    
    if (searchOptions.debug) {
      console.log(`Hybrid search completed in ${searchTime}ms`);
      console.log(`Found ${searchResults.length} results`);
    }
    
    // Step 5: Optionally re-rank results
    let finalResults = searchResults;
    let rerankingTime = 0;
    
    if (searchOptions.useReranking && retrievalParams.rerank && searchResults.length > 0) {
      const rerankingStartTime = currentTime;
      
      // The rerank function now handles conversion internally
      finalResults = await rerank(
        query,
        searchResults, // Use original search results - conversion handled in rerank
        searchOptions.rerankCount || 5
      );
      
      rerankingTime = Date.now() - rerankingStartTime;
      
      if (searchOptions.debug) {
        console.log(`Reranking completed in ${rerankingTime}ms`);
      }
    }
    
    // Calculate total processing time
    const totalTime = Date.now() - startTime;
    
    return {
      results: finalResults,
      queryAnalysis,
      processingTime: {
        analysis: analysisTime,
        expansion: expansionTime > 0 ? expansionTime : undefined,
        search: searchTime,
        reranking: rerankingTime > 0 ? rerankingTime : undefined,
        total: totalTime
      }
    };
  } catch (error) {
    logError('Error in query routing', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Converts search results to a format suitable for the response
 */
export function formatResults(results: HybridSearchResult[]): Array<{
  text: string;
  source: string;
  metadata: Record<string, any>;
  relevanceScore: number;
}> {
  return results.map(result => ({
    text: result.item.text,
    source: result.item.metadata?.source || 'Unknown',
    metadata: {
      ...result.item.metadata,
      category: result.item.metadata?.category || 'Unknown',
      technicalLevel: result.item.metadata?.technicalLevel || 1
    },
    relevanceScore: result.score
  }));
}

/**
 * Generate a brief explanation of search strategy based on query analysis
 */
export function explainSearchStrategy(queryAnalysis: QueryAnalysis): string {
  const retrievalParams = getRetrievalParameters(queryAnalysis);
  
  let explanation = `This query was identified as primarily about ${queryAnalysis.primaryCategory} `;
  explanation += `with a technical level of ${queryAnalysis.technicalLevel}/10. `;
  
  if (retrievalParams.hybridRatio > 0.7) {
    explanation += 'Keyword matching was emphasized for better precision. ';
  } else if (retrievalParams.hybridRatio < 0.3) {
    explanation += 'Semantic similarity was emphasized for better recall. ';
  } else {
    explanation += 'A balanced approach between keywords and semantic similarity was used. ';
  }
  
  if (retrievalParams.categoryFilter?.strict) {
    explanation += `Results were strictly filtered to the ${retrievalParams.categoryFilter.categories.join(', ')} category. `;
  } else if (retrievalParams.categoryFilter?.categories?.length) {
    explanation += `Results were boosted from the ${retrievalParams.categoryFilter.categories.join(', ')} category. `;
  }
  
  if (retrievalParams.technicalLevelRange) {
    explanation += `Content was filtered to match technical level ${retrievalParams.technicalLevelRange.min}-${retrievalParams.technicalLevelRange.max}. `;
  }
  
  if (retrievalParams.rerank) {
    explanation += 'Results were re-ranked using semantic relevance to improve ordering. ';
  }
  
  return explanation;
} 