/**
 * Hybrid Search Module for Smart Query Routing with Supabase Backend
 * 
 * This module uses Supabase's PostgreSQL functions for vector search, keyword search,
 * and hybrid search with metadata-aware filtering.
 */

import { VectorStoreItem, getSimilarItems } from './vectorStore';
import { embedText } from './openaiClient';
import { logError, logInfo, logWarning } from './logger';
import { DocumentCategory } from '../types/metadata';
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
  categories?: DocumentCategory[];
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
  bm25Score: number;
  vectorScore: number;
  metadata: {
    matchesCategory: boolean;
    categoryBoost: number;
    technicalLevelMatch: number;
  };
}

// Filter options for hybrid search
export interface HybridSearchFilter {
  // Category filtering
  categories?: DocumentCategory[];
  strictCategoryMatch?: boolean;
  
  // Technical level filtering
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  
  // Entity filtering
  requiredEntities?: string[];
  
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
}

// Update interface to include facets and implement iterable for backwards compatibility
export interface HybridSearchResponse {
  results: Array<VectorStoreItem & { score: number }>;
  facets?: {
    categories: CategoryHierarchy[];
    entities: Record<string, Array<{ name: string, count: number }>>;
    technicalLevels: Array<{ level: number, count: number }>;
  };
  [Symbol.iterator](): Iterator<VectorStoreItem & { score: number }>;
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
 * Perform hybrid search using Supabase's hybrid_search RPC function
 */
export async function performHybridSearch(
  query: string,
  limit: number = 10,
  hybridRatio: number = 0.5, // Controls the balance between vector and keyword search
  filter?: MetadataFilter
): Promise<SearchResult[]> {
  if (!query || query.trim() === '') {
    return [];
  }
  
  try {
    // Generate embedding for the query
    const queryEmbedding = await embedText(query);
    
    // Prepare filter JSON if needed
    const filterJson = filter ? prepareFilterJson(filter) : null;
    
    // Calculate weights based on hybridRatio
    const vectorWeight = hybridRatio;
    const keywordWeight = 1 - hybridRatio;
    
    // Call the RPC function
    const { data, error } = await getSupabaseAdmin().rpc('hybrid_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_threshold: 0.7, // Default threshold, can be adjusted
      match_count: limit,
      vector_weight: vectorWeight,
      keyword_weight: keywordWeight,
      filter: filterJson
    });
    
    if (error) {
      logError('Error during hybrid search RPC call', error);
      // More detailed error logging to help with debugging
      logError('Supabase RPC hybrid_search error details', {
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        queryDetails: {
          query_length: query.length,
          embedding_length: queryEmbedding.length,
          limit,
          has_filter: !!filterJson
        }
      });
      
      // Try fallbackSearch before giving up
      const fallbackResults = await fallbackSearch(query);
      if (fallbackResults && fallbackResults.length > 0) {
        logInfo('Recovered using fallback search', {
          resultCount: fallbackResults.length
        });
        
        // Convert fallback results to SearchResult format
        return fallbackResults.map(item => ({
          item: {
            id: item.id || '',
            text: item.text || item.originalText || '',
            metadata: item.metadata || {}
          },
          score: item.score || 0,
          vectorScore: 0, // No vector score in fallback
          bm25Score: item.score || 0 // Use the score as BM25
        }));
      }
      
      throw new Error(`Hybrid search failed: ${error.message}`);
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      logInfo('No results from hybrid_search RPC', {
        query_length: query.length
      });
      return [];
    }
    
    // Map the results to the SearchResult format
    const results: SearchResult[] = data.map(item => ({
      item: {
        id: item.id,
        text: item.content || item.text || '',
        metadata: item.metadata || {}
      },
      score: item.combined_score || 0,
      vectorScore: item.vector_score || 0,
      bm25Score: item.keyword_score || 0
    }));
    
    return results;
  } catch (error) {
    logError('Error in performHybridSearch', error);
    
    // Try fallback as last resort
    try {
      logWarning('Attempting keyword-only fallback search');
      const fallbackResults = await fallbackSearch(query);
      
      if (fallbackResults && fallbackResults.length > 0) {
        return fallbackResults.map(item => ({
          item: {
            id: item.id || '',
            text: item.text || item.originalText || '',
            metadata: item.metadata || {}
          },
          score: item.score || 0,
              vectorScore: 0,
          bm25Score: item.score || 0
        }));
      }
    } catch (fallbackError) {
      logError('Fallback search also failed', fallbackError);
    }
    
    return [];
  }
}

