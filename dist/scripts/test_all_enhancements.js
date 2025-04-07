"use strict";
/**
 * Comprehensive test script for evaluating all RAG system enhancements
 *
 * This script compares the full enhanced RAG system (hybrid search + re-ranking + query expansion)
 * against the baseline vector-only approach to demonstrate the improvements in result quality.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const test_queries_1 = require("../utils/test_queries");
const openaiClient_1 = require("../utils/openaiClient");
const enhancedRetrieval_1 = require("../utils/enhancedRetrieval");
const reranking_1 = require("../utils/reranking");
const queryExpansion_1 = require("../utils/queryExpansion");
const vectorStore_1 = require("../utils/vectorStore");
// Load environment variables
dotenv_1.default.config();
// Test configuration
const VERBOSE = true; // Set to true for detailed output
const TEST_SUBSET = 10; // Number of queries to test from the full set
// Initialize the enhanced retrieval system
const enhancedRetrieval = new enhancedRetrieval_1.EnhancedRetrieval({
    bm25Weight: 0.3,
    minBM25Score: 0.01,
    minVectorScore: 0.6,
    normalizeScores: true,
    maxResults: 10
});
/**
 * Run baseline vector search (original approach)
 */
async function runBaselineSearch(query, topK = 5) {
    // Generate embedding for the query
    const queryEmbedding = await (0, openaiClient_1.embedText)(query);
    // Get similar items using vector-only search
    const results = (0, vectorStore_1.getSimilarItems)(queryEmbedding, topK, query);
    return results;
}
/**
 * Run enhanced search with all improvements
 */
async function runEnhancedSearch(query, options) {
    try {
        // Step 1: Apply query expansion if enabled
        let queryForRetrieval = query;
        let expansion = null;
        if (options.useQueryExpansion) {
            const expandedQueryResult = await (0, queryExpansion_1.expandQuery)(query, {
                useSemanticExpansion: true,
                useKeywordExpansion: true,
                maxExpandedTerms: 3,
                timeoutMs: 3000
            });
            if (expandedQueryResult.expansionType !== 'none') {
                queryForRetrieval = expandedQueryResult.expandedQuery;
                expansion = expandedQueryResult;
                if (VERBOSE) {
                    console.log(`Original query: "${query}"`);
                    console.log(`Expanded query: "${queryForRetrieval}"`);
                    console.log(`Added terms: ${expandedQueryResult.addedTerms.join(', ')}`);
                }
            }
        }
        // Step 2: Get hybrid search results (BM25 + vector)
        const retrievalResults = await enhancedRetrieval.findSimilarDocuments(queryForRetrieval, {
            maxResults: 10
        });
        // Step 3: Apply re-ranking if enabled
        if (options.useReranking && retrievalResults.length > 1) {
            const rerankedResults = await (0, reranking_1.rerankResults)(query, retrievalResults, {
                returnTopN: 5,
                model: 'gpt-3.5-turbo',
                parallelBatching: true,
                timeoutMs: 6000
            });
            // Return the original results from the reranked results
            return rerankedResults.map(result => result.originalResult);
        }
        // Return the hybrid search results if re-ranking is disabled
        return retrievalResults;
    }
    catch (error) {
        console.error('Error in enhanced search:', error);
        return [];
    }
}
/**
 * Compare search results to evaluate improvement
 */
function compareResults(baselineResults, enhancedResults) {
    // Extract sources for comparison and filter out undefined values
    const baselineSources = baselineResults
        .map(r => { var _a; return (_a = r.metadata) === null || _a === void 0 ? void 0 : _a.source; })
        .filter((source) => typeof source === 'string');
    const enhancedSources = enhancedResults
        .map(r => { var _a; return (_a = r.item.metadata) === null || _a === void 0 ? void 0 : _a.source; })
        .filter((source) => typeof source === 'string');
    // Count overlapping sources
    const common = baselineSources.filter(s => enhancedSources.includes(s));
    const overlapCount = common.length;
    const overlapPercentage = (overlapCount / Math.max(baselineSources.length, 1)) * 100;
    // Check if ranking changed
    const changedRanking = baselineSources.length > 0 &&
        enhancedSources.length > 0 &&
        baselineSources[0] !== enhancedSources[0];
    return {
        overlapCount,
        overlapPercentage,
        baselineSources,
        enhancedSources,
        changedRanking
    };
}
/**
 * Main test function
 */
