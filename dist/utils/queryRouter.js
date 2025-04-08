"use strict";
/**
 * Query Router Module
 *
 * This module provides functionality to route queries to the appropriate retrieval strategy
 * based on query analysis, metadata, and category information.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeQuery = routeQuery;
exports.formatResults = formatResults;
exports.explainSearchStrategy = explainSearchStrategy;
const queryAnalysis_1 = require("./queryAnalysis");
const hybridSearch_1 = require("./hybridSearch");
const reranking_1 = require("./reranking");
const queryExpansion_1 = require("./queryExpansion");
const errorHandling_1 = require("./errorHandling");
// Default search options
const DEFAULT_SEARCH_OPTIONS = {
    limit: 10,
    useQueryExpansion: true,
    useReranking: true,
    rerankCount: 5,
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
 * 5. Optionally re-ranks the results
 *
 * @param query The user query
 * @param options Search options
 * @returns The search results
 */
async function routeQuery(query, options = {}) {
    var _a, _b, _c, _d;
    // Merge options with defaults
    const searchOptions = { ...DEFAULT_SEARCH_OPTIONS, ...options };
    const startTime = Date.now();
    let currentTime = startTime;
    try {
        // Step 1: Analyze query
        const analysisStartTime = currentTime;
        const queryAnalysis = await (0, queryAnalysis_1.analyzeQuery)(query);
        const analysisTime = Date.now() - analysisStartTime;
        currentTime = Date.now();
        if (searchOptions.debug) {
            console.log(`Query analysis completed in ${analysisTime}ms`);
            console.log('Primary category:', queryAnalysis.primaryCategory);
            console.log('Query type:', queryAnalysis.queryType);
            console.log('Technical level:', queryAnalysis.technicalLevel);
        }
        // Step 2: Get retrieval parameters based on analysis
        const retrievalParams = (0, queryAnalysis_1.getRetrievalParameters)(queryAnalysis);
        // Step 3: Optionally expand the query
        let expandedQuery = query;
        let expansionTime = 0;
        if (searchOptions.useQueryExpansion && retrievalParams.expandQuery) {
            const expansionStartTime = currentTime;
            const expansion = await (0, queryExpansion_1.expandQuery)(query, {
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
            categories: ((_a = retrievalParams.categoryFilter) === null || _a === void 0 ? void 0 : _a.strict) ?
                ((_b = retrievalParams.categoryFilter) === null || _b === void 0 ? void 0 : _b.categories) || [] :
                [], // No category filtering unless strict mode
            strictCategoryMatch: false, // Always use lenient category matching
            // Widen the technical level range by 1 in each direction to be more inclusive
            technicalLevelMin: Math.max(1, (((_c = retrievalParams.technicalLevelRange) === null || _c === void 0 ? void 0 : _c.min) || 1) - 1),
            technicalLevelMax: Math.min(5, (((_d = retrievalParams.technicalLevelRange) === null || _d === void 0 ? void 0 : _d.max) || 5) + 1)
        } : undefined;
        const searchResults = await (0, hybridSearch_1.performHybridSearch)(expandedQuery, searchOptions.limit || 10, retrievalParams.hybridRatio, searchFilter);
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
            finalResults = await (0, reranking_1.rerank)(query, searchResults, // Use original search results - conversion handled in rerank
            searchOptions.rerankCount || 5);
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
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error in query routing', error instanceof Error ? error.message : String(error));
        throw error;
    }
}
/**
 * Converts search results to a format suitable for the response
 */
function formatResults(results) {
    return results.map(result => {
        var _a, _b, _c;
        return ({
            text: result.item.text,
            source: ((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown',
            metadata: {
                ...result.item.metadata,
                category: ((_b = result.item.metadata) === null || _b === void 0 ? void 0 : _b.category) || 'Unknown',
                technicalLevel: ((_c = result.item.metadata) === null || _c === void 0 ? void 0 : _c.technicalLevel) || 1
            },
            relevanceScore: result.score
        });
    });
}
/**
 * Generate a brief explanation of search strategy based on query analysis
 */
function explainSearchStrategy(queryAnalysis) {
    var _a, _b, _c;
    const retrievalParams = (0, queryAnalysis_1.getRetrievalParameters)(queryAnalysis);
    let explanation = `This query was identified as primarily about ${queryAnalysis.primaryCategory} `;
    explanation += `with a technical level of ${queryAnalysis.technicalLevel}/10. `;
    if (retrievalParams.hybridRatio > 0.7) {
        explanation += 'Keyword matching was emphasized for better precision. ';
    }
    else if (retrievalParams.hybridRatio < 0.3) {
        explanation += 'Semantic similarity was emphasized for better recall. ';
    }
    else {
        explanation += 'A balanced approach between keywords and semantic similarity was used. ';
    }
    if ((_a = retrievalParams.categoryFilter) === null || _a === void 0 ? void 0 : _a.strict) {
        explanation += `Results were strictly filtered to the ${retrievalParams.categoryFilter.categories.join(', ')} category. `;
    }
    else if ((_c = (_b = retrievalParams.categoryFilter) === null || _b === void 0 ? void 0 : _b.categories) === null || _c === void 0 ? void 0 : _c.length) {
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
