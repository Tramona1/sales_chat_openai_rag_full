/**
 * Hybrid Search Module for Smart Query Routing with Supabase Backend
 * 
 * This module uses Supabase's PostgreSQL functions for vector search, keyword search,
 * and hybrid search with metadata-aware filtering.
 */

/**
 * Hybrid Search Module for Smart Query Routing with Supabase Backend
 * 
 * This module uses Supabase's PostgreSQL functions for vector search, keyword search,
 * and hybrid search with metadata-aware filtering.
 * 
 * IMPORTANT CHANGES (2023-08-03):
 * 1. Default matchThreshold reduced from 0.7 to 0.2 for better retrieval recall
 * 2. Added execution IDs to track duplicate calls
 * 3. Enhanced logging to diagnose parameter issues
 * 4. Added caller tracking to identify source of duplicate calls
 * 5. Standardized parameters across API endpoints for consistent behavior
 * 6. Renamed bm25Score to keywordScore to reflect PostgreSQL FTS implementation
 */

import { VectorStoreItem } from './vectorStore';
import { embedText, getEmbeddingClient } from './embeddingClient';
import { logError, logInfo, logWarning, logDebug } from './logger';
import { DocumentCategoryType } from './documentCategories';
import { 
  filterDocumentsByCategoryPath,
  parseCategoryPath,
  buildCategoryHierarchyWithCounts,
  getAllEntitiesFromDocuments,
  getTechnicalLevelDistribution,
  CategoryHierarchy
} from './hierarchicalCategories';

// Import Supabase client - use admin client for access to RPC functions
import { getSupabaseAdmin } from './supabaseClient';

// Local types
interface Document {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

interface DocumentEmbedding extends Document {
  embedding: number[];
}

interface MetadataFilter {
  categories?: DocumentCategoryType[];
  strictCategoryMatch?: boolean;
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  lastUpdatedAfter?: string;
  entities?: string[];
  keywords?: string[];
}

interface SearchResultItem {
  text: string;
  source?: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
}

export interface SearchResult {
  item: {
    id: string;
    text: string;
    metadata?: Record<string, any>;
  };
  score: number;
  vectorScore?: number;
  bm25Score?: number;
}

// Result from hybrid search
export interface HybridSearchResult {
  item: VectorStoreItem;
  score: number;
  keywordScore: number;
  vectorScore: number;
  metadata: {
    matchesCategory: boolean;
    categoryBoost: number;
    technicalLevelMatch: number;
  };
}

// Filter options for hybrid search
export interface HybridSearchFilter {
  strictCategoryMatch?: boolean;
  
  // Primary and secondary categories (standardized format)
  primaryCategory?: DocumentCategoryType;
  secondaryCategories?: DocumentCategoryType[];
  
  // URL path segments for direct path filtering
  urlPathSegments?: string[];
  
  // Technical level filtering (1-10 scale)
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  
  // Entity filtering
  requiredEntities?: string[];
  
  // Keyword filtering (added for standardization)
  keywords?: string[];
  
