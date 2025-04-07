/**
 * Hybrid Search Module for Smart Query Routing
 * 
 * This module combines vector search and BM25 with metadata-aware filtering
 * to improve retrieval accuracy based on query analysis and document metadata.
 */

import { VectorStoreItem, getAllVectorStoreItems } from './vectorStore';
import { calculateBM25Score, loadCorpusStatistics } from './bm25';
import { embedText } from './openaiClient';
import { logError, logInfo } from './errorHandling';
import { DocumentCategory } from '../types/metadata';
import fs from 'fs';
import path from 'path';

// Use local type definitions instead of importing them
export interface Document {
  id: string;
  text: string;
  metadata?: any;
}

interface MetadataFilter {
  categories?: DocumentCategory[];
  strictCategoryMatch?: boolean;
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  lastUpdatedAfter?: string;
  entities?: string[];
  keywords?: string[];
}

export interface SearchResult {
  item: Document;
  score: number;
  vectorScore?: number;
  bm25Score?: number;
}

// Constants
const DEFAULT_VECTOR_STORE_PATH = path.join(process.cwd(), 'data', 'vectorStore.json');
const CORPUS_STATS_PATH = path.join(process.cwd(), 'data', 'corpus_stats');

// In-memory storage for documents and embeddings
let vectorDocuments: Document[] = [];
let corpusTermFrequencies: Record<string, number> = {};
let documentFrequencies: Record<string, number> = {};
let documentCount = 0;

// Initialize the hybrid search system
let initialized = false;

// Result from hybrid search
export interface HybridSearchResult {
  item: VectorStoreItem & { id: string };
  score: number;
  bm25Score: number;
  vectorScore: number;
  metadata: {
    matchesCategory: boolean;
    categoryBoost: number;
    technicalLevelMatch: number;
  };
}

// Filter options for hybrid search
export interface HybridSearchFilter {
  // Category filtering
  categories?: DocumentCategory[];
  strictCategoryMatch?: boolean;
  
  // Technical level filtering
  technicalLevelMin?: number;
  technicalLevelMax?: number;
  
  // Entity filtering
  requiredEntities?: string[];
  
  // Custom metadata filters
  customFilters?: Record<string, any>;
}

/**
 * Initialize the hybrid search system
 */
export async function initializeHybridSearch(): Promise<void> {
  if (initialized) return;
  
  try {
    // Load vector documents
    await loadVectorDocuments();
    
    // Load BM25 corpus statistics
    await loadCorpusStats();
    
    initialized = true;
    logInfo('Hybrid search system initialized', { 
      documentCount, 
      vectorDocumentsCount: vectorDocuments.length 
    });
  } catch (error) {
    logError('Failed to initialize hybrid search', error);
    throw new Error('Failed to initialize hybrid search system');
  }
}

/**
 * Load vector documents from disk
 */
async function loadVectorDocuments(): Promise<void> {
  try {
    if (fs.existsSync(DEFAULT_VECTOR_STORE_PATH)) {
      const data = fs.readFileSync(DEFAULT_VECTOR_STORE_PATH, 'utf8');
      const parsedData = JSON.parse(data);
      
      // Handle different formats of vector store data
      let rawItems: any[] = [];
      
      if (Array.isArray(parsedData)) {
        // Direct array format
        rawItems = parsedData;
      } else if (parsedData && typeof parsedData === 'object') {
        // Object with items array
        if (Array.isArray(parsedData.items)) {
          rawItems = parsedData.items;
        } else if (parsedData.batches && Array.isArray(parsedData.batches)) {
          // Batch format - flatten all batches
          rawItems = parsedData.batches.flatMap((batch: any) => 
            Array.isArray(batch.items) ? batch.items : []
          );
        }
      }
      
      // Transform VectorStoreItems to Document format, ensuring each has an id
      if (rawItems.length > 0) {
        vectorDocuments = rawItems.map((item, index) => ({
          id: item.id || `doc-${index}`,
          text: item.text || '',
          metadata: item.metadata || {}
        }));
        logInfo('Loaded vector documents', { count: vectorDocuments.length });
      } else {
        vectorDocuments = [];
        logError('No items found in vector store data', { 
          dataType: typeof parsedData,
          isArray: Array.isArray(parsedData),
          hasItems: parsedData && parsedData.items ? 'yes' : 'no',
          hasBatches: parsedData && parsedData.batches ? 'yes' : 'no'
        });
      }
    } else {
      vectorDocuments = [];
      logInfo('No vector documents found, starting with empty store');
    }
  } catch (error) {
    logError('Error loading vector documents', error);
    vectorDocuments = [];
  }
}

