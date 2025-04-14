# Hybrid Search and Answer Synthesis with Gemini

## Complete RAG Pipeline Documentation

This document explains how our system combines hybrid search with Gemini to create a robust RAG (Retrieval-Augmented Generation) pipeline that efficiently processes multiple search results into coherent, structured answers.

## Table of Contents

1. [Overview of the RAG Pipeline](#overview-of-the-rag-pipeline)
2. [Hybrid Search Implementation](#hybrid-search-implementation)
3. [Processing Multiple Search Results](#processing-multiple-search-results)
4. [Answer Synthesis with Gemini](#answer-synthesis-with-gemini)
5. [Performance Optimization](#performance-optimization)
6. [Best Practices](#best-practices)

## Overview of the RAG Pipeline

Our RAG pipeline consists of several key components that work together:

1. **Query Analysis**: Analyze the user query to understand intent and extract key entities
2. **Hybrid Search**: Combine vector similarity and keyword search to retrieve relevant information
3. **Result Processing**: Filter, rank, and organize multiple chunks of retrieved information
4. **Context Creation**: Transform search results into a coherent context for the LLM
5. **Answer Generation**: Use Gemini to synthesize a coherent response based on the context
6. **Response Formatting**: Structure the output according to the user's needs

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────┐    ┌────────────────┐    ┌────────────────┐
│ User Query  │ -> │ Hybrid      │ -> │ Result          │ -> │ Context        │ -> │ Gemini Answer  │
│             │    │ Search      │    │ Processing      │    │ Creation       │    │ Generation     │
└─────────────┘    └─────────────┘    └─────────────────┘    └────────────────┘    └────────────────┘
```

## Hybrid Search Implementation

Our hybrid search combines two powerful retrieval methods:

### Vector Similarity Search

- Uses embeddings (vector representations) to capture semantic meaning
- Finds documents that are conceptually similar, even if they use different terminology
- Leverages PostgreSQL's pgvector extension for efficient vector similarity calculations

### Keyword Search

- Uses PostgreSQL's full-text search capabilities
- Finds exact matches and variations of specific terms
- Provides high precision for queries with specific terminology

### Combined Approach

The results from both methods are combined with configurable weights:

```sql
SELECT DISTINCT ON (id)
  id,
  document_id,
  chunk_id,
  content,
  text,
  metadata,
  vector_score,
  keyword_score,
  -- Calculate the combined score based on the weights
  (vector_score * vector_weight) + (keyword_score * keyword_weight) AS combined_score,
  search_type
FROM 
  combined_results
ORDER BY 
  id, combined_score DESC
LIMIT 
  match_count;
```

## Processing Multiple Search Results

When hybrid search returns multiple chunks, our system processes them efficiently:

### 1. Filtering and Relevance Sorting

```typescript
// From utils/answerGenerator.ts
export async function generateAnswer(
  query: string, 
  searchResults: SearchResultItem[],
  options: {
    includeSourceCitations?: boolean;
    maxSourcesInAnswer?: number;
    model?: string;
    timeout?: number;
    conversationHistory?: string | Array<{role: string; content: string}>;
  } = {}
): Promise<string> {
  // ...

  // Sort results by relevance score (if available)
  const sortedResults = [...searchResults].sort((a, b) => {
    return (b.relevanceScore || 0) - (a.relevanceScore || 0);
  });

  // Limit to the most relevant results
  const limitedResults = sortedResults.slice(0, maxSourcesInAnswer);
  
  // ...
```

### 2. Deduplication and Redundancy Elimination

The system handles duplicate and overlapping content by:

- Using distinct IDs to eliminate pure duplicates
- Calculating similarity between chunks to avoid redundant information
- Prioritizing chunks with higher relevance scores

### 3. Context Formation

```typescript
// Format context with source information
let contextText = '';
const sourceReferences: Record<string, string> = {};

limitedResults.forEach((result, index) => {
  // Format the source citation if available
  const source = result.source ? result.source.trim() : 'Unknown source';
  sourceReferences[`[${index + 1}]`] = source;
  
  // Add metadata information if relevant
  const metadataInfo = formatResultMetadata(result.metadata);
  
  // Add the context item with its source citation
  contextText += `[${index + 1}] ${result.text}\n`;
  if (metadataInfo) {
    contextText += `Metadata: ${metadataInfo}\n`;
  }
  contextText += `\n`;
});

// Handle context length limits
if (estimateTokenCount(contextText) > MAX_TOKENS_FOR_MODEL) {
  contextText = await summarizeContext(query, contextText);
}
```

## Answer Synthesis with Gemini

### Context Handling

For large amounts of retrieved content, our system has several strategies:

1. **Prioritization**: Focusing on the most relevant chunks first
2. **Summarization**: Using Gemini to condense content while preserving key information
3. **Chunking**: Breaking large contexts into manageable pieces when necessary

```typescript
async function summarizeContext(query: string, context: string): Promise<string> {
  try {
    console.log(`Context too large (${estimateTokenCount(context)} tokens), summarizing with Gemini...`);
    
    const systemPrompt = `You are an expert summarizer for Workstream, an HR, Payroll, and Hiring platform for the hourly workforce. Your task is to condense the provided text to answer a specific question accurately.
    // ...
    `;

    const userPrompt = `Question: ${query}
    
    Here is the content to summarize while keeping information relevant to the question:
    
    ${context}
    
    Provide a detailed summary that maintains all key information...`;

    const summary = await generateGeminiChatCompletion(systemPrompt, userPrompt);
    return summary;
  } catch (error) {
    // Fallback handling if summarization fails
    // ...
  }
}
```

### Structured Answer Generation

Gemini generates structured responses using carefully crafted prompts that:

1. **Maintain Company Voice**: Present information from the company's perspective
2. **Preserve Key Details**: Ensure important information isn't lost in synthesis
3. **Format Consistently**: Create well-organized responses with proper citations
4. **Address the Question**: Stay focused on the user's specific information needs

```typescript
const systemPrompt = `You are a knowledgeable AI assistant for Workstream, an HR, Payroll, and Hiring platform for the hourly workforce.
You have access to our company's knowledge base and should use that information to answer questions.

IMPORTANT: You represent our company. When answering questions about "our company," "our products," "our services," or referring to "we" or "us," you should speak from the perspective of a company representative.

Answer the user's question using the provided context. The context contains information from our company's knowledge base.
// ...
`;

const userPrompt = `Question: ${query}\n\nContext:\n${contextText}\n\nAnswer:`;
```

### JSON Structured Output (When Needed)

For specialized needs, Gemini can produce structured JSON outputs:

```typescript
export async function generateStructuredGeminiResponse(
  systemPrompt: string,
  userPrompt: string,
  responseSchema: any
): Promise<any> {
  // ...implementation details
}
```

## Performance Optimization

Our system includes several optimizations for handling large volumes of search results:

### Token Management

- Accurately estimates token counts to avoid exceeding model limits
- Uses dynamic chunking to fit content within model constraints
- Applies summarization only when necessary to preserve detail

```typescript
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount * AVG_TOKENS_PER_WORD);
}
```

### Model Selection

- Uses different models based on context size and complexity
- Falls back to more efficient models for summarization tasks
- Balances quality and performance across the pipeline

### Database Optimizations

- Indexes for both vector and keyword searches
- Efficient filtering in the database rather than in application code
- Pagination and limiting to avoid processing unnecessary results

## Best Practices

For optimal performance of the hybrid search and answer synthesis pipeline:

1. **Chunk Size Optimization**:
   - Aim for chunks of 500-1000 tokens
   - Ensure chunks have proper context and don't break mid-sentence
   - Use overlapping chunks to prevent information loss at boundaries

2. **Filter Usage**:
   - Apply filters in the database query to reduce retrieved documents
   - Use category and metadata filters for more precise results
   - Balance filter specificity with recall needs

3. **Weight Tuning**:
   - Adjust `vector_weight` and `keyword_weight` based on query types
   - Use higher vector weight (0.7-0.8) for conceptual questions
   - Use higher keyword weight (0.7-0.8) for fact-based or terminology-specific questions

4. **Prompt Engineering**:
   - Craft system prompts that clearly define the company voice
   - Include specific instructions about handling uncertainty
   - Provide format guidelines for consistent outputs

5. **Monitoring and Feedback**:
   - Track search and generation metrics
   - Collect user feedback on answer quality
   - Analyze cases where answers don't meet expectations

## Conclusion

Our hybrid search and answer synthesis pipeline brings together the best of both retrieval techniques and modern LLM capabilities. By efficiently managing multiple search results and using advanced context processing, we deliver high-quality, accurate answers that represent the company's voice while addressing users' specific questions. 