/**
 * Prepare filter JSON for Supabase queries
 */
function prepareFilterJson(filter: MetadataFilter): any {
  const filterJson: any = {};
  
  if (filter.categories && filter.categories.length > 0) {
    filterJson.categories = filter.categories;
  }
  
  if (filter.technicalLevelMin !== undefined || filter.technicalLevelMax !== undefined) {
    filterJson.technical_level = {};
    if (filter.technicalLevelMin !== undefined) {
      filterJson.technical_level.min = filter.technicalLevelMin;
    }
    if (filter.technicalLevelMax !== undefined) {
      filterJson.technical_level.max = filter.technicalLevelMax;
    }
  }
  
  if (filter.entities && filter.entities.length > 0) {
    filterJson.entities = filter.entities;
  }
  
  if (filter.lastUpdatedAfter) {
    filterJson.updated_after = filter.lastUpdatedAfter;
  }
  
  return filterJson;
}

/**
 * Convert HybridSearchFilter to a JSON filter suitable for the Supabase RPC call
 */
function convertFilterToJson(filter?: HybridSearchFilter): any {
  if (!filter) return null;
  
  const jsonFilter: any = {};
  
  // Category filters
  if (filter.categories && filter.categories.length > 0) {
    jsonFilter.categories = filter.categories;
    if (filter.strictCategoryMatch !== undefined) {
      jsonFilter.strict_category_match = filter.strictCategoryMatch;
    }
  }
  
  // Technical level filters
  if (filter.technicalLevelMin !== undefined || filter.technicalLevelMax !== undefined) {
    jsonFilter.technical_level = {};
    if (filter.technicalLevelMin !== undefined) {
      jsonFilter.technical_level.min = filter.technicalLevelMin;
    }
    if (filter.technicalLevelMax !== undefined) {
      jsonFilter.technical_level.max = filter.technicalLevelMax;
    }
  }
  
  // Entity filters
  if (filter.requiredEntities && filter.requiredEntities.length > 0) {
    jsonFilter.entities = filter.requiredEntities;
  }
  
  // Custom filters
  if (filter.customFilters) {
    jsonFilter.custom = filter.customFilters;
  }
  
  return Object.keys(jsonFilter).length > 0 ? jsonFilter : null;
}

