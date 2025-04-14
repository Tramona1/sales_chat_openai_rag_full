/**
 * Search Types
 * 
 * This module defines types related to search functionality, 
 * document storage, and retrieval.
 */

import { DocumentCategoryType } from '../utils/documentCategories';

/**
 * Basic document interface
 */
export interface Document {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Document with embedding for vector search
 */
export interface DocumentEmbedding extends Document {
  embedding: number[];
}

/**
 * Metadata filter for search operations
 */
export interface MetadataFilter {
  categories?: DocumentCategoryType[];
  strictCategoryMatch?: boolean;
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  lastUpdatedAfter?: string;
  entities?: string[];
  keywords?: string[];
}

/**
 * Search result item
 */
export interface SearchResultItem {
  text: string;
  source?: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
} 