async function runTests() {
    var _a, _b;
    console.log('Starting comprehensive RAG enhancement evaluation...');
    console.log('='.repeat(80));
    try {
        // Initialize the enhanced retrieval system
        await enhancedRetrieval.initialize();
        console.log('Enhanced retrieval system initialized\n');
        // Select a subset of test queries
        const testQueries = test_queries_1.TEST_QUERIES.slice(0, TEST_SUBSET);
        // Summary statistics
        const stats = {
            totalQueries: testQueries.length,
            changedTopResult: 0,
            averageOverlap: 0,
            improvedQueries: 0
        };
        // Run tests for each query
        for (let i = 0; i < testQueries.length; i++) {
            const query = testQueries[i].query;
            console.log(`\n[${i + 1}/${testQueries.length}] Testing query: "${query}"`);
            console.log('-'.repeat(80));
            // 1. Run baseline vector search
            console.log('Running baseline vector search...');
            const baselineStart = Date.now();
            const baselineResults = await runBaselineSearch(query, 5);
            const baselineTime = Date.now() - baselineStart;
            console.log(`Found ${baselineResults.length} results in ${baselineTime}ms with vector search`);
            // 2. Run search with just hybrid search (BM25 + vector, no re-ranking or expansion)
            console.log('\nRunning hybrid search (BM25 + vector)...');
            const hybridStart = Date.now();
            const hybridResults = await runEnhancedSearch(query, {
                useReranking: false,
                useQueryExpansion: false
            });
            const hybridTime = Date.now() - hybridStart;
            console.log(`Found ${hybridResults.length} results in ${hybridTime}ms with hybrid search`);
            // 3. Run search with hybrid + re-ranking (no expansion)
            console.log('\nRunning hybrid search + re-ranking...');
            const rerankStart = Date.now();
            const rerankResults = await runEnhancedSearch(query, {
                useReranking: true,
                useQueryExpansion: false
            });
            const rerankTime = Date.now() - rerankStart;
            console.log(`Found ${rerankResults.length} results in ${rerankTime}ms with hybrid search + re-ranking`);
            // 4. Run search with all enhancements (hybrid + re-ranking + expansion)
            console.log('\nRunning with ALL enhancements (hybrid + re-ranking + query expansion)...');
            const fullStart = Date.now();
            const fullResults = await runEnhancedSearch(query, {
                useReranking: true,
                useQueryExpansion: true
            });
            const fullTime = Date.now() - fullStart;
            console.log(`Found ${fullResults.length} results in ${fullTime}ms with all enhancements`);
            // 5. Compare results
            console.log('\nRESULT COMPARISON:');
            // Baseline vs Hybrid
            const hybridComparison = compareResults(baselineResults, hybridResults);
            console.log(`Baseline vs Hybrid: ${hybridComparison.overlapCount}/${baselineResults.length} common results (${hybridComparison.overlapPercentage.toFixed(1)}%)`);
            console.log(`Top result changed: ${hybridComparison.changedRanking ? 'YES' : 'NO'}`);
            // Baseline vs Full Enhancement
            const fullComparison = compareResults(baselineResults, fullResults);
            console.log(`Baseline vs All Enhancements: ${fullComparison.overlapCount}/${baselineResults.length} common results (${fullComparison.overlapPercentage.toFixed(1)}%)`);
            console.log(`Top result changed: ${fullComparison.changedRanking ? 'YES' : 'NO'}`);
            // Update statistics
            if (fullComparison.changedRanking) {
                stats.changedTopResult++;
            }
            stats.averageOverlap += fullComparison.overlapPercentage;
            // Look at the top result details
            console.log('\nTop result comparison:');
            if (baselineResults.length > 0) {
                console.log(`Baseline top result: ${((_a = baselineResults[0].metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown'}`);
                console.log(`  ${baselineResults[0].text.substring(0, 100)}...`);
            }
            if (fullResults.length > 0) {
                console.log(`Enhanced top result: ${((_b = fullResults[0].item.metadata) === null || _b === void 0 ? void 0 : _b.source) || 'Unknown'}`);
                console.log(`  ${fullResults[0].item.text.substring(0, 100)}...`);
            }
            // Performance comparison
            console.log('\nPerformance comparison:');
            console.log(`- Baseline (vector): ${baselineTime}ms`);
            console.log(`- Hybrid (BM25 + vector): ${hybridTime}ms`);
            console.log(`- Hybrid + re-ranking: ${rerankTime}ms`);
            console.log(`- All enhancements: ${fullTime}ms`);
            console.log('='.repeat(80));
        }
        // Calculate final statistics
        stats.averageOverlap = stats.averageOverlap / stats.totalQueries;
        // Print summary
        console.log('\nEVALUATION SUMMARY:');
        console.log(`Total queries tested: ${stats.totalQueries}`);
        console.log(`Queries with changed top result: ${stats.changedTopResult} (${((stats.changedTopResult / stats.totalQueries) * 100).toFixed(1)}%)`);
        console.log(`Average results overlap: ${stats.averageOverlap.toFixed(1)}%`);
        console.log(`Performance impact:`);
        console.log(`- Hybrid search typically adds ~100-200ms`);
        console.log(`- Re-ranking typically adds ~500-2000ms`);
        console.log(`- Query expansion typically adds ~200-500ms`);
    }
    catch (error) {
        console.error('Error in test execution:', error);
    }
}
// Run the tests
runTests().catch(console.error);
