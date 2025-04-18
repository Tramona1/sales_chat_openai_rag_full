/**
 * Query Router Module
 *
 * This module provides functionality to route queries to the appropriate retrieval strategy
 * based on query analysis, metadata, and category information.
 * It includes robust error handling and fallback logic to ensure results are returned even when
 * metadata filters may be too restrictive.
 */

import { DocumentCategoryType } from './documentCategories';
import { analyzeQuery, getRetrievalParameters, analyzeVisualQuery, LocalQueryAnalysis } from './queryAnalysis';
// NOTE: QueryAnalysis is imported from '../types/queryAnalysis' but LocalQueryAnalysis is defined locally
//       Ensure you are using the correct type throughout or reconcile the definitions.
// import { QueryAnalysis } from '../types/queryAnalysis'; // REMOVED - Using LocalQueryAnalysis instead
// import { DocumentCategory } from '../types/metadata'; // Make sure this is exported from the types file - Removed as DocumentCategoryType is used
import {
  // performHybridSearch, // Using `hybridSearch` from `hybridSearch.ts` instead based on previous files
  hybridSearch, // Assuming this is the correct import based on `hybridSearch.ts`
  HybridSearchOptions,
  HybridSearchResponse,
  HybridSearchFilter
} from './hybridSearch'; // Make sure path is correct
// Import VectorStoreItem directly from its source
import { VectorStoreItem } from './vectorStore'; 
import {
  rerankWithGemini, // Assuming this is the correct import for the reranker function
  MultiModalRerankOptions,
  MultiModalSearchResult,
  RankedSearchResult
} from './reranking'; // Make sure path is correct
import { expandQuery } from './queryExpansion'; // Make sure path is correct
import { logError, logInfo, logWarning, logDebug, logApiCall } from './logger'; // Make sure path is correct
import { Entity } from '../types/queryAnalysis';
import { getSupabaseAdmin } from './supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// Interface for search options
export interface RouterSearchOptions {
  limit?: number;
  useQueryExpansion?: boolean;
  useReranking?: boolean;
  rerankCount?: number; // How many results to return *after* reranking
  searchLimit?: number; // How many results to fetch *before* reranking
  applyMetadataFiltering?: boolean;
  fallbackToGeneral?: boolean;
  debug?: boolean;
}

// Default search options
const DEFAULT_SEARCH_OPTIONS: RouterSearchOptions = {
  limit: 5, // Default limit for final results (used for rerankCount if not specified)
  useQueryExpansion: true,
  useReranking: true,
  rerankCount: 5, // Keep top 5 after reranking by default
  searchLimit: 15, // Fetch more initially for reranking
  applyMetadataFiltering: true,
  fallbackToGeneral: true,
  debug: false
};

// Add a type alias for compatibility - Adjust based on what routeQuery actually returns
// Using RankedSearchResult as the most likely final type after reranking
type FinalSearchResults = RankedSearchResult[];

// Add these interfaces for tracing
interface SearchTrace {
  id: string;
  query: string;
  timestamp: string;
  queryAnalysis: {
    primaryCategory: string;
    secondaryCategories: string[];
    technicalLevel: number;
    intent: string;
    entities: any[];
  };
  searchDecisions: {
    initialFilter: any;
    appliedFilter: any;
    filterRelaxed: boolean;
    relaxationReason?: string;
    categoryBalancing?: {
      before: { sales: number; nonSales: number };
      after: { sales: number; nonSales: number };
    };
  };
  resultStats: {
    initialResultCount: number;
    finalResultCount: number;
    categoriesInResults: Record<string, number>;
    salesContentRatio: number;
  };
  timings: {
    analysis: number;
    search: number;
    reranking?: number;
    total: number;
  };
}