/**
 * Main hybrid search function with support for facets and filters
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResponse> {
  if (!query || query.trim() === '') {
    // Return empty results with correct structure
    const emptyResponse: HybridSearchResponse = {
      results: [],
      [Symbol.iterator]: function* () {
        for (const result of this.results) {
          yield result;
        }
      }
    };
    
    if (options.includeFacets) {
      emptyResponse.facets = {
        categories: [],
        entities: {},
        technicalLevels: []
      };
    }
    
    return emptyResponse;
  }
  
  try {
    // Generate embedding for the query
    const queryEmbedding = await embedText(query);
    
    // Prepare options and weights
    const limit = options.limit || 10;
    const vectorWeight = options.vectorWeight !== undefined ? options.vectorWeight : 0.5;
    const keywordWeight = options.keywordWeight !== undefined ? options.keywordWeight : 0.5;
    const matchThreshold = options.matchThreshold || 0.7;
    
    // Prepare filter based on options
    const filter: any = {};
    
    // Handle category path option
    if (options.categoryPath && options.categoryPath.length > 0) {
      filter.category_path = options.categoryPath;
    }
    
    // Handle technical level filtering
    if (options.technicalLevelRange) {
      filter.technical_level = {
        min: options.technicalLevelRange.min,
        max: options.technicalLevelRange.max
      };
    }
    
    // Handle entity filtering
    if (options.entityFilters && Object.keys(options.entityFilters).length > 0) {
      filter.entities = options.entityFilters;
    }
    
    // Handle special document flags
    if (options.includeDeprecated !== undefined) {
      filter.include_deprecated = options.includeDeprecated;
    }
    
    if (options.onlyAuthoritative !== undefined) {
      filter.only_authoritative = options.onlyAuthoritative;
    }
    
    // Call Supabase hybrid_search RPC function
    const { data, error } = await getSupabaseAdmin().rpc('hybrid_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: limit,
      match_threshold: matchThreshold,
      vector_weight: vectorWeight,
      keyword_weight: keywordWeight,
      filter: Object.keys(filter).length > 0 ? filter : null
    });
    
    if (error) {
      logError('Error during hybrid search RPC call', error);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }
    
    if (!data || !Array.isArray(data)) {
      // Return empty results with correct structure
      const emptyResponse: HybridSearchResponse = {
        results: [],
        [Symbol.iterator]: function* () {
          for (const result of this.results) {
            yield result;
          }
        }
      };
      
      if (options.includeFacets) {
        emptyResponse.facets = {
          categories: [],
          entities: {},
          technicalLevels: []
        };
      }
      
      return emptyResponse;
    }
    
    // Map the results to the expected format
    const results: Array<VectorStoreItem & { score: number }> = data.map(item => ({
      id: item.id,
      document_id: item.document_id,
      chunk_index: item.chunk_index,
      text: item.text || '',
      originalText: item.content || '',
      metadata: item.metadata || {},
      embedding: [], // Empty embedding for efficiency
      score: item.combined_score || 0,
      search_type: item.search_type || ''
    }));
    
    // Prepare facets if requested
    let facetsData = undefined;
    if (options?.includeFacets) {
      facetsData = await fetchFacetsFromItems(data || []);
    }
    
    // Prepare the final response object
    const response: HybridSearchResponse = {
      results,
      // @ts-ignore - Linter incorrectly expects entities to be an array here
      facets: facetsData ? {
        ...facetsData,
        entities: facetsData.entities
      } : undefined,
      [Symbol.iterator]: function*() {
        for (const item of results) {
          yield item;
        }
      }
    };
    
    return response;
  } catch (error) {
    logError('Error in hybridSearch', error);
    
    // Return empty results with correct structure when error occurs
    const errorResponse: HybridSearchResponse = {
      results: [],
      [Symbol.iterator]: function* () {
      for (const result of this.results) {
        yield result;
      }
    }
  };
  
    if (options.includeFacets) {
      errorResponse.facets = {
        categories: [],
        entities: {},
        technicalLevels: []
      };
    }
    
    return errorResponse;
  }
}

/**
 * Fallback search function when embedding generation fails
 */
export async function fallbackSearch(
  query: string
): Promise<(VectorStoreItem & { score: number })[]> {
  if (!query || query.trim() === '') {
    return [];
  }
  
  try {
    // Use keyword_search RPC function as fallback
    const { data, error } = await getSupabaseAdmin().rpc('keyword_search', {
      query_text: query,
      match_count: 10
    });
    
    if (error) {
      logError('Error during fallback search RPC call', error);
      return [];
    }
    
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    // Map the results to the expected format
    const results: Array<VectorStoreItem & { score: number }> = data.map(item => ({
      id: item.id,
      document_id: item.document_id,
      chunk_index: item.chunk_index,
      text: item.text || '',
      originalText: item.content || '',
      metadata: item.metadata || {},
      embedding: [], // Empty embedding for efficiency
      score: item.rank || 0 // Use rank as score
    }));
  
  return results;
  } catch (error) {
    logError('Error in fallbackSearch', error);
    return [];
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
      entities: { all: [] },
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
        entities: { all: [] },
        technicalLevels: []
      };
    }
    
    if (!data || !Array.isArray(data)) {
      return {
        categories: [],
        entities: { all: [] },
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
      entities: { all: allEntities },
      technicalLevels: getTechnicalLevelDistribution(documents)
    };
  } catch (error) {
    logError('Error generating facets', error);
    return {
      categories: [],
      entities: { all: [] },
      technicalLevels: []
    };
  }
} 