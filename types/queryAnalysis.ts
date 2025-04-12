/**
 * Query Analysis Types
 * 
 * This file defines interfaces for query analysis and understanding.
 */

/**
 * Entity types recognized in queries
 */
export type EntityType = 
  | 'PERSON'
  | 'ORGANIZATION'
  | 'PRODUCT'
  | 'FEATURE'
  | 'LOCATION'
  | 'CONCEPT'
  | 'TECHNICAL_TERM'
  | 'OTHER';

/**
 * Interface for entities extracted from queries
 */
export interface Entity {
  name: string;
  type: EntityType;
  score: number;
}

/**
 * Query intent types
 */
export type QueryIntent = 
  | 'INFORMATIONAL'
  | 'TECHNICAL'
  | 'FEATURE_INQUIRY'
  | 'COMPARISON'
  | 'TROUBLESHOOTING'
  | 'HOW_TO'
  | 'DEFINITION'
  | 'PRICING'
  | 'COMPATIBILITY'
  | 'OTHER';

/**
 * Interface for query analysis results
 */
export interface QueryAnalysis {
  /** The original query text */
  originalQuery: string;
  
  /** The primary detected intent of the query */
  intent: QueryIntent;
  
  /** Main topics detected in the query */
  topics: string[];
  
  /** List of entities detected in the query */
  entities: Entity[];
  
  /** Technical level of the query (0-3) */
  technicalLevel: number;
  
  /** The primary category the query relates to */
  primaryCategory?: string;
  
  /** Secondary categories the query might relate to */
  secondaryCategories?: string[];
  
  /** Query type classification */
  queryType?: string;
  
  /** Keywords extracted from the query */
  keywords?: string[];
  
  /** Expanded version of the query (for better search) */
  expandedQuery?: string;
  
  /** Is the query ambiguous and needs clarification */
  isAmbiguous?: boolean;
}

/**
 * Parameters generated for optimizing retrieval
 */
export interface RetrievalParameters {
  /** Hybrid search parameters */
  hybridRatio: number;
  limit: number;
  rerank: boolean;
  rerankCount: number;
  
  /** Whether to expand the query for better results */
  expandQuery: boolean;
  
  /** Category filtering parameters */
  categoryFilter: {
    categories: string[];
    strict: boolean;
  };
  
  /** Technical level range to filter results */
  technicalLevelRange: {
    min: number;
    max: number;
  };
} 