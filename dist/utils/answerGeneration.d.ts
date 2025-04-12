/**
 * Answer Generation Module
 *
 * This module provides functions for generating answers based on search results.
 */
import { SearchResultItem } from './answerGenerator';
/**
 * Generate an answer from retrieved search results
 *
 * @param query The user's original query
 * @param searchResults The search results to generate an answer from
 * @param options Additional options for answer generation
 * @returns The generated answer
 */
export declare function generateAnswer(query: string, searchResults: SearchResultItem[], options?: {
    systemPrompt?: string;
    includeSourceCitations?: boolean;
    maxSourcesInAnswer?: number;
    model?: string;
    timeout?: number;
    conversationHistory?: string;
    useContextualInformation?: boolean;
}): Promise<string>;