/**
 * Routes a query through the intelligent retrieval pipeline
 *
 * This function:
 * 1. Analyzes the query to determine categories, type, etc.
 * 2. Derives optimal retrieval parameters
 * 3. Optionally expands the query
 * 4. Performs a hybrid search with metadata filtering
 * 5. Optionally re-ranks the results with multi-modal aware reranking
 *
 * The function includes comprehensive error handling and fallback mechanisms:
 * - If initial search with category/metadata filters returns 0 results, it automatically 
 *   retries without filters to ensure users always get relevant results
 * - Detailed logging is included at each step for diagnostic purposes
 * - Errors are caught, logged, and thrown to allow proper handling by the caller
 *
 * @param query The user query
 * @param options Search options including filtering, expansion, and reranking preferences
 * @returns An object containing: 
 *   - results: The final search results (potentially reranked)
 *   - queryAnalysis: Analysis of the query's intent, categories, and technical level
 *   - processingTime: Timing breakdowns for each step of the pipeline
 * @throws Error if any critical step in the pipeline fails
 */
export async function routeQuery(
  query: string,
  options: RouterSearchOptions = {}
): Promise<{
  results: FinalSearchResults; // Adjusted return type
  queryAnalysis: LocalQueryAnalysis; // Using LocalQueryAnalysis
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

  // Ensure rerankCount is set if useReranking is true
  if (searchOptions.useReranking && !searchOptions.rerankCount) {
    searchOptions.rerankCount = searchOptions.limit || DEFAULT_SEARCH_OPTIONS.limit;
  }
  // Ensure searchLimit is at least rerankCount
  if (searchOptions.useReranking && searchOptions.searchLimit && searchOptions.rerankCount && searchOptions.searchLimit < searchOptions.rerankCount) {
    logInfo(`[RouteQuery] Adjusting searchLimit (${searchOptions.searchLimit}) to match rerankCount (${searchOptions.rerankCount})`);
    searchOptions.searchLimit = searchOptions.rerankCount;
  }


  try {
    // Step 1: Analyze query
    const analysisStartTime = currentTime;
    const queryAnalysis = await analyzeQuery(query);
    logInfo(`[RouteQuery] Query Analysis Result for query "${query}":`, JSON.stringify(queryAnalysis, null, 2));
    const analysisTime = Date.now() - analysisStartTime;
    currentTime = Date.now();

    if (searchOptions.debug) {
      console.log(`[RouteQuery] Query analysis completed in ${analysisTime}ms`);
      console.log('[RouteQuery] Primary category:', queryAnalysis.primaryCategory);
      // console.log('[RouteQuery] Query type:', queryAnalysis.queryType); // May not exist on LocalQueryAnalysis
      console.log('[RouteQuery] Technical level:', queryAnalysis.technicalLevel);
      console.log('[RouteQuery] Intent:', queryAnalysis.intent);
      console.log('[RouteQuery] Original query (from analysis):', queryAnalysis.originalQuery); // Accessing originalQuery
    }

    // Step 2: Get retrieval parameters based on analysis
    // Cast queryAnalysis to 'any' temporarily if LocalQueryAnalysis mismatches expected type - NO LONGER NEEDED?
    const retrievalParams = getRetrievalParameters(queryAnalysis);

    // Step 3: Optionally expand the query
    let expandedQuery = query; // Use original query by default for search call
    let queryForReranking = query; // Keep original query for reranker context
    let expansionTime = 0;

    if (searchOptions.useQueryExpansion && retrievalParams.expandQuery) {
      const expansionStartTime = currentTime;
      const expansion = await expandQuery(query, {
        useSemanticExpansion: true,
        maxExpandedTerms: 3,
        enableCaching: true
      });
      // Use expanded query ONLY for the hybrid search call
      expandedQuery = expansion.expandedQuery;
      expansionTime = Date.now() - expansionStartTime;
      currentTime = Date.now();

      if (searchOptions.debug) {
        console.log(`[RouteQuery] Query expansion completed in ${expansionTime}ms`);
        console.log('[RouteQuery] Expanded query for search:', expandedQuery);
        console.log('[RouteQuery] Added terms:', expansion.addedTerms);
        console.log('[RouteQuery] Original query for reranking:', queryForReranking);
      }
    }

    // Step 4: Perform search with parameters derived from analysis
    const searchStartTime = currentTime;

    // Create a filter object for search based on retrievalParams
    const searchFilter: HybridSearchFilter = searchOptions.applyMetadataFiltering ? {
        // Map categories correctly if needed
        primaryCategory: queryAnalysis.primaryCategory as DocumentCategoryType,
        secondaryCategories: queryAnalysis.secondaryCategories as DocumentCategoryType[],

        // Add URL path segments if entities map to known URL paths
        // This helps direct queries to specific site sections
        urlPathSegments: extractUrlPathsFromEntities(queryAnalysis.entities),
        
        // Widen the technical level range by 1 in each direction to be more inclusive
        technicalLevelMin: Math.max(1, (retrievalParams.technicalLevelRange?.min || 1) - 1),
        technicalLevelMax: Math.min(5, (retrievalParams.technicalLevelRange?.max || 5) + 1), // Assuming 1-5 scale now
        
        // Add entities if they exist in the analysis
        requiredEntities: queryAnalysis.entities?.map(e => e.name).filter(name => !!name) as string[] | undefined,
    } : {};

    // NEW: Log original filter for tracing
    const originalFilter = { ...searchFilter };
    
    // NEW: Check for sales-focused categories and ensure balance
    const isSalesFocused = isSalesFocusedCategory(queryAnalysis.primaryCategory) || 
      (queryAnalysis.secondaryCategories && queryAnalysis.secondaryCategories
        .some(c => isSalesFocusedCategory(c as string)));
    
    // Add detailed logging about filter application
    logInfo(`[RouteQuery] Initial filter created:`, JSON.stringify(searchFilter, null, 2));
    logInfo(`[RouteQuery] Query has sales focus: ${isSalesFocused}`);
    
    // Ensure we don't over-prioritize sales content for non-sales queries
    if (!isSalesFocused && searchFilter.primaryCategory && 
        isSalesFocusedCategory(searchFilter.primaryCategory)) {
      logInfo(`[RouteQuery] Balancing: Changing primary category from sales-focused ${searchFilter.primaryCategory} to more general category`);
      
      // If primary is sales-focused but query isn't, use a secondary category instead
      if (searchFilter.secondaryCategories && searchFilter.secondaryCategories.length > 0) {
        // Find first non-sales secondary category
        const nonSalesSecondary = searchFilter.secondaryCategories.find(c => !isSalesFocusedCategory(c));
        if (nonSalesSecondary) {
          searchFilter.primaryCategory = nonSalesSecondary;
          logInfo(`[RouteQuery] Changed primary category to non-sales category: ${nonSalesSecondary}`);
        }
      }
    }

    logInfo(`[RouteQuery] Constructed Search Filter:`, JSON.stringify(searchFilter, null, 2));

    // Prepare options for hybridSearch
    const hybridSearchOptions: HybridSearchOptions = {
        limit: searchOptions.searchLimit, // Use searchLimit before reranking
        vectorWeight: 0.3, // <<< Emphasize keywords more
        keywordWeight: 0.7, // <<< Implicitly emphasize keywords more
        matchThreshold: 0.1, // Keep the lower threshold
        filter: Object.keys(searchFilter).length > 0 ? searchFilter : undefined, // Only pass filter if not empty
        // includeFacets: false // Default
    };

    // Add detailed logging right before the hybridSearch call
    logInfo(`[RouteQuery] FINAL options passed to hybridSearch:`, JSON.stringify(hybridSearchOptions, null, 2));
    logInfo(`[RouteQuery] hybridRatio from retrievalParams: ${retrievalParams.hybridRatio || 'undefined'}`);
    logInfo(`[RouteQuery] expandQuery from retrievalParams: ${retrievalParams.expandQuery || 'undefined'}`);
    
    // Call hybridSearch
    const searchResponse: HybridSearchResponse = await hybridSearch(
      expandedQuery,
      hybridSearchOptions
    );
    let initialResults: Array<VectorStoreItem & { score: number; vectorScore?: number; keywordScore?: number; }> = searchResponse.results || [];

    const searchTime = Date.now() - searchStartTime;
    currentTime = Date.now();

    // *** ENSURING FALLBACK LOGIC IS PRESENT ***
    // --- Debugging Fallback Conditions ---
    logDebug("[RouteQuery Fallback Check]", {
      initialLength: initialResults.length,
      applyFiltering: searchOptions.applyMetadataFiltering,
      filterObjectExists: !!hybridSearchOptions.filter,
      filterObjectContent: JSON.stringify(hybridSearchOptions.filter) 
    });
    // --- End Debugging ---
    if (initialResults.length === 0 && searchOptions.applyMetadataFiltering && hybridSearchOptions.filter) {
      logWarning(`[RouteQuery] Initial search with filter returned 0 results for query "${query}". Retrying without category/metadata filters.`);
      
      const fallbackSearchStartTime = currentTime;
      // Create options without the filter
      const fallbackOptions: HybridSearchOptions = {
        ...hybridSearchOptions,
        filter: undefined 
      };

      const fallbackResponse = await hybridSearch(
        expandedQuery,
        fallbackOptions
      );
      initialResults = fallbackResponse.results || [];
      const fallbackSearchTime = Date.now() - fallbackSearchStartTime;
      logInfo(`[RouteQuery] Fallback search completed in ${fallbackSearchTime}ms, found ${initialResults.length} results.`);
      // Optionally add fallback time to total search time? For now, just log.
    }
    // *** END FALLBACK LOGIC ***

    // *** ENSURE LOGGING BEFORE RERANKING EXISTS AND IS DETAILED ***
    logInfo(`[RouteQuery] Results BEFORE rerank (${initialResults?.length || 0}):`,
      JSON.stringify(initialResults?.map(r => ({
          id: r.id,
          score: r.score?.toFixed(4),
          vectorScore: r.vectorScore?.toFixed(4),
          keywordScore: r.keywordScore?.toFixed(4),
          docId: r.document_id,
          textPreview: (r.text || r.originalText || '').substring(0, 100) + '...'
      })) || [], null, 2)
    );
    // *** END LOGGING BEFORE RERANKING ***

    // Step 5: Optionally re-rank results
    let finalResults: FinalSearchResults = [];
    let rerankingTime = 0;

    // Map initial results to MultiModalSearchResult[] format
    const resultsForReranker: MultiModalSearchResult[] = initialResults.map(result => ({
        item: {
            id: result.id || `missing-id-${Math.random()}`,
            text: result.text || result.originalText || '',
            metadata: result.metadata || {},
        },
        score: result.score || 0,
    }));

    if (searchOptions.useReranking && retrievalParams.rerank && resultsForReranker.length > 0) {
      const rerankingStartTime = currentTime;

      // Check if the query has visual focus
      const visualQueryAnalysis = analyzeVisualQuery(queryForReranking);

      // Configure reranking options
      const rerankOptions: MultiModalRerankOptions = {
        limit: searchOptions.rerankCount,
        includeScores: true,
        useVisualContext: true,
        visualFocus: visualQueryAnalysis.isVisualQuery,
        visualTypes: visualQueryAnalysis.visualTypes,
        timeoutMs: 10000
      };

      logInfo(`[RouteQuery] Reranking ${resultsForReranker.length} results to get top ${searchOptions.rerankCount}...`);

      // *** RESTORE RERANKER CALL ***
      finalResults = await rerankWithGemini(
        queryForReranking, // Use original query for reranking context
        resultsForReranker, // Pass the correctly mapped results
        rerankOptions
      );
      // *** END RESTORED CALL ***

      rerankingTime = Date.now() - rerankingStartTime;
      currentTime = Date.now();

      if (searchOptions.debug) {
        console.log(`[RouteQuery] Reranking completed in ${rerankingTime}ms`);
        console.log(`[RouteQuery] Used multi-modal reranking with visual focus: ${visualQueryAnalysis.isVisualQuery}`);
      }

    } else {
      // This else block handles cases where reranking was disabled or no initial results
      logInfo(`[RouteQuery] Skipping reranking for query: "${query}". Using initial results.`);
      finalResults = resultsForReranker // Use the mapped resultsForReranker
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, searchOptions.limit || 5) // Apply final limit
        .map(r => ({ // Map to FinalSearchResults format
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

    // *** Logging AFTER rerank/selection ***
    logInfo(`[RouteQuery] Results AFTER rerank/final processing (${finalResults?.length || 0}):`,
      JSON.stringify(finalResults?.map(r => ({
        id: r.item?.id,
        finalScore: r.score?.toFixed(4),
        originalScore: r.originalScore?.toFixed(4),
        explanation: r.explanation,
        docId: r.item?.metadata?.document_id || r.item?.metadata?.source,
        textPreview: (r.item?.text || '').substring(0, 100) + '...'
      })) || [], null, 2)
    );
    // *** END LOGGING AFTER RERANKING ***

    // Calculate total processing time
    const totalTime = Date.now() - startTime;

    // Create trace of the search process
    const processingTime = {
      analysis: analysisTime,
      search: searchTime,
      reranking: rerankingTime || undefined,
      total: totalTime
    };

    // Create search trace for debugging and analysis
    const searchTrace = await createSearchTrace(
      query,
      queryAnalysis,
      originalFilter,
      hybridSearchOptions.filter,
      !!(initialResults.length === 0 && searchOptions.applyMetadataFiltering && hybridSearchOptions.filter),
      initialResults.length === 0 ? "No results with original filter" : undefined,
      initialResults,
      finalResults,
      processingTime
    );

    // Store trace in database asynchronously (don't await)
    storeSearchTrace(searchTrace).catch(err => 
      logError('[RouteQuery] Failed to store search trace', err));

    // Return results with timing information
    return {
      results: finalResults,
      queryAnalysis,
      processingTime
    };
  } catch (error) {
    logError('[RouteQuery] Error in query routing pipeline', error instanceof Error ? error : String(error));
    // Depending on requirements, might want to return empty results or rethrow
     throw error instanceof Error ? error : new Error(String(error));
  }
}

// --- Functions below might belong in a separate utility file or be removed if unused ---

/**
 * Converts search results to a format suitable for the response
 * NOTE: This function might need adjustment based on the structure of FinalSearchResults (RankedSearchResult)
 */
export function formatResults(results: FinalSearchResults): Array<{
  text: string;
  source: string;
  metadata: Record<string, any>;
  relevanceScore: number;
  visualContent?: any; // Include visual content if present in RankedSearchResult
}> {
  if (!results) return [];
  return results.map(result => ({
    text: result.item?.text || result.item?.originalText || '',
    source: result.item?.metadata?.source || 'Unknown',
    metadata: result.item?.metadata || {},
    relevanceScore: result.score || 0,
    visualContent: (result.item as any)?.visualContent // Access visualContent if it exists
  }));
}

/**
 * Generate a brief explanation of search strategy based on query analysis
 * NOTE: Ensure queryAnalysis object has the required fields
 */
export function explainSearchStrategy(queryAnalysis: LocalQueryAnalysis): string { // Using LocalQueryAnalysis
  if (!queryAnalysis) return "Standard search strategy applied.";

  // Assuming getRetrievalParameters works with the provided queryAnalysis type
  const retrievalParams = getRetrievalParameters(queryAnalysis);

  let explanation = `Based on the query analysis:\n`;
  const queryString = queryAnalysis.originalQuery || '[Query not available]'; // Prioritize originalQuery
  const primaryCategory = queryAnalysis.primaryCategory || 'general topics';
  const technicalLevel = queryAnalysis.technicalLevel ?? 'N/A';

  explanation += `Query analysis identified the topic as related to ${primaryCategory} `;
  explanation += `with an estimated technical level of ${technicalLevel}. `;

  if (retrievalParams.hybridRatio !== undefined) {
    if (retrievalParams.hybridRatio > 0.7) {
      explanation += 'Keyword matching was emphasized. ';
    } else if (retrievalParams.hybridRatio < 0.3) {
      explanation += 'Semantic similarity was emphasized. ';
    } else {
      explanation += 'A balanced hybrid search was used. ';
    }
  }

  // Check category filter (might be empty array, check length)
  const filterCategories = retrievalParams.categoryFilter?.categories;
  if (filterCategories && filterCategories.length > 0) {
     explanation += `Results were filtered/boosted for categories: ${filterCategories.join(', ')}. `;
  }

  if (retrievalParams.technicalLevelRange) {
    explanation += `Content was filtered for technical level ${retrievalParams.technicalLevelRange.min}-${retrievalParams.technicalLevelRange.max}. `;
  }

  // Check reranking parameter
  if (retrievalParams.rerank) {
    explanation += 'AI reranking applied to improve relevance. ';

    // Check if this was a visual query using the original query string
    const visualQuery = analyzeVisualQuery(queryString);
    if (visualQuery.isVisualQuery) {
      explanation += `Multi-modal reranking focused on visual content ${visualQuery.visualTypes.length > 0 ? `(${visualQuery.visualTypes.join(', ')})` : ''}. `;
    }
  }

  return explanation;
}

/**
 * Extract URL path segments from query entities if they map to known site sections
 * This helps direct certain queries to specific parts of the site
 */
function extractUrlPathsFromEntities(entities?: Entity[]): string[] | undefined {
  if (!entities || entities.length === 0) return undefined;
  
  const pathSegments: string[] = [];
  
  // Map entity types to potential URL paths
  entities.forEach(entity => {
    // Skip entities with low confidence
    if (entity.score && entity.score < 0.5) return;
    
    const entityName = entity.name.toLowerCase();
    
    // Check if entity type maps to a known URL section
    if (entity.type === 'PRODUCT') {
      if (entityName.includes('payroll')) {
        pathSegments.push('PAYROLL');
      } else if (entityName.includes('hiring') || entityName.includes('applicant') || entityName.includes('recruit')) {
        pathSegments.push('HIRING');
      } else if (entityName.includes('onboarding')) {
        pathSegments.push('ONBOARDING');
      } else if (entityName.includes('scheduling') || entityName.includes('shift')) {
        pathSegments.push('SCHEDULING');
      }
    } else if (entity.type === 'ORGANIZATION' && entityName.includes('workstream')) {
      pathSegments.push('ABOUT');
    } else if (entity.type === 'CONCEPT') {
      // Map concept entities to relevant paths
      if (entityName.includes('compliance') || entityName.includes('legal')) {
        pathSegments.push('COMPLIANCE');
      } else if (entityName.includes('retention')) {
        pathSegments.push('RETENTION');
      }
    }
  });
  
  // Add debug logging for URL path segments
  if (pathSegments.length > 0) {
    logDebug(`[QueryRouter] Extracted URL path segments: ${pathSegments.join(', ')}`);
  }
  
  return pathSegments.length > 0 ? pathSegments : undefined;
}

/**
 * Determines if a category is sales-focused
 * 
 * @param category The category to check
 * @returns true if the category is sales-focused, false otherwise
 */
function isSalesFocusedCategory(category?: string): boolean {
  if (!category) return false;
  
  const salesCategories = [
    'CASE_STUDIES',
    'CUSTOMER_TESTIMONIALS',
    'ROI_CALCULATOR',
    'PRICING_INFORMATION',
    'COMPETITIVE_ANALYSIS',
    'PRODUCT_COMPARISON',
    'FEATURE_BENEFITS',
    'SALES_ENABLEMENT',
    'IMPLEMENTATION_PROCESS',
    'CONTRACT_TERMS',
    'CUSTOMER_SUCCESS_STORIES',
    'PRODUCT_ROADMAP',
    'INDUSTRY_INSIGHTS',
    'COST_SAVINGS_ANALYSIS',
    'DEMO_MATERIALS'
  ];
  
  return salesCategories.includes(category);
}

/**
 * Creates a structured trace of the search process for diagnostics and analysis
 */
async function createSearchTrace(
  query: string,
  queryAnalysis: LocalQueryAnalysis,
  initialFilter: any,
  appliedFilter: any,
  filterRelaxed: boolean,
  relaxationReason: string | undefined,
  initialResults: any[],
  finalResults: any[],
  processingTime: {
    analysis: number;
    search: number;
    reranking?: number;
    total: number;
  }
): Promise<SearchTrace> {
  // Count categories in results for analysis
  const categoriesInResults: Record<string, number> = {};
  let salesContentCount = 0;
  let nonSalesContentCount = 0;

  finalResults.forEach(result => {
    const primaryCategory = result.item?.metadata?.primaryCategory;
    if (primaryCategory) {
      categoriesInResults[primaryCategory] = (categoriesInResults[primaryCategory] || 0) + 1;
      
      // Count sales vs non-sales content
      if (isSalesFocusedCategory(primaryCategory)) {
        salesContentCount++;
      } else {
        nonSalesContentCount++;
      }
    }
  });

  // Calculate sales content ratio
  const salesContentRatio = finalResults.length > 0 ? 
    salesContentCount / finalResults.length : 0;

  return {
    id: uuidv4(),
    query,
    timestamp: new Date().toISOString(),
    queryAnalysis: {
      primaryCategory: queryAnalysis.primaryCategory,
      secondaryCategories: queryAnalysis.secondaryCategories || [],
      technicalLevel: queryAnalysis.technicalLevel,
      intent: queryAnalysis.intent,
      entities: queryAnalysis.entities || []
    },
    searchDecisions: {
      initialFilter,
      appliedFilter,
      filterRelaxed,
      relaxationReason,
      // Include category balancing info if it was applied
      categoryBalancing: filterRelaxed ? {
        before: { 
          sales: initialResults.filter(r => 
            isSalesFocusedCategory(r.metadata?.primaryCategory)).length,
          nonSales: initialResults.filter(r => 
            !isSalesFocusedCategory(r.metadata?.primaryCategory)).length
        },
        after: { sales: salesContentCount, nonSales: nonSalesContentCount }
      } : undefined
    },
    resultStats: {
      initialResultCount: initialResults.length,
      finalResultCount: finalResults.length,
      categoriesInResults,
      salesContentRatio
    },
    timings: processingTime
  };
}

/**
 * Stores search trace in the database for later analysis
 */
async function storeSearchTrace(trace: SearchTrace): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      logWarning('[storeSearchTrace] Supabase client not available, skipping trace storage');
      return;
    }

    const { error } = await supabase
      .from('search_traces')
      .insert({
        id: trace.id,
        query: trace.query,
        timestamp: trace.timestamp,
        query_analysis: trace.queryAnalysis,
        search_decisions: trace.searchDecisions,
        result_stats: trace.resultStats,
        timings: trace.timings
      });

    if (error) {
      logError('[storeSearchTrace] Failed to store search trace', error);
    } else {
      logDebug('[storeSearchTrace] Successfully stored search trace', { traceId: trace.id });
    }
  } catch (err) {
    logError('[storeSearchTrace] Error storing search trace', err);
  }
}