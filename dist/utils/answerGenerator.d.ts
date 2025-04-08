/**
 * Answer generation utility for the RAG system
 * Generates accurate answers from search results using the OpenAI API
 * With fallback to Gemini for handling large contexts
 */
/**
 * Interface for search result items that will be passed to the answer generator
 */
export interface SearchResultItem {
    text: string;
    source?: string;
    metadata?: Record<string, any>;
    relevanceScore?: number;
}
/**
 * Generate an answer based on retrieved context and the user's query
 *
 * @param query The user's original query
 * @param searchResults The search results from the retrieval system
 * @param options Optional settings for answer generation
 * @returns A string with the generated answer
 */
export declare function generateAnswer(query: string, searchResults: SearchResultItem[], options?: {
    includeSourceCitations?: boolean;
    maxSourcesInAnswer?: number;
    model?: string;
    timeout?: number;
    conversationHistory?: string;
}): Promise<string>;
