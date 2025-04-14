/**
 * Query Router Module
 *
 * This module provides functionality to route queries to the appropriate retrieval strategy
 * based on query analysis, metadata, and category information.
 */
import { analyzeQuery, getRetrievalParameters, analyzeVisualQuery } from './queryAnalysis';
// NOTE: QueryAnalysis is imported from '../types/queryAnalysis' but LocalQueryAnalysis is defined locally
//       Ensure you are using the correct type throughout or reconcile the definitions.
// import { QueryAnalysis } from '../types/queryAnalysis'; // REMOVED - Using LocalQueryAnalysis instead
// import { DocumentCategory } from '../types/metadata'; // Make sure this is exported from the types file - Removed as DocumentCategoryType is used
import { 
// performHybridSearch, // Using `hybridSearch` from `hybridSearch.ts` instead based on previous files
hybridSearch } from './hybridSearch'; // Make sure path is correct
import { rerankWithGemini } from './reranking'; // Make sure path is correct
import { expandQuery } from './queryExpansion'; // Make sure path is correct
import { logError, logInfo } from './logger'; // Make sure path is correct
// Default search options
const DEFAULT_SEARCH_OPTIONS = {
    limit: 5, // Default limit for final results (used for rerankCount if not specified)
    useQueryExpansion: true,
    useReranking: true,
    rerankCount: 5, // Keep top 5 after reranking by default
    searchLimit: 15, // Fetch more initially for reranking
    applyMetadataFiltering: true,
    fallbackToGeneral: true,
    debug: false
};
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
 * @param query The user query
 * @param options Search options
 * @returns The search results
 */
