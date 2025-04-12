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
/**
 * Interface for multi-modal search result items
 */
export interface MultiModalSearchResultItem extends SearchResultItem {
    matchedVisual?: any;
    matchType?: 'text' | 'visual' | 'both';
    visualContent?: Array<{
        type: string;
        description: string;
        extractedText?: string;
        structuredData?: any;
        imageUrl?: string;
        position?: {
            page: number;
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }>;
}
/**
 * Options for generating answers with visual context
 */
export interface VisualAnswerOptions {
    /** Include source citations in the answer */
    includeSourceCitations?: boolean;
    /** Maximum number of sources to include in the answer */
    maxSourcesInAnswer?: number;
    /** LLM model to use for generation */
    model?: string;
    /** Timeout in milliseconds */
    timeout?: number;
    /** Previous conversation history */
    conversationHistory?: string;
    /** Whether the query has visual focus */
    visualFocus?: boolean;
    /** Types of visual content the query is asking about */
    visualTypes?: string[];
    /** Whether to include image URLs in the response */
    includeImageUrls?: boolean;
}
/**
 * Generate an answer based on retrieved context with multi-modal awareness
 * This function handles both text and visual elements in the search results
 *
 * @param query The user's original query
 * @param searchResults The multi-modal search results from the retrieval system
 * @param options Optional settings for answer generation
 * @returns A string with the generated answer
 */
export declare function generateAnswerWithVisualContext(query: string, searchResults: MultiModalSearchResultItem[], options?: VisualAnswerOptions): Promise<string>;
