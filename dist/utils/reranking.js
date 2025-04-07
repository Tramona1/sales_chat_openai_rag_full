"use strict";
/**
 * Re-ranking Module
 *
 * This module provides LLM-based re-ranking functionality for search results,
 * improving result relevance by using AI to judge the quality of each result
 * in relation to the user's query.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RERANKING_OPTIONS = void 0;
exports.rerankResults = rerankResults;
exports.rerankResultsWithExplanations = rerankResultsWithExplanations;
const openaiClient_1 = require("./openaiClient");
const errorHandling_1 = require("./errorHandling");
/**
 * Default re-ranking options
 */
exports.DEFAULT_RERANKING_OPTIONS = {
    returnTopN: 5,
    model: 'gpt-3.5-turbo',
    parallelBatching: true,
    timeoutMs: 10000,
    batchSize: 5,
    debug: false
};
/**
 * Re-rank search results using LLM relevance judgments
 *
 * This function takes the results from hybrid search and uses an LLM to
 * evaluate how relevant each document is to the original query.
 */
async function rerankResults(query, results, options = {}) {
    // Apply default options
    const config = { ...exports.DEFAULT_RERANKING_OPTIONS, ...options };
    if (config.debug) {
        console.log(`Re-ranking ${results.length} results for query: "${query}"`);
    }
    // Early return if no results
    if (!results || results.length === 0) {
        return [];
    }
    try {
        // Split results into batches to avoid context limits
        const batches = [];
        for (let i = 0; i < results.length; i += config.batchSize) {
            batches.push(results.slice(i, i + config.batchSize));
        }
        if (config.debug) {
            console.log(`Created ${batches.length} batches for re-ranking`);
        }
        // Process each batch either in parallel or sequentially
        let rerankedResults = [];
        if (config.parallelBatching) {
            // Process batches in parallel with timeout protection
            const batchPromises = batches.map((batch, idx) => processReRankingBatch(query, batch, idx, config));
            // Wait for all batches with timeout
            const batchesWithTimeout = await Promise.all(batchPromises.map(promise => Promise.race([
                promise,
                new Promise((resolve) => setTimeout(() => resolve([]), config.timeoutMs))
            ])));
            // Flatten batch results
            rerankedResults = batchesWithTimeout.flat();
        }
        else {
            // Process batches sequentially
            for (let i = 0; i < batches.length; i++) {
                const batchResults = await processReRankingBatch(query, batches[i], i, config);
                rerankedResults = [...rerankedResults, ...batchResults];
            }
        }
        // Sort by final score (descending) and limit to top N
        const sortedResults = rerankedResults
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, config.returnTopN);
        if (config.debug) {
            console.log(`Re-ranking complete. Returning top ${sortedResults.length} results`);
            sortedResults.forEach((result, i) => {
                console.log(`[${i + 1}] Final score: ${result.finalScore.toFixed(3)} (BM25: ${result.originalResult.bm25Score.toFixed(3)}, Vector: ${result.originalResult.vectorScore.toFixed(3)}, Rerank: ${result.rerankScore.toFixed(3)})`);
            });
        }
        return sortedResults;
    }
    catch (error) {
        (0, errorHandling_1.logError)(error, 'rerankResults');
        // Fall back to original results on error
        const fallbackResults = results.map(result => ({
            originalResult: result,
            rerankScore: result.combinedScore * 10, // Scale up to 0-10 range
            finalScore: result.combinedScore
        }));
        return fallbackResults
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, config.returnTopN);
    }
}
/**
 * Process a batch of results for re-ranking
 */
