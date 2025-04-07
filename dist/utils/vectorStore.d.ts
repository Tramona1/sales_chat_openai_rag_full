export interface VectorStoreItem {
    embedding: number[];
    text: string;
    metadata?: {
        source?: string;
        page?: number;
        batch?: string;
        isStructured?: boolean;
        infoType?: string;
        priority?: string;
    };
}
declare let vectorStore: VectorStoreItem[];
/**
 * Calculate cosine similarity between two vectors
 * @param vecA First vector
 * @param vecB Second vector
 * @returns Cosine similarity score (0-1)
 */
export declare function cosineSimilarity(vecA: number[], vecB: number[]): number;
/**
 * Add an item or multiple items to the vector store
 * @param items Single item or array of items to add
 */
export declare function addToVectorStore(items: VectorStoreItem | VectorStoreItem[]): void;
export declare function getSimilarItems(queryEmbedding: number[], limit?: number, queryText?: string, priorityInfoType?: string): (VectorStoreItem & {
    score: number;
})[];
/**
 * Clear the vector store
 */
export declare function clearVectorStore(): void;
/**
 * Get the current size of the vector store
 * @returns Number of items in the vector store
 */
export declare function getVectorStoreSize(): number;
/**
 * Get all items from the vector store
 * @returns Array of all vector store items
 */
export declare function getAllVectorStoreItems(): VectorStoreItem[];
export { vectorStore };
