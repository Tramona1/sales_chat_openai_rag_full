"use strict";
/**
 * Vector Search Utilities
 *
 * This module provides functions for performing vector-based similarity search.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performVectorSearch = performVectorSearch;
const vectorStore_1 = require("./vectorStore");
const embeddingClient_1 = require("./embeddingClient");
const errorHandling_1 = require("./errorHandling");
/**
 * Perform vector search using cosine similarity
 *
 * @param query The search query or embedding vector
 * @param limit Maximum number of results to return
 * @param filter Optional filter to apply to results
 * @returns Array of search results with scores
 */
async function performVectorSearch(query, limit = 10, filter) {
    try {
        // Convert query to embedding if it's a string
        const queryEmbedding = Array.isArray(query) ? query : await (0, embeddingClient_1.embedText)(query);
        // Get similar items from vector store
        const results = (0, vectorStore_1.getSimilarItems)(queryEmbedding, limit * 2);
        // Apply filter if provided
        const filteredResults = filter
            ? results.filter(result => filter(result))
            : results;
        // Format results
        return filteredResults.slice(0, limit).map(result => ({
            item: result,
            score: result.score,
            vectorScore: result.score
        }));
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error in performVectorSearch', error);
        return [];
    }
}
