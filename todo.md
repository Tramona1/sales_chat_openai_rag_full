# RAG Enhancement Implementation Plan: Contextual Retrieval with Gemini Integration

## 📋 Overview

This document outlines our comprehensive implementation plan for enhancing the RAG (Retrieval-Augmented Generation) system with the following major improvements:

1. **Contextual Retrieval Capabilities**
   - Generate and store contextual information about documents and chunks
   - Leverage document structure and semantic understanding for better retrieval
   - Enhance query understanding to match context with user intent

2. **Migration from OpenAI to Gemini Models**
   - Replace OpenAI's text generation models with Gemini where appropriate
   - Maintain OpenAI embedding models initially, with path to Gemini embeddings
   - Create abstraction layers to support multiple model providers

3. **Enhanced Reranking Mechanisms**
   - Implement semantic reranking based on query intent and document context
   - Develop hybrid scoring that considers both vector similarity and contextual relevance
   - Optimize for both accuracy and performance

4. **Increased Chunk Retrieval for Improved Answer Generation**
   - Retrieve more initial candidates for consideration
   - Implement more sophisticated filtering based on metadata and context
   - Use contextual information to improve chunk selection

## 🎯 High Priority Tasks

### Phase 1: Update Model Configuration & Environment

#### 1.1 Update `modelConfig.ts` to Include New Model Parameters 
- [ ] Add `contextGenerationModel` field to `ModelSettings` interface
  ```typescript
  contextGenerationModel: {
    provider: 'gemini' | 'openai';
    model: string;
    temperature: number;
    maxTokens: number;
  }
  ```
- [ ] Add `rerankerModel` field to `ModelSettings` interface
  ```typescript
  rerankerModel: {
    provider: 'gemini' | 'openai';
    model: string;
    temperature: number;
  }
  ```
- [ ] Configure Gemini as default for applicable models
  ```typescript
  export const defaultModelConfig: ModelSettings = {
    // Existing fields
    chatModel: { 
      provider: 'openai', 
      model: 'gpt-3.5-turbo', 
      temperature: 0.7,
      // ...existing settings 
    },
    // New fields
    contextGenerationModel: {
      provider: 'gemini',
      model: 'gemini-pro',
      temperature: 0.2,
      maxTokens: 1024
    },
    rerankerModel: {
      provider: 'gemini',
      model: 'gemini-pro',
      temperature: 0.1
    },
    // Keep embedding model as OpenAI initially
    embeddingModel: {
      provider: 'openai',
      model: 'text-embedding-ada-002'
    }
  }
  ```
- [ ] Create model selection utility function
  ```typescript
  // Function to determine which model provider to use for a given task
  export function getModelForTask(
    config: ModelSettings,
    task: 'chat' | 'embedding' | 'context' | 'reranking'
  ): { provider: string; model: string; settings: any } {
    // Implementation details
  }
  ```

#### 1.2 Update Environment Variables in `.env.local`
- [ ] Add `GEMINI_API_KEY` variable
- [ ] Add `USE_GEMINI_FOR_CONTEXT` flag (default to true)
- [ ] Add `USE_GEMINI_FOR_RERANKING` flag (default to true) 
- [ ] Add `USE_CONTEXTUAL_RETRIEVAL` feature flag (default to true)
- [ ] Add `DEFAULT_CANDIDATES_COUNT` variable (increase from current value)
- [ ] Create a `.env.example` with documentation for new variables:
  ```
  # Gemini API Configuration
  GEMINI_API_KEY=your_gemini_api_key_here
  
  # Feature Flags
  USE_GEMINI_FOR_CONTEXT=true
  USE_GEMINI_FOR_RERANKING=true
  USE_CONTEXTUAL_RETRIEVAL=true
  
  # Retrieval Settings
  DEFAULT_CANDIDATES_COUNT=30  # Increased from previous value of 10
  ```

#### 1.3 Create Gemini Client Utility
- [ ] Create `utils/geminiClient.ts` with core functionality:
  ```typescript
  import { GoogleGenerativeAI } from '@google/generative-ai';
  
  // Initialize the Gemini client
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  
  export async function generateWithGemini(
    prompt: string,
    model: string = 'gemini-pro',
    temperature: number = 0.7,
    maxTokens?: number
  ): Promise<string> {
    // Implementation details
  }
  
  export async function generateWithGeminiStructured<T>(
    prompt: string,
    responseFormat: { [key: string]: string },
    model: string = 'gemini-pro',
    temperature: number = 0.2
  ): Promise<T> {
    // Implementation to get structured responses
  }
  ```

### Phase 2: Implement Contextual Document Processing

#### 2.1 Create Context Generation Utility Functions
- [ ] Implement `extractDocumentContext()` in `adminWorkflow.ts`
  ```typescript
  export async function extractDocumentContext(
    documentText: string,
    metadata?: Record<string, any>
  ): Promise<{
    summary: string;
    mainTopics: string[];
    entities: string[];
    documentType: string;
    technicalLevel: number;
    audienceType: string[];
  }> {
    // Implementation using Gemini to analyze the document
    const prompt = `
      Analyze the following document and extract key information:
      
      ${documentText.substring(0, 8000)}  // Limit to first 8000 chars for context
      
      Provide your analysis in JSON format with the following fields:
      - summary: A concise 1-2 sentence summary of the document
      - mainTopics: An array of 3-5 main topics covered
      - entities: An array of key entities (people, companies, products) mentioned
      - documentType: The type of document (e.g., "technical documentation", "marketing material", "educational content")
      - technicalLevel: A number from 0-3 indicating technical complexity (0=non-technical, 3=highly technical)
      - audienceType: An array of likely target audiences (e.g., ["developers", "sales team", "executives"])
    `;
    
    try {
      const result = await generateWithGeminiStructured(prompt, {
        summary: "string",
        mainTopics: "string[]",
        entities: "string[]",
        documentType: "string",
        technicalLevel: "number",
        audienceType: "string[]"
      });
      
      return result;
    } catch (error) {
      console.error("Error generating document context:", error);
      // Fallback to simple extraction methods if AI fails
      return {
        summary: documentText.substring(0, 200) + "...",
        mainTopics: [],
        entities: [],
        documentType: "unknown",
        technicalLevel: 0,
        audienceType: []
      };
    }
  }
  ```

- [ ] Implement `generateChunkContext()` in `documentProcessing.ts`
  ```typescript
  export async function generateChunkContext(
    chunkText: string,
    documentContext?: any
  ): Promise<{
    description: string;
    keyPoints: string[];
    isDefinition: boolean;
    containsExample: boolean;
    relatedTopics: string[];
  }> {
    // If we have document context, use that to inform chunk analysis
    const contextPrefix = documentContext ? 
      `This is part of a document about ${documentContext.mainTopics.join(", ")}.` : 
      "";
    
    const prompt = `
      ${contextPrefix}
      
      Analyze the following text chunk and extract key information:
      
      "${chunkText}"
      
      Provide your analysis in JSON format with the following fields:
      - description: A 1-sentence description of what this chunk is about
      - keyPoints: 1-3 key points from this chunk
      - isDefinition: boolean indicating if this chunk contains a definition
      - containsExample: boolean indicating if this chunk contains an example
      - relatedTopics: 1-3 related topics this chunk might connect to
    `;
    
    try {
      return await generateWithGeminiStructured(prompt, {
        description: "string",
        keyPoints: "string[]",
        isDefinition: "boolean",
        containsExample: "boolean",
        relatedTopics: "string[]"
      });
    } catch (error) {
      console.error("Error generating chunk context:", error);
      // Fallback simple extraction
      return {
        description: chunkText.substring(0, 100) + "...",
        keyPoints: [],
        isDefinition: false,
        containsExample: false,
        relatedTopics: []
      };
    }
  }
  ```

#### 2.2 Enhance Document Chunking
- [ ] Implement `splitIntoChunksWithContext()` in `documentProcessing.ts`
  ```typescript
  export async function splitIntoChunksWithContext(
    text: string,
    chunkSize: number = 500,
    source?: string,
    overlapSize: number = 100
  ): Promise<Array<{
    text: string;
    originalText: string;
    context?: any;
    metadata?: any;
  }>> {
    // Start with existing implementation for splitting
    const basicChunks = splitIntoChunks(text, chunkSize, source);
    
    // Extract document-level context once
    const documentContext = await extractDocumentContext(text);
    
    // Process each chunk to add context
    const contextualChunks = [];
    for (const chunk of basicChunks) {
      const chunkContext = await generateChunkContext(chunk.text, documentContext);
      
      contextualChunks.push({
        text: chunk.text,
        originalText: chunk.text, // Store original text
        context: {
          document: documentContext,
          chunk: chunkContext
        },
        metadata: {
          ...chunk.metadata,
          isContextualized: true,
          documentType: documentContext.documentType,
          technicalLevel: documentContext.technicalLevel,
          topics: [...documentContext.mainTopics, ...chunkContext.relatedTopics],
          isDefinition: chunkContext.isDefinition,
          containsExample: chunkContext.containsExample
        }
      });
    }
    
    return contextualChunks;
  }
  ```

#### 2.3 Update Vector Store Interface in `vectorStore.ts`
- [ ] Add `originalText` field to `VectorStoreItem` interface
  ```typescript
  export interface VectorStoreItem {
    text: string;
    originalText?: string; // Store the original unmodified text
    embedding: number[];
    metadata?: {
      source: string;
      // ... existing fields
      contextDescription?: string; // Brief description of chunk content
      isContextualized?: boolean;  // Flag indicating if this item has context
      [key: string]: any;
    };
    context?: {
      document?: {
        summary: string;
        mainTopics: string[];
        // ... other document context fields
      };
      chunk?: {
        description: string;
        keyPoints: string[];
        // ... other chunk context fields
      };
    };
  }
  ```

- [ ] Update `addToVectorStore` function to handle the new fields
  ```typescript
  export function addToVectorStore(
    item: VectorStoreItem,
    batchId?: string,
    skipPersist: boolean = false
  ): void {
    // Ensure the item has the new fields or defaults
    const enhancedItem: VectorStoreItem = {
      ...item,
      originalText: item.originalText || item.text,
      metadata: {
        ...item.metadata,
        contextDescription: item.context?.chunk?.description || '',
        isContextualized: !!item.context
      }
    };
    
    // Existing vector store logic
    vectorStore.push(enhancedItem);
    
    // Update the persistence logic to include new fields
    if (!skipPersist) {
      persistVectorStore();
    }
  }
  ```

- [ ] Add utility function to access context data
  ```typescript
  export function getItemContext(item: VectorStoreItem): {
    description: string;
    topics: string[];
    technicalLevel: number;
  } {
    // Extract context in a standardized way, with fallbacks
    return {
      description: item.context?.chunk?.description || 
                  item.metadata?.contextDescription || 
                  item.text.substring(0, 100),
      topics: [
        ...(item.context?.document?.mainTopics || []),
        ...(item.context?.chunk?.relatedTopics || [])
      ],
      technicalLevel: item.metadata?.technicalLevel || 0
    };
  }
  ```

## 🔄 Medium Priority Tasks

### Phase 3: Update Document Ingestion

#### 3.1 Create Unified Embedding Client
- [ ] Create `utils/embeddingClient.ts` with abstraction layer
  ```typescript
  // A unified interface for embedding generation across providers
  export interface EmbeddingClient {
    embedText(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
    getDimensions(): number;
    getProvider(): string;
  }
  
  // Factory function to get the appropriate client
  export function getEmbeddingClient(): EmbeddingClient {
    const provider = process.env.EMBEDDING_PROVIDER || 'openai';
    
    switch (provider.toLowerCase()) {
      case 'gemini':
        return new GeminiEmbeddingClient();
      case 'openai':
      default:
        return new OpenAIEmbeddingClient();
    }
  }
  
  // Implementation classes
  class OpenAIEmbeddingClient implements EmbeddingClient {
    // Implementation using OpenAI
    async embedText(text: string): Promise<number[]> {
      // Use existing OpenAI embedding function
      return await embedText(text);
    }
    
    async embedBatch(texts: string[]): Promise<number[][]> {
      // Implementation for batch embedding
    }
    
    getDimensions(): number {
      return 1536; // OpenAI ada-002 dimensions
    }
    
    getProvider(): string {
      return 'openai';
    }
  }
  
  class GeminiEmbeddingClient implements EmbeddingClient {
    // Implementation using Gemini
    // Would be implemented later when Gemini embedding API is available/mature
  }
  ```

- [ ] Update OpenAI client to focus on embeddings
  ```typescript
  // utils/openaiClient.ts
  
  // Keep existing embedding functions but refactor for clarity
  export async function embedText(text: string): Promise<number[]> {
    // Existing implementation
  }
  
  // Add batch embedding capability for efficiency
  export async function embedBatch(texts: string[], model: string = 'text-embedding-ada-002'): Promise<number[][]> {
    // Implementation for batch processing
  }
  ```

- [ ] Enhance Gemini client with embedding capabilities
  ```typescript
  // utils/geminiClient.ts
  
  // Add these functions to the existing Gemini client
  export async function embedTextWithGemini(
    text: string,
    model: string = 'embedding-001'  // Update with actual model name when available
  ): Promise<number[]> {
    // Implementation for Gemini embeddings
    // Note: This is a placeholder for when Gemini embedding API is more widely available
  }
  ```

#### 3.2 Modify Document Upload Pipeline

- [ ] Update `upload.ts` to use contextual chunking
  ```typescript
  // pages/api/upload.ts
  
  // Update the document processing flow
  async function processUploadedDocument(
    filePath: string, 
    mimetype: string, 
    filename: string
  ): Promise<{ success: boolean; message: string; count: number }> {
    try {
      // Extract text from document (existing code)
      const text = await extractText(filePath, mimetype);
      
      // Use the new contextual chunking
      const useContextualRetrieval = process.env.USE_CONTEXTUAL_RETRIEVAL === 'true';
      
      let chunks;
      if (useContextualRetrieval) {
        // Use enhanced chunking with context
        chunks = await splitIntoChunksWithContext(text, 500, filename);
        console.log(`Generated ${chunks.length} contextual chunks from ${filename}`);
      } else {
        // Fallback to regular chunking
        chunks = splitIntoChunks(text, 500, filename);
        console.log(`Generated ${chunks.length} basic chunks from ${filename}`);
      }
      
      // Get the embedding client
      const embeddingClient = getEmbeddingClient();
      
      // Create batch for efficiency
      const batchTexts = chunks.map(chunk => chunk.text);
      const embeddings = await embeddingClient.embedBatch(batchTexts);
      
      // Add to vector store
      const batchId = generateUUID();
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        
        addToVectorStore({
          text: chunk.text,
          originalText: chunk.originalText || chunk.text,
          embedding,
          metadata: {
            ...chunk.metadata,
            source: `${filename}_chunk_${i}`,
            uploadedAt: new Date().toISOString(),
            batch: batchId
          },
          context: chunk.context
        }, batchId);
      }
      
      return { 
        success: true, 
        message: `Successfully processed ${filename} with ${chunks.length} chunks`, 
        count: chunks.length 
      };
    } catch (error) {
      console.error(`Error processing document ${filename}:`, error);
      return { 
        success: false, 
        message: `Error processing document: ${error instanceof Error ? error.message : String(error)}`,
        count: 0
      };
    }
  }
  ```