  // Custom metadata filters
  customFilters?: Record<string, any>;
}

// Update HybridSearchOptions interface to include hierarchy-related options
export interface HybridSearchOptions {
  limit?: number;
  includeDeprecated?: boolean; // Option to include deprecated documents
  onlyAuthoritative?: boolean; // Option to only include authoritative documents
  priorityInfoType?: string;
  categoryPath?: string[]; // Add support for hierarchical category filtering
  includeFacets?: boolean; // Option to include facet information in results
  technicalLevelRange?: { min: number; max: number }; // Technical level filtering
  entityFilters?: Record<string, string[]>; // Entity-based filtering
  // New options specific to Supabase
  vectorWeight?: number; // Weight for vector search (0-1)
  keywordWeight?: number; // Weight for keyword search (0-1)
  matchThreshold?: number; // Similarity threshold for vector matches
  filter?: HybridSearchFilter; // Filter object
}

// Update interface to include facets and implement iterable for backwards compatibility
export interface HybridSearchResponse {
  results: Array<VectorStoreItem & { 
    score: number;
    vectorScore?: number;
    keywordScore?: number;
  }>;
  facets?: {
    categories: CategoryHierarchy[];
    entities: Record<string, Array<{ name: string, count: number }>>;
    technicalLevels: Array<{ level: number, count: number }>;
  };
}

// Re-export fallbackSearch to ensure it's properly available when importing the module
// REMOVING CIRCULAR REFERENCE: export { fallbackSearch } from './hybridSearch';

/**
 * Fallback search function that performs a basic keyword search when hybrid search fails
 * This simple implementation ensures basic search functionality even when vector search is unavailable
 * 
 * @param query The user's search query
 * @returns Array of search results
 */

/**
 * Fallback search function for emergency retrieval when the main hybrid search fails
 * 
 * This function uses Supabase's built-in full-text search capability to provide results
 * when the primary hybrid search mechanism encounters errors. It's designed to be:
 * - Resilient: Relies on simple, proven PostgreSQL full-text search technology
 * - Fast: Optimized for speed rather than relevance in emergency situations
 * - Reliable: Has minimal dependencies to reduce failure points
 * 
 * The implementation uses PostgreSQL's plainto_tsquery for better keyword matching with
 * the English text search configuration for stemming and normalization.
 * 
 * Results are assigned a standard score of 0.5 since the relevance scores from this
 * method are not directly comparable with those from the hybrid search.
 * 
 * @param query - The user's search query text
 * @returns Promise resolving to an array of VectorStoreItems with basic score values
 * @throws Error if the database query fails with details of the failure
 * 
 * @example
 * try {
 *   const results = await fallbackSearch("How to configure authentication");
 *   // Process results...
 * } catch (error) {
 *   // Handle error...
 * }
 */
export async function fallbackSearch(query: string): Promise<Array<VectorStoreItem & { score: number }>> {
  const supabase = getSupabaseAdmin();
  
  logInfo(`[fallbackSearch] Performing fallback keyword search for query: "${query}"`);
  
  try {
    // Use the built-in full-text search capability with plainto_tsquery for better keyword matching
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, document_id, chunk_index, text, metadata')
      .textSearch('text', query, {
        type: 'plain',
        config: 'english'
      })
      .limit(10);
      
    if (error) {
      logError(`[fallbackSearch] Error: ${error.message}`);
      throw new Error(`Fallback search error: ${error.message}`);
    }
    
    if (!data || !Array.isArray(data)) {
      logWarning('[fallbackSearch] No results found or invalid response');
      return [];
    }
    
    logInfo(`[fallbackSearch] Found ${data.length} results`);
    
    // Map the results to the expected format with a basic score
    return data.map((item) => ({
      id: item.id,
      document_id: item.document_id,
      chunk_index: item.chunk_index || 0,
      text: item.text || '',
      metadata: item.metadata || {},
      embedding: [], // Empty embedding for efficiency
      score: 0.5 // Default score for fallback results
    }));
  } catch (error) {
    logError('[fallbackSearch] Error during fallback search', error);
    // Return empty array on error
    return [];
  }
}

/**
 * Initialize the hybrid search system - minimal initialization since we're using Supabase
 */
export async function initializeHybridSearch(): Promise<void> {
  // No extensive initialization needed with Supabase backend
  // The database is always ready, and we don't need to load files anymore
  
  try {
    // Just verify Supabase connection to ensure everything works
    const { count, error } = await getSupabaseAdmin()
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      throw new Error(`Failed to connect to Supabase: ${error.message}`);
    }
    
    logInfo('Hybrid search system initialized with Supabase backend', { 
      documentChunksCount: count
    });
    
    return;
  } catch (error) {
    logError('Failed to initialize hybrid search with Supabase', error);
    throw new Error('Failed to initialize hybrid search system');
  }
}

/**
 * @deprecated Use hybridSearch with HybridSearchOptions instead
 * Perform hybrid search using Supabase's hybrid_search RPC function
 */
