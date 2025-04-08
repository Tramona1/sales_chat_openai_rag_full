# RAG System Technical Documentation

This document provides a comprehensive technical explanation of the Retrieval-Augmented Generation (RAG) system implemented in this application. It covers the entire lifecycle from document upload to search and answer generation.

## Table of Contents

1. [System Overview](#system-overview)
2. [Document Processing Pipeline](#document-processing-pipeline)
3. [Vector Store Implementation](#vector-store-implementation)
4. [Embedding Generation](#embedding-generation)
5. [Search Infrastructure](#search-infrastructure)
   - [Query Analysis & Routing](#query-analysis--routing)
   - [Hybrid Search Implementation](#hybrid-search-implementation)
   - [Metadata-Aware Filtering](#metadata-aware-filtering)
   - [BM25 Implementation](#bm25-implementation)
   - [Hierarchical Category Management](#hierarchical-category-management) 
   - [Advanced Search Options](#advanced-search-options)
   - [Reranking Mechanism](#reranking-mechanism)
   - [Search Flow Diagram](#search-flow-diagram)
6. [Answer Generation](#answer-generation)
7. [API Integration](#api-integration)
8. [Batch Processing](#batch-processing)
9. [Technical Architecture Diagram](#technical-architecture-diagram)

## System Overview

The RAG (Retrieval-Augmented Generation) system combines vector search, keyword search, and language model capabilities to provide accurate answers based on a corpus of company knowledge. The system works in several key stages:

1. **Document Ingestion**: Documents are uploaded, processed, and split into chunks
2. **Embedding Generation**: Text chunks are converted to vector embeddings using OpenAI's embedding model
3. **Vector Storage**: Embeddings and metadata are stored in a vector database
4. **Query Processing**: User queries are analyzed and routed to appropriate search strategies
5. **Hybrid Search**: Combining vector similarity and keyword search for optimal retrieval
6. **Answer Generation**: Using LLMs to generate coherent answers from retrieved context

## Document Processing Pipeline

### Document Upload

When documents are uploaded to the system, they go through the following process:

1. **File Handling**: The system accepts various file formats including PDF, DOCX, and TXT
2. **Text Extraction**: Content is extracted using appropriate libraries (pdf-parse for PDFs, mammoth for DOCX)
3. **Text Preprocessing**: The extracted text is cleaned and normalized
4. **Chunking**: Text is split into manageable chunks (default 500 tokens) using the `splitIntoChunks` function
5. **Metadata Extraction**: The system detects structured information like company values, investors, etc.

### Document Chunking Logic

The chunking logic is sophisticated and context-aware:

```typescript
export function splitIntoChunks(
  text: string, 
  chunkSize: number = 500,
  source?: string
): Array<{ text: string; metadata?: { isStructured?: boolean; infoType?: string; } }> {
  // Clean the text
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // Handle short texts
  if (cleanedText.length <= chunkSize) {
    // Check for structured information
    const structuredInfo = detectStructuredInfo(cleanedText);
    // Add appropriate metadata
    // ...
  }

  // Special handling for career and about pages
  const isAboutPage = source?.includes('/about') || source?.toLowerCase().includes('about us');
  const isCareersPage = source?.includes('/careers') || source?.toLowerCase().includes('careers');
  
  if (isAboutPage || isCareersPage) {
    return splitStructuredContent(cleanedText, chunkSize, source);
  }

  // Standard chunking for other content
  return splitRegularContent(cleanedText, chunkSize);
}
```

The system uses specialized logic for structured content to preserve context and semantic meaning.

### Advanced Document Processing

For documents requiring deeper understanding, the system can use advanced processing capabilities:

```typescript
export async function processDocumentWithUnderstanding(
  document: {
    text: string;
    metadata?: Record<string, any>;
    filename?: string;
  },
  options: {
    extractEntities?: boolean;
    summarize?: boolean;
    categorize?: boolean;
  } = {}
): Promise<{
  processedDocument: {
    text: string;
    metadata?: Record<string, any>;
    filename?: string;
  };
  entities?: string[];
  summary?: string;
  categories?: string[];
}> {
  // Process document with advanced understanding...
}
```

This enables entity extraction, summarization, and categorization to enrich document metadata.

## Vector Store Implementation

### Data Storage Structure

The vector store is designed to handle large document collections efficiently:

1. **In-Memory Storage**: For fast query performance, vectors are loaded into memory
2. **Batch-Based Persistence**: Documents are stored in batch files to manage scale
3. **Backup File**: A single file backup is maintained for redundancy
4. **Metadata Storage**: Rich metadata is stored alongside vectors for filtering

### Vector Store Interface

The core data structure is the `VectorStoreItem`:

```typescript
export interface VectorStoreItem {
  id?: string;
  embedding: number[];
  text: string;
  metadata?: {
    source?: string;
    page?: number;
    batch?: string;
    isStructured?: boolean;
    infoType?: string;
    priority?: string;
    category?: string;
    technicalLevel?: number;
    entities?: string;
    keywords?: string;
    summary?: string;
    lastUpdated?: string;
    timestamp?: string;
    createdAt?: string;
    approvedAt?: string;
    isAuthoritative?: string;
    isDeprecated?: string;
    deprecatedBy?: string;
    deprecatedAt?: string;
  };
}
```

### Batch Management

The system uses a batch approach to manage vector storage:

```typescript
// Constants for batch processing
const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
const BATCH_INDEX_FILE = path.join(process.cwd(), 'data', 'batch_index.json');
const MAX_BATCH_SIZE = 1000; // Maximum items per batch file
```

Key functions:
- `loadVectorStore()`: Loads active batches from disk
- `createNewBatch()`: Creates a new batch when needed
- `saveBatch()`: Persists a specific batch to disk
- `saveVectorStore()`: Saves the current state of all batches

This batch system ensures efficient management of large document collections.

### Document Addition and Deletion

When adding documents to the vector store:

```typescript
export function addToVectorStore(items: VectorStoreItem | VectorStoreItem[]): void {
  // Convert single item to array
  const itemsArray = Array.isArray(items) ? items : [items];
  if (itemsArray.length === 0) return;
  
  // Add to in-memory store
  vectorStore = [...vectorStore, ...itemsArray];
  
  // Save changes to disk
  saveVectorStore();
}
```

Deletion ensures documents are removed from all storage locations (in-memory, batch files, and backups).

## Embedding Generation

### OpenAI Embedding Generation

The system uses OpenAI's embedding model to convert text into vectors:

```typescript
export async function embedText(text: string): Promise<number[]> {
  try {
    // Clean and prepare text
    const cleanedText = text.trim().replace(/\n+/g, ' ');
    
    // Get embedding from OpenAI
    const response = await openai.embeddings.create({
      model: AI_SETTINGS.embeddingModel,
      input: cleanedText,
    });
    
    // Return the embedding vector
    return response.data[0].embedding;
  } catch (error) {
    logError('Error generating embedding', error);
    // Fallback to zero vector
    return Array(1536).fill(0);
  }
}
```

The embeddings are 1536-dimensional vectors that represent the semantic meaning of the text, enabling similarity-based searches.

### Similarity Calculation

Cosine similarity is used to measure the similarity between embeddings:

```typescript
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}
```

## Search Infrastructure

### Query Analysis & Routing

The system begins the search process by analyzing the query to determine the optimal search strategy:

```typescript
// From query.ts API handler
// Step 1: Analyze the query to determine optimal retrieval strategy
const queryAnalysis = await analyzeQuery(query);

// Step 2: Get retrieval parameters based on analysis
const retrievalParams = getRetrievalParameters(queryAnalysis);
```

The `analyzeQuery` function examines the query for:
- Primary topic/category (product, company, technical, pricing)
- Query type (factual, comparative, procedural, exploratory)
- Entity extraction (product names, features, technical terms)
- Query complexity and technical level

Based on this analysis, the system determines:
- The optimal hybrid ratio between vector and keyword search
- Which metadata filters to apply
- Whether to use query expansion for broader context
- Whether reranking should be applied
- The technical level range to target

This intelligent routing ensures the most effective search strategy is used for each query type.

### Query Expansion

For queries that might benefit from additional context, the system can expand the original query:

```typescript
if (searchOptions.expandQuery) {
  try {
    const expandedResult = await expandQuery(query);
    processedQuery = expandedResult.expandedQuery;
    console.log(`DEBUG: Expanded query: "${processedQuery}"`);
  } catch (err) {
    console.error('Error expanding query, using original:', err);
  }
}
```

Query expansion uses LLM capabilities to:
- Add synonyms and related terms
- Reframe ambiguous queries
- Include company-specific terminology
- Broaden narrow queries for better recall

### Hybrid Search Implementation

The system uses a sophisticated hybrid search that combines multiple search strategies:

1. **Vector Similarity Search**: Using cosine similarity between embeddings
2. **BM25 Keyword Search**: Based on term frequency and document frequency
3. **Metadata Filtering**: For categories, technical levels, etc.

The hybrid search function:

```typescript
export async function performHybridSearch(
  query: string,
  limit: number = 10,
  hybridRatio: number = 0.5,
  filter?: MetadataFilter
): Promise<SearchResult[]> {
  // Generate embedding for the query
  const queryEmbedding = await embedText(query);
  
  // Perform vector search
  const vectorResults = performVectorSearch(queryEmbedding, limit * 2);
  
  // Perform keyword search
  const keywordResults = performKeywordSearch(query, limit * 2);
  
  // Combine and rerank results
  const combinedResults = combineSearchResults(
    vectorResults, 
    keywordResults, 
    hybridRatio
  );
  
  // Apply metadata filters
  const filteredResults = applyFilters(combinedResults, filter);
  
  // Return top results
  return filteredResults.slice(0, limit);
}
```

The `hybridRatio` parameter controls the balance between semantic (vector) and lexical (keyword) search strategies, and is dynamically adjusted based on query analysis.

### Metadata-Aware Filtering

The search system includes robust metadata filtering capabilities:

```typescript
// From hybridSearch.ts
// The hybrid search includes category-specific boosting
if (shouldBoostStructuredInfo && item.metadata?.isStructured) {
  // Specific boosts for different types of structured information
  const infoType = item.metadata?.infoType;
  
  // Handle the case when a specific info type is prioritized
  if (priorityInfoType && infoType === priorityInfoType) {
    score *= 1.5; // Strong boost for exact info type match
  }
  // Otherwise, apply standard boosts
  else if (shouldBoostCompanyValues && infoType === 'company_values') {
    score *= 1.3;
  } else if (shouldBoostInvestors && infoType === 'investors') {
    score *= 1.3;
  } else if (shouldBoostLeadership && infoType === 'leadership') {
    score *= 1.3;
  } else if (shouldBoostPricing && infoType === 'pricing') {
    score *= 1.3;
  } else if (shouldBoostProductFeatures && infoType === 'product_features') {
    score *= 1.3;
  } else if (shouldBoostSalesInfo && infoType === 'sales_info') {
    score *= 1.3;
  } else if (item.metadata?.isStructured) {
    // General boost for any structured info
    score *= 1.1;
  }
}
```

The system dynamically boosts results based on:
- Document structure type (company values, investors, leadership, etc.)
- Priority information types relevant to the query
- Technical level matching user requirements
- Authoritative source prioritization
- Content recency (favoring more recent documents)

### BM25 Implementation

The system implements the BM25 ranking algorithm for keyword search:

```typescript
export function calculateBM25Score(query: string, document: Document, corpusStats: CorpusStatistics): number {
  const queryTerms = tokenize(query);
  const docLength = getDocumentLength(document.text);
  const docId = document.id;
  
  let score = 0;
  
  // Calculate score for each query term
  for (const term of queryTerms) {
    // Skip if term not in corpus
    if (!corpusStats.documentFrequency[term]) {
      continue;
    }
    
    // Calculate term frequency in the document
    const tf = countTermFrequency(document.text)[term] || 0;
    
    // Skip if term not in document
    if (tf === 0) {
      continue;
    }
    
    // Calculate inverse document frequency
    const idf = Math.log(
      (corpusStats.totalDocuments - corpusStats.documentFrequency[term] + 0.5) /
      (corpusStats.documentFrequency[term] + 0.5)
    );
    
    // Prevent negative IDF
    const safeIdf = Math.max(0, idf);
    
    // Calculate normalized term frequency
    const normalizedTf = 
      (tf * (BM25_K1 + 1)) / 
      (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / corpusStats.averageDocumentLength)));
    
    // Add term contribution to total score
    score += normalizedTf * safeIdf;
  }
  
  return score;
}
```

### Tokenization and Text Processing

For BM25 search, the system implements robust text tokenization:

```typescript
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Convert to lowercase
  const lowercased = text.toLowerCase();
  
  // Replace punctuation with spaces
  const noPunctuation = lowercased.replace(/[^\w\s]|_/g, ' ');
  
  // Split on whitespace
  const tokens = noPunctuation.split(/\s+/).filter(token => token.length > 0);
  
  // Filter out stopwords and very short tokens
  return tokens.filter(token => 
    token.length > 1 && !STOP_WORDS.has(token)
  );
}
```

### Hierarchical Category Management

The system supports hierarchical category management for precise filtering:

```typescript
// From hierarchicalCategories.ts referenced in hybridSearch.ts
export function filterDocumentsByCategoryPath(
  documents: Document[],
  categoryPath: string[]
): Document[] {
  // If no path specified, return all documents
  if (!categoryPath || categoryPath.length === 0) {
    return documents;
  }
  
  return documents.filter(doc => {
    // Get categories from document metadata
    const docCategories = doc.metadata?.categories || [];
    
    // Check if document matches the specified path
    return matchesCategoryPath(docCategories, categoryPath);
  });
}
```

This allows filtering by category hierarchies rather than just flat category labels, enabling more precise search results across:
- Primary categories (product, company, technical)
- Secondary categories (features, roadmap, competition)
- Industry-specific categories (retail, healthcare, etc.)
- Functional categories (HR, payroll, recruiting)

The system maintains a complete category hierarchy with document counts, enabling faceted navigation of the knowledge base.

### Advanced Search Options

The API exposes several advanced search options:

```typescript
export interface HybridSearchOptions {
  limit?: number;
  includeDeprecated?: boolean; // Option to include deprecated documents
  onlyAuthoritative?: boolean; // Option to only include authoritative documents
  priorityInfoType?: string;
  categoryPath?: string[]; // Support for hierarchical category filtering
  includeFacets?: boolean; // Option to include facet information in results
  technicalLevelRange?: { min: number; max: number }; // Technical level filtering
  entityFilters?: Record<string, string[]>; // Entity-based filtering
}
```

This allows clients to customize their search behavior, targeting specific document characteristics. The search response can also include facets for building intuitive search interfaces:

```typescript
export interface HybridSearchResponse {
  results: Array<VectorStoreItem & { score: number }>;
  facets?: {
    categories: CategoryHierarchy[];
    entities: Record<string, Array<{ name: string, count: number }>>;
    technicalLevels: Array<{ level: number, count: number }>;
  };
  [Symbol.iterator](): Iterator<VectorStoreItem & { score: number }>;
}
```

### Reranking Mechanism

The system includes a reranking mechanism that uses LLM capabilities to further refine search results:

```typescript
export async function rankTextsForQuery(
  query: string,
  texts: string[],
  model: string = AI_SETTINGS.fallbackModel,
  options: {
    returnScoresOnly?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<number[]> {
  try {
    // Create the system prompt for re-ranking
    const systemPrompt = `You are a document relevance judge. Rate how relevant each document is to the query on a scale of 0-10 where:
    - 10: Perfect match with specific details answering the query
    - 7-9: Highly relevant with key information related to the query
    - 4-6: Somewhat relevant but lacks specific details
    - 1-3: Only tangentially related to the query
    - 0: Not relevant at all`;
    
    // Get relevance scores from LLM
    const scores = await generateStructuredResponse(
      systemPrompt,
      userPrompt,
      { scores: [] },
      model
    );
    
    return scores.scores;
  } catch (error) {
    console.error('Error in rankTextsForQuery:', error);
    return texts.map(() => 5); // Default score on error
  }
}
```

The LLM-based reranking provides several advantages:
- Deeper semantic understanding beyond vector similarity
- Better handling of complex or nuanced queries
- More accurate relevance judgments for domain-specific content
- Adaptability to different query types (factual, procedural, etc.)

### Multi-Model Support

The search system can leverage multiple AI providers for different aspects of search:
- OpenAI: Primary embedding generation and reranking
- Gemini: Used for handling larger contexts and summarization
- Perplexity: Alternative for certain types of queries and specialized knowledge

This multi-model approach ensures robustness and optimal performance across different query types.

### Search Flow Diagram

```
                              ┌─────────────────────┐
                              │   User Query        │
                              └──────────┬──────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   Query Analysis    │
                              └──────────┬──────────┘
                                         │
                   ┌─────────────────────┴────────────────────┐
                   │                                          │
         ┌─────────▼───────┐                        ┌─────────▼───────┐
         │ Query Expansion │                        │ Hybrid Settings │
         │  (optional)     │                        │  Determination  │
         └─────────┬───────┘                        └─────────┬───────┘
                   │                                          │
                   └─────────────────────┬──────────────────┬─┘
                                         │                  │
                               ┌─────────▼─────────┐  ┌─────▼────────────┐
                               │  Vector Search    │  │  Keyword Search  │
                               └─────────┬─────────┘  └─────┬────────────┘
                                         │                  │
                                         └──────────┬───────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │ Combined Results  │
                                         └─────────┬─────────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │ Metadata Filtering│
                                         └─────────┬─────────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │  LLM Re-ranking   │
                                         │   (optional)      │
                                         └─────────┬─────────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │  Final Results    │
                                         └─────────┬─────────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │ Answer Generation │
                                         └───────────────────┘
```

This search flow ensures that every query is processed using the optimal combination of techniques based on its characteristics, resulting in highly relevant results.

## Answer Generation

The answer generation process combines retrieved context with LLM capabilities:

```typescript
export async function generateAnswer(
  query: string, 
  searchResults: SearchResultItem[],
  options: {
    includeSourceCitations?: boolean;
    maxSourcesInAnswer?: number;
    model?: string;
    timeout?: number;
    conversationHistory?: string;
  } = {}
): Promise<string> {
  // Only handle basic greetings conversationally
  if (isBasicConversational(query)) {
    return await handleConversationalQuery(query, options.conversationHistory);
  }
  
  // Use options or defaults
  const model = options.model || AI_SETTINGS.defaultModel;
  const includeSourceCitations = options.includeSourceCitations ?? true;
  
  // Handle case with no results
  if (!searchResults || searchResults.length === 0) {
    // Handle empty results case
  }
  
  // Prepare context from search results
  const context = prepareContext(searchResults, options.maxSourcesInAnswer || 10);
  
  // Check context length
  const contextTokens = estimateTokenCount(context);
  if (contextTokens > MAX_TOKENS_OPENAI) {
    // Summarize context if too large
    context = await summarizeContext(query, context);
  }
  
  // Generate the answer using the LLM
  const answer = await generateFromContext(query, context, options);
  
  return answer;
}
```

### LLM Integration

The system integrates with OpenAI's GPT models and has a fallback to Gemini for larger contexts:

```typescript
export async function generateChatCompletion(
  systemPrompt: string,
  userPrompt: string,
  model: string = AI_SETTINGS.defaultModel,
  jsonMode: boolean = false
): Promise<string> {
  try {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages,
      temperature: AI_SETTINGS.temperature,
      max_tokens: AI_SETTINGS.maxTokens,
      response_format: jsonMode && supportsJsonMode ? { type: 'json_object' } : undefined,
    });
    
    return response.choices[0].message.content || '';
  } catch (error) {
    // Try fallback model if primary fails
    // ...
  }
}
```

## API Integration

### Query API Handler

The main query API endpoint orchestrates the entire RAG process:

```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { query, conversationId, messages, options = {}, context = '' } = req.body;
    
    // Step 1: Analyze the query
    const queryAnalysis = await analyzeQuery(query);
    
    // Step 2: Get retrieval parameters
    const retrievalParams = getRetrievalParameters(queryAnalysis);
    
    // Step 3: Prepare search options
    const searchOptions = {
      ...retrievalParams,
      ...options,
      // Metadata filtering
      // ...
    };
    
    // Step 4: Expand query if needed
    let processedQuery = query;
    if (searchOptions.expandQuery) {
      // Expand query
    }
    
    // Step 5: Perform hybrid search
    const searchResults = await performHybridSearch(
      processedQuery, 
      searchOptions.limit || 10,
      searchOptions.hybridRatio || 0.5,
      searchOptions.filter
    );
    
    // Step 6: Apply re-ranking if enabled
    let finalResults = searchResults;
    if (searchOptions.rerank) {
      // Apply reranking
    }
    
    // Step 7: Generate answer from search results
    const formattedResults = finalResults.map(result => ({
      text: result.item.text,
      source: result.item.metadata?.source || 'Unknown',
      metadata: result.item.metadata,
      relevanceScore: result.score
    }));

    // Generate answer
    const answer = await generateAnswer(query, formattedResults, answerOptions);
    
    // Prepare response
    const response = {
      answer: answer,
      sources: finalResults.map(result => ({
        title: result.item.metadata?.title || result.item.metadata?.source || 'Unknown',
        source: result.item.metadata?.source || 'Unknown',
        relevance: result.score
      })),
      metadata: {
        // Query metadata
      }
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    // Error handling
  }
}
```

## Batch Processing

### Batch Upload and Processing

The system supports batch document upload and processing:

1. Documents are processed in batches to manage memory
2. Each batch is assigned a unique ID
3. Batches are tracked in an index file
4. Updates to documents update the appropriate batch file

### Vector Store Batch Management

The batch management system ensures efficient storage:

```javascript
// Group items by batch
const batchMap: Record<string, VectorStoreItem[]> = {};

// Find items without batch ID (newly added)
const unbatchedItems = vectorStore.filter(item => !item.metadata?.batch);

if (unbatchedItems.length > 0) {
  // Get current batch or create new one
  let currentBatchId = activeBatches[activeBatches.length - 1];
  
  if (currentBatchId) {
    // Count items in the current batch
    const currentBatchCount = vectorStore.filter(
      item => item.metadata?.batch === currentBatchId
    ).length;
    
    // Create a new batch if current one is too full
    if (currentBatchCount + unbatchedItems.length > MAX_BATCH_SIZE) {
      currentBatchId = createNewBatch();
    }
  } else {
    // No batches exist yet, create the first one
    currentBatchId = createNewBatch();
  }
  
  // Assign batch ID to unbatched items
  unbatchedItems.forEach(item => {
    if (!item.metadata) item.metadata = {};
    item.metadata.batch = currentBatchId;
  });
}
```

## Technical Architecture Diagram

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Document Upload│     │  Query Processing │     │ Search Results  │
│  ┌───────────┐  │     │   ┌───────────┐   │     │  ┌───────────┐  │
│  │PDF/DOCX/TXT│──┼────►   │Query Analysis│   │     │  │Ranked Items│  │
│  └───────────┘  │     │   └───────────┘   │     │  └───────────┘  │
└────────┬────────┘     │         │         │     └────────┬────────┘
         │              │         ▼         │              │
         ▼              │   ┌───────────┐   │              │
┌────────────────┐      │   │Hybrid Search│◄──┼──────┐     │
│Text Extraction │      │   └───────────┘   │      │     │
└────────┬───────┘      └─────────┬─────────┘      │     │
         │                        │                │     │
         ▼                        ▼                │     ▼
┌────────────────┐      ┌─────────────────┐       │   ┌─────────────────┐
│Text Chunking   │      │Vector Similarity│◄──────┼───┤Answer Generation│
└────────┬───────┘      └────────┬────────┘       │   └─────────────────┘
         │                       │                │             ▲
         ▼                       │                │             │
┌────────────────┐               │                │    ┌────────────────┐
│Embedding       │               ▼                │    │Context          │
│Generation      │      ┌─────────────────┐       │    │Preparation      │
└────────┬───────┘      │ BM25 Keyword    │       │    └────────────────┘
         │              │ Search          │       │
         ▼              └────────┬────────┘       │
┌────────────────┐               │                │
│Vector Store    │◄──────────────┴────────────────┘
│                │
└────────────────┘
```

This document provides an overview of the technical implementation of the RAG system. For more detailed information on specific components, please refer to the corresponding code files. 