### Phase 4: Enhance Search & Retrieval

#### 4.1 Update Query Analysis

- [ ] Enhance `RetrievalParameters` interface in `queryAnalysis.ts`
  ```typescript
  export interface RetrievalParameters {
    initialCandidateCount: number; // Increased from previous values
    rerankedCandidateCount: number;
    useHybridSearch: boolean;
    useReranking: boolean;
    useContextualEnhancement: boolean; // New flag
    requiredMetadata: Record<string, any>;
    excludedMetadata: Record<string, any>;
    preferredDocumentTypes: string[]; // New field
    targetTechnicalLevel?: number;    // New field
  }
  
  // Update the defaults
  export const DEFAULT_RETRIEVAL_PARAMETERS: RetrievalParameters = {
    initialCandidateCount: 30,       // Increased from 10
    rerankedCandidateCount: 15,      // Increased from 5
    useHybridSearch: true,
    useReranking: true,
    useContextualEnhancement: true,  // Enable by default
    requiredMetadata: {},
    excludedMetadata: {},
    preferredDocumentTypes: []
  };
  ```

- [ ] Implement `analyzeQueryForContext` function
  ```typescript
  export async function analyzeQueryForContext(
    query: string
  ): Promise<{
    searchTerms: string[];
    topicCategories: string[];
    technicalLevel: number;
    expectedAnswerType: 'factual' | 'conceptual' | 'procedural' | 'comparative';
    entityFocus: string[];
  }> {
    // Use Gemini to analyze the query for better retrieval
    const prompt = `
      Analyze the following query to understand the user's information needs:
      
      "${query}"
      
      Provide your analysis in JSON format with the following fields:
      - searchTerms: An array of 2-5 key search terms extracted from the query
      - topicCategories: An array of 1-3 likely topic categories this query belongs to
      - technicalLevel: A number from 0-3 indicating technical complexity (0=non-technical, 3=highly technical)
      - expectedAnswerType: One of ["factual", "conceptual", "procedural", "comparative"]
      - entityFocus: An array of specific entities (products, companies, etc.) the user is asking about
    `;
    
    try {
      return await generateWithGeminiStructured(prompt, {
        searchTerms: "string[]",
        topicCategories: "string[]",
        technicalLevel: "number",
        expectedAnswerType: "string",
        entityFocus: "string[]"
      });
    } catch (error) {
      console.error("Error analyzing query context:", error);
      // Fallback to basic extraction
      return {
        searchTerms: query.split(/\s+/).filter(t => t.length > 3),
        topicCategories: [],
        technicalLevel: 1,
        expectedAnswerType: 'factual',
        entityFocus: []
      };
    }
  }
  ```

#### 4.2 Improve Hybrid Search

- [ ] Update `performHybridSearch` to retrieve more initial candidates
  ```typescript
  export async function performHybridSearch(
    query: string,
    options: {
      limit?: number;
      vectorWeight?: number;
      keywordWeight?: number;
      metadataFilters?: Record<string, any>;
      preferredDocumentTypes?: string[];
      targetTechnicalLevel?: number;
    } = {}
  ): Promise<Array<SearchResult>> {
    const {
      limit = 20,
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      metadataFilters = {},
      preferredDocumentTypes = [],
      targetTechnicalLevel = undefined
    } = options;
    
    // Determine how many candidates to fetch from each method
    // We'll get more initial candidates to allow for better reranking
    const vectorLimit = Math.ceil(limit * 1.5);
    const keywordLimit = Math.ceil(limit * 1.5);
    
    // Get vector search results
    const vectorResults = await performVectorSearch(query, vectorLimit);
    
    // Get keyword search results
    const keywordResults = performKeywordSearch(query, keywordLimit);
    
    // Apply metadata filters
    const filteredResults = [...vectorResults, ...keywordResults].filter(result => {
      // Check metadata filters
      if (metadataFilters && Object.keys(metadataFilters).length > 0) {
        for (const [key, value] of Object.entries(metadataFilters)) {
          const metaValue = result.item.metadata?.[key];
          if (metaValue === undefined || metaValue !== value) {
            return false;
          }
        }
      }
      
      // Apply preferred document type filtering (soft filter with boosting)
      if (preferredDocumentTypes.length > 0 && result.item.metadata?.documentType) {
        if (preferredDocumentTypes.includes(result.item.metadata.documentType)) {
          // Boost the score for preferred document types
          result.score *= 1.25;
        }
      }
      
      // Apply technical level matching (soft filter with boosting)
      if (targetTechnicalLevel !== undefined && result.item.metadata?.technicalLevel !== undefined) {
        // Boost score based on how closely the technical level matches
        const levelDifference = Math.abs(targetTechnicalLevel - result.item.metadata.technicalLevel);
        const levelMultiplier = 1 - (levelDifference * 0.15); // Reduce score by 15% per level difference
        result.score *= Math.max(0.7, levelMultiplier); // Don't reduce below 70%
      }
      
      return true;
    });
    
    // Combine and deduplicate results
    const combinedResults = combineSearchResults(
      filteredResults,
      vectorWeight,
      keywordWeight
    );
    
    // Return top results
    return combinedResults.slice(0, limit);
  }
  ```

#### 4.3 Implement Reranking with Gemini

- [ ] Create `rerankWithGemini` in `reranking.ts`
  ```typescript
  export async function rerankWithGemini(
    query: string,
    results: SearchResult[],
    options: {
      limit?: number;
      includeScores?: boolean;
      useContextForReranking?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const { 
      limit = 5, 
      includeScores = true,
      useContextForReranking = true
    } = options;
    
    // Early return if not enough results to rerank
    if (results.length <= 1) return results;
    
    try {
      // Prepare texts for reranking
      const items = results.map((result, index) => {
        const item = result.item;
        let contextInfo = '';
        
        // Include contextual information if available and enabled
        if (useContextForReranking && (item.context || item.metadata?.contextDescription)) {
          contextInfo = `
            CONTEXT INFO:
            ${item.context?.chunk?.description || item.metadata?.contextDescription || ''}
            KEY POINTS: ${(item.context?.chunk?.keyPoints || []).join(', ')}
            TOPICS: ${[
              ...(item.context?.document?.mainTopics || []),
              ...(item.context?.chunk?.relatedTopics || [])
            ].join(', ')}
          `;
        }
        
        return {
          id: index,
          text: useContextForReranking && item.originalText ? item.originalText : item.text,
          context: contextInfo,
          initialScore: result.score
        };
      });
      
      // Create prompt for Gemini reranking
      const prompt = `
        You are a document reranking system. Your task is to score how relevant each document is to the query.
        
        QUERY: "${query}"
        
        DOCUMENTS:
        ${items.map(item => `
          DOCUMENT ${item.id}:
          ${item.context}
          ---
          ${item.text}
        `).join('\n\n')}
        
        For each document, assign a relevance score from 0.0 to 1.0, where:
        - 1.0 means perfectly relevant and directly answers the query
        - 0.0 means completely irrelevant to the query
        
        Return your analysis as a JSON array with objects containing:
        - id: The document ID number
        - score: Your relevance score (0.0-1.0)
        - reason: A brief explanation of why you assigned this score
      `;
      
      // Call Gemini for reranking
      const response: Array<{id: number, score: number, reason: string}> = 
        await generateWithGeminiStructured(prompt, {
          "0": {
            id: "number",
            score: "number",
            reason: "string"
          }
        });
      
      // Map scores back to results
      const scoredResults = response.map(rankItem => {
        const originalResult = results[rankItem.id];
        return {
          ...originalResult,
          item: originalResult.item,
          score: rankItem.score,
          explanation: rankItem.reason
        };
      });
      
      // Sort by new scores
      scoredResults.sort((a, b) => b.score - a.score);
      
      // Return top results
      return scoredResults.slice(0, limit);
    } catch (error) {
      console.error("Error during Gemini reranking:", error);
      // Fall back to original ranking if Gemini fails
      return results.slice(0, limit);
    }
  }
  ```

#### 4.4 Update the Query API

- [ ] Modify result formatting in `query.ts` to use original text and context
  ```typescript
  // Update the handler in pages/api/query.ts
  
  export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    // Existing code for handling request...
    
    // Add this to the search flow after the hybrid search:
    
    // Use Gemini for reranking if enabled
    let searchResults = hybridResults;
    if (options.useReranking) {
      try {
        const useGeminiReranking = process.env.USE_GEMINI_FOR_RERANKING === 'true';
        
        if (useGeminiReranking) {
          // Use the new Gemini reranker
          searchResults = await rerankWithGemini(query, hybridResults, {
            limit: options.rerankedCandidateCount,
            useContextForReranking: options.useContextualEnhancement
          });
        } else {
          // Use the existing reranker
          searchResults = await rerankResults(query, hybridResults, options.rerankedCandidateCount);
        }
      } catch (rerankError) {
        console.error("Error during reranking:", rerankError);
        // Fall back to the original search results
        searchResults = hybridResults.slice(0, options.rerankedCandidateCount);
      }
    }
    
    // Prepare the sources with contextual information if available
    const sources = searchResults.map(result => {
      const item = result.item;
      
      return {
        text: item.originalText || item.text,
        source: item.metadata?.source || "Unknown",
        score: result.score,
        context: item.context ? {
          description: item.context.chunk?.description || item.metadata?.contextDescription,
          topics: [
            ...(item.context.document?.mainTopics || []),
            ...(item.context.chunk?.relatedTopics || [])
          ],
          isDefinition: item.context.chunk?.isDefinition || false,
          containsExample: item.context.chunk?.containsExample || false
        } : undefined
      };
    });
    
    // Generate answer with context-aware prompt
    let answer;
    try {
      if (options.useContextualEnhancement) {
        // Generate a context-aware answer using the contextual information
        answer = await generateContextAwareAnswer(query, sources);
      } else {
        // Use the existing answer generation
        answer = await generateAnswer(query, sources.map(s => s.text));
      }
    } catch (error) {
      console.error("Error generating answer:", error);
      answer = "I encountered an error while generating an answer. Please try asking in a different way.";
    }
    
    // Return the enhanced response
    return res.status(200).json({
      answer,
      sources: sources.map(s => ({
        text: s.text.substring(0, 250) + "...", // Truncate for response
        source: s.source,
        context: s.context?.description
      })),
      metadata: {
        queryTime: Date.now() - startTime,
        retrievalStrategy: {
          useHybridSearch: options.useHybridSearch,
          useReranking: options.useReranking,
          useContextualEnhancement: options.useContextualEnhancement
        }
      }
    });
  }
  ```

## 📊 Testing & Migration Tasks

### Phase 5: Document Migration & Evaluation

#### 5.1 Create Migration Script for Existing Documents

- [ ] Implement `scripts/migrateToContextualEmbeddings.ts`
  ```typescript
  import fs from 'fs';
  import path from 'path';
  import { 
    getAllVectorStoreItems, 
    addToVectorStore,
    VectorStoreItem 
  } from '../utils/vectorStore';
  import { extractDocumentContext, generateChunkContext } from '../utils/documentProcessing';
  
  /**
   * Script to migrate existing documents to the new contextual format
   * Runs as a standalone process to avoid impacting the main application
   */
  async function migrateDocuments() {
    console.log("Starting migration to contextual embeddings...");
    
    // Load the current vector store
    const items = getAllVectorStoreItems();
    console.log(`Loaded ${items.length} items from vector store`);
    
    // Group by source document
    const sourceMap: Record<string, VectorStoreItem[]> = {};
    for (const item of items) {
      const source = item.metadata?.source?.split('_chunk_')?.[0];
      if (source) {
        if (!sourceMap[source]) {
          sourceMap[source] = [];
        }
        sourceMap[source].push(item);
      }
    }
    
    console.log(`Found ${Object.keys(sourceMap).length} unique source documents`);
    
    // Process each source document
    let migratedCount = 0;
    for (const [source, chunks] of Object.entries(sourceMap)) {
      try {
        console.log(`Processing document: ${source} with ${chunks.length} chunks`);
        
        // Join chunks to reconstruct the full document
        // (This is an approximation, could be improved)
        const fullText = chunks.map(chunk => chunk.text).join("\n\n");
        
        // Generate document-level context
        const documentContext = await extractDocumentContext(fullText);
        console.log(`Generated context for ${source}`);
        
        // Process each chunk
        for (const chunk of chunks) {
          // Generate chunk-level context
          const chunkContext = await generateChunkContext(chunk.text, documentContext);
          
          // Create enhanced item
          const enhancedItem: VectorStoreItem = {
            ...chunk,
            originalText: chunk.text,
            context: {
              document: documentContext,
              chunk: chunkContext
            },
            metadata: {
              ...chunk.metadata,
              contextDescription: chunkContext.description,
              isContextualized: true,
              documentType: documentContext.documentType,
              technicalLevel: documentContext.technicalLevel,
              topics: [...documentContext.mainTopics, ...chunkContext.relatedTopics],
              isDefinition: chunkContext.isDefinition,
              containsExample: chunkContext.containsExample
            }
          };
          
          // Remove the old item and add the enhanced one
          // We'd implement a safer update mechanism in production
          
          migratedCount++;
        }
        
        // Log progress periodically
        if (migratedCount % 100 === 0) {
          console.log(`Migrated ${migratedCount} chunks so far...`);
        }
      } catch (error) {
        console.error(`Error processing document ${source}:`, error);
      }
    }
    
    console.log(`Migration complete. Migrated ${migratedCount} chunks.`);
  }
  
  // Run the migration if executed directly
  if (require.main === module) {
    migrateDocuments().catch(console.error);
  }
  ```

#### 5.2 Create A/B Testing Framework

