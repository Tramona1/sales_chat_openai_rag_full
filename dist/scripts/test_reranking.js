"use strict";
/**
 * Test script for the re-ranking implementation
 *
 * This script tests the effectiveness of LLM-based re-ranking of search results.
 * It compares standard hybrid search results with re-ranked results to demonstrate
 * the improvement in relevance quality.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const enhancedRetrieval_1 = require("../utils/enhancedRetrieval");
const reranking_1 = require("../utils/reranking");
// Load environment variables
dotenv_1.default.config();
// Sample test queries covering different domains
const TEST_QUERIES = [
    "What is the pricing for enterprise customers?",
    "What are the security features of your platform?",
    "How does your product compare to competitors?",
    "Do you offer any educational or non-profit discounts?",
    "What kind of customer support options do you provide?"
];
/**
 * Main test function
 */
async function testReranking() {
    var _a, _b, _c, _d;
    console.log('Starting re-ranking tests...');
    console.log('='.repeat(50));
    try {
        // Initialize the enhanced retrieval system (hybrid search)
        const enhancedRetrieval = new enhancedRetrieval_1.EnhancedRetrieval({
            bm25Weight: 0.3, // 30% weight for BM25 scores
            minBM25Score: 0.01, // Minimum score to consider relevant
            minVectorScore: 0.6, // Minimum vector similarity
            normalizeScores: true, // Normalize scores before combining
            maxResults: 8, // Get 8 initial results for re-ranking
            debug: false // Disable debug logging for cleaner output
        });
        // Initialize the system
        await enhancedRetrieval.initialize();
        console.log('Enhanced retrieval system initialized\n');
        // Process each test query
        for (const query of TEST_QUERIES) {
            console.log(`\n${'='.repeat(80)}\nTESTING QUERY: "${query}"\n${'='.repeat(80)}\n`);
            // Step 1: Get hybrid search results
            console.log('Running hybrid search...');
            const hybridResults = await enhancedRetrieval.findSimilarDocuments(query);
            console.log(`Found ${hybridResults.length} results with hybrid search`);
            console.log('\nTop 3 hybrid search results:');
            hybridResults.slice(0, 3).forEach((result, i) => {
                var _a;
                console.log(`\n[${i + 1}] Combined Score: ${result.combinedScore.toFixed(4)} | BM25: ${result.bm25Score.toFixed(4)} | Vector: ${result.vectorScore.toFixed(4)}`);
                console.log(`  Source: ${((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown'}`);
                console.log(`  ${result.item.text.substring(0, 200)}...`);
            });
            // Step 2: Apply re-ranking
            console.log('\nApplying LLM-based re-ranking...');
            const rerankedResults = await (0, reranking_1.rerankResults)(query, hybridResults, {
                returnTopN: 5,
                debug: true
            });
            console.log(`\nRe-ranking complete. ${rerankedResults.length} results after re-ranking`);
            console.log('\nTop 3 re-ranked results:');
            rerankedResults.slice(0, 3).forEach((result, i) => {
                var _a;
                console.log(`\n[${i + 1}] Final Score: ${result.finalScore.toFixed(4)} | Re-rank: ${result.rerankScore.toFixed(2)}/10 | BM25: ${result.originalResult.bm25Score.toFixed(4)} | Vector: ${result.originalResult.vectorScore.toFixed(4)}`);
                console.log(`  Source: ${((_a = result.originalResult.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown'}`);
                console.log(`  ${result.originalResult.item.text.substring(0, 200)}...`);
            });
            // Step 3: Compare top results
            console.log('\nComparing top results before and after re-ranking:');
            const topHybridSource = (_b = (_a = hybridResults[0]) === null || _a === void 0 ? void 0 : _a.item.metadata) === null || _b === void 0 ? void 0 : _b.source;
            const topRerankedSource = (_d = (_c = rerankedResults[0]) === null || _c === void 0 ? void 0 : _c.originalResult.item.metadata) === null || _d === void 0 ? void 0 : _d.source;
            if (topHybridSource === topRerankedSource) {
                console.log('✓ Same top result source');
            }
            else {
                console.log('↺ Different top result sources:');
                console.log(`  - Hybrid: ${topHybridSource || 'Unknown'}`);
                console.log(`  - Re-ranked: ${topRerankedSource || 'Unknown'}`);
            }
            // Calculate result movement
            const hybridSources = hybridResults.slice(0, 5).map(r => { var _a; return (_a = r.item.metadata) === null || _a === void 0 ? void 0 : _a.source; });
            const rerankedSources = rerankedResults.map(r => { var _a; return (_a = r.originalResult.item.metadata) === null || _a === void 0 ? void 0 : _a.source; });
            const movedUp = rerankedSources.filter((source, idx) => {
                const hybridIdx = hybridSources.indexOf(source);
                return hybridIdx > idx && hybridIdx !== -1;
            });
            console.log(`\n${movedUp.length} results moved up in ranking after LLM re-ranking`);
            // Step 4: Get explanations for the top result
            console.log('\nGetting explanation for top re-ranked result:');
            const explanations = await (0, reranking_1.rerankResultsWithExplanations)(query, [hybridResults[0]], {
                model: 'gpt-4' // Use more capable model for detailed explanation
            });
            if (explanations.length > 0) {
                console.log(`\nScore: ${explanations[0].rerankScore}/10`);
                console.log(`Explanation: ${explanations[0].explanation}`);
            }
            console.log('\n' + '-'.repeat(80));
        }
        console.log('\nAll re-ranking tests completed successfully!');
    }
    catch (error) {
        console.error('Error in test:', error);
    }
}
// Run the tests
testReranking().catch(console.error);
