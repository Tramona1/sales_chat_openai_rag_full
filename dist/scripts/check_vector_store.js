"use strict";
/**
 * Script to check if investor information exists in the vector store
 * This will help us understand if the issue is missing data or retrieval problems
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vectorStore_1 = require("../utils/vectorStore");
const openaiClient_1 = require("../utils/openaiClient");
// Search terms to look for
const INVESTOR_RELATED_TERMS = [
    'investor', 'funding', 'investment', 'venture capital', 'vc', 'backed by',
    'series a', 'series b', 'funding round', 'invested', 'raised'
];
async function checkVectorStore() {
    var _a;
    console.log('Checking vector store for investor information...');
    try {
        // Get all items from vector store
        const items = await (0, vectorStore_1.getAllVectorStoreItems)();
        console.log(`Vector store contains ${items.length} items`);
        // 1. Text search - look for exact matches
        console.log('\n--- TEXT SEARCH RESULTS ---');
        let textMatches = 0;
        const matchingItems = [];
        for (const item of items) {
            const text = item.text.toLowerCase();
            for (const term of INVESTOR_RELATED_TERMS) {
                if (text.includes(term.toLowerCase())) {
                    textMatches++;
                    matchingItems.push(item);
                    console.log(`Match found for "${term}" in item:`, {
                        source: ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown',
                        excerpt: text.substring(Math.max(0, text.indexOf(term) - 50), Math.min(text.length, text.indexOf(term) + 100))
                    });
                    break; // Only count each item once
                }
            }
        }
        console.log(`Found ${textMatches} items with investor-related terms`);
        // 2. Vector search for "investors"
        console.log('\n--- VECTOR SEARCH RESULTS ---');
        const query = "Who are the investors of Workstream?";
        const queryEmbedding = await (0, openaiClient_1.embedText)(query);
        // Calculate similarity scores
        const results = items
            .filter(item => item.embedding && Array.isArray(item.embedding))
            .map(item => {
            // Calculate cosine similarity
            const similarity = calculateCosineSimilarity(queryEmbedding, item.embedding);
            return {
                item,
                similarity
            };
        })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5);
        console.log(`Top 5 vector search results for "${query}":`);
        results.forEach((result, i) => {
            var _a;
            console.log(`${i + 1}. Similarity: ${result.similarity.toFixed(4)}, Source: ${((_a = result.item.metadata) === null || _a === void 0 ? void 0 : _a.source) || 'Unknown'}`);
            console.log(`   Excerpt: ${result.item.text.substring(0, 150)}...`);
        });
        // 3. Check if we are missing relevant categories
        console.log('\n--- CATEGORY ANALYSIS ---');
        const categories = new Set();
        items.forEach(item => {
            var _a;
            if ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.category) {
                categories.add(item.metadata.category.toString());
            }
        });
        console.log('Available categories in vector store:', Array.from(categories));
        console.log('\nAnalysis complete.');
    }
    catch (error) {
        console.error('Error checking vector store:', error);
    }
}
// Helper function to calculate cosine similarity
function calculateCosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        mag1 += vec1[i] * vec1[i];
        mag2 += vec2[i] * vec2[i];
    }
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    return dotProduct / (mag1 * mag2);
}
// Run the script
checkVectorStore().catch(console.error);
