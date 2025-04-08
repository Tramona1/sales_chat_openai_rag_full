/**
 * Hybrid Search Module for Smart Query Routing
 * 
 * This module combines vector search and BM25 with metadata-aware filtering
 * to improve retrieval accuracy based on query analysis and document metadata.
 */

import { VectorStoreItem, getAllVectorStoreItems, cosineSimilarity, getSimilarItems } from './vectorStore';
import { calculateBM25Score, loadCorpusStatistics } from './bm25';
import { embedText } from './openaiClient';
import { logError, logInfo } from './errorHandling';
import { DocumentCategory } from '../types/metadata';
import fs from 'fs';
import path from 'path';
import { DocumentCategoryType } from './documentCategories';
import { 
  filterDocumentsByCategoryPath,
  parseCategoryPath,
  buildCategoryHierarchyWithCounts,
  getAllEntitiesFromDocuments,
  getTechnicalLevelDistribution,
  CategoryHierarchy
} from './hierarchicalCategories';

// Local types instead of importing from @/types/search
interface Document {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

interface DocumentEmbedding extends Document {
  embedding: number[];
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

interface SearchResultItem {
  text: string;
  source?: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
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
  item: VectorStoreItem;
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

// Update HybridSearchOptions interface to include hierarchy-related options
export interface HybridSearchOptions {
  limit?: number;
  includeDeprecated?: boolean; // Option to include deprecated documents
  onlyAuthoritative?: boolean; // Option to only include authoritative documents
  priorityInfoType?: string;
  categoryPath?: string[]; // Add support for hierarchical category filtering
  includeFacets?: boolean; // Option to include facet information in results
  technicalLevelRange?: { min: number; max: number }; // Technical level filtering
  entityFilters?: Record<string, string[]>; // Entity-based filtering
}

// Update interface to include facets and implement iterable for backwards compatibility
export interface HybridSearchResponse {
  results: Array<VectorStoreItem & { score: number }>;
  facets?: {
    categories: CategoryHierarchy[];
    entities: Record<string, Array<{ name: string, count: number }>>;
    technicalLevels: Array<{ level: number, count: number }>;
  };
  [Symbol.iterator](): Iterator<VectorStoreItem & { score: number }>;
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
    // Log the search query and parameters
    console.log(`Searching for: "${query}"`);
    console.log(`Search parameters: limit=${limit}, hybridRatio=${hybridRatio}, filter=${JSON.stringify(filter || {})}`);
    
    // Enhanced query analysis - using a more flexible pattern-based approach
    const lowercaseQuery = query.toLowerCase();
    
    // Check for company-specific signals using possessive pronouns and company name
    const isCompanyQuery = /\b(our|we|us|workstream)\b/i.test(query);
    
    // Check for question words which often indicate information-seeking queries
    const isQuestionQuery = /\b(what|who|how|when|where|why|which|tell me about|explain)\b/i.test(query);
    
    // Check for product-related terms directly
    const isProductQuery = /\b(product|service|feature|offering|platform|solution|tool|application|app|software)\b/i.test(query);
    
    // Check for feature-related queries specifically
    const isFeatureQuery = /\b(feature|new feature|latest feature|launch|update|upgrade|release|rollout)\b/i.test(query);
    
    // Check for time references that might indicate recent feature queries
    const hasTimeReference = /\b(recent|recently|new|latest|this quarter|this month|this year)\b/i.test(query);
    
    // Special handling for feature queries with time references
    const isRecentFeaturesQuery = isFeatureQuery && hasTimeReference;
    
    // Check for leadership/CEO-related queries
    const isLeadershipQuery = /\b(ceo|chief executive|leadership|founder|executive|management team|executive team|desmond lim)\b/i.test(query);
    
    // Determine if this is likely a company-specific information query
    const isCompanyInfoQuery = isCompanyQuery && (isQuestionQuery || isProductQuery);
    
    console.log(`Query analysis: company-specific=${isCompanyQuery}, question format=${isQuestionQuery}, product-related=${isProductQuery}, feature-query=${isFeatureQuery}, time-reference=${hasTimeReference}, recent-features=${isRecentFeaturesQuery}, info query=${isCompanyInfoQuery}, leadership-query=${isLeadershipQuery}`);
    
