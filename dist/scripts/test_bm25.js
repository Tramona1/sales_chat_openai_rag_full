"use strict";
/**
 * Test script for BM25 implementation
 * This demonstrates the BM25 scoring functionality on sample queries
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bm25_1 = require("../utils/bm25");
const tokenization_1 = require("../utils/tokenization");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
/**
 * Load the vector store content
 */
async function loadVectorStore() {
    try {
        // Try loading from single vectorStore.json file
        const singleStoreFile = path_1.default.join(process.cwd(), 'data', 'vectorStore.json');
        const fileExists = await promises_1.default.access(singleStoreFile).then(() => true).catch(() => false);
        if (fileExists) {
            const fileData = await promises_1.default.readFile(singleStoreFile, 'utf8');
            const parsedData = JSON.parse(fileData);
            if (Array.isArray(parsedData)) {
                return parsedData;
            }
            else if (parsedData.items && Array.isArray(parsedData.items)) {
                return parsedData.items;
            }
        }
        console.log('No vector store file found or empty store');
        return [];
    }
    catch (error) {
        console.error('Error loading vector store:', error);
        return [];
    }
}
/**
 * Run a search query using BM25
 */
async function searchBM25(query, limit = 5) {
    try {
        // Load corpus statistics
        const corpusStats = await (0, bm25_1.loadCorpusStatistics)();
        // Load vector store
        const vectorStore = await loadVectorStore();
        console.log(`Loaded ${vectorStore.length} documents and corpus statistics with ${Object.keys(corpusStats.documentFrequency).length} terms`);
        // Calculate BM25 scores for each item
        console.log(`Calculating BM25 scores for query: "${query}"`);
        console.log(`Tokenized query: [${(0, tokenization_1.tokenize)(query).join(', ')}]`);
        const scoredItems = vectorStore.map(item => {
            var _a;
            return ({
                item,
                score: (0, bm25_1.calculateBM25Score)(query, { id: ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'unknown', text: item.text }, corpusStats)
            });
        });
        // Sort by score (descending)
        const sortedItems = scoredItems.sort((a, b) => b.score - a.score);
        // Take top results
        return sortedItems.slice(0, limit);
    }
    catch (error) {
        console.error('Error searching with BM25:', error);
        return [];
    }
}
/**
 * Main function to test BM25 search
 */
async function testBM25() {
    console.log('Testing BM25 scoring...');
    // Define some test queries
    const queries = [
        'What is the pricing for enterprise customers?',
        'How does your platform handle security?',
        'What makes your product better than competitors?',
        'Do you offer discounts for non-profits?',
        'Tell me about your customer support options'
    ];
    // Run each query
    for (const query of queries) {
        console.log('\n===============================================');
        console.log(`QUERY: ${query}`);
        console.log('===============================================');
        const results = await searchBM25(query, 3);
        // Display results
        if (results.length === 0) {
            console.log('No results found');
        }
        else {
            results.forEach((result, index) => {
                var _a;
                console.log(`\nRESULT ${index + 1} - Score: ${result.score.toFixed(4)}`);
                console.log(`Source: ${((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'unknown'}`);
                console.log(`Text: ${result.item.text.substring(0, 300)}${result.item.text.length > 300 ? '...' : ''}`);
            });
        }
    }
}
// Run the test
testBM25().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
