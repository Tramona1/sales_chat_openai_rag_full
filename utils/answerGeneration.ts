/**
 * Answer Generation Module
 *
 * This module provides functions for generating answers based on search results.
 */

import { SearchResultItem, generateAnswer as generateAnswerFromGenerator } from './answerGenerator';
import { logError } from './logger';

/**
 * Generate an answer from retrieved search results
 * 
 * @param query The user's original query
 * @param searchResults The search results to generate an answer from
 * @param options Additional options for answer generation
 * @returns The generated answer
 */
export async function generateAnswer(
  query: string,
  searchResults: SearchResultItem[],
  options: {
    systemPrompt?: string;
    includeSourceCitations?: boolean;
    maxSourcesInAnswer?: number;
    model?: string;
    timeout?: number;
    conversationHistory?: string;
    useContextualInformation?: boolean;
  } = {}
): Promise<string> {
  try {
    // Call the actual implementation from answerGenerator
    return await generateAnswerFromGenerator(query, searchResults, {
      includeSourceCitations: options.includeSourceCitations,
      maxSourcesInAnswer: options.maxSourcesInAnswer,
      model: options.model,
      timeout: options.timeout,
      conversationHistory: options.conversationHistory
    });
  } catch (error) {
    logError('Error generating answer', error as Error);
    return "I'm sorry, I encountered an error while trying to generate an answer. Please try again with a different query.";
  }
} 