export async function performHybridSearch(
  query: string,
  limit: number = 10,
  hybridRatio: number = 0.5, // Controls the balance between vector and keyword search
  filter?: MetadataFilter
): Promise<SearchResult[]> {
  console.warn('performHybridSearch is deprecated. Please use hybridSearch instead.');
  
  // Convert the old filter format to the new format if it exists
  const newFilter = filter ? {
    categories: filter.categories,
    strictCategoryMatch: filter.strictCategoryMatch,
    technicalLevelMin: filter.technicalLevelMin,
    technicalLevelMax: filter.technicalLevelMax,
    requiredEntities: filter.entities
  } : undefined;
  
  // Call the updated function with equivalent parameters
  return hybridSearch(query, {
    limit,
    vectorWeight: hybridRatio,
    keywordWeight: 1 - hybridRatio,
    matchThreshold: 0.7,
    filter: newFilter
  }).then(response => response.results.map(item => ({
    item: {
      id: item.id || '',
      text: item.text || item.originalText || '',
      metadata: item.metadata || {}
    },
    score: item.score || 0,
    vectorScore: item.vectorScore || 0,
    bm25Score: item.keywordScore || 0
  })));
}

/**
 * Convert HybridSearchFilter to a JSON object format that Supabase RPC function can understand
 * 
 * This function converts the typed HybridSearchFilter object to a JSON structure that
 * can be sent to the Supabase hybrid_search RPC function. It handles special logic for
 * translating between our TypeScript interface and the PostgreSQL function parameters.
 * 
 * Enhanced features:
 * - Improved handling of URL path segments filtering for more targeted retrieval
 * - Special handling for sales-focused categories
 * - Support for entity filtering, especially for competitors and industry entities
 * 
 * @param filter The filter object with various filtering criteria
 * @returns JSON object to pass to Supabase RPC
 */
function convertFilterToJson(filter?: HybridSearchFilter): any {
  if (!filter) {
    return null;
  }
  
  // Start with an empty filter object
  const jsonFilter: any = {};
  
  // Add category filters
  if (filter.primaryCategory) {
    jsonFilter.primary_category = filter.primaryCategory;
    
    // Special handling for sales-focused categories - add stronger boosting
    if (isSalesFocusedCategory(filter.primaryCategory)) {
      jsonFilter.sales_focus = true;
    }
  }
  
  if (filter.secondaryCategories && filter.secondaryCategories.length > 0) {
    jsonFilter.secondary_categories = filter.secondaryCategories;
    jsonFilter.strict_category_match = filter.strictCategoryMatch === true;
    
    // Check for sales-focused categories in secondary categories
    if (filter.secondaryCategories.some((c: string) => isSalesFocusedCategory(c))) {
      jsonFilter.sales_focus = true;
    }
  }
  
  // Add URL path segment filters with enhanced processing
  if (filter.urlPathSegments && filter.urlPathSegments.length > 0) {
    // Normalize path segments (remove leading/trailing slashes, lowercase)
    const normalizedSegments = filter.urlPathSegments.map(segment => 
      segment.toLowerCase().replace(/^\/+|\/+$/g, '')
    );
    
    // Add with both original and normalized versions for more reliable matching
    jsonFilter.url_path_segments = normalizedSegments;
    
    // Log the URL path segments we're using
    logDebug(`[convertFilterToJson] Using URL path segments: ${normalizedSegments.join(', ')}`);
  }
  
  // Add technical level filters
  if (filter.technicalLevelMin !== undefined || filter.technicalLevelMax !== undefined) {
    jsonFilter.technical_level = {};
    
    if (filter.technicalLevelMin !== undefined) {
      jsonFilter.technical_level.min = filter.technicalLevelMin;
    }
    
    if (filter.technicalLevelMax !== undefined) {
      jsonFilter.technical_level.max = filter.technicalLevelMax;
    }
  }
  
  // Add entity filters
  if (filter.requiredEntities && filter.requiredEntities.length > 0) {
    jsonFilter.required_entities = filter.requiredEntities;
  }
  
  // Add keyword filters
  if (filter.keywords && filter.keywords.length > 0) {
    jsonFilter.keywords = filter.keywords;
  }
  
  // Add custom filters
  if (filter.customFilters) {
    jsonFilter.custom_filters = filter.customFilters;
  }
  
  return jsonFilter;
}

