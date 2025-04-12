/**
 * Context-Aware Answer Generation Utilities
 *
 * This module provides functions for generating answers that take advantage
 * of contextual and multi-modal information for more accurate responses.
 */
/**
 * Interface for search result context provided to answer generation
 */
interface SearchContext {
    text: string;
    source: string;
    score: number;
    metadata?: any;
    visualContent?: Array<{
        type: string;
        description: string;
        text?: string;
    }>;
}
/**
 * Options for answer generation
 */
interface AnswerGenerationOptions {
    systemPrompt?: string;
    includeSourceCitations?: boolean;
    maxSourcesInAnswer?: number;
    conversationHistory?: string;
    useContextualInformation?: boolean;
    useMultiModalContent?: boolean;
    responseFormat?: 'text' | 'markdown' | 'json';
}
/**
 * Generate a context-aware answer using Gemini
 *
 * @param query The user's query
 * @param searchResults The retrieved search results
 * @param options Options for answer generation
 * @returns The generated answer
 */
export declare function generateContextAwareAnswer(query: string, searchResults: SearchContext[], options?: AnswerGenerationOptions): Promise<string>;
/**
 * Generate an answer that specifically incorporates visual information
 *
 * @param query The user's query
 * @param searchResults The retrieved search results
 * @param options Options for answer generation
 * @returns The generated answer
 */
export declare function generateAnswerWithVisualContext(query: string, searchResults: SearchContext[], options?: AnswerGenerationOptions): Promise<string>;
/**
 * Entry point for answer generation that selects the appropriate method
 * based on query type and available context
 */
export declare function generateAnswer(query: string, searchResults: SearchContext[], options?: AnswerGenerationOptions): Promise<string>;
export {};