export async function routeQuery(query, options = {}) {
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
        // Use LocalQueryAnalysis type if that's what analyzeQuery returns
        const queryAnalysis = await analyzeQuery(query);
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
        const searchFilter = searchOptions.applyMetadataFiltering ? {
            // Map categories correctly if needed
            // Example: Assuming retrievalParams.categoryFilter.categories are strings matching DocumentCategoryType
            primaryCategory: queryAnalysis.primaryCategory, // Adapt if needed
            secondaryCategories: queryAnalysis.secondaryCategories, // Adapt if needed
            // Widen the technical level range by 1 in each direction to be more inclusive
            technicalLevelMin: Math.max(1, (retrievalParams.technicalLevelRange?.min || 1) - 1),
            technicalLevelMax: Math.min(10, (retrievalParams.technicalLevelRange?.max || 3) + 1), // Assuming 1-10 scale now
            // Add other potential filters from retrievalParams if applicable
            // requiredEntities: retrievalParams.entityFilter?.entities // Example
        } : {}; // Empty object if not applying filters
        // Prepare options for hybridSearch
        const hybridSearchOptions = {
            limit: searchOptions.searchLimit, // Use searchLimit before reranking
            vectorWeight: retrievalParams.hybridRatio,
            keywordWeight: 1.0 - retrievalParams.hybridRatio, // Ensure weights sum to 1
            matchThreshold: retrievalParams.matchThreshold ?? 0.2, // Restore: Use threshold from params or default 0.2
            filter: Object.keys(searchFilter).length > 0 ? searchFilter : undefined, // Only pass filter if not empty
            // includeFacets: false // Default
        };
        // Call hybridSearch (make sure this is the function handling RPC call)
        const searchResponse = await hybridSearch(expandedQuery, // Use expanded query here
        hybridSearchOptions);
        // Extract the initial results array
        const initialResults = searchResponse.results || [];
        const searchTime = Date.now() - searchStartTime;
        currentTime = Date.now();
        if (searchOptions.debug) {
            console.log(`[RouteQuery] Hybrid search completed in ${searchTime}ms`);
            console.log(`[RouteQuery] Found ${initialResults.length} initial results`);
        }
        // ****************************************************************
        // *** ADDED LOGGING BEFORE RERANKING ***
        // ****************************************************************
        logInfo(`[RouteQuery] Results BEFORE rerank (${initialResults?.length || 0}):`, JSON.stringify(initialResults?.map(r => ({
            id: r.id,
            score: r.score?.toFixed(4), // Format initial combined score
            vectorScore: r.vectorScore?.toFixed(4), // Log vector score too
            bm25Score: r.bm25Score?.toFixed(4), // Log keyword score too
            docId: r.document_id // Useful for tracing
        })) || [], null, 2));
        // Log full details of top few initial results if needed for deeper debugging
        if (initialResults && initialResults.length > 0 && searchOptions.debug) {
            logInfo(`[RouteQuery] Top initial result details:`, JSON.stringify(initialResults[0], null, 2));
        }
        // Step 5: Optionally re-rank results
        let finalResults = []; // Initialize as empty array
        let rerankingTime = 0;
        // Map initial results to MultiModalSearchResult[] format expected by reranker
        const resultsForReranker = initialResults.map(result => ({
            item: {
                id: result.id || `missing-id-${Math.random()}`, // Ensure ID exists
                text: result.text || result.originalText || '', // Ensure text exists
                metadata: result.metadata || {}, // Ensure metadata exists
                // Map other potential fields if your reranker uses them directly from item
                // e.g., visualContent might be here already if hybridSearch returns it
            },
            score: result.score || 0, // The initial combined score
            // Add other potential fields if hybridSearch returns them
            // e.g., matchType: result.search_type
        }));
        if (searchOptions.useReranking && retrievalParams.rerank && resultsForReranker.length > 0) {
            const rerankingStartTime = currentTime;
            // Check if the query has visual focus
            const visualQueryAnalysis = analyzeVisualQuery(queryForReranking); // Use original query
            // Configure reranking options
            const rerankOptions = {
                limit: searchOptions.rerankCount, // Use rerankCount for the final limit
                includeScores: true,
                useVisualContext: true, // Enable visual context by default
                visualFocus: visualQueryAnalysis.isVisualQuery,
                visualTypes: visualQueryAnalysis.visualTypes,
                timeoutMs: 10000 // Use a reasonable timeout
            };
            logInfo(`[RouteQuery] Reranking ${resultsForReranker.length} results to get top ${searchOptions.rerankCount}...`);
            // Use the enhanced Gemini-based reranking with proper typing
            const rerankedResults = await rerankWithGemini(queryForReranking, // Use original query for reranking context
            resultsForReranker, // Pass the correctly mapped results
            rerankOptions);
            // Use the reranked results
            finalResults = rerankedResults; // Assign the reranked results
            rerankingTime = Date.now() - rerankingStartTime;
            currentTime = Date.now(); // Update currentTime after reranking
            if (searchOptions.debug) {
                console.log(`[RouteQuery] Reranking completed in ${rerankingTime}ms`);
                console.log(`[RouteQuery] Used multi-modal reranking with visual focus: ${visualQueryAnalysis.isVisualQuery}`);
            }
        }
        else {
            // If not reranking, map initial results to the final format (RankedSearchResult)
            // This might involve just adding default/original scores if needed downstream
            logInfo(`[RouteQuery] Skipping reranking. Using initial search results.`);
            finalResults = resultsForReranker.map(r => ({
                ...r,
                originalScore: r.score,
                // Add explanation or metadata if needed for consistency, otherwise keep simple
                item: {
                    ...r.item,
                    metadata: {
                        ...r.item.metadata,
                        rerankScore: r.score, // In this case, same as original
                        originalScore: r.score
                    }
                }
            })).sort((a, b) => (b.score || 0) - (a.score || 0)) // Still sort by initial score
                .slice(0, searchOptions.limit); // Apply final limit
        }
        // ****************************************************************
        // *** ADDED LOGGING AFTER RERANKING (or skipping reranking) ***
        // ****************************************************************
        logInfo(`[RouteQuery] Results AFTER rerank/final processing (${finalResults?.length || 0}):`, JSON.stringify(finalResults?.map(r => ({
            id: r.item?.id,
            finalScore: r.score?.toFixed(4), // Reranked score (or initial if skipped)
            originalScore: r.originalScore?.toFixed(4), // Score from hybridSearch
            explanation: r.explanation // Include reason from reranker if available
        })) || [], null, 2));
        // Log full details of top final result if needed
        if (finalResults && finalResults.length > 0 && searchOptions.debug) {
            logInfo(`[RouteQuery] Top final result details:`, JSON.stringify(finalResults[0], null, 2));
        }
        // Calculate total processing time
        const totalTime = Date.now() - startTime;
        // Return final results and metadata
        return {
            results: finalResults, // Return the potentially reranked and limited results
            queryAnalysis: queryAnalysis, // Return LocalQueryAnalysis
            processingTime: {
                analysis: analysisTime,
                expansion: expansionTime > 0 ? expansionTime : undefined,
                search: searchTime,
                reranking: rerankingTime > 0 ? rerankingTime : undefined,
                total: totalTime
            }
        };
    }
    catch (error) {
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
export function formatResults(results) {
    if (!results)
        return [];
    return results.map(result => ({
        text: result.item?.text || result.item?.originalText || '',
        source: result.item?.metadata?.source || 'Unknown',
        metadata: result.item?.metadata || {},
        relevanceScore: result.score || 0,
        visualContent: result.item?.visualContent // Access visualContent if it exists
    }));
}
/**
 * Generate a brief explanation of search strategy based on query analysis
 * NOTE: Ensure queryAnalysis object has the required fields
 */
export function explainSearchStrategy(queryAnalysis) {
    if (!queryAnalysis)
        return "Standard search strategy applied.";
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
        }
        else if (retrievalParams.hybridRatio < 0.3) {
            explanation += 'Semantic similarity was emphasized. ';
        }
        else {
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