/**
 * Helper function to identify sales-focused categories
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
 * Main hybrid search function with support for facets and filters
 * 
 * This function provides comprehensive hybrid search capabilities by combining vector
 * and keyword search. It includes detailed logging for diagnostics and robust error
 * handling with fallback mechanisms.
 * 
 * Enhanced features:
 * - Detailed logging of search parameters and results with unique execution IDs to track duplicate calls
 * - Special debugging for specific query types (e.g., investor-related queries)
 * - Zero-result detection with automatic fallback to more lenient search
 * - Consistent terminology using keywordScore instead of bm25Score to reflect PostgreSQL FTS
 * - Improved default parameters: more lenient matchThreshold (0.2) for better recall
 * - Caller tracking to identify sources of duplicate executions
 * 
 * Parameter defaults:
 * - vectorWeight: 0.5 (unless specified in options)
 * - keywordWeight: 0.5 (unless specified in options)
 * - matchThreshold: 0.2 (unless specified in options) - CHANGED from 0.7 to improve recall
 * - limit: 10 (unless specified in options)
 * 
 * @param query - The search query string
 * @param options - Configuration options for the search
 * @returns A promise resolving to search results with detailed scoring information
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResponse> {
  const supabase = getSupabaseAdmin();
  const embeddingClient = getEmbeddingClient();
  
  // Generate a unique execution ID for this call to track potential duplicates
  const executionId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Enhanced logging of incoming parameters with execution ID
  logInfo(`===== HYBRID SEARCH CALL START (ID: ${executionId}) =====`);
  logInfo(`[hybridSearch:${executionId}] Query: "${query}"`);
  logDebug(`[hybridSearch:${executionId}] Options:`, JSON.stringify(options, null, 2));
  
  // Track caller information to identify source of duplicate calls
  const stackTrace = new Error().stack || '';
  const callerInfo = stackTrace.split('\n')[2] || 'unknown caller';
  logDebug(`[hybridSearch:${executionId}] Called from: ${callerInfo.trim()}`);

  if (!query || query.trim() === '') {
    logWarning('[hybridSearch] Empty query received, returning empty results');
    // Return empty results with correct structure
    const emptyResponse: HybridSearchResponse = {
      results: [],
    };
    
    if (options.includeFacets) {
      emptyResponse.facets = {
        categories: [],
        entities: { 
          people: [],
          companies: [],
          products: [],
          features: []
        },
        technicalLevels: []
      };
    }
    
    return emptyResponse;
  }
  
  try {
    // Generate query embedding
    logDebug('[hybridSearch] Generating embedding for query');
    
    // Clean query with the exact same approach used in embeddingClient.ts
    const cleanedQuery = query.replace(/\s+/g, ' ').trim();
    logDebug(`[hybridSearch] Original query: "${query}", Cleaned query: "${cleanedQuery}"`);
    
    const queryEmbedding = await embeddingClient.embedText(cleanedQuery);
    logDebug(`[hybridSearch] Embedding generated with ${queryEmbedding?.length ?? 0} dimensions`);

    // Prepare options and weights with improved defaults
    const limit = options.limit || 10;
    
    // Use provided weights or default to balanced (0.5/0.5)
    const vectorWeight = options.vectorWeight !== undefined ? options.vectorWeight : 0.5;
    const keywordWeight = options.keywordWeight !== undefined ? options.keywordWeight : 0.5;
    
    // Use a more lenient default threshold (0.2 instead of 0.7)
    const matchThreshold = options.matchThreshold !== undefined ? options.matchThreshold : 0.2;
    
    // Log where values are coming from
    logDebug('[hybridSearch] Parameter sources:');
    logDebug(`[hybridSearch] vectorWeight=${vectorWeight} (${options.vectorWeight !== undefined ? 'from options' : 'default'})`);
    logDebug(`[hybridSearch] keywordWeight=${keywordWeight} (${options.keywordWeight !== undefined ? 'from options' : 'default'})`);
    logDebug(`[hybridSearch] matchThreshold=${matchThreshold} (${options.matchThreshold !== undefined ? 'from options' : 'default'})`);
    logDebug(`[hybridSearch] limit=${limit} (${options.limit ? 'from options' : 'default'})`);
    
    // Prepare filter based on options
    let filter: any = {};
    
    // Enhanced filter logging
    logDebug('[hybridSearch] Processing search filters');
    
    // Convert between filter formats if needed
    if (options.filter) {
      logInfo('[hybridSearch] Using provided filter object:', JSON.stringify(options.filter, null, 2));
      filter = convertFilterToJson(options.filter);
    } else {
      logDebug('[hybridSearch] No direct filter object, checking legacy filter options');
      // Handle legacy filter fields
      if (options.categoryPath && options.categoryPath.length > 0) {
        filter.category_path = options.categoryPath;
        logDebug(`[hybridSearch] Using category path: [${options.categoryPath.join(', ')}]`);
      }
      
      if (options.technicalLevelRange) {
        filter.technical_level = {
          min: options.technicalLevelRange.min,
          max: options.technicalLevelRange.max
        };
        logDebug(`[hybridSearch] Using technical level range: min=${options.technicalLevelRange.min}, max=${options.technicalLevelRange.max}`);
      }
      
      if (options.entityFilters && Object.keys(options.entityFilters).length > 0) {
        filter.entities = options.entityFilters;
        logDebug(`[hybridSearch] Using entity filters: ${JSON.stringify(options.entityFilters, null, 2)}`);
      }
      
      if (options.includeDeprecated !== undefined) {
        filter.include_deprecated = options.includeDeprecated;
        logDebug(`[hybridSearch] includeDeprecated: ${options.includeDeprecated}`);
      }
      
      if (options.onlyAuthoritative !== undefined) {
        filter.only_authoritative = options.onlyAuthoritative;
        logDebug(`[hybridSearch] onlyAuthoritative: ${options.onlyAuthoritative}`);
      }
    }
    
    // Call Supabase hybrid_search RPC function
    logInfo('--------- RPC CALL DETAILS ---------');
    logInfo(`[hybridSearch] Calling RPC 'hybrid_search' for query: "${query}"`);
    logInfo(`[hybridSearch] Filter sent to RPC: ${JSON.stringify(filter, null, 2)}`);
    logInfo(`[hybridSearch] Parameters: vectorWeight=${vectorWeight}, keywordWeight=${keywordWeight}, matchThreshold=${matchThreshold}, limit=${limit}`);
    
    // For troubleshooting specific queries
    if (query.toLowerCase().includes('investor') || query.toLowerCase().includes('invest')) {
      logInfo('[hybridSearch] INVESTOR QUERY DETECTED - enabling additional debugging');
      
      // Try getting document count first to verify content exists
      try {
        const { count, error: countError } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true });
          
        logInfo(`[hybridSearch] Database contains ${count || 'unknown'} document chunks total`);
        
        // Check for any docs with investor-related content
        const { data: investorDocs, error: investorError } = await supabase
          .from('document_chunks')
          .select('id, document_id')
          .ilike('text', '%invest%')
          .limit(5);
          
        if (investorError) {
          logWarning(`[hybridSearch] Error checking for investor content: ${investorError.message}`);
        } else {
          logInfo(`[hybridSearch] Found ${investorDocs?.length || 0} documents containing 'invest'`);
          if (investorDocs && investorDocs.length > 0) {
            logInfo(`[hybridSearch] Sample investor documents: ${JSON.stringify(investorDocs.map(d => d.document_id))}`);
          }
        }
      } catch (debugError) {
        logWarning(`[hybridSearch] Error during debug checks: ${debugError}`);
      }
    }
    
    const rpcStartTime = Date.now();
    const { data, error } = await supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: limit,
      match_threshold: matchThreshold,
      vector_weight: vectorWeight,
      keyword_weight: keywordWeight,
      filter: filter 
    });
    const rpcDuration = Date.now() - rpcStartTime;
    
    // Enhanced RPC call result logging
    logInfo(`[hybridSearch] RPC call completed in ${rpcDuration}ms`);

    if (error) {
      logError('--------- RPC ERROR DETAILS ---------');
      logError(`[hybridSearch] Error during RPC call - Code: ${error.code}, Message: ${error.message}`);
      logError(`[hybridSearch] Error details: ${error.details || 'none'}`);
      logError(`[hybridSearch] Query: "${query}"`);
      logError(`[hybridSearch] Filter: ${JSON.stringify(filter, null, 2)}`);
      logError(`[hybridSearch] Query embedding length: ${queryEmbedding?.length || 'unknown'}`);
      logError(`[hybridSearch] Parameters: vectorWeight=${vectorWeight}, keywordWeight=${keywordWeight}, matchThreshold=${matchThreshold}, limit=${limit}`);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }
    
    logInfo('--------- RPC RESPONSE DETAILS ---------');
    logInfo(`[hybridSearch] RPC call successful. Found ${Array.isArray(data) ? data.length : 'unknown'} results.`);
    
    if (Array.isArray(data) && data.length === 0) {
      logWarning(`[hybridSearch] RPC call returned 0 results for query: "${query}"`);
      logWarning(`[hybridSearch] Filter used: ${JSON.stringify(filter, null, 2)}`);
      logWarning(`[hybridSearch] Consider checking category mappings and filter validity`);
      
      // Immediately try a more lenient search if we got zero results and there's a filter
      if (filter && Object.keys(filter).length > 0) {
        logInfo(`[hybridSearch] Attempting secondary search with reduced filter strictness`);
        
        // Try to get some results with a more lenient approach
        try {
          // Try without any filter
          const { data: unfilteredData, error: unfilteredError } = await supabase.rpc('hybrid_search', {
            query_text: query,
            query_embedding: queryEmbedding,
            match_count: limit,
            match_threshold: matchThreshold * 0.7, // Lower the threshold by 30%
            vector_weight: vectorWeight,
            keyword_weight: keywordWeight,
            filter: null // No filter
          });
          
          if (unfilteredError) {
            logWarning(`[hybridSearch] Secondary search failed: ${unfilteredError.message}`);
          } else {
            logInfo(`[hybridSearch] Secondary search found ${unfilteredData?.length || 0} results - available for fallback`);
            
            // Log the first result for debugging
            if (unfilteredData && unfilteredData.length > 0) {
              logInfo(`[hybridSearch] First unfiltered result: ${JSON.stringify({
                id: unfilteredData[0].id,
                score: unfilteredData[0].combined_score || unfilteredData[0].similarity,
                text: unfilteredData[0].text?.substring(0, 100) + '...'
              })}`);
            }
          }
        } catch (secondaryError) {
          logWarning(`[hybridSearch] Error during secondary search: ${secondaryError}`);
        }
      }
    }
    
    if (!data || !Array.isArray(data)) {
      logWarning('[hybridSearch] RPC returned no data or data is not an array.');
      const emptyResponse: HybridSearchResponse = {
        results: [],
      };
      if (options.includeFacets) {
        emptyResponse.facets = {
          categories: [],
          entities: { people: [], companies: [], products: [], features: [] },
          technicalLevels: []
        };
      }
      return emptyResponse;
    }
    
    // Enhanced result mapping logging
    logDebug(`[hybridSearch] Mapping ${data.length} results to response format`);
    
    // Map the results
    const results: Array<VectorStoreItem & { 
      score: number;
      vectorScore: number;
      keywordScore: number;
      search_type?: string;
    }> = data.map(item => ({
      id: item.id,
      document_id: item.document_id,
      chunk_index: item.chunk_index || 0,
      text: item.text || item.content || '',
      originalText: item.original_text || item.content || '',
      metadata: item.metadata || {},
      embedding: [], // Empty embedding for efficiency
      score: item.combined_score ?? item.similarity ?? item.keyword_score ?? 0, 
      vectorScore: item.vector_score ?? 0, 
      keywordScore: item.keyword_score ?? 0,
      search_type: item.search_type || 'hybrid'
    }));
    
    // Log details of the first few results
    if (results.length > 0) {
      logDebug('[hybridSearch] First result details:');
      logDebug(JSON.stringify({
        id: results[0].id,
        document_id: results[0].document_id,
        score: results[0].score,
        vectorScore: results[0].vectorScore,
        keywordScore: results[0].keywordScore,
        metadata: results[0].metadata
      }, null, 2));
      
      // Log metadata categories of first 3 results to help diagnose category issues
      const categoryInfo = results.slice(0, 3).map(r => ({
        id: r.id,
        primary: r.metadata?.primaryCategory,
        secondary: r.metadata?.secondaryCategories
      }));
      logInfo('[hybridSearch] Category information in top results:', JSON.stringify(categoryInfo, null, 2));
    }
    
    // Prepare facets if requested
    let facetsData = undefined;
    if (options?.includeFacets) {
      logDebug('[hybridSearch] Fetching facet information');
      facetsData = await fetchFacetsFromItems(results);
    }
    
    // Prepare the final response object
    const response: HybridSearchResponse = {
      results,
      facets: facetsData ? {
        categories: facetsData.categories,
        entities: facetsData.entities,
        technicalLevels: facetsData.technicalLevels
      } : undefined,
    };

    logInfo(`[hybridSearch:${executionId}] Successfully processed ${results.length} results`);
    logInfo(`===== HYBRID SEARCH CALL END (ID: ${executionId}) =====`);
    
    return response;
  } catch (error: any) {
    logError(`===== HYBRID SEARCH ERROR (ID: ${executionId}) =====`);
    logError(`[hybridSearch:${executionId}] Error processing query: "${query}"`);
    logError(`[hybridSearch:${executionId}] Error message: ${error.message}`); 
    logError(`[hybridSearch:${executionId}] Options used: ${JSON.stringify(options, null, 2)}`);
    if (error.stack) { logError(`[hybridSearch:${executionId}] Stack trace: ${error.stack}`); }
    
    // Try fallback search if hybrid search fails
    try {
      logWarning(`[hybridSearch] Attempting keyword-only fallback for query: "${query}"`);
      const fallbackResults = await fallbackSearch(query);
      
      const fallbackResponse: HybridSearchResponse = {
        results: fallbackResults.map((item: VectorStoreItem & { score: number }) => ({
          ...item,
          vectorScore: 0,
          keywordScore: item.score || 0
        })),
      };
      logInfo(`[hybridSearch] Fallback search returned ${fallbackResponse.results.length} results.`);
      return fallbackResponse;
    } catch (fallbackError: any) {
      logError('[hybridSearch] Fallback search also failed');
      logError(`[hybridSearch] Fallback error: ${fallbackError.message}`);
      if (fallbackError.stack) { logError(`[hybridSearch] Fallback stack: ${fallbackError.stack}`); }
    }
    
    // Return empty results with correct structure when error occurs
    logInfo('[hybridSearch] Returning empty response due to errors');
    logInfo('===== HYBRID SEARCH CALL END =====');
    
    const errorResponse: HybridSearchResponse = {
      results: [],
    };
    if (options.includeFacets) {
      errorResponse.facets = {
        categories: [],
        entities: { people: [], companies: [], products: [], features: [] },
        technicalLevels: []
      };
    }
    return errorResponse;
  }
}

/**
 * Fetch facet information for search results
 */