/**
 * Load BM25 corpus statistics
 */
async function loadCorpusStats(): Promise<void> {
  try {
    // Load term frequencies
    const tfPath = path.join(CORPUS_STATS_PATH, 'term_frequencies.json');
    if (fs.existsSync(tfPath)) {
      const tfData = fs.readFileSync(tfPath, 'utf8');
      corpusTermFrequencies = JSON.parse(tfData);
    } else {
      corpusTermFrequencies = {};
    }
    
    // Load document frequencies
    const dfPath = path.join(CORPUS_STATS_PATH, 'doc_frequencies.json');
    if (fs.existsSync(dfPath)) {
      const dfData = fs.readFileSync(dfPath, 'utf8');
      documentFrequencies = JSON.parse(dfData);
    } else {
      documentFrequencies = {};
    }
    
    // Load document count
    const countPath = path.join(CORPUS_STATS_PATH, 'doc_count.json');
    if (fs.existsSync(countPath)) {
      const countData = fs.readFileSync(countPath, 'utf8');
      const countObj = JSON.parse(countData);
      documentCount = countObj.count || 0;
    } else {
      documentCount = 0;
    }
    
    logInfo('Loaded corpus statistics', { 
      termsCount: Object.keys(corpusTermFrequencies).length,
      documentCount
    });
  } catch (error) {
    logError('Error loading corpus statistics', error);
    corpusTermFrequencies = {};
    documentFrequencies = {};
    documentCount = 0;
  }
}

/**
 * Perform hybrid search combining vector and BM25 search
 * 
 * @param query The search query
 * @param limit Maximum number of results to return
 * @param hybridRatio Ratio of vector to BM25 scores (0-1, where 1 is all vector)
 * @param filter Optional metadata filters
 */
export async function performHybridSearch(
  query: string,
  limit: number = 10,
  hybridRatio: number = 0.5,
  filter?: MetadataFilter
): Promise<SearchResult[]> {
  // Ensure search system is initialized
  if (!initialized) {
    await initializeHybridSearch();
  }
  
  try {
    // Tokenize query
    const queryTokens = tokenizeText(query);
    
    // Apply BM25 search
    const bm25Results = computeBM25Scores(queryTokens, vectorDocuments);
    
    // Currently we're just using BM25, in a real implementation you would:
    // 1. Get vector embeddings for the query
    // 2. Compute cosine similarity with document vectors
    // 3. Combine with BM25 scores using hybridRatio
    
    // For now, we'll just use BM25 scores
    const results = bm25Results
      .filter(result => applyMetadataFilter(result.item, filter))
      .map(result => ({
        ...result,
        item: {
          ...result.item,
          id: result.item.id || `result-${Math.random().toString(36).substring(2, 9)}`
        },
        vectorScore: 0,
        score: result.score
      }))
      .slice(0, limit);
    
    return results;
  } catch (error) {
    logError('Error performing hybrid search', error);
    return [];
  }
}

/**
 * Tokenize text into terms for BM25 search
 */
function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(token => token.length > 1); // Remove single-character tokens
}

/**
 * Compute BM25 scores for documents against query tokens
 */
