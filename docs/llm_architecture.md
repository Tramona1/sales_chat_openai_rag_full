# LLM-Driven Architecture

The Sales Chat RAG system uses a fully LLM-driven architecture to provide sophisticated, contextually relevant responses to user queries. This document explains the key components and principles of this architecture.

## Core Principles

1. **Direct LLM Integration**: The system directly integrates with LLM capabilities without unnecessary indirection layers or hardcoded responses, enabling it to scale effectively with increasing data and query complexity.

2. **End-to-End RAG Pipeline**: The entire Retrieval-Augmented Generation pipeline is designed to leverage LLM capabilities at each stage, from query understanding to answer generation.

3. **Context-Aware Response Generation**: The system dynamically adapts responses based on query type, available context, and conversation history.

4. **Continuous Conversational Context**: The system maintains document references across multiple exchanges, ensuring that follow-up questions leverage previously retrieved knowledge.

## Key Components

### Query Analysis (`utils/geminiProcessor.ts`)

The system uses Gemini to analyze user queries with the following capabilities:

```typescript
export async function analyzeQueryWithGemini(query: string): Promise<QueryAnalysisResult> {
  // Implementation uses Gemini to extract structured information about query intent and entities
}
```

This function:
- Extracts query intent (factual, technical, comparison, overview)
- Identifies entities in the query (people, companies, products, features)
- Suggests appropriate filters for search (categories, technical level)
- Determines expected content types for the answer

### Hybrid Search (`utils/hybridSearch.ts`)

The search system intelligently combines vector and keyword search:

```typescript
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResponse> {
  // Implementation uses Supabase's pgvector capabilities combined with text search
}
```

This function:
- Balances vector similarity (semantic) and keyword matching
- Applies metadata filters based on query analysis
- Handles fallback scenarios when initial searches return limited results

### Answer Generation (`utils/answerGenerator.ts`)

The core of the system is the answer generation module:

```typescript
export async function generateAnswer(
  query: string, 
  searchResults: SearchResultItem[],
  options: {
    systemPrompt?: string;
    includeSourceCitations?: boolean;
    maxSourcesInAnswer?: number;
    model?: string;
    timeout?: number;
    conversationHistory?: string | Array<{role: string; content: string}>;
  } = {}
): Promise<string> {
  // Implementation prepares context and uses Gemini to generate coherent responses
}
```

This function:
- Processes retrieved context from search results
- Formats appropriate responses for conversational queries
- Handles large context windows with automatic summarization
- Provides fallback mechanisms when information is incomplete
- Generates coherent, contextually relevant answers using Gemini
- Utilizes conversation history to maintain context across exchanges

### Document Reference Tracking

The system now implements document reference tracking across conversation turns:

```typescript
function extractPreviousDocumentReferences(
  conversationHistory: Array<{role: string; content: string}>
): Array<DocumentReference> {
  // Extract document references from previous assistant responses
}
```

This functionality:
- Identifies documents referenced in previous responses
- Maintains these references for follow-up questions
- Prioritizes previously referenced documents in the context
- Ensures continuity and coherence in multi-turn conversations
- Enhances the system's ability to handle complex follow-up questions

## API Handler Implementation

The API handler in `pages/api/query.ts` now directly uses these LLM-powered components:

```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Implementation directly uses LLM-powered components
  
  // Extract conversation history and document references
  const { conversationHistory } = req.body;
  const previousDocumentReferences = extractPreviousDocumentReferences(conversationHistory);
  
  // Query analysis with Gemini
  const queryAnalysis = await analyzeQueryWithGemini(originalQuery);
  
  // Hybrid search using Supabase pgvector
  const hybridResults = await hybridSearch(queryToUse, searchOptions);
  
  // Combine previous document references with new search results
  const combinedContext = [...previousDocumentReferences, ...processedResults];
  
  // Answer generation with Gemini
  const answer = await generateAnswer(queryToUse, combinedContext, {
    includeSourceCitations: true,
    maxSourcesInAnswer: 5,
    conversationHistory: conversationHistory
  });
}
```

## Benefits of the LLM-Driven Approach

1. **Scalability**: The system can handle increasing data volumes and query complexity without hardcoded limitations.

2. **Flexibility**: The LLM can adapt to new query types and domains without requiring extensive code changes.

3. **Natural Responses**: Direct use of the LLM produces more natural, coherent responses than template-based approaches.

4. **Maintenance**: Removing indirection layers and mock implementations simplifies maintenance and debugging.

5. **Quality**: The system leverages state-of-the-art LLM capabilities for all aspects of query processing, ensuring high-quality responses.

6. **Conversational Coherence**: The document reference tracking ensures that conversations maintain context and coherence across multiple exchanges.

## Development Guidelines

When extending the system:

1. Always prefer direct LLM integration over hard-coded responses or rule-based systems.

2. Use strongly typed interfaces to ensure consistency between components.

3. Provide fallback mechanisms for cases where the LLM might not perform optimally.

4. Maintain clear separation of concerns between query analysis, search, and answer generation.

5. Use the system prompt effectively to guide the LLM toward providing accurate, contextually relevant responses.

6. Prioritize conversation context maintenance to ensure smooth multi-turn interactions.

## Future Improvements

Future improvements to the architecture may include:

1. Enhancing query analysis with multi-stage reasoning
2. Implementing more sophisticated document reference storage and retrieval
3. Adding support for interactive topic exploration through guided follow-up questions
4. Improving citation and source attribution with more precise document linking
5. Optimizing context preparation for more efficient token usage
6. Developing a more robust mechanism for retrieving the actual content of previously referenced documents 