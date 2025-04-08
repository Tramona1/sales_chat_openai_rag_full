"use strict";
/**
 * Reranking Module for Smart Query Routing
 *
 * This module applies LLM-based reranking to improve search result ordering.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rerank = rerank;
const openaiClient_1 = require("./openaiClient");
const errorHandling_1 = require("./errorHandling");
/**
 * Reranks search results based on relevance to the query
 *
 * @param query The original user query
 * @param results The search results to rerank
 * @param topK Number of top results to return
 * @param options Optional reranking configuration
 * @returns Reranked results (topK of them)
 */
async function rerank(query, results, topK = results.length, options = {}) {
    // No need to rerank if we have 0 or 1 results
    if (results.length <= 1) {
        return results;
    }
    try {
        // Convert results to HybridSearchResult format if needed
        const hybridResults = results.map((result) => {
            // If it's already a HybridSearchResult, return it as is
            if (result.metadata && result.bm25Score !== undefined && result.vectorScore !== undefined) {
                return result;
            }
            // Otherwise, create a compatible structure
            return {
                item: {
                    ...result.item,
                    // Add required VectorStoreItem fields
                    embedding: result.item.embedding || [], // Empty array if not present
                    id: result.item.id || `result-${Math.random().toString(36).substring(2, 9)}`
                },
                score: result.score,
                bm25Score: result.bm25Score || 0,
                vectorScore: result.vectorScore || 0,
                metadata: {
                    matchesCategory: true,
                    categoryBoost: 0,
                    technicalLevelMatch: 1
                }
            };
        });
        // Default options
        const model = options.model || 'gpt-3.5-turbo';
        const timeoutMs = options.timeoutMs || 10000;
        console.log(`[Reranking] Reranking ${hybridResults.length} results with model: ${model}`);
        // Create prompt for the reranker
        const systemPrompt = `
      You are a Search Result Evaluator. Your task is to rank search results by relevance to the query.
      Assign a score from 0-10 for each result where:
      - 10: Perfect match that directly and comprehensively answers the query
      - 7-9: Highly relevant with most information needed
      - 4-6: Moderately relevant with partial information
      - 1-3: Slightly relevant but missing key information
      - 0: Completely irrelevant
      
      Focus on semantic relevance, factual accuracy, and information completeness.
      
      IMPORTANT: You must respond with a valid JSON array of objects, where each object has resultId and score properties.
    `;
        // Prepare results for evaluation
        const formattedResults = hybridResults.map((result, i) => {
            // Truncate content to a reasonable length for evaluation
            const content = result.item.text.length > 500
                ? result.item.text.substring(0, 500) + '...'
                : result.item.text;
            return `[${i + 1}] ${content}`;
        }).join('\n\n');
        // User prompt with query and results
        const userPrompt = `
      Query: "${query}"
      
      Search Results:
      ${formattedResults}
      
      Evaluate the relevance of each search result to the query. Return a JSON array where each item has:
      - resultId: The result number (1, 2, etc.)
      - score: A relevance score from 0-10
      ${options.includeExplanations ? '- explanation: Brief justification for the score' : ''}
      
      Format your response as a JSON array ONLY, with no additional text. Example:
      [{"resultId": 1, "score": 7.5}, {"resultId": 2, "score": 4.2}]
    `;
        // Set up timeout
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve(null), timeoutMs);
        });
        // Request reranking with timeout
        const rerankerPromise = (0, openaiClient_1.generateStructuredResponse)(systemPrompt, userPrompt, {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    resultId: { type: 'integer' },
                    score: { type: 'number' },
                    explanation: { type: 'string' }
                },
                required: ['resultId', 'score']
            }
        }, model);
        // Race between reranker and timeout
        const rerankerResponse = await Promise.race([rerankerPromise, timeoutPromise]);
        // Handle timeout
        if (!rerankerResponse) {
            console.log(`[Reranking] Timed out after ${timeoutMs}ms, using original order`);
            return hybridResults.slice(0, topK);
        }
        // Ensure rerankerResponse is an array before mapping
        let responseArray = rerankerResponse;
        if (!Array.isArray(rerankerResponse)) {
            console.log(`[Reranking] Response is not an array, attempting to parse. Got: ${typeof rerankerResponse}`);
            // If response is an object with a property that contains an array, extract it
            if (typeof rerankerResponse === 'object' && rerankerResponse !== null) {
                for (const key in rerankerResponse) {
                    if (Array.isArray(rerankerResponse[key])) {
                        responseArray = rerankerResponse[key];
                        console.log(`[Reranking] Found array in response under key: ${key}`);
                        break;
                    }
                }
            }
            // If we still don't have an array, fall back to original order
            if (!Array.isArray(responseArray)) {
                // Try to parse as JSON if it's a string
                if (typeof rerankerResponse === 'string') {
                    try {
                        const parsed = JSON.parse(rerankerResponse);
                        if (Array.isArray(parsed)) {
                            responseArray = parsed;
                            console.log('[Reranking] Successfully parsed string as JSON array');
                        }
                    }
                    catch (e) {
                        console.log('[Reranking] Failed to parse string as JSON');
                    }
                }
                // If still not an array, use original order
                if (!Array.isArray(responseArray)) {
                    console.log('[Reranking] Could not convert response to array, using original order');
                    return hybridResults.slice(0, topK);
                }
            }
        }
        // Parse and map reranking results
        const rerankedResults = responseArray
            .map((item) => {
            // Use 0-based index to access results array
            const resultIndex = Math.max(0, (parseInt(item.resultId, 10) || 1) - 1);
            // Ensure index is valid
            const resultItem = resultIndex < hybridResults.length
                ? hybridResults[resultIndex]
                : hybridResults[0];
            return {
                original: resultItem,
                relevanceScore: item.score || 0,
                explanation: item.explanation
            };
        })
            // Sort by relevance score in descending order
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
        console.log(`[Reranking] Successfully reranked results`);
        // Return the top K results in reranked order
        return rerankedResults
            .slice(0, topK)
            .map((item) => item.original);
    }
    catch (error) {
        // Log error and fall back to original ranking
        (0, errorHandling_1.logError)('[Reranking] Error during reranking', String(error));
        console.log('[Reranking] Falling back to original ranking due to error');
        return results.slice(0, topK);
    }
}