    // Check for investor-related queries
    const isInvestorQuery = /\b(investor|funding|investment|venture|capital|vc|backed|series|raised)\b/i.test(query);
    
    // If this is an investor query, temporarily modify the filter to include all categories
    let effectiveFilter = filter;
    if (isInvestorQuery) {
      console.log("Detected investor-related query, enabling investor-specific search");
      // Create a modified version of the filter with broader category settings
      effectiveFilter = {
        ...filter,
        categories: ['GENERAL', 'PRODUCT', 'CUSTOMER_CASE'],
        strictCategoryMatch: false,
        technicalLevelMin: 1,
        technicalLevelMax: 10
      };
    }
    
    // If this is a leadership query, temporarily modify the filter to be more inclusive
    else if (isLeadershipQuery) {
      console.log("Detected leadership/CEO-related query, enabling leadership-specific search");
      // Create a modified version of the filter with broader category settings for leadership
      effectiveFilter = {
        ...filter,
        categories: ['PRODUCT', 'GENERAL', 'FAQ'] as DocumentCategory[],
        strictCategoryMatch: false,
        technicalLevelMin: 0,
        technicalLevelMax: 10
      };
    }
    
    // If this is a feature query with time reference, adjust the filter to be more permissive
    if (isRecentFeaturesQuery) {
      console.log('This is a query about recent features - adjusting filter to be more permissive');
      if (effectiveFilter) {
        // Initialize categories array if it doesn't exist
        if (!effectiveFilter.categories) {
          effectiveFilter.categories = [];
        }
        
        // Make sure we include the FEATURES category
        if (!effectiveFilter.categories.includes('features' as any)) {
          effectiveFilter.categories.push('features' as any);
        }
        // Also include PRODUCT as fallback since they often contain feature info
        if (!effectiveFilter.categories.includes('product' as any)) {
          effectiveFilter.categories.push('product' as any);
        }
        // Make category matching less strict for these queries
        effectiveFilter.strictCategoryMatch = false;
      }
    }
    
    // Generate query embedding for vector search
    const queryEmbedding = await embedText(query);
    
    // Tokenize query for BM25 search
    const queryTokens = tokenizeText(query);
    console.log(`Tokenized query: [${queryTokens.join(', ')}]`);
    
    // Split query into search terms for simple text matching
    const searchTerms = lowercaseQuery.split(/\s+/).filter(term => term.length > 2);
    
    // Add commonly searched terms for product-related queries
    let enhancedSearchTerms = [...searchTerms];
    if (isProductQuery || lowercaseQuery.includes('product')) {
      enhancedSearchTerms = [...enhancedSearchTerms, 'product', 'service', 'feature', 'solution', 'platform'];
    }
    
    // Find relevant documents using both methods
    const results: SearchResult[] = [];
    
    // Keep track of how many documents were discarded by filter
    let filteredOutCount = 0;
    let processedCount = 0;
    
    // Fallback documents to use if we don't find enough matches
    const fallbackDocuments: Array<{doc: Document, score: number}> = [];
    