- [ ] Implement `utils/evaluationUtils.ts` with comparison functions
  ```typescript
  export interface EvaluationResult {
    queryId: string;
    query: string;
    answerA: string;
    answerB: string;
    sourcesA: Array<{ text: string; source: string; score: number }>;
    sourcesB: Array<{ text: string; source: string; score: number }>;
    retrievalTimeA: number;
    retrievalTimeB: number;
    totalTimeA: number;
    totalTimeB: number;
    strategy: 'baseline' | 'contextual';
  }
  
  /**
   * Runs the same query through two different retrieval strategies and compares results
   */
  export async function compareRetrievalStrategies(
    query: string,
    options?: {
      recordResults?: boolean;
      evaluationId?: string;
    }
  ): Promise<EvaluationResult> {
    const { recordResults = true, evaluationId = `eval_${Date.now()}` } = options || {};
    
    // Query ID for tracking
    const queryId = `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Strategy A: Baseline (current production strategy)
    const startTimeA = Date.now();
    const baselineResults = await runQueryWithStrategy(query, {
      useHybridSearch: true,
      useReranking: true,
      useContextualEnhancement: false,
      initialCandidateCount: 10,
      rerankedCandidateCount: 5
    });
    const totalTimeA = Date.now() - startTimeA;
    
    // Strategy B: Contextual (enhanced strategy)
    const startTimeB = Date.now();
    const contextualResults = await runQueryWithStrategy(query, {
      useHybridSearch: true,
      useReranking: true,
      useContextualEnhancement: true,
      initialCandidateCount: 30,
      rerankedCandidateCount: 15
    });
    const totalTimeB = Date.now() - startTimeB;
    
    // Compile evaluation results
    const result: EvaluationResult = {
      queryId,
      query,
      answerA: baselineResults.answer,
      answerB: contextualResults.answer,
      sourcesA: baselineResults.sources,
      sourcesB: contextualResults.sources,
      retrievalTimeA: baselineResults.retrievalTime,
      retrievalTimeB: contextualResults.retrievalTime,
      totalTimeA,
      totalTimeB,
      strategy: totalTimeB < totalTimeA * 1.2 && contextualResults.sources.length >= baselineResults.sources.length ? 
        'contextual' : 'baseline'
    };
    
    // Save results if enabled
    if (recordResults) {
      await saveEvaluationResult(evaluationId, result);
    }
    
    return result;
  }
  
  /**
   * Helper function to run a query with specific strategy parameters
   */
  async function runQueryWithStrategy(
    query: string,
    options: {
      useHybridSearch: boolean;
      useReranking: boolean;
      useContextualEnhancement: boolean;
      initialCandidateCount: number;
      rerankedCandidateCount: number;
    }
  ): Promise<{
    answer: string;
    sources: Array<{ text: string; source: string; score: number }>;
    retrievalTime: number;
  }> {
    // Create a custom fetch function that will hit our API endpoint with the specific parameters
    const startTime = Date.now();
    
    try {
      // In actual implementation, this would call the query API with the specific parameters
      // For this example, we're mocking the structure
      
      // Call the API with overridden parameters
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          options
        }),
      });
      
      const data = await response.json();
      const retrievalTime = data.metadata.queryTime;
      
      return {
        answer: data.answer,
        sources: data.sources.map((s: any) => ({
          text: s.text,
          source: s.source,
          score: s.score || 0
        })),
        retrievalTime
      };
    } catch (error) {
      console.error("Error during strategy evaluation:", error);
      return {
        answer: "Error generating answer",
        sources: [],
        retrievalTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Save evaluation results to disk or database
   */
  async function saveEvaluationResult(
    evaluationId: string,
    result: EvaluationResult
  ): Promise<void> {
    try {
      // Create evaluations directory if it doesn't exist
      const evalDir = path.join(process.cwd(), 'data', 'evaluations');
      if (!fs.existsSync(evalDir)) {
        fs.mkdirSync(evalDir, { recursive: true });
      }
      
      // Save to a file named with the evaluation ID
      const evalFile = path.join(evalDir, `${evaluationId}.json`);
      
      // Read existing data if file exists
      let evalData: EvaluationResult[] = [];
      if (fs.existsSync(evalFile)) {
        evalData = JSON.parse(fs.readFileSync(evalFile, 'utf-8'));
      }
      
      // Add new result
      evalData.push(result);
      
      // Write back to file
      fs.writeFileSync(evalFile, JSON.stringify(evalData, null, 2));
      
      console.log(`Saved evaluation result to ${evalFile}`);
    } catch (error) {
      console.error("Error saving evaluation result:", error);
    }
  }
  
  /**
   * Generate a summary report from evaluation results
   */
  export async function generateEvaluationReport(
    evaluationId: string
  ): Promise<{
    totalQueries: number;
    preferredStrategy: 'baseline' | 'contextual' | 'tied';
    averageTimeBaseline: number;
    averageTimeContextual: number;
    speedDifference: string;
    querySamples: Array<{
      query: string;
      answerA: string;
      answerB: string;
      strategy: string;
    }>;
  }> {
    try {
      // Read evaluation results
      const evalFile = path.join(process.cwd(), 'data', 'evaluations', `${evaluationId}.json`);
      if (!fs.existsSync(evalFile)) {
        throw new Error(`Evaluation file not found: ${evalFile}`);
      }
      
      const results: EvaluationResult[] = JSON.parse(fs.readFileSync(evalFile, 'utf-8'));
      
      // Calculate statistics
      const totalQueries = results.length;
      const baselineCount = results.filter(r => r.strategy === 'baseline').length;
      const contextualCount = results.filter(r => r.strategy === 'contextual').length;
      
      const averageTimeBaseline = results.reduce((sum, r) => sum + r.totalTimeA, 0) / totalQueries;
      const averageTimeContextual = results.reduce((sum, r) => sum + r.totalTimeB, 0) / totalQueries;
      
      // Determine preferred strategy
      let preferredStrategy: 'baseline' | 'contextual' | 'tied' = 'tied';
      if (contextualCount > baselineCount) {
        preferredStrategy = 'contextual';
      } else if (baselineCount > contextualCount) {
        preferredStrategy = 'baseline';
      }
      
      // Calculate speed difference as percentage
      const speedDifference = averageTimeBaseline > 0
        ? `${((averageTimeContextual - averageTimeBaseline) / averageTimeBaseline * 100).toFixed(2)}%`
        : 'N/A';
      
      // Sample up to 5 queries for the report
      const querySamples = results.slice(0, 5).map(r => ({
        query: r.query,
        answerA: r.answerA,
        answerB: r.answerB,
        strategy: r.strategy
      }));
      
      return {
        totalQueries,
        preferredStrategy,
        averageTimeBaseline,
        averageTimeContextual,
        speedDifference,
        querySamples
      };
    } catch (error) {
      console.error("Error generating evaluation report:", error);
      throw error;
    }
  }

### Phase 6: Progressive Rollout & Monitoring

#### 6.1 Implement Monitoring System

- [ ] Create `utils/performanceMonitoring.ts` for metrics tracking
  ```typescript
  export interface QueryMetrics {
    queryId: string;
    query: string;
    timestamp: number;
    duration: number;
    retrievalTime: number;
    generationTime: number;
    tokensUsed: number;
    candidatesCount: number;
    strategy: {
      useContextualRetrieval: boolean;
      useGeminiReranking: boolean;
      initialCandidateCount: number;
    };
    result: 'success' | 'error';
    errorMessage?: string;
  }
  
  // In-memory store for recent metrics (would use a DB in production)
  const recentMetrics: QueryMetrics[] = [];
  
  /**
   * Record metrics for a query
   */
  export function recordQueryMetrics(metrics: QueryMetrics): void {
    // Add to in-memory store
    recentMetrics.push(metrics);
    
    // Keep only recent metrics
    while (recentMetrics.length > 1000) {
      recentMetrics.shift();
    }
    
    // Would send to monitoring system in production
    console.log(`Recorded metrics for query ${metrics.queryId}: ${metrics.duration}ms`);
    
    // In a production system, we would:
    // 1. Write to persistent storage (DB)
    // 2. Send to monitoring service (e.g., Prometheus)
    // 3. Trigger alerts if necessary
  }
  
  /**
   * Get recent query metrics with optional filtering
   */
  export function getRecentMetrics(options?: { 
    limit?: number;
    strategyFilter?: Partial<QueryMetrics['strategy']>;
  }): QueryMetrics[] {
    const { limit = 100, strategyFilter } = options || {};
    
    let filtered = recentMetrics;
    
    // Apply strategy filter if provided
    if (strategyFilter) {
      filtered = filtered.filter(metric => {
        for (const [key, value] of Object.entries(strategyFilter)) {
          if (metric.strategy[key as keyof QueryMetrics['strategy']] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Sort by timestamp (newest first) and limit
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Get performance comparison between strategies
   */
  export function getPerformanceComparison(): {
    contextual: { avgDuration: number; sampleSize: number; errorRate: number };
    baseline: { avgDuration: number; sampleSize: number; errorRate: number };
  } {
    const contextualMetrics = recentMetrics.filter(m => m.strategy.useContextualRetrieval);
    const baselineMetrics = recentMetrics.filter(m => !m.strategy.useContextualRetrieval);
    
    return {
      contextual: {
        avgDuration: contextualMetrics.reduce((sum, m) => sum + m.duration, 0) / (contextualMetrics.length || 1),
        sampleSize: contextualMetrics.length,
        errorRate: contextualMetrics.filter(m => m.result === 'error').length / (contextualMetrics.length || 1)
      },
      baseline: {
        avgDuration: baselineMetrics.reduce((sum, m) => sum + m.duration, 0) / (baselineMetrics.length || 1),
        sampleSize: baselineMetrics.length,
        errorRate: baselineMetrics.filter(m => m.result === 'error').length / (baselineMetrics.length || 1)
      }
    };
  }
  
  /**
   * Track token usage for cost calculations
   */
  export function trackTokenUsage(
    model: string,
    tokens: number,
    operation: 'embedding' | 'completion' | 'context-generation'
  ): void {
    // In a production system, this would update a persistent counter
    console.log(`Used ${tokens} tokens with ${model} for ${operation}`);
    
    // Could track:
    // - Daily/weekly/monthly usage
    // - Per model costs
    // - Per operation type costs
    // - Cost per query
  }
  
  /**
   * Create a dashboard data object for visualization
   */
  export function getDashboardData(): {
    queries: { timestamp: number; duration: number; strategy: string }[];
    errorRate: number;
    avgResponseTime: number;
    costEstimate: number;
    strategySplit: { strategy: string; count: number }[];
  } {
    // Calculate metrics for dashboard visualization
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recentQueries = recentMetrics.filter(m => m.timestamp > last24Hours);
    
    // Prepare query timeline data
    const queries = recentQueries.map(m => ({
      timestamp: m.timestamp,
      duration: m.duration,
      strategy: m.strategy.useContextualRetrieval ? 'contextual' : 'baseline'
    }));
    
    // Calculate error rate
    const errorRate = recentQueries.length > 0
      ? recentQueries.filter(m => m.result === 'error').length / recentQueries.length
      : 0;
    
    // Calculate average response time
    const avgResponseTime = recentQueries.length > 0
      ? recentQueries.reduce((sum, m) => sum + m.duration, 0) / recentQueries.length
      : 0;
    
    // Calculate strategy split
    const strategyCount: Record<string, number> = {};
    for (const metric of recentQueries) {
      const key = `${metric.strategy.useContextualRetrieval ? 'Contextual' : 'Baseline'}-${metric.strategy.useGeminiReranking ? 'Gemini' : 'Standard'}`;
      strategyCount[key] = (strategyCount[key] || 0) + 1;
    }
    
    const strategySplit = Object.entries(strategyCount).map(([strategy, count]) => ({
      strategy,
      count
    }));
    
    // Mock cost estimate (would be based on actual token usage in production)
    const costEstimate = recentQueries.reduce((sum, m) => sum + (m.tokensUsed || 0) * 0.0001, 0);
    
    return {
      queries,
      errorRate,
      avgResponseTime,
      costEstimate,
      strategySplit
    };
  }
  ```

#### 6.2 Set Up Feature Flags for Phased Rollout

- [ ] Create `utils/featureFlags.ts` with rollout controls
  ```typescript
  export interface FeatureFlag {
    name: string;
    enabled: boolean;
    rolloutPercentage: number;
    description: string;
    lastUpdated: string;
  }
  
  // In a production app this would come from a database or config service
  const featureFlags: Record<string, FeatureFlag> = {
    useContextualRetrieval: {
      name: 'useContextualRetrieval',
      enabled: true,
      rolloutPercentage: 50, // Start with 50% rollout
      description: 'Use contextual information to enhance retrieval',
      lastUpdated: new Date().toISOString()
    },
    useGeminiForContext: {
      name: 'useGeminiForContext',
      enabled: true,
      rolloutPercentage: 100, // Fully enabled
      description: 'Use Gemini to generate contextual information',
      lastUpdated: new Date().toISOString()
    },
    useGeminiForReranking: {
      name: 'useGeminiForReranking',
      enabled: true,
      rolloutPercentage: 30, // Start with limited rollout
      description: 'Use Gemini for reranking search results',
      lastUpdated: new Date().toISOString()
    },
    increasedCandidatesCount: {
      name: 'increasedCandidatesCount',
      enabled: true,
      rolloutPercentage: 100, // Fully enabled
      description: 'Use increased candidate count for better results',
      lastUpdated: new Date().toISOString()
    }
  };
  
  /**
   * Check if a feature flag is enabled for a specific user/request
   * @param flagName The name of the feature flag
   * @param context Unique identifier for the user/request, used for consistent assignment
   */
  export function isFeatureEnabled(
    flagName: string,
    context: string = ''
  ): boolean {
    const flag = featureFlags[flagName];
    
    // If flag doesn't exist or is disabled, return false
    if (!flag || !flag.enabled) return false;
    
    // If 100% rollout, return true
    if (flag.rolloutPercentage >= 100) return true;
    
    // If 0% rollout, return false
    if (flag.rolloutPercentage <= 0) return false;
    
    // Determine if this context should get the feature
    // Use a hash of the context to ensure consistent assignment
    const hash = simpleHash(flagName + context);
    const normalized = (hash % 100) + 1; // 1-100
    
    return normalized <= flag.rolloutPercentage;
  }
  
  /**
   * Simple string hash function for feature flag assignment
   */
  function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Update a feature flag configuration
   */
  export function updateFeatureFlag(
    flagName: string,
    updates: Partial<FeatureFlag>
  ): FeatureFlag {
    if (!featureFlags[flagName]) {
      throw new Error(`Feature flag ${flagName} does not exist`);
    }
    
    featureFlags[flagName] = {
      ...featureFlags[flagName],
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    return featureFlags[flagName];
  }
  
  /**
   * Get all feature flags
   */
  export function getAllFeatureFlags(): Record<string, FeatureFlag> {
    return { ...featureFlags };
  }
  
  /**
   * Create a new feature flag
   */
  export function createFeatureFlag(
    name: string,
    description: string,
    enabled: boolean = false,
    rolloutPercentage: number = 0
  ): FeatureFlag {
    if (featureFlags[name]) {
      throw new Error(`Feature flag ${name} already exists`);
    }
    
    const newFlag: FeatureFlag = {
      name,
      description,
      enabled,
      rolloutPercentage,
      lastUpdated: new Date().toISOString()
    };
    
    featureFlags[name] = newFlag;
    return newFlag;
  }
  
  /**
   * Apply feature flags to request options
   */
  export function applyFeatureFlags(
    requestId: string,
    defaultOptions: any
  ): any {
    // Clone the options
    const options = { ...defaultOptions };
    
    // Apply feature flags
    if (isFeatureEnabled('useContextualRetrieval', requestId)) {
      options.useContextualEnhancement = true;
    }
    
    if (isFeatureEnabled('useGeminiForReranking', requestId)) {
      options.useGeminiReranking = true;
    }
    
    if (isFeatureEnabled('increasedCandidatesCount', requestId)) {
      options.initialCandidateCount = 30;
      options.rerankedCandidateCount = 15;
    }
    
    return options;
  }
  ```

## 📅 Timeline & Dependencies

### Week 1: Configuration & Foundation Work
- **Day 1-2: Model Configuration**
  - [ ] Create Gemini API client utility
  - [ ] Update model configuration interfaces
  - [ ] Set up environment variables
  - [ ] Document new configuration options
  - [ ] Create initial tests for Gemini client

- **Day 3-4: Context Generation Functions**
  - [ ] Implement document context extraction
  - [ ] Implement chunk context generation
  - [ ] Create test suite for context generation
  - [ ] Document prompt templates and expected outputs

- **Day 5: Vector Store Interface Updates**
  - [ ] Update `VectorStoreItem` interface
  - [ ] Enhance `addToVectorStore` function
  - [ ] Add utility functions for accessing context
  - [ ] Write data migration plan

### Week 2: Document Processing & Embedding
- **Day 1-2: Complete Vector Store Updates**
  - [ ] Implement batch context processing
  - [ ] Update vector store serialization
  - [ ] Create tests for updated vector store functions
  - [ ] Document new vector store capabilities

- **Day 3-4: Embedding Abstraction Layer**
  - [ ] Create embedding client interface
  - [ ] Implement OpenAI embedding client
  - [ ] Create placeholder for Gemini embedding client
  - [ ] Add batch embedding capabilities
  - [ ] Write tests for embedding client

- **Day 5: Document Upload Pipeline**
  - [ ] Update the `processUploadedDocument` function
  - [ ] Integrate contextual chunking
  - [ ] Update batch processing
  - [ ] Test new upload flow with sample documents

### Week 3: Search & Retrieval Enhancements
- **Day 1-2: Complete Upload Pipeline & Start Query Analysis**
  - [ ] Finalize document upload pipeline
  - [ ] Test embedding generation and storage
  - [ ] Begin query analysis enhancements
  - [ ] Update `RetrievalParameters` interface

- **Day 3: Hybrid Search Improvements**
  - [ ] Enhance vector search with contextual awareness
  - [ ] Update keyword search weighting
  - [ ] Implement context-based score boosting
  - [ ] Test search with various query types

- **Day 4-5: Reranking & Query API**
  - [ ] Implement Gemini-based reranking
  - [ ] Update query API to use contextual information
  - [ ] Improve answer generation prompts
  - [ ] End-to-end testing of retrieval pipeline

### Week 4: Testing & Migration
- **Day 1-2: Query API & Testing**
  - [ ] Finalize query API updates
  - [ ] Implement context-aware answer generation
  - [ ] Create comprehensive test suite
  - [ ] Document API changes

- **Day 3-4: Migration Script**
  - [ ] Create document migration script
  - [ ] Test migration with subset of documents
  - [ ] Optimize migration performance
  - [ ] Document migration process

- **Day 5: A/B Testing Framework**
  - [ ] Implement retrieval strategy comparison
  - [ ] Create evaluation result storage
  - [ ] Build evaluation report generation
  - [ ] Set up test queries for comparison

### Week 5: Monitoring & Rollout
- **Day 1-2: Finalize A/B Testing & Monitoring**
  - [ ] Complete evaluation framework
  - [ ] Run A/B tests on standard query set
  - [ ] Implement performance monitoring
  - [ ] Create monitoring dashboard

- **Day 3: Feature Flags**
  - [ ] Implement feature flag system
  - [ ] Create admin interface for flags
  - [ ] Test progressive rollout scenarios
  - [ ] Document feature flag usage

- **Day 4-5: Production Rollout**
  - [ ] Set up production configuration
  - [ ] Start progressive rollout
  - [ ] Monitor performance and errors
  - [ ] Document rollout process and results

### Dependencies & Critical Path
- The critical path follows this sequence:
  1. Model configuration must be completed first
  2. Context generation functions are needed before vector store updates
  3. Vector store updates are required before document processing changes
  4. Document processing must be updated before search enhancements
  5. Search enhancements are needed before query API updates
  6. Full implementation is required before migration can begin
  7. Testing and monitoring are needed before production rollout

- **Potential Bottlenecks:**
  - Gemini API access and quotas
  - Migration performance for large document collections
  - Integration testing across multiple components
  - Unforeseen issues with context generation quality

## 🔬 Evaluation Metrics

### 1. Retrieval Accuracy
- [ ] **Precision and Recall:**
  - Measure precision at k=3, 5, and 10 results
  - Calculate recall with manually labeled relevant documents
  - Compute F1 score to balance precision and recall

- [ ] **Relevance Improvement:**
  - Compare relevance scores between baseline and contextual approaches
  - Calculate Mean Average Precision (MAP) and Normalized Discounted Cumulative Gain (NDCG)
  - Use a test set of 50+ diverse queries across different topics

- [ ] **Source Diversity:**
  - Measure uniqueness of sources in top results
  - Track number of distinct documents retrieved
  - Evaluate coverage of topics from different information sources

- [ ] **Implementation Plan:**
  ```typescript
  // Create metrics collection function
  async function evaluateRetrievalAccuracy(
    testQueries: Array<{
      query: string;
      relevantDocIds: string[];  // Manually labeled relevant documents
    }>
  ): Promise<{
    baselineMetrics: RetrievalMetrics;
    contextualMetrics: RetrievalMetrics;
    improvement: RetrievalMetrics;
  }> {
    // Implementation to test both approaches and compare results
  }
  
  // Run evaluation with test query set
  const accuracyResults = await evaluateRetrievalAccuracy(testQuerySet);
  console.log(JSON.stringify(accuracyResults, null, 2));
  ```

### 2. Answer Quality
- [ ] **Factual Accuracy:**
  - Manually evaluate factual correctness of answers
  - Track hallucination/fabrication rate
  - Compare with ground truth answers where available

- [ ] **Answer Completeness:**
  - Evaluate whether answers address all aspects of the query
  - Track information omission rates
  - Measure coverage of key points from relevant sources

- [ ] **Coherence and Clarity:**
  - Assess answer readability and structure
  - Evaluate logical flow and organization
  - Track clarity improvements with contextual information

- [ ] **User Satisfaction:**
  - Conduct blind A/B tests with real users
  - Collect ratings on answer usefulness
  - Measure preference between baseline and enhanced answers

- [ ] **Implementation Plan:**
  ```typescript
  // Define rating rubric for manual evaluation
  interface AnswerQualityRating {
    factualAccuracy: number;  // 0-10
    completeness: number;     // 0-10
    coherence: number;        // 0-10
    hasHallucinations: boolean;
    userRating: number;       // 1-5 stars
    evaluatorNotes: string;
  }
  
  // Create structured evaluation form
  function evaluateAnswerQuality(
    query: string,
    baselineAnswer: string,
    contextualAnswer: string
  ): {
    baselineRating: AnswerQualityRating;
    contextualRating: AnswerQualityRating;
    preferredAnswer: 'baseline' | 'contextual' | 'tied';
  }
  ```

### 3. Performance Impact
- [ ] **End-to-End Latency:**
  - Measure total response time for queries
  - Track p50, p90, and p99 latency
  - Compare baseline vs. contextual retrieval timings

- [ ] **Component Breakdown:**
  - Time spent on query analysis
  - Time spent on initial retrieval
  - Time spent on reranking
  - Time spent on answer generation

- [ ] **Resource Utilization:**
  - Memory usage during retrieval
  - CPU utilization
  - Network request patterns
  - API call frequency

- [ ] **Scaling Characteristics:**
  - Performance with increasing document count
  - Impact of concurrent requests
  - Cache effectiveness

- [ ] **Implementation Plan:**
  ```typescript
  // Performance monitoring middleware
  function trackQueryPerformance(
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => void
  ) {
    const startTime = process.hrtime();
    const metrics: PerformanceMetrics = {
      queryId: req.headers['x-request-id'] as string,
      stages: {}
    };
    
    // Attach tracking to response
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const totalTime = seconds * 1000 + nanoseconds / 1000000;
      
      metrics.totalTime = totalTime;
      recordPerformanceMetrics(metrics);
    });
    
    // Attach stage tracking function to request
    req.trackStage = (stage: string) => {
      // Implementation to track individual stage timing
    };
    
    next();
  }
  ```

### 4. Cost Analysis
- [ ] **Token Usage Tracking:**
  - Count tokens used for embeddings
  - Count tokens for context generation
  - Count tokens for reranking
  - Count tokens for answer generation

- [ ] **Cost Per Query:**
  - Calculate average cost per query
  - Compare costs between baseline and contextual approaches
  - Track cost by operation type

- [ ] **Cost Optimization:**
  - Identify opportunities to reduce token usage
  - Evaluate caching effectiveness
  - Analyze ROI of different components

- [ ] **API Budget Management:**
  - Track spending against monthly budget
  - Set up alerts for unusual usage patterns
  - Create cost forecasting

- [ ] **Implementation Plan:**
  ```typescript
  // Token counter and cost calculator
  function trackQueryCost(
    query: string,
    retrievalStrategy: RetrievalStrategy,
    tokensUsed: {
      embedding: number;
      contextGeneration: number;
      reranking: number;
      answerGeneration: number;
    }
  ): {
    totalCost: number;
    costBreakdown: Record<string, number>;
  } {
    // Implementation to calculate costs based on current pricing
    const costs = {
      embedding: tokensUsed.embedding * 0.0001,
      contextGeneration: tokensUsed.contextGeneration * 0.0005,
      reranking: tokensUsed.reranking * 0.0005,
      answerGeneration: tokensUsed.answerGeneration * 0.0020,
    };
    
    return {
      totalCost: Object.values(costs).reduce((sum, cost) => sum + cost, 0),
      costBreakdown: costs
    };
  }
  ```

## 📝 Notes & Considerations

### Architecture Decisions
- **Embedding Strategy**: We're keeping OpenAI embeddings initially with plans to migrate to Gemini embeddings in the future when they become more mature. The interface design allows for a seamless transition.

- **Contextual Information Storage**: We're storing both the original text and derived contextual information. While this increases storage requirements, it provides significant benefits:
  - Improved search relevance through contextual reranking
  - More comprehensive answer generation from original content
  - Ability to regenerate context without reprocessing documents

- **Progressive Enhancement**: The implementation supports graceful degradation when components fail or are unavailable:
  - Falls back to basic retrieval if context generation fails
  - Uses existing reranking if Gemini reranking is unavailable
  - Can operate with or without contextual information

### Performance Optimizations
- **Batching Strategies**: To minimize API calls and improve throughput:
  - Batch document context extraction for multiple chunks
  - Use embedding batch requests instead of individual calls
  - Parallelize independent operations where possible

- **Caching Layers**:
  - Cache document context to avoid regeneration
  - Cache common search results for popular queries
  - Cache embeddings to avoid recomputation

### Maintenance & Operations
- **Incremental Migration**: The migration approach allows for selective enhancement of high-value documents before processing the entire corpus:
  1. Identify high-value documents based on query logs
  2. Process these documents first to maximize impact
  3. Gradually process remaining documents based on usage patterns

- **Feature Toggles**: Comprehensive feature flags allow for:
  - Turning features on/off without code changes
  - Percentage-based progressive rollout
  - A/B testing different configurations
  - Quick rollback if issues arise

- **Monitoring Strategy**:
  - Track key metrics and set up alerts
  - Implement detailed logging for debugging
  - Create dashboards for performance visualization
  - Monitor cost and resource utilization

### Future Enhancements
- **Vector Database Migration**: Consider migrating to a dedicated vector database for improved scaling:
  - Options include Pinecone, Milvus, or Weaviate
  - Would support larger document collections
  - Improved query performance and filtering capabilities

- **Multi-Modal Context**: Extend the system to handle additional content types:
  - Image understanding and context generation
  - Structured data (tables, JSON, etc.)
  - Code and technical documentation

- **Personalization**: Add user context to further improve relevance:
  - User-specific boosting based on interests or role
  - Query history awareness
  - Tailored technical level based on user expertise

## 🔄 Alternative Implementation: Full Gemini Migration Strategy

### Overview: Complete Vector Store Replacement

This alternative implementation plan takes a more radical approach: completely replacing the existing vector store (OpenAI embeddings) with a new one built entirely using Gemini embeddings, discarding all old data. This approach requires reprocessing all source documents from scratch but provides the following benefits:

1. **Clean Slate**: No compatibility issues between different embedding models
2. **Full Gemini Integration**: Leveraging Gemini for both context generation and embeddings
3. **Unified Dimensions**: Consistent 768-dimensional embeddings throughout the system
4. **Better Performance**: Potentially improved relevance from using the same model for all aspects of retrieval

### Phase 1: Configuration & Client Implementation

#### 1.1 Update `modelConfig.ts` for Full Gemini Embedding
- [ ] Set Gemini as the sole embedding provider:
  ```typescript
  embeddingModel: {
    provider: 'gemini',
    model: 'models/text-embedding-004', // Use the latest available Gemini embedding model
    dimensions: 768 // Gemini embeddings are 768-dimensional
  }
  ```
- [ ] Confirm other model configurations:
  ```typescript
  contextGenerationModel: { provider: 'gemini', model: 'gemini-pro', ... },
  rerankerModel: { provider: 'gemini', model: 'gemini-pro', ... },
  ```
- [ ] Remove OpenAI embedding configuration entirely if no other part of the system uses it

#### 1.2 Update Environment Variables
- [ ] Ensure `GEMINI_API_KEY` is present and valid
- [ ] Remove `OPENAI_API_KEY` if no longer needed for any service
- [ ] Set `EMBEDDING_PROVIDER=gemini` environment variable
- [ ] Keep other feature flags: `USE_GEMINI_FOR_CONTEXT=true`, `USE_GEMINI_FOR_RERANKING=true`, etc.

#### 1.3 Implement Full `GeminiEmbeddingClient`
- [ ] Complete the implementation of `GeminiEmbeddingClient`:
  ```typescript
  // utils/embeddingClient.ts or utils/geminiClient.ts
  import { GoogleGenerativeAI, TaskType, BatchEmbedContentsRequest, EmbedContentRequest } from "@google/generative-ai";
  import { AI_SETTINGS } from './config';
  import { logError } from './errorHandling';
  import { EmbeddingClient } from './embeddingClientInterface';

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const modelName = AI_SETTINGS.embeddingModel.model;
  const embeddingDimension = AI_SETTINGS.embeddingModel.dimensions;

  export class GeminiEmbeddingClient implements EmbeddingClient {
      private model = genAI.getGenerativeModel({ model: modelName });

      async embedText(text: string, taskType: TaskType = TaskType.RETRIEVAL_QUERY): Promise<number[]> {
          try {
              const cleanedText = text.trim().replace(/\n+/g, ' ');
              if (!cleanedText) return Array(embeddingDimension).fill(0);

              const result = await this.model.embedContent({
                  content: { parts: [{ text: cleanedText }], role: "user" },
                  taskType: taskType,
              });
              return result.embedding.values;
          } catch (error) {
              logError(`Error embedding single text with Gemini (${modelName})`, error);
              return Array(embeddingDimension).fill(0);
          }
      }

      async embedBatch(texts: string[], taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT): Promise<number[][]> {
          const MAX_BATCH_SIZE = 100; // Gemini API limit
          const embeddings: number[][] = [];
          const requests: EmbedContentRequest[] = texts.map(text => ({
              content: { parts: [{ text: text.trim().replace(/\n+/g, ' ') }], role: "user" },
              taskType: taskType,
          }));

          try {
              for (let i = 0; i < requests.length; i += MAX_BATCH_SIZE) {
                  const batchRequests = requests.slice(i, i + MAX_BATCH_SIZE);
                  const request: BatchEmbedContentsRequest = { requests: batchRequests };
                  const result = await this.model.batchEmbedContents(request);

                  embeddings.push(...result.embeddings.map(e => e.values));
                  // Optional: Add slight delay if hitting rate limits
                  // await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // Ensure correct length, handle potential errors where some batches might fail
              if (embeddings.length !== texts.length) {
                  logError(`Gemini batch embedding mismatch: expected ${texts.length}, got ${embeddings.length}`, null);
                  // Pad with zeros if lengths mismatch
                  while (embeddings.length < texts.length) {
                      embeddings.push(Array(embeddingDimension).fill(0));
                  }
              }
              return embeddings;
          } catch (error) {
              logError(`Error batch embedding text with Gemini (${modelName})`, error);
              // Return zero vectors for all if batch fails
              return texts.map(() => Array(embeddingDimension).fill(0));
          }
      }

      getDimensions(): number { return embeddingDimension; }
      getProvider(): string { return 'gemini'; }
  }
  ```

- [ ] Update the embedding client factory to return only the Gemini client:
  ```typescript
  export function getEmbeddingClient(): EmbeddingClient {
    // No longer check environment variables - always return Gemini client
    return new GeminiEmbeddingClient();
  }
  ```

### Phase 2: Update Core Logic for Gemini Embeddings

#### 2.1 Update Contextual Processing for Embedding
- [ ] Implement a decision for what text gets embedded:
  ```typescript
  // Option 1 (Recommended): Prepend context to original chunk text for embedding
  export function prepareTextForEmbedding(
    chunk: {
      text: string;
      context?: {
        chunk?: { description?: string; keyPoints?: string[] };
      }
    }
  ): string {
    let contextPrefix = '';
    
    if (chunk.context?.chunk) {
      if (chunk.context.chunk.description) {
        contextPrefix += chunk.context.chunk.description + ' ';
      }
      
      if (chunk.context.chunk.keyPoints && chunk.context.chunk.keyPoints.length > 0) {
        contextPrefix += 'Key points: ' + chunk.context.chunk.keyPoints.join(', ') + ' ';
      }
    }
    
    return contextPrefix + chunk.text;
  }
  ```

- [ ] Modify `splitIntoChunksWithContext` to prepare text for embedding:
  ```typescript
  // Inside splitIntoChunksWithContext
  const contextualChunks = [];
  for (const chunk of basicChunks) {
    const chunkContext = await generateChunkContext(chunk.text, documentContext);
    
    const chunkWithContext = {
      originalText: chunk.text, // Store original text
      text: chunk.text, // Will be replaced with embedText in the next step
      context: {
        document: documentContext,
        chunk: chunkContext
      },
      metadata: {
        // ... existing metadata ...
      }
    };
    
    // Prepare text for embedding - this is what actually gets embedded
    chunkWithContext.text = prepareTextForEmbedding(chunkWithContext);
    
    contextualChunks.push(chunkWithContext);
  }
  ```

#### 2.2 Update Document Ingestion Pipeline
- [ ] Modify the document upload flow to use Gemini embeddings:
  ```typescript
  // In processUploadedDocument or similar function
  const embeddingClient = getEmbeddingClient(); // Now returns GeminiEmbeddingClient
  
  // Extract texts for embedding from chunks
  const batchTexts = chunks.map(chunk => chunk.text); // text field already prepared in 2.1
  
  // Generate embeddings using Gemini
  const embeddings = await embeddingClient.embedBatch(
    batchTexts, 
    TaskType.RETRIEVAL_DOCUMENT
  );
  
  // Add to vector store with the new embeddings
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    
    addToVectorStore({
      text: chunk.text, // The text with context that was embedded
      originalText: chunk.originalText, // The original chunk text without context
      embedding, // The Gemini 768-dimensional embedding
      metadata: {
        // ... existing metadata ...
        embeddingProvider: 'gemini',
        embeddingModel: modelName
      },
      context: chunk.context
    }, batchId);
  }
  ```

#### 2.3 Update Runtime Query Processing
- [ ] Modify query embedding to use Gemini:
  ```typescript
  // In API handler or search function
  const embeddingClient = getEmbeddingClient();
  
  // Embed the user query with Gemini
  const queryEmbedding = await embeddingClient.embedText(
    userQuery, 
    TaskType.RETRIEVAL_QUERY
  );
  
  // Use the Gemini embedding for vector search
  const vectorResults = await performVectorSearch(queryEmbedding, vectorLimit);
  ```

- [ ] Update the vector search function to handle 768-dimensional embeddings:
  ```typescript
  // In hybridSearch.ts or vectorSearch.ts
  export async function performVectorSearch(
    queryEmbedding: number[],
    limit: number = 20
  ): Promise<SearchResult[]> {
    // Check if we're using the in-memory store or a database
    if (useInMemoryStore) {
      // In-memory implementation
      return vectorStore.map(item => {
        const similarity = calculateCosineSimilarity(
          queryEmbedding,
          item.embedding
        );
        return { item, score: similarity };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    } else {
      // Database implementation
      // Ensure your database query is updated to work with 768-dimensional vectors
      // For example, with Supabase:
      const { data, error } = await supabase
        .rpc('match_documents', {
          query_embedding: queryEmbedding, // Now 768-dimensional
          match_threshold: 0.6,
          match_count: limit
        });
        
      if (error) throw error;
      
      // Transform database results to search results
      return data.map(row => ({
        item: {
          text: row.text,
          originalText: row.original_text,
          embedding: row.embedding,
          metadata: row.metadata,
          context: row.context
        },
        score: row.similarity
      }));
    }
  }
  ```

### Phase 3: Data Purge, Storage Update & Full Migration

#### 3.1 Backup Existing Data
- [ ] Create a full backup of all vector data:
  ```bash
  # Script for backing up data
  #!/bin/bash
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  BACKUP_DIR="./backups/vector_store_backup_$TIMESTAMP"
  
  # Create backup directory
  mkdir -p "$BACKUP_DIR"
  
  # Backup vector store data
  cp -r ./data/vector_batches "$BACKUP_DIR/vector_batches"
  cp -r ./data/corpus_stats "$BACKUP_DIR/corpus_stats"
  cp ./data/batch_index.json "$BACKUP_DIR/batch_index.json"
  cp ./data/vectorStore.json "$BACKUP_DIR/vectorStore.json"
  
  echo "Backup completed at $BACKUP_DIR"
  ```

#### 3.2 Create Data Purge Script
- [ ] Implement `scripts/purgeVectorStore.ts` to delete all vector data:
  ```typescript
  import fs from 'fs';
  import path from 'path';
  import { supabase } from '../utils/supabaseClient'; // If using Supabase

  async function purgeVectorStore() {
    console.log("⚠️ WARNING: This will permanently delete all vector store data!");
    console.log("Make sure you have a backup before proceeding.");
    
    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const confirmation = await new Promise(resolve => {
      readline.question('Type "DELETE" to confirm: ', answer => {
        readline.close();
        resolve(answer);
      });
    });
    
    if (confirmation !== 'DELETE') {
      console.log("Aborted. No data was deleted.");
      return;
    }
    
    console.log("Starting vector store purge...");
    
    // File system purge
    try {
      const vectorBatchesDir = path.join(process.cwd(), 'data', 'vector_batches');
      const batchIndexFile = path.join(process.cwd(), 'data', 'batch_index.json');
      const vectorStoreFile = path.join(process.cwd(), 'data', 'vectorStore.json');
      const corpusStatsDir = path.join(process.cwd(), 'data', 'corpus_stats');
      
      // Delete vector batch files
      if (fs.existsSync(vectorBatchesDir)) {
        const files = fs.readdirSync(vectorBatchesDir);
        for (const file of files) {
          if (file.startsWith('batch_') && file.endsWith('.json')) {
            fs.unlinkSync(path.join(vectorBatchesDir, file));
            console.log(`Deleted ${file}`);
          }
        }
      }
      
      // Delete batch index
      if (fs.existsSync(batchIndexFile)) {
        fs.unlinkSync(batchIndexFile);
        console.log(`Deleted batch_index.json`);
      }
      
      // Delete legacy vector store file if exists
      if (fs.existsSync(vectorStoreFile)) {
        fs.unlinkSync(vectorStoreFile);
        console.log(`Deleted vectorStore.json`);
      }
      
      // Delete corpus stats files
      if (fs.existsSync(corpusStatsDir)) {
        const files = fs.readdirSync(corpusStatsDir);
        for (const file of files) {
          fs.unlinkSync(path.join(corpusStatsDir, file));
          console.log(`Deleted corpus stats file: ${file}`);
        }
      }
      
      console.log("File system purge completed.");
    } catch (error) {
      console.error("Error during file system purge:", error);
    }
    
    // Database purge (if using Supabase)
    try {
      // CAUTION: This will delete all data in these tables
      console.log("Purging database tables...");
      
      // Truncate document chunks table
      const { error: chunksError } = await supabase.rpc('truncate_document_chunks');
      if (chunksError) throw chunksError;
      console.log("Truncated document_chunks table");
      
      // Truncate BM25 related tables
      const { error: termFreqError } = await supabase.rpc('truncate_term_frequencies');
      if (termFreqError) throw termFreqError;
      console.log("Truncated term_frequencies table");
      
      const { error: docFreqError } = await supabase.rpc('truncate_document_frequencies');
      if (docFreqError) throw docFreqError;
      console.log("Truncated document_frequencies table");
      
      const { error: corpusError } = await supabase.rpc('truncate_corpus_stats');
      if (corpusError) throw corpusError;
      console.log("Truncated corpus_stats table");
      
      console.log("Database purge completed.");
    } catch (error) {
      console.error("Error during database purge:", error);
    }
    
    console.log("Vector store purge completed successfully.");
  }

  // Run the function if executed directly
  if (require.main === module) {
    purgeVectorStore().catch(console.error);
  }
  ```

#### 3.3 Update Storage Schema for Gemini Embeddings
- [ ] Create database migration script for Supabase (if applicable):
  ```typescript
  // scripts/migrateDbSchema.ts
  import { supabase } from '../utils/supabaseClient';
  
  async function migrateSchemaForGemini() {
    console.log("Updating database schema for Gemini embeddings...");
    
    try {
      // Change embedding column dimension
      console.log("Altering embedding column type to VECTOR(768)...");
      const { error: alterError } = await supabase.rpc(
        'alter_embedding_dimension',
        { new_dimension: 768 }
      );
      if (alterError) throw alterError;
      
      // Drop existing index
      console.log("Dropping existing vector index...");
      const { error: dropIndexError } = await supabase.rpc('drop_embedding_index');
      if (dropIndexError) throw dropIndexError;
      
      // Create new index
      console.log("Creating new vector index for 768 dimensions...");
      const { error: createIndexError } = await supabase.rpc(
        'create_embedding_index',
        { dimension: 768, lists: 100 }
      );
      if (createIndexError) throw createIndexError;
      
      console.log("Database schema migration completed successfully.");
    } catch (error) {
      console.error("Error migrating database schema:", error);
      throw error;
    }
  }
  
  // Run the function if executed directly
  if (require.main === module) {
    migrateSchemaForGemini().catch(console.error);
  }
  ```

#### 3.4 Implement Full Re-Processing Script
- [ ] Create `scripts/rebuildVectorStore.ts` to reprocess all documents:
  ```typescript
  import fs from 'fs';
  import path from 'path';
  import { extractText } from '../utils/documentProcessing';
  import { splitIntoChunksWithContext } from '../utils/documentProcessing';
  import { getEmbeddingClient } from '../utils/embeddingClient';
  import { addToVectorStore, generateUUID } from '../utils/vectorStore';
  import { TaskType } from '@google/generative-ai';
  import { getAllSourceDocuments } from '../utils/sourceDocumentRetriever';
  
  async function rebuildVectorStore() {
    console.log("Starting full vector store rebuild with Gemini embeddings...");
    
    // Get the embedding client (Gemini)
    const embeddingClient = getEmbeddingClient();
    console.log(`Using embedding provider: ${embeddingClient.getProvider()}`);
    console.log(`Embedding dimensions: ${embeddingClient.getDimensions()}`);
    
    // Get all source documents
    const sourceDocuments = await getAllSourceDocuments();
    console.log(`Found ${sourceDocuments.length} source documents to process`);
    
    // Processing stats
    let processedDocuments = 0;
    let totalChunks = 0;
    let failedDocuments = 0;
    
    // Process each source document
    for (const sourceDoc of sourceDocuments) {
      try {
        console.log(`Processing document: ${sourceDoc.path} (${processedDocuments + 1}/${sourceDocuments.length})`);
        
        // Extract raw text from document
        const text = await extractText(sourceDoc.path, sourceDoc.mimetype);
        
        // Generate chunks with context using Gemini
        const chunks = await splitIntoChunksWithContext(text, 500, sourceDoc.filename);
        console.log(`Generated ${chunks.length} contextual chunks`);
        
        // Prepare text for embedding
        const batchTexts = chunks.map(chunk => chunk.text); // text was prepared in splitIntoChunksWithContext
        
        // Generate embeddings in batches of 20 to avoid rate limits
        const BATCH_SIZE = 20;
        const batchId = generateUUID();
        
        for (let i = 0; i < batchTexts.length; i += BATCH_SIZE) {
          const batchSlice = batchTexts.slice(i, i + BATCH_SIZE);
          const chunksSlice = chunks.slice(i, i + BATCH_SIZE);
          
          // Get embeddings
          console.log(`Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(batchTexts.length / BATCH_SIZE)}`);
          const embeddings = await embeddingClient.embedBatch(batchSlice, TaskType.RETRIEVAL_DOCUMENT);
          
          // Add to vector store
          for (let j = 0; j < chunksSlice.length; j++) {
            const chunk = chunksSlice[j];
            const embedding = embeddings[j];
            
            addToVectorStore({
              text: chunk.text,
              originalText: chunk.originalText,
              embedding,
              metadata: {
                ...chunk.metadata,
                source: `${sourceDoc.filename}_chunk_${i + j}`,
                uploadedAt: new Date().toISOString(),
                batch: batchId,
                embeddingProvider: 'gemini',
                originalPath: sourceDoc.path
              },
              context: chunk.context
            }, batchId);
            
            totalChunks++;
          }
          
          // Optional: Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        processedDocuments++;
        console.log(`Completed document ${processedDocuments}/${sourceDocuments.length}`);
        
      } catch (error) {
        console.error(`Error processing document ${sourceDoc.path}:`, error);
        failedDocuments++;
      }
    }
    
    // Rebuild BM25 index
    console.log("Rebuilding BM25 index...");
    await rebuildCorpusStats();
    
    console.log("\n==== Vector Store Rebuild Summary ====");
    console.log(`Total documents processed: ${processedDocuments}/${sourceDocuments.length}`);
    console.log(`Failed documents: ${failedDocuments}`);
    console.log(`Total chunks created: ${totalChunks}`);
    console.log(`Embedding provider: ${embeddingClient.getProvider()}`);
    console.log(`Embedding dimensions: ${embeddingClient.getDimensions()}`);
    console.log("========================================");
  }
  
  // Run the function if executed directly
  if (require.main === module) {
    rebuildVectorStore().catch(console.error);
  }
  ```

#### 3.5 Create Rebuild BM25 Index Script
- [ ] Implement or update corpus stats script:
  ```typescript
  // scripts/rebuildCorpusStats.ts
  import { getAllVectorStoreItems } from '../utils/vectorStore';
  import { calculateTermFrequencies, calculateDocumentFrequencies, calculateCorpusStats } from '../utils/bm25';
  import { saveTermFrequencies, saveDocumentFrequencies, saveCorpusStats } from '../utils/persistence';
  
  async function rebuildCorpusStats() {
    console.log("Starting BM25 index rebuild...");
    
    // Get all vector store items
    const items = getAllVectorStoreItems();
    console.log(`Found ${items.length} items in vector store`);
    
    if (items.length === 0) {
      console.error("No items found in vector store. BM25 index rebuild aborted.");
      return;
    }
    
    // Extract texts - use the same text that was embedded
    const texts = items.map(item => item.text);
    
    // Calculate term frequencies
    console.log("Calculating term frequencies...");
    const termFrequencies = calculateTermFrequencies(texts);
    
    // Calculate document frequencies
    console.log("Calculating document frequencies...");
    const documentFrequencies = calculateDocumentFrequencies(termFrequencies);
    
    // Calculate corpus stats
    console.log("Calculating corpus stats...");
    const corpusStats = calculateCorpusStats(documentFrequencies, texts.length);
    
    // Save all data
    console.log("Saving BM25 index data...");
    await saveTermFrequencies(termFrequencies);
    await saveDocumentFrequencies(documentFrequencies);
    await saveCorpusStats(corpusStats);
    
    console.log("BM25 index rebuild completed successfully.");
  }
  
  // Run the function if executed directly
  if (require.main === module) {
    rebuildCorpusStats().catch(console.error);
  }
  ```

### Phase 4: Testing & Evaluation

#### 4.1 Update Test Suite
- [ ] Modify tests to expect 768-dimensional Gemini embeddings
- [ ] Update mock data and fixtures for tests
- [ ] Add specific tests for Gemini embedding client
- [ ] Create tests for the updated processing pipeline

#### 4.2 Evaluate and Benchmark New System
- [ ] Implement `scripts/evaluateGeminiSystem.ts`:
  ```typescript
  import { compareRetrievalStrategies } from '../utils/evaluationUtils';
  import fs from 'fs';
  import path from 'path';
  
  async function evaluateGeminiSystem() {
    console.log("Evaluating Gemini-based RAG system performance...");
    
    // Load test queries
    const testQueriesPath = path.join(process.cwd(), 'data', 'evaluation', 'test_queries.json');
    const testQueries = JSON.parse(fs.readFileSync(testQueriesPath, 'utf-8'));
    
    console.log(`Running evaluation on ${testQueries.length} test queries...`);
    
    // Create evaluation ID
    const evaluationId = `gemini_evaluation_${Date.now()}`;
    
    // For each query, run the evaluation 
    const results = [];
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`Processing query ${i + 1}/${testQueries.length}: "${query.text}"`);
      
      // For the new Gemini system, there's no 'baseline' to compare against
      // So here we're just running the query and recording metrics
      const result = await runGeminiQuery(query.text);
      
      results.push({
        query: query.text,
        response: result.answer,
        retrievalTime: result.retrievalTime,
        totalTime: result.totalTime,
        relevantSourcesCount: result.sources.length
      });
    }
    
    // Save results to file
    const resultsPath = path.join(process.cwd(), 'data', 'evaluation', `${evaluationId}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`Evaluation completed. Results saved to ${resultsPath}`);
    
    // Generate summary metrics
    const avgRetrievalTime = results.reduce((sum, r) => sum + r.retrievalTime, 0) / results.length;
    const avgTotalTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
    const avgSourcesCount = results.reduce((sum, r) => sum + r.relevantSourcesCount, 0) / results.length;
    
    console.log("\n==== Performance Summary ====");
    console.log(`Average retrieval time: ${avgRetrievalTime.toFixed(2)}ms`);
    console.log(`Average total time: ${avgTotalTime.toFixed(2)}ms`);
    console.log(`Average relevant sources count: ${avgSourcesCount.toFixed(2)}`);
    console.log("==============================");
  }
  
  async function runGeminiQuery(query: string) {
    const startTime = Date.now();
    
    // Call your API with the query
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    const totalTime = Date.now() - startTime;
    
    return {
      answer: data.answer,
      sources: data.sources,
      retrievalTime: data.metadata.queryTime,
      totalTime
    };
  }
  
  // Run the function if executed directly
  if (require.main === module) {
    evaluateGeminiSystem().catch(console.error);
  }
  ```

### Phase 5: Deployment & Monitoring

#### 5.1 Create Deployment Checklist
- [ ] Develop a comprehensive deployment plan:
  ```markdown
  # Gemini Migration Deployment Checklist

  ## Pre-Deployment
  - [ ] Complete full system tests
  - [ ] Verify backup of existing vector data
  - [ ] Ensure Gemini API key and quotas are set up correctly
  - [ ] Prepare rollback plan
  - [ ] Schedule deployment during low-traffic period

  ## Deployment Steps
  1. [ ] Deploy updated application code with feature flags disabled
  2. [ ] Run database schema migration (if using database)
  3. [ ] Purge existing vector store data
  4. [ ] Run the full rebuild script
  5. [ ] Verify rebuild completion and data integrity
  6. [ ] Rebuild BM25 index
  7. [ ] Run evaluation tests on production data
  8. [ ] Enable feature flags and gradually increase traffic

  ## Post-Deployment
  - [ ] Monitor system performance for 24-48 hours
  - [ ] Check error rates and latency metrics
  - [ ] Compare quality metrics to pre-migration baseline
  - [ ] Adjust system parameters as needed
  - [ ] Document any issues or learnings
  ```

#### 5.2 Enhanced Monitoring for Embedding Changes
- [ ] Implement specific monitoring for Gemini embedding performance:
  ```typescript
  // In utils/performanceMonitoring.ts
  export interface EmbeddingMetrics extends QueryMetrics {
    embeddingProvider: string;
    embeddingDimensions: number;
    embeddingTime: number;
    embeddingTokens: number;
  }
  
  export function recordEmbeddingMetrics(metrics: EmbeddingMetrics): void {
    // Add to shared metrics store
    recordQueryMetrics(metrics);
    
    // Additionally, track embedding-specific metrics
    console.log(`Recorded embedding metrics: ${metrics.embeddingProvider}, ${metrics.embeddingTime}ms`);
    
    // In production, send these to your monitoring system
  }
  
  export function getEmbeddingPerformance(): {
    avgEmbeddingTime: number;
    totalEmbeddingTokens: number;
    estimatedEmbeddingCost: number;
  } {
    const metrics = getRecentMetrics()
      .filter(m => (m as EmbeddingMetrics).embeddingTime !== undefined) as EmbeddingMetrics[];
    
    return {
      avgEmbeddingTime: metrics.reduce((sum, m) => sum + m.embeddingTime, 0) / (metrics.length || 1),
      totalEmbeddingTokens: metrics.reduce((sum, m) => sum + m.embeddingTokens, 0),
      estimatedEmbeddingCost: metrics.reduce((sum, m) => sum + (m.embeddingTokens * 0.0001), 0)
    };
  }
  ```

## 🔄 Migration Path Selection

### Comparison: Progressive Enhancement vs. Full Migration

| Aspect | Progressive Enhancement | Full Gemini Migration |
|--------|-------------------------|----------------------|
| **Risk Level** | Lower - Gradual changes with fallbacks | Higher - Complete rebuild required |
| **Implementation Time** | Longer - Phased approach | Shorter - One-time rebuild |
| **System Downtime** | Minimal - Compatible with existing data | Significant - Requires data purge |
| **Consistency** | Mixed - Different embedding models in system | High - Single embedding model throughout |
| **Cost** | Lower initial cost, higher maintenance | Higher initial cost, lower maintenance |
| **Rollback Option** | Easy - Can disable features individually | Difficult - Requires restoring backups |
| **Performance** | May be suboptimal with mixed models | Potentially better with unified model |

### Decision Factors

Choose the Full Gemini Migration approach if:
- You're starting a new deployment or can afford downtime
- Consistency of embedding dimensions is critical
- You want to maximize Gemini's capabilities without compromise
- You have a reliable source of all original documents
- You can handle the API costs of reprocessing everything at once

Choose the Progressive Enhancement approach if:
- You need continuous system availability
- You want to gradually evaluate and introduce Gemini
- You prefer to spread out the API costs over time
- You have a very large document corpus making full reprocessing impractical
- You're concerned about potential issues with Gemini embeddings

### Implementation Sequence

Regardless of which approach you choose, the sequence of implementation should be:

1. First, update the configuration and client code
2. Then, implement/update the document processing pipeline
3. Next, modify the search and retrieval components
4. Finally, deploy and evaluate the changes

For the Full Migration approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, purge existing data
3. Run the full rebuild process
4. Verify and monitor the new system

For the Progressive Enhancement approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, verify and monitor the new system
3. Gradually introduce Gemini for new documents
4. Monitor and adjust as needed

For both approaches, ensure thorough testing and monitoring before and after deployment

## 🔄 Migration Path Selection

### Comparison: Progressive Enhancement vs. Full Migration

| Aspect | Progressive Enhancement | Full Gemini Migration |
|--------|-------------------------|----------------------|
| **Risk Level** | Lower - Gradual changes with fallbacks | Higher - Complete rebuild required |
| **Implementation Time** | Longer - Phased approach | Shorter - One-time rebuild |
| **System Downtime** | Minimal - Compatible with existing data | Significant - Requires data purge |
| **Consistency** | Mixed - Different embedding models in system | High - Single embedding model throughout |
| **Cost** | Lower initial cost, higher maintenance | Higher initial cost, lower maintenance |
| **Rollback Option** | Easy - Can disable features individually | Difficult - Requires restoring backups |
| **Performance** | May be suboptimal with mixed models | Potentially better with unified model |

### Decision Factors

Choose the Full Gemini Migration approach if:
- You're starting a new deployment or can afford downtime
- Consistency of embedding dimensions is critical
- You want to maximize Gemini's capabilities without compromise
- You have a reliable source of all original documents
- You can handle the API costs of reprocessing everything at once

Choose the Progressive Enhancement approach if:
- You need continuous system availability
- You want to gradually evaluate and introduce Gemini
- You prefer to spread out the API costs over time
- You have a very large document corpus making full reprocessing impractical
- You're concerned about potential issues with Gemini embeddings

### Implementation Sequence

Regardless of which approach you choose, the sequence of implementation should be:

1. First, update the configuration and client code
2. Then, implement/update the document processing pipeline
3. Next, modify the search and retrieval components
4. Finally, deploy and evaluate the changes

For the Full Migration approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, purge existing data
3. Run the full rebuild process
4. Verify and monitor the new system

For the Progressive Enhancement approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, verify and monitor the new system
3. Gradually introduce Gemini for new documents
4. Monitor and adjust as needed

For both approaches, ensure thorough testing and monitoring before and after deployment

## 🔄 Migration Path Selection

### Comparison: Progressive Enhancement vs. Full Migration

| Aspect | Progressive Enhancement | Full Gemini Migration |
|--------|-------------------------|----------------------|
| **Risk Level** | Lower - Gradual changes with fallbacks | Higher - Complete rebuild required |
| **Implementation Time** | Longer - Phased approach | Shorter - One-time rebuild |
| **System Downtime** | Minimal - Compatible with existing data | Significant - Requires data purge |
| **Consistency** | Mixed - Different embedding models in system | High - Single embedding model throughout |
| **Cost** | Lower initial cost, higher maintenance | Higher initial cost, lower maintenance |
| **Rollback Option** | Easy - Can disable features individually | Difficult - Requires restoring backups |
| **Performance** | May be suboptimal with mixed models | Potentially better with unified model |

### Decision Factors

Choose the Full Gemini Migration approach if:
- You're starting a new deployment or can afford downtime
- Consistency of embedding dimensions is critical
- You want to maximize Gemini's capabilities without compromise
- You have a reliable source of all original documents
- You can handle the API costs of reprocessing everything at once

Choose the Progressive Enhancement approach if:
- You need continuous system availability
- You want to gradually evaluate and introduce Gemini
- You prefer to spread out the API costs over time
- You have a very large document corpus making full reprocessing impractical
- You're concerned about potential issues with Gemini embeddings

### Implementation Sequence

Regardless of which approach you choose, the sequence of implementation should be:

1. First, update the configuration and client code
2. Then, implement/update the document processing pipeline
3. Next, modify the search and retrieval components
4. Finally, deploy and evaluate the changes

For the Full Migration approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, purge existing data
3. Run the full rebuild process
4. Verify and monitor the new system

For the Progressive Enhancement approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, verify and monitor the new system
3. Gradually introduce Gemini for new documents
4. Monitor and adjust as needed

For both approaches, ensure thorough testing and monitoring before and after deployment

## 🔄 Migration Path Selection

### Comparison: Progressive Enhancement vs. Full Migration

| Aspect | Progressive Enhancement | Full Gemini Migration |
|--------|-------------------------|----------------------|
| **Risk Level** | Lower - Gradual changes with fallbacks | Higher - Complete rebuild required |
| **Implementation Time** | Longer - Phased approach | Shorter - One-time rebuild |
| **System Downtime** | Minimal - Compatible with existing data | Significant - Requires data purge |
| **Consistency** | Mixed - Different embedding models in system | High - Single embedding model throughout |
| **Cost** | Lower initial cost, higher maintenance | Higher initial cost, lower maintenance |
| **Rollback Option** | Easy - Can disable features individually | Difficult - Requires restoring backups |
| **Performance** | May be suboptimal with mixed models | Potentially better with unified model |

### Decision Factors

Choose the Full Gemini Migration approach if:
- You're starting a new deployment or can afford downtime
- Consistency of embedding dimensions is critical
- You want to maximize Gemini's capabilities without compromise
- You have a reliable source of all original documents
- You can handle the API costs of reprocessing everything at once

Choose the Progressive Enhancement approach if:
- You need continuous system availability
- You want to gradually evaluate and introduce Gemini
- You prefer to spread out the API costs over time
- You have a very large document corpus making full reprocessing impractical
- You're concerned about potential issues with Gemini embeddings

### Implementation Sequence

Regardless of which approach you choose, the sequence of implementation should be:

1. First, update the configuration and client code
2. Then, implement/update the document processing pipeline
3. Next, modify the search and retrieval components
4. Finally, deploy and evaluate the changes

For the Full Migration approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, purge existing data
3. Run the full rebuild process
4. Verify and monitor the new system

For the Progressive Enhancement approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, verify and monitor the new system
3. Gradually introduce Gemini for new documents
4. Monitor and adjust as needed

For both approaches, ensure thorough testing and monitoring before and after deployment

## 🔄 Migration Path Selection

### Comparison: Progressive Enhancement vs. Full Migration

| Aspect | Progressive Enhancement | Full Gemini Migration |
|--------|-------------------------|----------------------|
| **Risk Level** | Lower - Gradual changes with fallbacks | Higher - Complete rebuild required |
| **Implementation Time** | Longer - Phased approach | Shorter - One-time rebuild |
| **System Downtime** | Minimal - Compatible with existing data | Significant - Requires data purge |
| **Consistency** | Mixed - Different embedding models in system | High - Single embedding model throughout |
| **Cost** | Lower initial cost, higher maintenance | Higher initial cost, lower maintenance |
| **Rollback Option** | Easy - Can disable features individually | Difficult - Requires restoring backups |
| **Performance** | May be suboptimal with mixed models | Potentially better with unified model |

### Decision Factors

Choose the Full Gemini Migration approach if:
- You're starting a new deployment or can afford downtime
- Consistency of embedding dimensions is critical
- You want to maximize Gemini's capabilities without compromise
- You have a reliable source of all original documents
- You can handle the API costs of reprocessing everything at once

Choose the Progressive Enhancement approach if:
- You need continuous system availability
- You want to gradually evaluate and introduce Gemini
- You prefer to spread out the API costs over time
- You have a very large document corpus making full reprocessing impractical
- You're concerned about potential issues with Gemini embeddings

### Implementation Sequence

Regardless of which approach you choose, the sequence of implementation should be:

1. First, update the configuration and client code
2. Then, implement/update the document processing pipeline
3. Next, modify the search and retrieval components
4. Finally, deploy and evaluate the changes

For the Full Migration approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, purge existing data
3. Run the full rebuild process
4. Verify and monitor the new system

For the Progressive Enhancement approach, add these steps:
1. Before deployment, create comprehensive backups
2. After deployment, verify and monitor the new system
3. Gradually introduce Gemini for new documents
4. Monitor and adjust as needed

For both approaches, ensure thorough testing and monitoring before and after deployment 

## 📊 Multi-Modal Document Processing Enhancement

### Overview: Enhancing Visual Content Understanding

This enhancement focuses on improving the RAG system's ability to process and understand documents containing rich visual elements such as charts, diagrams, tables, and images. Traditional text extraction methods often miss crucial information contained in visual elements, especially in PDFs, PowerPoint presentations, and documents with complex layouts.

By leveraging Gemini's multi-modal capabilities, we can significantly enhance the quality and completeness of information extracted from mixed-media documents.

### Benefits of Multi-Modal Processing

1. **Comprehensive Information Extraction**: Capture insights from both textual and visual content
2. **Context Preservation**: Maintain relationships between text and associated visuals
3. **Layout Understanding**: Preserve document structure and formatting information
4. **Enhanced Search Relevance**: Allow queries about visual elements to return appropriate results
5. **Improved Answer Generation**: Generate more accurate responses that incorporate visual information

### Phase 1: Multi-Modal Document Analyzer Implementation

#### 1.1 Create Multi-Modal Processing Pipeline
- [ ] Implement a document pre-processor that identifies document type and potential visual elements:
  ```typescript
  // utils/documentAnalyzer.ts
  import { PDFLoader } from './documentLoaders/pdfLoader';
  import { PowerPointLoader } from './documentLoaders/powerPointLoader';
  import { ImageAnalyzer } from './imageAnalysis/imageAnalyzer';
  import { DocumentType, VisualElement, ProcessedDocument } from './types';
  
  export async function analyzeDocument(
    filePath: string, 
    mimeType: string
  ): Promise<ProcessedDocument> {
    // Determine document type
    const docType = determineDocumentType(mimeType);
    
    // Extract content based on document type
    let textContent = '';
    let visualElements: VisualElement[] = [];
    
    try {
      switch (docType) {
        case DocumentType.PDF:
          const pdfResult = await PDFLoader.extract(filePath);
          textContent = pdfResult.text;
          visualElements = await extractVisualElementsFromPDF(filePath, pdfResult.pages);
          break;
          
        case DocumentType.POWERPOINT:
          const pptResult = await PowerPointLoader.extract(filePath);
          textContent = pptResult.text;
          visualElements = pptResult.slides.map(slide => ({
            type: 'slide',
            pageNumber: slide.number,
            imageBuffer: slide.thumbnail,
            location: slide.number,
            associatedText: slide.text
          }));
          break;
          
        // Handle other document types
        default:
          textContent = await extractText(filePath, mimeType);
      }
      
      return {
        text: textContent,
        documentType: docType,
        visualElements,
        metadata: {
          source: filePath,
          mimeType,
          processingDate: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error analyzing document ${filePath}:`, error);
      throw error;
    }
  }
  
  async function extractVisualElementsFromPDF(
    filePath: string, 
    pages: any[]
  ): Promise<VisualElement[]> {
    const visualElements: VisualElement[] = [];
    
    // Extract images from PDF
    const images = await PDFLoader.extractImages(filePath);
    
    // For each extracted image, analyze it
    for (const image of images) {
      // Analyze image to determine if it's a chart, table, diagram, etc.
      const analysis = await ImageAnalyzer.analyze(image.buffer);
      
      visualElements.push({
        type: analysis.type, // 'chart', 'table', 'image', etc.
        pageNumber: image.pageNumber,
        imageBuffer: image.buffer,
        location: image.location,
        associatedText: image.surroundingText || '',
        analysis: analysis.description
      });
    }
    
    return visualElements;
  }
  ```

#### 1.2 Implement Visual Element Analysis with Gemini
- [ ] Create a service to analyze images, charts, and diagrams using Gemini's vision capabilities:
  ```typescript
  // utils/imageAnalysis/imageAnalyzer.ts
  import { GoogleGenerativeAI } from '@google/generative-ai';
  import { AI_SETTINGS } from '../config';
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const visionModel = genAI.getGenerativeModel({ model: AI_SETTINGS.visionModel.model });
  
  export interface ImageAnalysisResult {
    type: 'chart' | 'table' | 'diagram' | 'image' | 'screenshot' | 'graph' | 'unknown';
    description: string;
    entities?: string[];
    data?: any;
    detectedText?: string;
  }
  
  export class ImageAnalyzer {
    static async analyze(imageBuffer: Buffer): Promise<ImageAnalysisResult> {
      try {
        // Convert buffer to proper format for Gemini
        const imagePart = {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/png' // Adjust based on actual image type
          }
        };
        
        // Create prompt for image analysis
        const prompt = "Analyze this image in detail. If it contains a chart, diagram, table, or graph, describe what it shows, including any trends, key data points, and the main message. If it's a regular image, describe its content and any text visible in it.";
        
        // Get analysis from Gemini
        const result = await visionModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        const analysisText = response.text();
        
        // Determine the image type
        const imageType = this.determineImageType(analysisText);
        
        // For charts and tables, try to extract structured data
        let extractedData = undefined;
        if (imageType === 'chart' || imageType === 'table' || imageType === 'graph') {
          extractedData = await this.extractStructuredData(imageBuffer, imageType);
        }
        
        // Extract any text visible in the image using OCR if needed
        const detectedText = await this.extractTextFromImage(imageBuffer);
        
        return {
          type: imageType,
          description: analysisText,
          data: extractedData,
          detectedText
        };
      } catch (error) {
        console.error("Error analyzing image:", error);
        return {
          type: 'unknown',
          description: 'Failed to analyze image due to an error.'
        };
      }
    }
    
    private static determineImageType(analysisText: string): ImageAnalysisResult['type'] {
      const lowerText = analysisText.toLowerCase();
      
      if (lowerText.includes('chart') || lowerText.includes('bar') || lowerText.includes('pie')) {
        return 'chart';
      } else if (lowerText.includes('table') || lowerText.includes('grid') || lowerText.includes('row') && lowerText.includes('column')) {
        return 'table';
      } else if (lowerText.includes('diagram') || lowerText.includes('flowchart') || lowerText.includes('process flow')) {
        return 'diagram';
      } else if (lowerText.includes('graph') || lowerText.includes('plot') || lowerText.includes('trend')) {
        return 'graph';
      } else if (lowerText.includes('screenshot') || lowerText.includes('screen capture')) {
        return 'screenshot';
      } else {
        return 'image';
      }
    }
    
    private static async extractStructuredData(imageBuffer: Buffer, type: string): Promise<any> {
      // For charts and tables, try to extract structured data using a more specific prompt
      try {
        const imagePart = {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/png'
          }
        };
        
        let prompt = "";
        if (type === 'chart' || type === 'graph') {
          prompt = "Extract the data from this chart/graph. Return the data in JSON format with the following structure: {title: string, xAxis: {label: string, values: any[]}, yAxis: {label: string, values: any[]}, series: [{name: string, data: number[]}], insights: string[]}";
        } else if (type === 'table') {
          prompt = "Extract the data from this table. Return the data in JSON format with the following structure: {headers: string[], rows: any[][], summary: string}";
        }
        
        const result = await visionModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        const jsonText = response.text();
        
        // Extract the JSON data from the response
        const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/) || 
                         jsonText.match(/```\n([\s\S]*?)\n```/) ||
                         jsonText.match(/{[\s\S]*?}/);
                         
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0].replace(/```json\n|```\n|```/g, ''));
        }
        
        return undefined;
      } catch (error) {
        console.error(`Error extracting structured data from ${type}:`, error);
        return undefined;
      }
    }
    
    private static async extractTextFromImage(imageBuffer: Buffer): Promise<string | undefined> {
      // Use OCR or Gemini to extract text from the image
      try {
        const imagePart = {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/png'
          }
        };
        
        const prompt = "Extract all visible text from this image. Return only the text, exactly as it appears.";
        
        const result = await visionModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        return response.text();
      } catch (error) {
        console.error("Error extracting text from image:", error);
        return undefined;
      }
    }
  }
  ```

#### 1.3 Update Document Types and Interfaces
- [ ] Define comprehensive types to handle multi-modal content:
  ```typescript
  // utils/types.ts
  export enum DocumentType {
    PDF = 'pdf',
    POWERPOINT = 'powerpoint',
    WORD = 'word',
    TEXT = 'text',
    IMAGE = 'image',
    SPREADSHEET = 'spreadsheet',
    HTML = 'html',
    UNKNOWN = 'unknown'
  }
  
  export interface VisualElement {
    type: 'chart' | 'table' | 'diagram' | 'image' | 'screenshot' | 'graph' | 'unknown';
    pageNumber: number;
    imageBuffer: Buffer;
    location: any; // Could be page number or coordinates
    associatedText: string;
    analysis?: string;
  }
  
  export interface ProcessedDocument {
    text: string;
    documentType: DocumentType;
    visualElements: VisualElement[];
    metadata: {
      source: string;
      mimeType: string;
      processingDate: string;
      [key: string]: any;
    };
  }
  
  export interface MultiModalVectorStoreItem extends VectorStoreItem {
    visualElements?: {
      type: string;
      description: string;
      location: any;
      embedding?: number[];
    }[];
    originalFormat?: string;
  }
  ```

### Phase 2: Enhanced Chunking and Embedding Strategies

#### 2.1 Implement Context-Aware Chunking with Visual Elements
- [ ] Update the chunking function to preserve relationships with visual elements:
  ```typescript
  // utils/documentProcessing.ts
  export async function splitIntoChunksWithMultiModalContext(
    document: ProcessedDocument,
    chunkSize: number = 500
  ): Promise<Array<{
    text: string;
    visualElements?: VisualElement[];
    context?: any;
    metadata?: any;
  }>> {
    // Extract basic chunks from text
    const textChunks = splitIntoChunks(document.text, chunkSize);
    
    // Get document context
    const documentContext = await extractDocumentContext(document);
    
    // Array to store enhanced chunks
    const multiModalChunks = [];
    
    // Process each text chunk
    for (const [index, chunk] of textChunks.entries()) {
      // Find visual elements relevant to this chunk
      const relevantVisuals = findRelevantVisualElements(
        chunk.text,
        document.visualElements,
        document.text
      );
      
      // Generate context for this chunk, including visual elements
      const chunkContext = await generateMultiModalChunkContext(
        chunk.text,
        relevantVisuals,
        documentContext
      );
      
      // Prepare chunk with visual context
      const multiModalChunk = {
        text: chunk.text,
        visualElements: relevantVisuals,
        context: {
          document: documentContext,
          chunk: chunkContext,
          visualSummaries: relevantVisuals.map(v => v.analysis).filter(Boolean)
        },
        metadata: {
          ...chunk.metadata,
          hasVisualElements: relevantVisuals.length > 0,
          visualElementTypes: [...new Set(relevantVisuals.map(v => v.type))],
          documentType: document.documentType
        }
      };
      
      multiModalChunks.push(multiModalChunk);
    }
    
    // Handle visual-only chunks (for significant visual elements with minimal text)
    for (const visual of document.visualElements) {
      // Skip visuals that were already associated with text chunks
      if (multiModalChunks.some(chunk => 
        chunk.visualElements?.some(v => v === visual)
      )) {
        continue;
      }
      
      // For important standalone visuals, create a dedicated chunk
      if (visual.analysis && visual.type !== 'unknown') {
        const visualChunk = {
          text: visual.analysis + (visual.associatedText ? `\n${visual.associatedText}` : ''),
          visualElements: [visual],
          context: {
            document: documentContext,
            isVisualElement: true,
            visualType: visual.type
          },
          metadata: {
            isVisualElement: true,
            visualElementType: visual.type,
            pageNumber: visual.pageNumber,
            documentType: document.documentType
          }
        };
        
        multiModalChunks.push(visualChunk);
      }
    }
    
    return multiModalChunks;
  }
  
  function findRelevantVisualElements(
    chunkText: string,
    visualElements: VisualElement[],
    fullText: string
  ): VisualElement[] {
    // Find visual elements that are relevant to this text chunk
    const relevantVisuals = [];
    
    for (const visual of visualElements) {
      // Check if the visual's associated text appears in this chunk
      if (visual.associatedText && chunkText.includes(visual.associatedText)) {
        relevantVisuals.push(visual);
        continue;
      }
      
      // Check if chunk references figures, tables, charts by number
      const visualPageRef = `figure ${visual.pageNumber}` || 
                           `table ${visual.pageNumber}` || 
                           `chart ${visual.pageNumber}`;
                           
      if (chunkText.toLowerCase().includes(visualPageRef.toLowerCase())) {
        relevantVisuals.push(visual);
        continue;
      }
      
      // Proximity-based matching (if chunk is close to the visual in the document)
      const visualPosition = fullText.indexOf(visual.associatedText);
      const chunkPosition = fullText.indexOf(chunkText);
      
      if (visualPosition !== -1 && chunkPosition !== -1) {
        const distance = Math.abs(visualPosition - chunkPosition);
        if (distance < 1000) { // Adjust threshold as needed
          relevantVisuals.push(visual);
        }
      }
    }
    
    return relevantVisuals;
  }
  
  async function generateMultiModalChunkContext(
    text: string,
    visualElements: VisualElement[],
    documentContext: any
  ): Promise<any> {
    // Base text context
    const baseContext = await generateChunkContext(text, documentContext);
    
    // If no visual elements, return base context
    if (visualElements.length === 0) {
      return baseContext;
    }
    
    // Enhance context with visual information
    const visualSummaries = visualElements.map(v => 
      `${v.type}: ${v.analysis || 'No analysis available'}`
    );
    
    return {
      ...baseContext,
      visualElements: {
        count: visualElements.length,
        types: [...new Set(visualElements.map(v => v.type))],
        summaries: visualSummaries
      }
    };
  }
  ```

#### 2.2 Implement Multi-Modal Embedding Strategy
- [ ] Create a function to embed both text and visual content:
  ```typescript
  // utils/multiModalEmbedding.ts
  import { getEmbeddingClient } from './embeddingClient';
  import { TaskType } from '@google/generative-ai';
  import { VisualElement } from './types';
  
  export async function generateMultiModalEmbeddings(
    chunks: Array<{
      text: string;
      visualElements?: VisualElement[];
      context?: any;
    }>
  ): Promise<Array<{
    textEmbedding: number[];
    visualEmbeddings?: number[][];
    combinedEmbedding?: number[];
  }>> {
    const embeddingClient = getEmbeddingClient();
    const results = [];
    
    // First, get all text embeddings in batch for efficiency
    const textsToEmbed = chunks.map(chunk => {
      // For text chunks with visuals, combine the text with visual descriptions
      if (chunk.visualElements && chunk.visualElements.length > 0) {
        const visualDescriptions = chunk.visualElements
          .filter(v => v.analysis)
          .map(v => v.analysis)
          .join(' ');
          
        return `${chunk.text} ${visualDescriptions}`;
      }
      
      return chunk.text;
    });
    
    // Generate embeddings for the combined texts
    const textEmbeddings = await embeddingClient.embedBatch(
      textsToEmbed,
      TaskType.RETRIEVAL_DOCUMENT
    );
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const textEmbedding = textEmbeddings[i];
      
      // For chunks without visual elements, just use the text embedding
      if (!chunk.visualElements || chunk.visualElements.length === 0) {
        results.push({ textEmbedding });
        continue;
      }
      
      // For visual elements, we can also embed their descriptions if needed
      const visualAnalyses = chunk.visualElements
        .filter(v => v.analysis)
        .map(v => v.analysis || '');
        
      let visualEmbeddings: number[][] = [];
      
      if (visualAnalyses.length > 0) {
        visualEmbeddings = await embeddingClient.embedBatch(
          visualAnalyses,
          TaskType.RETRIEVAL_DOCUMENT
        );
      }
      
      // For this approach, we'll use the combined text embedding as primary
      // But also store individual visual embeddings for potential specialized retrieval
      results.push({
        textEmbedding,
        visualEmbeddings: visualEmbeddings.length > 0 ? visualEmbeddings : undefined
      });
    }
    
    return results;
  }
  ```

### Phase 3: Vector Store and Retrieval Enhancement

#### 3.1 Update Vector Store for Multi-Modal Data
- [ ] Modify the vector store to handle visual elements and multiple embeddings:
  ```typescript
  // utils/vectorStore.ts
  export interface MultiModalVectorStoreItem extends VectorStoreItem {
    visualElements?: {
      type: string;
      description: string;
      embedding?: number[];
      imageId?: string; // Reference to stored image
    }[];
    originalFormat?: string;
  }
  
  export function addMultiModalItemToVectorStore(
    item: MultiModalVectorStoreItem,
    batchId?: string
  ): void {
    // Add to vector store as usual
    addToVectorStore(item, batchId);
    
    // If this item has visual elements with separate embeddings, we might
    // want to store them for specialized visual-first retrieval
    if (item.visualElements && item.visualElements.some(v => v.embedding)) {
      for (const visual of item.visualElements.filter(v => v.embedding)) {
        // Create a visual-focused item
        const visualItem: VectorStoreItem = {
          text: visual.description,
          embedding: visual.embedding!,
          metadata: {
            ...item.metadata,
            isVisualElement: true,
            visualType: visual.type,
            parentItemId: item.metadata?.source,
            imageId: visual.imageId
          }
        };
        
        // Add to same batch as parent item
        addToVectorStore(visualItem, batchId);
      }
    }
  }
  ```

#### 3.2 Implement Multi-Modal Search
- [ ] Enhance search to handle visual queries and content:
  ```typescript
  // utils/multiModalSearch.ts
  import { performVectorSearch, performKeywordSearch } from './hybridSearch';
  import { getEmbeddingClient } from './embeddingClient';
  import { TaskType } from '@google/generative-ai';
  
  export async function performMultiModalSearch(
    query: string,
    options: {
      limit?: number;
      visualFocus?: boolean;
      filters?: any;
    } = {}
  ) {
    const embeddingClient = getEmbeddingClient();
    
    // Analyze if the query is asking about visual content
    const isVisualQuery = isQueryAboutVisuals(query);
    
    // Generate query embedding
    const queryEmbedding = await embeddingClient.embedText(
      query,
      TaskType.RETRIEVAL_QUERY
    );
    
    // Base vector search
    let vectorResults = await performVectorSearch(
      queryEmbedding,
      options.limit || 20
    );
    
    // If query is focused on visuals, boost chunks with visual elements
    if (isVisualQuery || options.visualFocus) {
      vectorResults = vectorResults.map(result => {
        // Check if the item has visual elements
        const hasVisuals = result.item.metadata?.hasVisualElements ||
                         result.item.metadata?.isVisualElement ||
                         (result.item as MultiModalVectorStoreItem).visualElements?.length > 0;
                         
        // Boost score for items with visuals on visual queries
        if (hasVisuals) {
          return {
            ...result,
            score: result.score * 1.2 // 20% boost
          };
        }
        
        return result;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 20);
    }
    
    // Apply additional filters
    if (options.filters) {
      const { documentTypes, visualTypes, dateRange } = options.filters;
      
      // Filter by document type
      if (documentTypes && documentTypes.length > 0) {
        vectorResults = vectorResults.filter(result => 
          documentTypes.includes(result.item.metadata?.documentType)
        );
      }
      
      // Filter by visual type
      if (visualTypes && visualTypes.length > 0) {
        vectorResults = vectorResults.filter(result => {
          if (result.item.metadata?.isVisualElement) {
            return visualTypes.includes(result.item.metadata?.visualType);
          }
          
          const visualElementTypes = result.item.metadata?.visualElementTypes || [];
          return visualTypes.some(type => visualElementTypes.includes(type));
        });
      }
      
      // Apply date range filter
      if (dateRange) {
        // Implementation depends on how dates are stored
      }
    }
    
    return vectorResults;
  }
  
  function isQueryAboutVisuals(query: string): boolean {
    const visualTerms = [
      'chart', 'graph', 'table', 'diagram', 'image', 'picture', 'figure',
      'plot', 'visualization', 'infographic', 'slide', 'presentation',
      'show', 'display', 'visual', 'illustration'
    ];
    
    const lowerQuery = query.toLowerCase();
    
    // Check for direct references to visual elements
    for (const term of visualTerms) {
      if (lowerQuery.includes(term)) {
        return true;
      }
    }
    
    // Check for queries asking to see something
    const seeingPatterns = [
      'show me', 'display', 'visualize', 'graph of', 'chart of',
      'what does it look like', 'how does it appear'
    ];
    
    for (const pattern of seeingPatterns) {
      if (lowerQuery.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }
  ```

### Phase 4: Answer Generation with Visual Context

#### 4.1 Enhance Answer Generation
- [ ] Update the answer generator to incorporate visual information:
  ```typescript
  // utils/answerGenerator.ts
  export async function generateAnswerWithVisualContext(
    query: string,
    searchResults: any[],
    options: any = {}
  ): Promise<{
    answer: string;
    sources: any[];
    hasVisualContext: boolean;
    visualSourceIds?: string[];
  }> {
    // Extract context from search results
    let textContext = '';
    let visualContext = '';
    const sources = [];
    const visualSourceIds = [];
    
    // Identify if any results have visual elements
    const hasVisualElements = searchResults.some(result => 
      result.item.metadata?.hasVisualElements || 
      result.item.metadata?.isVisualElement
    );
    
    // Build context including visual information
    for (const result of searchResults) {
      // Add text content
      textContext += `${result.item.text}\n\n`;
      
      // If this is a visual element or has visual elements
      if (result.item.metadata?.isVisualElement) {
        // This is a dedicated visual element chunk
        visualContext += `[${result.item.metadata.visualType}]: ${result.item.text}\n\n`;
        visualSourceIds.push(result.item.metadata.imageId || result.item.metadata.source);
      } else if (result.item.metadata?.hasVisualElements) {
        // This is a text chunk with associated visuals
        const visualDescriptions = (result.item as MultiModalVectorStoreItem)
          .visualElements?.map(v => `[${v.type}]: ${v.description}`)
          .join('\n') || '';
          
        if (visualDescriptions) {
          visualContext += `${visualDescriptions}\n\n`;
          
          // Add image IDs if available
          (result.item as MultiModalVectorStoreItem)
            .visualElements?.forEach(v => {
              if (v.imageId) visualSourceIds.push(v.imageId);
            });
        }
      }
      
      // Add to sources
      sources.push({
        id: result.item.metadata?.source,
        score: result.score,
        hasVisuals: result.item.metadata?.hasVisualElements || result.item.metadata?.isVisualElement
      });
    }
    
    // Create a visual-aware prompt
    const hasVisualContext = visualContext.length > 0;
    let prompt = '';
    
    if (hasVisualContext) {
      prompt = `Answer the following query based on the provided text context and visual information:
      
Query: ${query}

Text Context:
${textContext}

Visual Information:
${visualContext}

Based on the above information, provide a comprehensive answer that incorporates both textual and visual insights. If the query specifically asks about visual elements, focus on the visual information.`;
    } else {
      // Use standard prompt for text-only contexts
      prompt = `Answer the following query based on the provided context:
      
Query: ${query}

Context:
${textContext}

Based on the above information, provide a comprehensive answer.`;
    }
    
    // Generate answer using the appropriate LLM
    const model = genAI.getGenerativeModel({ model: AI_SETTINGS.answerModel.model });
    const result = await model.generateContent(prompt);
    const answer = result.response.text();
    
    return {
      answer,
      sources,
      hasVisualContext,
      visualSourceIds: visualSourceIds.length > 0 ? visualSourceIds : undefined
    };
  }
  ```

### Phase 5: Implementation Plan for Multi-Modal Enhancement

#### 5.1 Integration with Gemini Migration Strategy
The multi-modal enhancement can be integrated with either migration strategy:

**With Progressive Enhancement Approach:**
- First implement the Gemini client for embeddings
- Then add multi-modal analysis capabilities
- Gradually process new documents with the enhanced pipeline
- Keep backward compatibility with existing documents

**With Full Migration Approach:**
- Include multi-modal analysis in the rebuild process
- Process all documents with the new pipeline in one go
- Fully leverage Gemini's multi-modal capabilities from the start

#### 5.2 Implementation Timeline
- Week 1: Document analyzer and visual element extractor
- Week 2: Multi-modal chunking and embedding strategies
- Week 3: Vector store and retrieval enhancements
- Week 4: Answer generation with visual context
- Week 5: Testing and optimization

#### 5.3 Storage Considerations
- [ ] Implement efficient storage for image data:
  - Store extracted images in an object storage service (S3, Google Cloud Storage)
  - Store only references/IDs in the vector store
  - Consider a CDN for serving images in the UI
  - Implement cache and periodic cleanup for optimization

### Decision Guide for Multi-Modal Implementation

Choose the right approach based on your document corpus:

**Visual-Heavy Documents:** If your documents contain many charts, diagrams, slides, etc., prioritize the multi-modal enhancement as it will significantly improve retrieval quality.

**Text-Dominant Documents:** If visual elements are minimal or not critical to understanding, you can implement this as a later phase after the basic Gemini migration.

**Mixed Document Types:** Consider a hybrid approach where you process new PowerPoint, PDF, and image-heavy documents with the multi-modal pipeline while handling text-dominant documents with the standard pipeline.

**Implementation Priority:**
1. Focus first on document types with highest visual importance (PowerPoint, infographic PDFs)
2. Then enhance standard PDFs and Word documents with occasional charts/images
3. Finally, implement specialized handling for pure image documents if needed