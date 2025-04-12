/**
 * Document Processing Types
 * 
 * This file defines interfaces for document processing, including contextual chunking.
 */

/**
 * Interface for document context information extracted by Gemini
 */
export interface DocumentContext {
  /** Summary of the document content */
  summary: string;
  
  /** Array of main topics covered in the document */
  mainTopics: string[];
  
  /** Array of entities (people, companies, products) mentioned */
  entities: string[];
  
  /** Type of document (technical, marketing, etc.) */
  documentType: string;
  
  /** Technical complexity level (0-3) */
  technicalLevel: number;
  
  /** Target audience types */
  audienceType: string[];
}

/**
 * Interface for chunk context information
 */
export interface ChunkContext {
  /** Description of what the chunk contains */
  description: string;
  
  /** Key points extracted from the chunk */
  keyPoints: string[];
  
  /** Whether this chunk contains a definition */
  isDefinition: boolean;
  
  /** Whether this chunk contains examples */
  containsExample: boolean;
  
  /** Topics related to this chunk content */
  relatedTopics: string[];
}

/**
 * Interface for a chunk with contextual information
 */
export interface ContextualChunk {
  /** The chunk text */
  text: string;
  
  /** Metadata associated with the chunk */
  metadata?: {
    /** Whether this is structured content (like a heading, list, table) */
    isStructured?: boolean;
    
    /** Type of information for structured content */
    infoType?: string;
    
    /** Source document identifier */
    source?: string;
    
    /** Parent document ID */
    parentDocument?: string;
    
    /** Page number in the source document */
    page?: number;
    
    /** Contextual information about the chunk */
    context?: ChunkContext;
  };
}

/**
 * Type for the splitIntoChunksWithContext function signature
 */
export type SplitIntoChunksWithContextFn = (
  text: string,
  chunkSize?: number,
  source?: string,
  generateContext?: boolean,
  existingContext?: DocumentContext | Record<string, any>
) => Promise<ContextualChunk[]>;

/**
 * Type for the extractDocumentContext function signature
 */
export type ExtractDocumentContextFn = (
  documentText: string,
  metadata?: Record<string, any>
) => Promise<DocumentContext>;

/**
 * Type for the generateChunkContext function signature
 */
export type GenerateChunkContextFn = (
  chunkText: string,
  documentContext?: DocumentContext | Record<string, any>
) => Promise<ChunkContext>; 