    for (const doc of vectorDocuments) {
      processedCount++;
      let vectorScore = 0;
      let bm25Score = 0;
      let textMatchScore = 0;
      
      // Apply the effective filter (original or modified)
      if (effectiveFilter && !applyMetadataFilter(doc, effectiveFilter)) {
        filteredOutCount++;
        
        // For company-specific queries, keep some documents as fallbacks even if they don't match the filter
        if (isCompanyInfoQuery && doc.text) {
          const lowercaseText = doc.text.toLowerCase();
          
          // Keep documents that mention products or the company
          if (lowercaseText.includes('workstream') || lowercaseText.includes('product')) {
            const basicScore = calculateBasicTextMatch(lowercaseText, enhancedSearchTerms);
            if (basicScore > 0.1) {
              fallbackDocuments.push({doc, score: basicScore});
            }
          }
        }
        continue;
      }
      
      // Simple text match for all documents - this is crucial for when embeddings fail
      if (doc.text) {
        const lowercaseText = doc.text.toLowerCase();
        const docSource = (doc.metadata?.source || '').toLowerCase();
        
        // Check for company name in the document - this is a strong signal
        if (lowercaseText.includes('workstream')) {
          textMatchScore += 0.3;
        }
        
        // For investor-related queries, boost documents from the investor page or with investor information
        if (isInvestorQuery) {
          // Strongly boost the dedicated investors page
          if (docSource.includes('/investors')) {
            textMatchScore += 1.5;
          }
          
          // Boost documents from the about page which often has investor info
          if (docSource.includes('/about')) {
            textMatchScore += 0.7;
          }
          
          // Boost documents containing investor lists
          if (lowercaseText.includes('our investors') || 
              lowercaseText.includes('backed by') || 
              lowercaseText.includes('series a') || 
              lowercaseText.includes('series b') || 
              lowercaseText.includes('funding round')) {
            textMatchScore += 0.8;
          }
        }
        
        // For product-related queries, boost documents that mention products explicitly
        if (isProductQuery && (lowercaseText.includes('product') || lowercaseText.includes('service'))) {
          textMatchScore += 0.4;
        }
        
        // For company information queries, find documents with exact matches of search terms
        if (isCompanyInfoQuery) {
          // Count how many query terms appear in the document
          let matchedTermCount = 0;
          let importantTermMatches = 0;
          
          for (const term of enhancedSearchTerms) {
            if (lowercaseText.includes(term)) {
              matchedTermCount++;
              
              // Identify important non-stopwords (length > 4 is a simple heuristic)
              if (term.length > 4) {
                importantTermMatches++;
                textMatchScore += 0.1; // Boost for important term matches
              } else {
                textMatchScore += 0.02; // Smaller boost for common words
              }
            }
          }
          
          // Calculate term match ratio (what percentage of query terms are in the document)
          const termMatchRatio = enhancedSearchTerms.length > 0 ? matchedTermCount / enhancedSearchTerms.length : 0;
          
          // Boost documents that match a high percentage of query terms
          if (termMatchRatio > 0.3) { // Lowered from 0.5 to be more lenient
            textMatchScore += 0.2; // Significant boost for high coverage
          }
          
          // Boost documents with source URLs that might contain the query topics
          if (searchTerms.some(term => docSource.includes(term))) {
            textMatchScore += 0.15;
          }
        }
      }
      
      // Calculate BM25 score if we have corpus stats
      const hasCorpusStats = documentCount > 0 && Object.keys(documentFrequencies).length > 0;
      if (hasCorpusStats) {
        // Get document tokens
        const docTokens = tokenizeText(doc.text);
        
        // Calculate BM25 score for each query token
        for (const token of queryTokens) {
          if (!documentFrequencies[token] || documentFrequencies[token] <= 0) continue;
          
          // Count token occurrences in document
          const tf = docTokens.filter(t => t === token).length;
          if (tf <= 0) continue;
          
          // Calculate BM25 for this token
          const idf = Math.log((documentCount - documentFrequencies[token] + 0.5) / (documentFrequencies[token] + 0.5) + 1);
          const k1 = 1.2; // BM25 parameter
          const b = 0.75; // BM25 parameter
          const avgDocLength = 300; // Average document length (this could be calculated more precisely)
          const docLength = docTokens.length;
          
          // BM25 score formula
          const numerator = tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
          const termScore = idf * (numerator / denominator);
          
          // For company info queries, give higher weight to BM25 scores
          if (isCompanyInfoQuery) {
            bm25Score += termScore * 1.5;
          } else {
            bm25Score += termScore;
          }
        }
      } else {
        // Fallback if corpus stats aren't available - use text match score
        bm25Score = textMatchScore * 0.8;
      }
      
      // Calculate vector score if document has embedding
      if (doc.hasOwnProperty('embedding') && Array.isArray((doc as any).embedding)) {
        const docEmbedding = (doc as any).embedding;
        vectorScore = cosineSimilarity(queryEmbedding, docEmbedding);
      } else if (textMatchScore > 0) {
        // For documents without embeddings but with text matches, 
        // assign a small vector score to ensure they get considered
        vectorScore = 0.15 * textMatchScore;
      }
      
      // Dynamic hybridRatio adjustment based on query type and text matches
      let effectiveHybridRatio = hybridRatio;
      
      // For company info queries, bias more toward text matching
      if (isCompanyInfoQuery) {
        // If we have good text matches, reduce vector influence
        if (textMatchScore > 0.3) {
          effectiveHybridRatio = Math.max(0.2, hybridRatio - 0.2);
        }
      }
      
      // Combined score calculation - weighted average of the scores
      let combinedScore = (vectorScore * effectiveHybridRatio) + (bm25Score * (1 - effectiveHybridRatio));
      
      // Add text match score as a bonus for all queries
      if (textMatchScore > 0) {
        // Higher boost for company info queries
        const textMatchBoost = isCompanyInfoQuery ? 0.35 : 0.15; // Increased boost
        combinedScore += textMatchScore * textMatchBoost;
      }
      
      // For product-related queries with company context, further boost the score
      if (isCompanyInfoQuery && isProductQuery && textMatchScore > 0) {
        combinedScore *= 1.3; // 30% boost
      }
      
      // For company documents with company queries, always include even if score is low
      const isCompanyDoc = doc.text && doc.text.toLowerCase().includes('workstream');
      const shouldForceInclude = isCompanyQuery && isCompanyDoc && textMatchScore > 0;
      
      // Lower threshold for inclusion - increase recall for product-related queries
      const inclusionThreshold = isProductQuery ? 0.05 : 0.1;
      
      // Only add if the document has some relevance
      if (combinedScore > inclusionThreshold || shouldForceInclude) {
        // If we need to force include a company document, ensure a minimum score
        if (shouldForceInclude && combinedScore < 0.15) {
          combinedScore = 0.15;
        }
        
        results.push({
          item: doc,
          score: combinedScore,
          vectorScore,
          bm25Score
        });
      }
    }
    
