/**
 * Hybrid Search Module for Smart Query Routing with Supabase Backend
 *
 * This module uses Supabase's PostgreSQL functions for vector search, keyword search,
 * and hybrid search with metadata-aware filtering.
 */
import { getEmbeddingClient } from './embeddingClient';
import { logError, logInfo, logWarning } from './logger';
import { DocumentCategoryType } from './documentCategories';
import { buildCategoryHierarchyWithCounts, getAllEntitiesFromDocuments, getTechnicalLevelDistribution } from './hierarchicalCategories';
// Import Supabase client - use admin client for access to RPC functions
import { getSupabaseAdmin } from './supabaseClient';
/**
 * Initialize the hybrid search system - minimal initialization since we're using Supabase
 */
export async function initializeHybridSearch() {
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
    }
    catch (error) {
        logError('Failed to initialize hybrid search with Supabase', error);
        throw new Error('Failed to initialize hybrid search system');
    }
}
/**
 * @deprecated Use hybridSearch with HybridSearchOptions instead
 * Perform hybrid search using Supabase's hybrid_search RPC function
 */
export async function performHybridSearch(query, limit = 10, hybridRatio = 0.5, // Controls the balance between vector and keyword search
filter) {
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
        bm25Score: item.bm25Score || 0
    })));
}
/**
 * Convert HybridSearchFilter to a JSON filter suitable for the Supabase RPC call
 * Ensures standardized category handling for both primary and secondary categories
 */
function convertFilterToJson(filter) {
    if (!filter)
        return null;
    const jsonFilter = {};
    // Assign primaryCategory directly if it exists
    if (filter.primaryCategory && Object.values(DocumentCategoryType).includes(filter.primaryCategory)) {
        jsonFilter.primaryCategory = filter.primaryCategory;
    }
    // Assign secondaryCategories directly if they exist and are valid
    if (filter.secondaryCategories && filter.secondaryCategories.length > 0) {
        const validSecondaryCategories = filter.secondaryCategories
            .filter(cat => cat && Object.values(DocumentCategoryType).includes(cat)); // Ensure valid enum members
        if (validSecondaryCategories.length > 0) {
            jsonFilter.secondaryCategories = validSecondaryCategories;
        }
    }
    // Set strictCategoryMatch if available (assuming the RPC expects this key)
    if (filter.strictCategoryMatch !== undefined) {
        jsonFilter.strict_category_match = filter.strictCategoryMatch;
    }
    // Assign technical level filters directly (1-5 scale)
    if (filter.technicalLevelMin !== undefined) {
        // Ensure min is at least 1
        jsonFilter.technicalLevelMin = Math.max(1, filter.technicalLevelMin);
    }
    if (filter.technicalLevelMax !== undefined) {
        // Ensure max is at most 5
        jsonFilter.technicalLevelMax = Math.min(5, filter.technicalLevelMax);
    }
    // Ensure min <= max if both are provided and adjust max if needed
    if (jsonFilter.technicalLevelMin !== undefined && jsonFilter.technicalLevelMax !== undefined && jsonFilter.technicalLevelMin > jsonFilter.technicalLevelMax) {
        logWarning('Technical level min filter > max filter, adjusting max to match min.');
        jsonFilter.technicalLevelMax = jsonFilter.technicalLevelMin;
    }
    // Assign entity filters directly
    if (filter.requiredEntities && filter.requiredEntities.length > 0) {
        jsonFilter.entities = filter.requiredEntities;
    }
    // Assign keyword filters directly
    if (filter.keywords && filter.keywords.length > 0) {
        jsonFilter.keywords = filter.keywords;
    }
    // Assign custom filters directly (assuming RPC expects 'custom' key for this)
    if (filter.customFilters && Object.keys(filter.customFilters).length > 0) {
        jsonFilter.custom = filter.customFilters; // Keep nested under 'custom' based on original logic
    }
    return Object.keys(jsonFilter).length > 0 ? jsonFilter : null;
}
/**
 * Main hybrid search function with support for facets and filters
 */
