/**
 * Multi-Modal Processing Types
 * 
 * This file defines interfaces and types for the multi-modal processing utilities.
 */

import { ContextualChunk } from './documentProcessing';
import { SearchResult, MultiModalVectorStoreItem } from './vectorStore';
import { 
  VisualContentType, 
  ImageAnalysisResult, 
  ProcessedImage,
  DocumentVisualAnalysis,
  BaseMultiModalChunk,
  VisualContentItem
} from './baseTypes';

// Re-export the enum and types for backward compatibility
export { VisualContentType };
export type { ImageAnalysisResult, ProcessedImage, DocumentVisualAnalysis };

/**
 * Interface for multi-modal search options
 */
export interface MultiModalSearchOptions {
  limit?: number;
  includeVisualContent?: boolean;
  visualTypes?: VisualContentType[];
  
  /** 
   * Flag to indicate if the query has visual focus (overrides automatic detection) 
   */
  visualFocus?: boolean;
  
  /**
   * Flag to use enhanced query analysis even for non-visual queries
   */
  useEnhancedAnalysis?: boolean;
  
  /**
   * Additional filters to apply to search results
   */
  filters?: {
    /** Document types to filter by */
    documentTypes?: string[];
    /** Visual types to filter by */
    visualTypes?: string[];
    /** Date range to filter by */
    dateRange?: {
      start?: string;
      end?: string;
    };
  };
}

/**
 * Interface for multi-modal search results
 */
export interface MultiModalSearchResult {
  score: number;
  item: MultiModalVectorStoreItem;
  matchedVisual?: MultiModalVectorStoreItem['visualContent'] extends Array<infer T> ? T : never;
  matchType: 'text' | 'visual' | 'both';
}

/**
 * Enhanced contextual chunk interface with multi-modal support
 * This extends the base interface from baseTypes.ts
 */
export interface MultiModalChunk extends BaseMultiModalChunk {
  // Additional properties specific to MultiModalChunk
  id?: string;
  text: string; // Required text property
  content?: string; // Alias for text property for compatibility
}

/**
 * Interface for hybrid search response
 * This should match the response format from hybridSearch.ts
 */
export interface HybridSearchResponse extends Array<SearchResult> {
  // Extends Array<SearchResult> to maintain compatibility with existing code
} 