async function fetchFacetsFromItems(
  items: Array<VectorStoreItem & { score: number }>
): Promise<{
  categories: CategoryHierarchy[];
  entities: Record<string, Array<{ name: string; count: number }>>;
  technicalLevels: Array<{ level: number; count: number }>;
}> {
  // Extract document IDs from search results
  const documentIds = [...new Set(items
    .filter(item => item.document_id)
    .map(item => item.document_id))];
    
  if (documentIds.length === 0) {
    return {
      categories: [],
      entities: { 
        people: [],
        companies: [],
        products: [],
        features: []
      },
      technicalLevels: []
    };
  }
  
  try {
    // Fetch document metadata for facet generation
    const { data, error } = await getSupabaseAdmin()
      .from('documents')
      .select('id, category, primary_topics, entities, technical_level')
      .in('id', documentIds);
      
    if (error) {
      logError('Error fetching facet data', error);
      return {
        categories: [],
        entities: { 
          people: [],
          companies: [],
          products: [],
          features: []
        },
        technicalLevels: []
      };
    }
    
    if (!data || !Array.isArray(data)) {
      return {
        categories: [],
        entities: { 
          people: [],
          companies: [],
          products: [],
          features: []
        },
        technicalLevels: []
      };
    }
    
    // Transform the data into the format expected by facet functions
    const documents = data.map(doc => ({
      id: doc.id,
      text: '',  // Not needed for facets
      metadata: {
        category: doc.category,
        primaryTopics: doc.primary_topics,
        entities: doc.entities,
        technicalLevel: doc.technical_level
      },
      embedding: [] // Add empty embedding to satisfy VectorStoreItem requirements
    }));
    
    // Generate facet information
    const categoryHierarchy = buildCategoryHierarchyWithCounts(documents);
    const allEntities = getAllEntitiesFromDocuments(documents);
    
    return {
      categories: categoryHierarchy,
      entities: allEntities,
      technicalLevels: getTechnicalLevelDistribution(documents)
    };
  } catch (error) {
    logError('Error generating facets', error);
    return {
      categories: [],
      entities: { 
        people: [],
        companies: [],
        products: [],
        features: []
      },
      technicalLevels: []
    };
  }
} 