export async function hybridSearch(query, options = {}) {
    if (!query || query.trim() === '') {
        // Return empty results with correct structure
        const emptyResponse = {
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
        // Get embedding client and specify retrieval query task type
        const embeddingClient = getEmbeddingClient();
        // Generate embedding for the query with proper task type
        const queryEmbedding = await embeddingClient.embedText(query, 'RETRIEVAL_QUERY');
        // Prepare options and weights
        const limit = options.limit || 10;
        const vectorWeight = options.vectorWeight !== undefined ? options.vectorWeight : 0.5;
        const keywordWeight = options.keywordWeight !== undefined ? options.keywordWeight : 0.5;
        const matchThreshold = options.matchThreshold || 0.7;
        // Prepare filter based on options
        let filter = {};
        // Convert between filter formats if needed
        if (options.filter) {
            filter = convertFilterToJson(options.filter);
        }
        else {
            // Handle legacy filter fields
            if (options.categoryPath && options.categoryPath.length > 0) {
                filter.category_path = options.categoryPath;
            }
            if (options.technicalLevelRange) {
                filter.technical_level = {
                    min: options.technicalLevelRange.min,
                    max: options.technicalLevelRange.max
                };
            }
            if (options.entityFilters && Object.keys(options.entityFilters).length > 0) {
                filter.entities = options.entityFilters;
            }
            if (options.includeDeprecated !== undefined) {
                filter.include_deprecated = options.includeDeprecated;
            }
            if (options.onlyAuthoritative !== undefined) {
                filter.only_authoritative = options.onlyAuthoritative;
            }
        }
        // Call Supabase hybrid_search RPC function with parameters matching SQL function
        const { data, error } = await getSupabaseAdmin().rpc('hybrid_search', {
            query_text: query,
            query_embedding: queryEmbedding,
            match_count: limit,
            match_threshold: matchThreshold,
            vector_weight: vectorWeight,
            keyword_weight: keywordWeight,
            filter: filter
        });
        // Log the filter being sent and the response/error received
        logInfo('[hybridSearch] Filter sent to RPC:', filter);
        if (error) {
            logError('[hybridSearch] Error during RPC call:', error);
            throw new Error(`Hybrid search failed: ${error.message}`);
        }
        logInfo('[hybridSearch] Data received from RPC:', data); // Log the raw data
        if (!data || !Array.isArray(data)) {
            // Return empty results with correct structure
            const emptyResponse = {
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
        // Map the results to the expected format with robust field mapping
        const results = data.map(item => ({
            id: item.id,
            document_id: item.document_id,
            chunk_index: item.chunk_index || 0,
            text: item.text || item.content || '',
            originalText: item.original_text || item.content || '',
            metadata: item.metadata || {},
            embedding: [], // Empty embedding for efficiency
            score: item.combined_score || item.similarity || 0,
            vectorScore: item.vector_score || 0,
            bm25Score: item.keyword_score || 0,
            search_type: item.search_type || 'hybrid'
        }));
        // Prepare facets if requested
        let facetsData = undefined;
        if (options?.includeFacets) {
            facetsData = await fetchFacetsFromItems(data || []);
        }
        // Prepare the final response object
        const response = {
            results,
            facets: facetsData ? {
                categories: facetsData.categories,
                entities: facetsData.entities,
                technicalLevels: facetsData.technicalLevels
            } : undefined,
        };
        return response;
    }
    catch (error) {
        logError('Error in hybridSearch', error);
        // Try fallback search if hybrid search fails
        try {
            logWarning('Attempting keyword-only fallback search');
            const fallbackResults = await fallbackSearch(query);
            // Create a response with the fallback results
            const fallbackResponse = {
                results: fallbackResults.map(item => ({
                    ...item,
                    vectorScore: 0,
                    bm25Score: item.score || 0
                })),
            };
            return fallbackResponse;
        }
        catch (fallbackError) {
            logError('Fallback search also failed', fallbackError);
        }
        // Return empty results with correct structure when error occurs
        const errorResponse = {
            results: [],
        };
        if (options.includeFacets) {
            errorResponse.facets = {
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
        return errorResponse;
    }
}
/**
 * Fallback search function when embedding generation fails
 */
export async function fallbackSearch(query) {
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
        // Map the results to the expected format with robust field mapping
        const results = data.map(item => ({
            id: item.id,
            document_id: item.document_id,
            chunk_index: item.chunk_index || 0,
            text: item.text || item.content || '',
            originalText: item.original_text || item.content || '',
            metadata: item.metadata || {},
            embedding: [], // Empty embedding for efficiency
            score: item.rank || item.similarity || 0
        }));
        return results;
    }
    catch (error) {
        logError('Error in fallbackSearch', error);
        return [];
    }
}
/**
 * Fetch facet information for search results
 */
async function fetchFacetsFromItems(items) {
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
            text: '', // Not needed for facets
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
    }
    catch (error) {
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
