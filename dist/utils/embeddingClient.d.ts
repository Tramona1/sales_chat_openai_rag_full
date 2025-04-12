/**
 * Embedding Client Factory
 *
 * This module provides a unified interface for generating embeddings
 * from different providers (OpenAI and Gemini).
 */
/**
 * Interface for embedding clients
 */
export interface EmbeddingClient {
    /**
     * Generate embeddings for a single text
     */
    embedText(text: string): Promise<number[]>;
    /**
     * Generate embeddings for multiple texts in one batch
     */
    embedBatch(texts: string[], taskType?: string): Promise<number[][]>;
    /**
     * Get the provider name
     */
    getProvider(): string;
    /**
     * Get the expected dimensions of the embeddings
     */
    getDimensions(): number;
}
/**
 * Factory function to get the appropriate embedding client
 * Always returns the Gemini embedding client after migration
 */
export declare function getEmbeddingClient(): EmbeddingClient;
/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
export declare function embedText(text: string): Promise<number[]>;
/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
export declare function embedBatch(texts: string[]): Promise<number[][]>;