function computeBM25Scores(queryTokens: string[], documents: Document[]): SearchResult[] {
  // BM25 parameters
  const k1 = 1.2; // Term frequency saturation
  const b = 0.75; // Length normalization
  
  // Check if documents is an array
  if (!Array.isArray(documents)) {
    logError('Documents is not an array in computeBM25Scores', { 
      documentsType: typeof documents,
      isArray: Array.isArray(documents),
      documentsLength: documents ? (documents as any).length : 'undefined'
    });
    return [];
  }
  
  // Handle empty documents array
  if (documents.length === 0) {
    return [];
  }
  
  // Get average document length
  const avgDocLength = documents.reduce(
    (sum, doc) => sum + tokenizeText(doc.text).length, 
    0
  ) / Math.max(1, documents.length);
  
  // Calculate scores for each document
  const results: SearchResult[] = documents.map(doc => {
    const docTokens = tokenizeText(doc.text);
    const docLength = docTokens.length;
    
    // Count term frequencies in this document
    const termFreqs: Record<string, number> = {};
    docTokens.forEach(token => {
      termFreqs[token] = (termFreqs[token] || 0) + 1;
    });
    
    // Calculate BM25 score for this document
    let score = 0;
    
    queryTokens.forEach(token => {
      // Skip if token not in document
      if (!termFreqs[token]) return;
      
      // Get document frequency of this term (how many docs contain it)
      const df = documentFrequencies[token] || 1;
      
      // IDF component: log((N - df + 0.5) / (df + 0.5) + 1)
      const idf = Math.log(
        (documentCount - df + 0.5) / (df + 0.5) + 1
      );
      
      // Term frequency component with saturation and document length normalization
      const tf = termFreqs[token];
      const tfComponent = 
        (tf * (k1 + 1)) / 
        (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
      
      // Add to document score
      score += idf * tfComponent;
    });
    
    return {
      item: doc,
      score: score,
      bm25Score: score
    };
  });
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Apply metadata filters to a document
 */
function applyMetadataFilter(doc: Document, filter?: MetadataFilter): boolean {
  if (!filter) return true;
  
  const metadata = doc.metadata;
  if (!metadata) return false;
  
  // Filter by categories
  if (filter.categories && filter.categories.length > 0) {
    if (filter.strictCategoryMatch) {
      // All categories must match
      if (metadata.categories) {
        if (!filter.categories.every((cat: DocumentCategory) => 
          metadata.categories.includes(cat)
        )) {
          return false;
        }
      } else if (metadata.category) {
        // If we only have a single category field, check that
        if (!filter.categories.includes(metadata.category)) {
          return false;
        }
      } else {
        // No category information, filter out
        return false;
      }
    } else {
      // At least one category must match
      if (metadata.categories) {
        if (!filter.categories.some((cat: DocumentCategory) => 
          metadata.categories.includes(cat)
        )) {
          return false;
        }
      } else if (metadata.category) {
        // If we only have a single category field, check that
        if (!filter.categories.includes(metadata.category)) {
          return false;
        }
      } else {
        // For lenient matching, if no categories are present, still allow it through
      }
    }
  }
  
  // Filter by technical level
  if (filter.technicalLevelMin !== undefined && 
      metadata.technicalLevel !== undefined &&
      metadata.technicalLevel < filter.technicalLevelMin) {
    return false;
  }
  
  if (filter.technicalLevelMax !== undefined && 
      metadata.technicalLevel !== undefined &&
      metadata.technicalLevel > filter.technicalLevelMax) {
    return false;
  }
  
  // Filter by last updated date
  if (filter.lastUpdatedAfter && metadata.lastUpdated) {
    if (new Date(metadata.lastUpdated) < new Date(filter.lastUpdatedAfter)) {
      return false;
    }
  }
  
  // Filter by entities
  if (filter.entities && filter.entities.length > 0) {
    const docEntityNames = metadata.entities ? 
      (typeof metadata.entities === 'string' ? 
        metadata.entities.toLowerCase().split(',').map((e: string) => e.trim()) :
        metadata.entities.map((e: any) => e.name ? e.name.toLowerCase() : e.toLowerCase())
      ) : [];
      
    if (docEntityNames.length > 0 && !filter.entities.some((entity: string) => 
      docEntityNames.some((docEntity: string) => docEntity.includes(entity.toLowerCase()))
    )) {
      return false;
    }
  }
  
  // Filter by keywords
  if (filter.keywords && filter.keywords.length > 0) {
    const docKeywords = metadata.keywords ?
      (typeof metadata.keywords === 'string' ?
        metadata.keywords.toLowerCase().split(',').map((k: string) => k.trim()) :
        metadata.keywords.map((k: string) => k.toLowerCase())
      ) : [];
      
    if (docKeywords.length > 0 && !filter.keywords.some((keyword: string) => 
      docKeywords.some((docKeyword: string) => docKeyword.includes(keyword.toLowerCase()))
    )) {
      return false;
    }
  }
  
  return true;
}

/**
 * Applies metadata-based filters to vector store items
 */
function applyMetadataFilters(
  item: VectorStoreItem, 
  filter?: HybridSearchFilter
): boolean {
  if (!filter || !filter.customFilters) {
    return true;
  }
  
  // If item has no metadata, filter it out if any filter is specified
  if (!item.metadata) {
    return false;
  }
  
  // Apply custom metadata filters
  for (const [key, value] of Object.entries(filter.customFilters)) {
    if (Array.isArray(value)) {
      // If filter value is an array, check if metadata field includes any value
      if (!item.metadata[key as keyof typeof item.metadata] || 
          !value.includes(item.metadata[key as keyof typeof item.metadata])) {
        return false;
      }
    }
    else if (item.metadata[key as keyof typeof item.metadata] !== value) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculates vector similarity between query and document
 */
function calculateVectorSimilarity(queryEmbedding: number[], itemEmbedding: number[]): number {
  if (!queryEmbedding || !itemEmbedding) return 0;
  
  // Compute cosine similarity
  let dotProduct = 0;
  let queryMagnitude = 0;
  let itemMagnitude = 0;
  
  for (let i = 0; i < queryEmbedding.length; i++) {
    dotProduct += queryEmbedding[i] * itemEmbedding[i];
    queryMagnitude += queryEmbedding[i] * queryEmbedding[i];
    itemMagnitude += itemEmbedding[i] * itemEmbedding[i];
  }
  
  queryMagnitude = Math.sqrt(queryMagnitude);
  itemMagnitude = Math.sqrt(itemMagnitude);
  
  if (queryMagnitude === 0 || itemMagnitude === 0) return 0;
  
  return dotProduct / (queryMagnitude * itemMagnitude);
}

/**
 * Calculates metadata-based boost factors for a document
 */
function calculateMetadataBoost(
  item: VectorStoreItem, 
  query: string, 
  filter?: HybridSearchFilter
): {
  totalBoost: number;
  matchesCategory: boolean;
  categoryBoost: number;
  technicalLevelMatch: number;
} {
  let totalBoost = 1.0;
  let matchesCategory = false;
  let categoryBoost = 1.0;
  let technicalLevelMatch = 1.0;
  
  // Default result if no metadata or filter
  if (!item.metadata || !filter) {
    return { totalBoost, matchesCategory, categoryBoost, technicalLevelMatch };
  }
  
  // Apply category boost if filter specifies categories
  if (filter.categories && filter.categories.length > 0 && item.metadata.category) {
    const itemCategory = item.metadata.category.toUpperCase() as DocumentCategory;
    matchesCategory = filter.categories.includes(itemCategory);
    
    if (matchesCategory) {
      // Boost matches by 1.5x
      categoryBoost = 1.5;
      totalBoost *= categoryBoost;
      
      // Even more boost for primary category match (first in the filter list)
      if (filter.categories[0] === itemCategory) {
        totalBoost *= 1.2; // Additional 20% boost for primary category
      }
    }
  }
  
  // Apply technical level match boost
  if (
    filter.technicalLevelMin !== undefined && 
    filter.technicalLevelMax !== undefined && 
    item.metadata.technicalLevel !== undefined
  ) {
    const techLevel = item.metadata.technicalLevel as number;
    const midpoint = (filter.technicalLevelMin + filter.technicalLevelMax) / 2;
    
    // Calculate how close the document's technical level is to the midpoint
    const distance = Math.abs(techLevel - midpoint);
    const range = (filter.technicalLevelMax - filter.technicalLevelMin) / 2;
    
    // Higher boost for closer match to the midpoint technical level
    if (range > 0) {
      // 1.0 (perfect match) to 0.8 (edge of range)
      technicalLevelMatch = 1.0 - (0.2 * (distance / range));
      totalBoost *= technicalLevelMatch;
    }
  }
  
  // Additional boost factors can be added here
  
  // Keyword presence boost
  if (item.metadata.keywords) {
    const keywordsText = item.metadata.keywords as string;
    const keywords = keywordsText.toLowerCase().split(',').map(k => k.trim());
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    // Count matching keywords in the query
    const matchingKeywords = queryTerms.filter(term => 
      keywords.some(keyword => keyword.includes(term))
    ).length;
    
    if (matchingKeywords > 0) {
      // Boost by 10% per matching keyword, up to 50%
      const keywordBoost = 1.0 + Math.min(0.5, matchingKeywords * 0.1);
      totalBoost *= keywordBoost;
    }
  }
  
  // Entity match boost
  if (item.metadata.entities && filter.requiredEntities) {
    const entitiesText = item.metadata.entities as string;
    const entities = entitiesText.toLowerCase().split(',').map(e => e.trim());
    
    // Count matching entities
    const matchingEntities = filter.requiredEntities.filter(required => 
      entities.some(entity => entity.includes(required.toLowerCase()))
    ).length;
    
    if (matchingEntities > 0) {
      // Boost by 25% per matching entity
      const entityBoost = 1.0 + (matchingEntities * 0.25);
      totalBoost *= entityBoost;
    }
  }
  
  return { totalBoost, matchesCategory, categoryBoost, technicalLevelMatch };
} 