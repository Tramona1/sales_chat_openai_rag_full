"use strict";
/**
 * Test script for retrieving company-specific information
 * This script tests if our RAG system can answer basic company questions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hybridSearch_1 = require("../utils/hybridSearch");
const answerGenerator_1 = require("../utils/answerGenerator");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Sample test queries that cover different aspects
const COMPANY_QUESTIONS = [
    "What is the name of our company?",
    "What are our product pricing tiers?",
    "What is Workstream?",
    "What are the main features of our product?",
    "Who are our clients?",
    "What kind of results do our customers typically report?"
];
/**
 * Run tests for all company-specific queries
 */
async function runTests() {
    var _a;
    console.log('Testing company-specific question answering...');
    console.log('===========================================\n');
    try {
        // Process each test query
        for (const query of COMPANY_QUESTIONS) {
            console.log(`\n==== TESTING COMPANY QUERY: "${query}" ====\n`);
            // 1. Run hybrid search with a strong emphasis on BM25 term matching (0.3)
            // Using a lower hybrid ratio emphasizes keyword matching over vector similarity
            console.log('Running hybrid search with BM25 emphasis...');
            const searchResults = await (0, hybridSearch_1.performHybridSearch)(query, 5, 0.3);
            console.log(`Found ${searchResults.length} results for hybrid search`);
            if (searchResults.length > 0) {
                console.log('\nTop retrieved document:');
                console.log(`Source: ${((_a = searchResults[0].item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown'}`);
                console.log(`Excerpt: ${searchResults[0].item.text.substring(0, 150)}...\n`);
            }
            else {
                console.log('No search results found!\n');
            }
            // 2. Generate an answer
            console.log('Generating answer...');
            const formattedResults = searchResults.map(result => {
                var _a;
                return ({
                    text: result.item.text,
                    source: ((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown',
                    metadata: result.item.metadata,
                    relevanceScore: result.score
                });
            });
            const answer = await (0, answerGenerator_1.generateAnswer)(query, formattedResults, {
                includeSourceCitations: true,
                maxSourcesInAnswer: 3
            });
            console.log('\nAnswer:');
            console.log(answer);
            console.log('\n---------------------------------------');
        }
        console.log('\nAll tests completed successfully!');
    }
    catch (error) {
        console.error('Error running tests:', error);
    }
}
// Run the tests
runTests().catch(console.error);