    // Add fallback documents if we don't have enough results
    if (results.length < limit && isCompanyInfoQuery && fallbackDocuments.length > 0) {
      console.log(`Adding ${Math.min(fallbackDocuments.length, limit - results.length)} fallback documents because we only found ${results.length} results`);
      
      // Sort fallbacks by score and take what we need
      const sortedFallbacks = fallbackDocuments
        .sort((a, b) => b.score - a.score)
        .slice(0, limit - results.length);
      
      // Add fallbacks to results
      sortedFallbacks.forEach(({doc, score}) => {
        results.push({
          item: doc,
          score: score * 0.8, // Slightly discount fallback scores
          vectorScore: 0,
          bm25Score: score
        });
      });
    }
    
    // Second-level fallback: If we still have zero results, try without any filters
    // This is especially important for CEO/leadership queries
    if (results.length === 0 && effectiveFilter) {
      console.log(`No results found with filters. Attempting a more relaxed search...`);
      
      // Create a minimal count of results by scanning all documents without filters
      const unfilteredResults: SearchResult[] = [];
      for (const doc of vectorDocuments) {
        if (doc.text) {
          const lowercaseText = doc.text.toLowerCase();
          // Very simple relevance check - just look for any query terms
          const relevanceScore = calculateBasicTextMatch(lowercaseText, searchTerms);
          
          if (relevanceScore > 0) {
            unfilteredResults.push({
              item: doc,
              score: relevanceScore * 0.7, // Mark these as less relevant
              vectorScore: 0,
              bm25Score: relevanceScore
            });
          }
        }
      }
      
      // If we found some results without filters, use them
      if (unfilteredResults.length > 0) {
        console.log(`Found ${unfilteredResults.length} results without filters`);
        // Sort by score and take only what we need
        const sortedUnfiltered = unfilteredResults
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        
        // Use these as our results
        return sortedUnfiltered;
      }
    }
    
    // Log search statistics
    console.log(`Processed ${processedCount} documents. Filtered out: ${filteredOutCount}. Results before sorting: ${results.length}`);
    
    // Sort by combined score (descending) and take top 'limit' results
    const sortedResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    console.log(`Hybrid search found ${sortedResults.length} results`);
    if (sortedResults.length > 0) {
      console.log(`Top result: score=${sortedResults[0].score.toFixed(4)}, bm25=${sortedResults[0].bm25Score?.toFixed(4) || 'n/a'}, vector=${sortedResults[0].vectorScore?.toFixed(4) || 'n/a'}`);
      console.log(`Top result source: ${sortedResults[0].item.metadata?.source || 'Unknown'}`);
      console.log(`Top result excerpt: ${sortedResults[0].item.text.substring(0, 150)}...`);
    }
    