async function processReRankingBatch(query, batch, batchIndex, config) {
    try {
        // Create a system prompt that explains how to judge relevance
        const systemPrompt = `You are a document relevance judge. Your task is to evaluate how relevant each document is to the given query on a scale of 0-10, where:
- 10: Perfect match that directly and completely answers the query with specific details
- 7-9: Highly relevant with most key information related to the query
- 4-6: Somewhat relevant but lacks specific details or only partially addresses the query
- 1-3: Only tangentially related to the query
- 0: Not relevant at all

Focus on how well the document answers the specific information need in the query.
Return a JSON object with your numerical scores in this format:
{"scores": [number, number, ...]}`;
        // Create a user prompt with the query and documents to score
        const userPrompt = `Query: ${query}

${batch.map((result, i) => `DOCUMENT ${batchIndex * config.batchSize + i + 1}:
${result.item.text.substring(0, 600)}${result.item.text.length > 600 ? '...' : ''}`).join('\n\n')}

Provide a relevance score from 0-10 for each document based on how well it answers the query.`;
        // Generate scores using the LLM
        const response = await (0, openaiClient_1.generateStructuredResponse)(systemPrompt, userPrompt, { scores: [] }, config.model);
        // Extract scores from the response
        const scores = (response === null || response === void 0 ? void 0 : response.scores) || [];
        if (config.debug) {
            console.log(`Batch ${batchIndex + 1} re-ranking scores:`, scores);
        }
        // Map scores to results
        return batch.map((result, idx) => {
            const rerankScore = scores[idx] !== undefined ? scores[idx] : 5; // Default to middle score if missing
            // Calculate final score - weighted combination of original score and rerank score
            // Original score is typically 0-1, rerank score is 0-10, so normalize
            const vectorWeight = 0.3;
            const bm25Weight = 0.2;
            const rerankWeight = 0.5; // Higher weight for LLM judgment
            const finalScore = (vectorWeight * result.vectorScore) +
                (bm25Weight * result.bm25Score) +
                (rerankWeight * (rerankScore / 10));
            return {
                originalResult: result,
                rerankScore,
                finalScore
            };
        });
    }
    catch (error) {
        (0, errorHandling_1.logError)(error, `processReRankingBatch_${batchIndex}`);
        // Fallback - use original scores
        return batch.map(result => ({
            originalResult: result,
            rerankScore: result.combinedScore * 10, // Scale up to 0-10 range
            finalScore: result.combinedScore
        }));
    }
}
/**
 * Enhanced version of reranking that provides explanation for each score
 * Useful for debugging and understanding why results were ranked as they were
 */
async function rerankResultsWithExplanations(query, results, options = {}) {
    const config = { ...exports.DEFAULT_RERANKING_OPTIONS, ...options };
    // Process just the top result for detailed analysis
    const topResult = results.length > 0 ? results[0] : null;
    if (!topResult) {
        return [];
    }
    try {
        // Get the text of the top result for the LLM to evaluate
        const documentText = topResult.item.text.substring(0, 800);
        // Create a system prompt for explaining relevance (without requiring JSON)
        const systemPrompt = `You are a document relevance judge. 
Your task is to evaluate how relevant a document is to a user query on a scale of 0-10.
Provide your evaluation in the following format:
Score: [NUMBER]/10
Explanation: [YOUR EXPLANATION]

Be specific about why the document is or isn't relevant to the query.`;
        // Create a detailed user prompt
        const userPrompt = `Query: "${query}"

Document:
${documentText}

Evaluate the relevance of this document to the query. Score it from 0-10 and explain your reasoning in 1-2 sentences.`;
        // Generate response without requiring JSON format
        const response = await (0, openaiClient_1.generateChatCompletion)(systemPrompt, userPrompt, config.model, false // Don't use JSON mode
        );
        // Parse the response to extract score and explanation
        const scoreRegex = /Score:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i;
        const explanationRegex = /Explanation:\s*(.*?)(?:\n|$)/is;
        const scoreMatch = response.match(scoreRegex);
        const explanationMatch = response.match(explanationRegex);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5;
        const explanation = explanationMatch ? explanationMatch[1].trim() : response;
        // Return the result with explanation
        return [{
                originalResult: topResult,
                rerankScore: score,
                finalScore: (0.5 * (score / 10)) + (0.5 * topResult.combinedScore), // Weighted combination
                explanation: explanation || "No explanation provided"
            }];
    }
    catch (error) {
        console.error('Error in rerankResultsWithExplanations:', error);
        // Try with fallback model if main model fails
        try {
            const fallbackModel = config.model === 'gpt-4' ? 'gpt-3.5-turbo' : 'gpt-3.5-turbo';
            const fallbackSystemPrompt = `You are evaluating document relevance. Rate the document's relevance to the query from 0-10 and explain why.`;
            const fallbackUserPrompt = `Query: ${query}\n\nDocument: ${topResult.item.text.substring(0, 400)}`;
            const fallbackResponse = await (0, openaiClient_1.generateChatCompletion)(fallbackSystemPrompt, fallbackUserPrompt, fallbackModel, false);
            // Extract a score if possible
            const scoreMatch = fallbackResponse.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
            const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5;
            return [{
                    originalResult: topResult,
                    rerankScore: score,
                    finalScore: topResult.combinedScore,
                    explanation: fallbackResponse
                }];
        }
        catch (fallbackError) {
            // Final fallback with default values
            return [{
                    originalResult: topResult,
                    rerankScore: 5,
                    finalScore: topResult.combinedScore,
                    explanation: "Unable to generate explanation due to an error."
                }];
        }
    }
}
