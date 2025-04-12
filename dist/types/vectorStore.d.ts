/**
 * Vector Store Types
 *
 * This file defines interfaces for the vector store implementations,
 * enhanced to support contextual retrieval and multi-modal capabilities.
 */
/**
 * Primary interface for items stored in the vector database
 */
export interface VectorStoreItem {
    /** Vector embedding of the text */
    embedding: number[];
    /** The text content */
    text: string;
    /** Original unprocessed text (for reranking and answer generation) */
    originalText?: string;
    /** Metadata associated with the text */
    metadata?: {
        /** Source of the text (usually document name/ID) */
        source?: string;
        /** Page number for documents with pages */
        page?: number;
        /** Batch ID for tracking which batch this item belongs to */
        batch?: string;
        /** Flag indicating if text is structured content */
        isStructured?: boolean;
        /** Type of information in structured content */
        infoType?: string;
        /** Priority level for retrieval */
        priority?: string;
        /** Primary category of the content */
        category?: string;
        /** Technical level (1-10) representing complexity */
        technicalLevel?: number;
        /** Date when the content was last updated */
        lastUpdated?: string;
        /** List of entities mentioned in the text */
        entities?: string;
        /** List of keywords for the text */
        keywords?: string;
        /** Time when item was added to the store */
        timestamp?: string;
        /** Flag indicating if this item has been approved */
        approved?: boolean;
        /** Review status: pending, approved, rejected */
        reviewStatus?: string;
        /** Time when item was approved */
        approvedAt?: string;
        /** Time when item was deprecated */
        deprecatedAt?: string;
        /** Flag indicating if this is a chunk from contextual processing */
        isContextualChunk?: boolean;
        /** Flag indicating if this is a chunk vs a whole document */
        isChunk?: boolean;
        /** ID of the pending document this chunk came from */
        pendingDocId?: string;
        /** Parent document ID for chunks */
        parentDocument?: string;
        /** Summary of the document this chunk belongs to */
        documentSummary?: string;
        /** Type of document (technical, marketing, etc.) */
        documentType?: string;
        /** Main topics of the document */
        primaryTopics?: string;
        /** Audience type targeted by the document */
        audienceType?: string;
        /** Original score from retrieval (used for reranking) */
        originalScore?: number;
        /** Reranking score (if reranked) */
        rerankScore?: number;
        /** Hybrid search BM25 component score */
        bm25Score?: number;
        /** Hybrid search vector component score */
        vectorScore?: number;
        /** Flag indicating if the document has visual content */
        hasVisualContent?: boolean;
        /** Contextual information about the chunk */
        context?: {
            /** Description of what this chunk contains */
            description?: string;
            /** Key points extracted from the chunk */
            keyPoints?: string[];
            /** Flag indicating if this chunk contains a definition */
            isDefinition?: boolean;
            /** Flag indicating if this chunk contains examples */
            containsExample?: boolean;
            /** Topics related to this chunk */
            relatedTopics?: string[];
        };
        /** Any additional metadata fields */
        [key: string]: any;
    };
}
/**
 * Search result interface
 */
export interface SearchResult {
    /** Score indicating relevance (0-1) */
    score: number;
    /** The matched vector item */
    item: VectorStoreItem;
    /** Optional explanation of why this result matched */
    explanation?: string;
}
/**
 * Interface for multi-modal vector store items
 */
export interface MultiModalVectorStoreItem extends VectorStoreItem {
    /** Visual content associated with this item */
    visualContent?: {
        /** Type of visual (image, chart, table, diagram) */
        type: 'image' | 'chart' | 'table' | 'diagram' | 'screenshot' | 'other';
        /** URL or path to the image if stored separately */
        imageUrl?: string;
        /** Base64 encoded image data (if stored inline) */
        imageData?: string;
        /** Description of the visual content */
        description?: string;
        /** Text extracted from the visual */
        extractedText?: string;
        /** For charts/tables, structured data representation */
        structuredData?: any;
        /** Position information in the original document */
        position?: {
            page: number;
            x: number;
            y: number;
            width: number;
            height: number;
        };
        /** Visual embedding vector (if using vision models) */
        visualEmbedding?: number[];
    }[];
}
/**
 * Interface for result of multi-modal search
 */
export interface MultiModalSearchResult extends SearchResult {
    /** The matched multi-modal vector item */
    item: MultiModalVectorStoreItem;
    /** Specific visual content that matched (if applicable) */
    matchedVisual?: MultiModalVectorStoreItem['visualContent'] extends Array<infer T> ? T : never;
    /** Whether the match was primarily based on text or visual content */
    matchType: 'text' | 'visual' | 'both';
}
/**
 * Interface for hybrid search results
 */
export interface HybridSearchResult extends SearchResult {
    /** BM25 component score */
    bm25Score?: number;
    /** Vector component score */
    vectorScore?: number;
    /** Mix ratio used for this result */
    mixRatio?: number;
}
/**
 * Interface for reranking results
 */
export interface RerankingResult extends SearchResult {
    /** Original score before reranking */
    originalScore: number;
    /** Explanation of why this result was ranked this way */
    explanation?: string;
}
/**
 * Vector store provider interface
 */
export interface VectorStoreProvider {
    /** Add a single item to the store */
    addItem(item: VectorStoreItem): Promise<string>;
    /** Add multiple items to the store */
    addItems(items: VectorStoreItem[]): Promise<string[]>;
    /** Retrieve items similar to the query embedding */
    search(queryEmbedding: number[], limit?: number): Promise<SearchResult[]>;
    /** Delete items by ID */
    deleteItems(ids: string[]): Promise<boolean>;
    /** Get the total count of items in the store */
    getCount(): Promise<number>;
}