    return sortedResults;
  } catch (error) {
    logError('Hybrid search failed', error);
    return [];
  }
}

/**
 * Calculate a basic text match score between document text and search terms
 */
function calculateBasicTextMatch(documentText: string, searchTerms: string[]): number {
  let score = 0;
  let matchCount = 0;
  
  for (const term of searchTerms) {
    if (documentText.includes(term)) {
      matchCount++;
      score += term.length > 4 ? 0.15 : 0.05;
    }
  }
  
  // Boost if most terms match
  if (matchCount > searchTerms.length * 0.6) {
    score += 0.2;
  }
  
  return score;
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

/**
 * Enhanced hybrid search that combines vector search with keyword-based content filtering
 * and can exclude deprecated documents
 * 
 * @param query User query text
 * @param options Search options like limit, includeDeprecated, etc.
 * @returns Array of matching documents with scores
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResponse> {
  const {
    limit = 10,
    includeDeprecated = false,
    onlyAuthoritative = false,
    priorityInfoType,
    categoryPath,
    includeFacets = false,
    technicalLevelRange,
    entityFilters
  } = options;
  
  // Get search results using the existing implementation
  const searchResults = await performSearchImplementation(
    query, 
    limit, 
    includeDeprecated, 
    onlyAuthoritative, 
    priorityInfoType
  );
  
  // Filter by category path if needed
  let filteredResults = [...searchResults];
  if (categoryPath && categoryPath.length > 0) {
    const categoryFilteredItems = filterDocumentsByCategoryPath(
      searchResults, 
      categoryPath
    );
    
    // Keep only items that remain after filtering
    filteredResults = searchResults.filter(item => 
      categoryFilteredItems.some(filtered => filtered.id === item.id)
    );
  }
  
  // Apply technical level filtering if specified
  if (technicalLevelRange) {
    filteredResults = filteredResults.filter(item => {
      if (!item.metadata?.technicalLevel) return false;
      
      // Parse technical level value - safely handle both string and number types
      let techLevel: number;
      if (typeof item.metadata.technicalLevel === 'string') {
        techLevel = parseInt(item.metadata.technicalLevel, 10);
      } else if (typeof item.metadata.technicalLevel === 'number') {
        techLevel = item.metadata.technicalLevel;
      } else {
        return false;
      }
      
      // Check against range
      return !isNaN(techLevel) && 
        techLevel >= technicalLevelRange.min && 
        techLevel <= technicalLevelRange.max;
    });
  }
  
  // Apply entity filters if specified
  if (entityFilters && Object.keys(entityFilters).length > 0) {
    filteredResults = filteredResults.filter(item => {
      if (!item.metadata?.entities) return false;
      
      // Parse entities JSON string
      try {
        const entitiesStr = item.metadata.entities as string;
        const entities = typeof entitiesStr === 'string' ? 
          JSON.parse(entitiesStr) : entitiesStr;
        
        // Check each entity type filter
        return Object.entries(entityFilters).every(([entityType, requiredEntities]) => {
          if (!entities[entityType] || !Array.isArray(entities[entityType])) return false;
          
          // At least one required entity must exist in the document
          return requiredEntities.some(requiredEntity => 
            entities[entityType].some((entity: any) => {
              if (typeof entity === 'string') return entity === requiredEntity;
              if (typeof entity === 'object' && entity.name) return entity.name === requiredEntity;
              return false;
            })
          );
        });
      } catch (e) {
        return false; // Failed to parse entities
      }
    });
  }
  
  // Limit to requested number of results
  const limitedResults = filteredResults.slice(0, limit);
  
  // Build facets if requested
  let facets;
  if (includeFacets) {
    // Build category hierarchy with counts
    const categories = buildCategoryHierarchyWithCounts(filteredResults);
    
    // Get entity distribution
    const entities = getAllEntitiesFromDocuments(filteredResults);
    
    // Get technical level distribution
    const technicalLevels = getTechnicalLevelDistribution(filteredResults);
    
    facets = { categories, entities, technicalLevels };
  }
  
  // Create response with properly implemented Symbol.iterator for backwards compatibility
  const response: HybridSearchResponse = {
    results: limitedResults,
    facets,
    *[Symbol.iterator]() {
      for (const result of this.results) {
        yield result;
      }
    }
  };
  
  return response;
}

// Helper function to perform the actual search (using the existing implementation)
async function performSearchImplementation(
  query: string, 
  limit: number,
  includeDeprecated: boolean,
  onlyAuthoritative: boolean,
  priorityInfoType?: string
): Promise<Array<VectorStoreItem & { score: number; vectorScore: number; bm25Score: number }>> {
  // Generate embedding for the query
  const embedding = await embedText(query);
  
  // Get all vector store items
  let availableItems = getAllVectorStoreItems();
  
  // Apply filters for deprecated/authoritative docs
  if (!includeDeprecated) {
    availableItems = availableItems.filter(item => 
      item.metadata?.isDeprecated !== 'true'
    );
  }
  
  if (onlyAuthoritative) {
    availableItems = availableItems.filter(item => 
      item.metadata?.isAuthoritative === 'true'
    );
  }
  
  // Calculate vector similarity for all items
  const vectorResults = availableItems.map(item => ({
    ...item,
    vectorScore: calculateVectorSimilarity(embedding, item.embedding),
    score: 0, // Will be updated with final score
    bm25Score: 0 // Initialize bm25Score
  }));
  
  // Calculate BM25 scores
  const queryTokens = tokenizeText(query);
  const documentsForBM25 = availableItems.map(item => ({
    id: item.id || item.metadata?.source || '',
    text: item.text
  }));
  
  const bm25Results = computeBM25Scores(queryTokens, documentsForBM25);
  
  // Map BM25 scores to vector results
  const resultMap = new Map<string, typeof vectorResults[0]>();
  
  // First, index all vector results by ID
  vectorResults.forEach(item => {
    const id = item.id || item.metadata?.source || '';
    if (id) resultMap.set(id, item);
  });
  
  // Then, add BM25 scores to the indexed items
  bm25Results.forEach(bm25Item => {
    const vectorItem = resultMap.get(bm25Item.item.id);
    if (vectorItem) {
      vectorItem.bm25Score = bm25Item.score;
    }
  });
  
  // Calculate hybrid scores and add metadata boosts
  const results = [...resultMap.values()].map(item => {
    // Default BM25 score to 0 if not calculated
    const bm25Score = item.bm25Score || 0;
    
    // Calculate metadata boost
    const metadataBoost = calculateMetadataBoost(item, query, undefined);
    
    // Hybrid score is weighted combination of vector and BM25
    const hybridScore = (0.7 * item.vectorScore) + (0.3 * bm25Score);
    
    // Final score includes metadata boost
    const finalScore = hybridScore * (1 + metadataBoost.totalBoost);
    
    return {
      ...item,
      bm25Score,
      vectorScore: item.vectorScore,
      metadata: {
        ...item.metadata,
        matchesCategory: metadataBoost.matchesCategory,
        categoryBoost: metadataBoost.categoryBoost,
        technicalLevelMatch: metadataBoost.technicalLevelMatch
      },
      score: finalScore
    };
  });
  
  // Sort results by score
  results.sort((a, b) => b.score - a.score);
  
  return results;
}

/**
 * Perform multiple search variants and return the best results
 * This is used as a fallback if the primary search returns no results
 * 
 * @param query User query text
 * @returns Best search results from various search variants
 */
export async function fallbackSearch(
  query: string
): Promise<(VectorStoreItem & { score: number })[]> {
  console.log('Performing fallback search with multiple variants');
  
  // Try different search configurations
  const searchVariants = [
    // Base search without restrictions
    hybridSearch(query, { limit: 5 }),
    
    // Include deprecated documents (as they may still be relevant)
    hybridSearch(query, { includeDeprecated: true, limit: 5 }),
    
    // Only authoritative documents but with a higher limit
    hybridSearch(query, { onlyAuthoritative: true, limit: 8 })
  ];
  
  // Wait for all search variants to complete
  const variantResults = await Promise.all(searchVariants);
  
  // Combine all results
  const combinedResults: (VectorStoreItem & { score: number })[] = [];
  const includedIds = new Set<string>();
  
  // Process each result set in priority order
  for (const resultSet of variantResults) {
    for (const doc of resultSet.results) {
      const docId = doc.metadata?.source || doc.id;
      
      // Only include each document once
      if (docId && !includedIds.has(docId)) {
        includedIds.add(docId);
        combinedResults.push(doc);
      }
    }
  }
  
  // Sort by score and return top 5
  return combinedResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
} 