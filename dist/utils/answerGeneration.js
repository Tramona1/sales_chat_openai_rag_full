"use strict";
/**
 * Answer Generation Module
 *
 * This module provides functions for generating answers based on search results.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAnswer = generateAnswer;
const answerGenerator_1 = require("./answerGenerator");
const errorHandling_1 = require("./errorHandling");
/**
 * Generate an answer from retrieved search results
 *
 * @param query The user's original query
 * @param searchResults The search results to generate an answer from
 * @param options Additional options for answer generation
 * @returns The generated answer
 */
async function generateAnswer(query, searchResults, options = {}) {
    try {
        // Call the actual implementation from answerGenerator
        return await (0, answerGenerator_1.generateAnswer)(query, searchResults, {
            includeSourceCitations: options.includeSourceCitations,
            maxSourcesInAnswer: options.maxSourcesInAnswer,
            model: options.model,
            timeout: options.timeout,
            conversationHistory: options.conversationHistory
        });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error generating answer', error);
        return "I'm sorry, I encountered an error while trying to generate an answer. Please try again with a different query.";
    }
}
