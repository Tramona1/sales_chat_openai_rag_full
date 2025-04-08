# Sales Knowledge Assistant: Technical Documentation

## System Overview

This document provides a comprehensive technical overview of the Workstream Sales Knowledge Assistant, including architecture, file structure, APIs, data flow, and implementation details.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [API Reference](#api-reference)
5. [Data Storage](#data-storage)
6. [Search & Retrieval System](#search--retrieval-system)
7. [AI Model Configuration](#ai-model-configuration)
8. [Dual Chat Mode Implementation](#dual-chat-mode-implementation)
9. [Real-Time Information System](#real-time-information-system)
   - [Perplexity API Integration](#perplexity-api-integration)
10. [Feedback & Analytics](#feedback--analytics)
11. [Admin Dashboard](#admin-dashboard)
    - [Document Management System](#document-management-system)
    - [Document Approval Workflow](#document-approval-workflow)
    - [Pending Document Manager](#pending-document-manager)
    - [Feedback System Integration](#feedback-system-integration)
12. [Scaling with Supabase](#scaling-with-supabase)
13. [Deployment Guide](#deployment-guide)
14. [Troubleshooting](#troubleshooting)

## System Architecture

### High-Level Architecture

The Sales Knowledge Assistant is built on a modern Next.js framework with a hybrid architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                        │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │  Base Chat UI │   │Company Chat UI│   │  Admin Dashboard  │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────────┐
│                           API Layer                              │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │    /query     │   │   /research   │   │ /feedback & /log  │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────────┐
│                        Service Layer                            │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │ Query Analysis│   │ Answer Generator│ │ External APIs     │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │ Hybrid Search │   │ Data Ingestion │  │ Analytics Engine  │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                               │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │ Vector Store  │   │ Document Store│   │ Analytics Store   │  │
│  └───────────────┘   └───────────────┘   └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React, Next.js, TailwindCSS
- **Backend**: Node.js, Next.js API Routes
- **Database**: JSON files, Vector database
- **AI/ML**: OpenAI API, Gemini API, Perplexity API 
- **Search**: Hybrid search (vector + BM25)
- **Deployment**: Vercel/Netlify or custom Node.js hosting

### File Structure

```
/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── query/            # Main query endpoint
│   │   ├── research/         # Company research endpoint
│   │   ├── feedback/         # Feedback collection endpoint
│   │   └── log/              # Usage logging endpoint
│   ├── chat/                 # Main chat interface
│   ├── company-chat/         # Company-specific chat
│   └── admin/                # Admin dashboard
├── components/               # React components
│   ├── ChatMessage.tsx       # Chat message component
│   ├── CompanyProfile.tsx    # Company info display
│   └── FeedbackButtons.tsx   # Upvote/downvote buttons
├── utils/                    # Utility functions
│   ├── answerGenerator.ts    # Response generation
│   ├── hybridSearch.ts       # Hybrid search implementation
│   ├── queryAnalysis.ts      # Query intent analysis
│   ├── vectorStore.ts        # Vector database interaction
│   ├── perplexityClient.ts   # Perplexity API client
│   ├── openaiClient.ts       # OpenAI API client
│   ├── geminiClient.ts       # Gemini API client
│   └── feedbackAnalytics.ts  # Feedback processing
├── data/                     # Data storage
│   ├── vector_batches/       # Vector store data
│   ├── corpus_stats/         # BM25 corpus statistics
│   ├── feedback/             # User feedback data
│   └── analytics/            # Usage analytics data
├── scripts/                  # Utility scripts
│   ├── rebuild_corpus_stats.ts    # Update BM25 index
│   ├── fix_vector_store.ts        # Repair vector store
│   └── ingest_documents.ts        # Document ingestion
└── docs/                     # Documentation
    ├── technical_documentation.md  # This document
    ├── document_management_playbook.md
    └── sales_knowledge_roadmap.md
```

## Core Components

### 1. Query Processing Pipeline

The query processing pipeline is the central workflow for handling user questions:

```
  User Query
      │
      ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│ Query      │───>│ Retrieval  │───>│ Answer     │
│ Analysis   │    │ System     │    │ Generation │
└────────────┘    └────────────┘    └────────────┘
      │                │                  │
      ▼                ▼                  ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│ Intent     │    │ Hybrid     │    │ Source     │
│ Detection  │    │ Search     │    │ Citation   │
└────────────┘    └────────────┘    └────────────┘
```

#### Key Files:

- `utils/queryAnalysis.ts`: Analyzes queries for intent, entities, and complexity
- `utils/hybridSearch.ts`: Performs vector and keyword search with metadata filtering
- `utils/answerGenerator.ts`: Generates answers from retrieved contexts

### 2. Hybrid Search System

The hybrid search system combines vector similarity search with BM25 keyword matching:

```typescript
// utils/hybridSearch.ts (simplified)
export async function performHybridSearch(
  query: string,
  limit: number = 10,
  hybridRatio: number = 0.5,
  filter?: MetadataFilter
): Promise<SearchResult[]> {
  // 1. Get query embedding
  const queryEmbedding = await embedText(query);
  
  // 2. Perform vector search
  const vectorResults = await performVectorSearch(queryEmbedding, limit * 2);
  
  // 3. Perform BM25 keyword search
  const keywordResults = performKeywordSearch(query, limit * 2);
  
  // 4. Merge results with hybridRatio weighting
  const mergedResults = mergeSearchResults(
    vectorResults, 
    keywordResults, 
    hybridRatio
  );
  
  // 5. Apply metadata filters
  const filteredResults = applyFilters(mergedResults, filter);
  
  // 6. Return top results
  return filteredResults.slice(0, limit);
}
```

### 3. Answer Generation System

The answer generation system has built-in context management to handle large documents:

```typescript
// utils/answerGenerator.ts (simplified)
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
  // 1. Prepare context from search results
  const contextText = prepareContext(searchResults, options.maxSourcesInAnswer);
  
  // 2. Estimate token count
  const tokenCount = estimateTokenCount(contextText + query);
  
  // 3. Choose model based on context size
  let answer: string;
  if (tokenCount > MAX_TOKENS_OPENAI) {
    // Use Gemini for large contexts or summarize first
    if (tokenCount > MAX_CONTEXT_LENGTH) {
      const summarizedContext = await summarizeContext(query, contextText);
      answer = await generateGeminiAnswer(query, summarizedContext, options);
    } else {
      answer = await generateGeminiAnswer(query, contextText, options);
    }
  } else {
    // Use OpenAI for standard contexts
    answer = await generateOpenAIAnswer(query, contextText, options);
  }
  
  return answer;
}
```

### 4. Company Research System

The company research system fetches and processes company information:

```typescript
// utils/companyResearch.ts (simplified)
export async function researchCompany(
  companyName: string
): Promise<CompanyProfile> {
  // 1. Check cache first
  const cachedProfile = await getFromCache(companyName);
  if (cachedProfile && !isExpired(cachedProfile)) {
    return cachedProfile;
  }
  
  // 2. Perform parallel research queries
  const [basicInfo, news, products, industry] = await Promise.all([
    fetchCompanyBasicInfo(companyName),
    fetchCompanyNews(companyName),
    fetchCompanyProducts(companyName),
    fetchIndustryAnalysis(companyName)
  ]);
  
  // 3. Process and structure the data
  const companyProfile = {
    name: companyName,
    basicInfo,
    news,
    products,
    industry,
    timestamp: Date.now()
  };
  
  // 4. Save to cache
  await saveToCache(companyName, companyProfile);
  
  return companyProfile;
}
```

## Data Flow

### Query Processing Flow

1. **User Query Input**
   - User enters query in chat interface
   - Client sends query to `/api/query` endpoint

2. **Query Analysis**
   - `analyzeQuery()` determines query intent and parameters
   - System classifies query type (factual, conversational, company-specific)

3. **Retrieval Parameter Optimization**
   - `getRetrievalParameters()` sets optimal search parameters
   - For company queries, system adjusts hybridRatio to favor keyword matching

4. **Information Retrieval**
   - `performHybridSearch()` combines vector and keyword search
   - System applies metadata filters based on query type
   - For factual queries, system prioritizes verified information

5. **Answer Generation**
   - Retrieved contexts are sent to LLM for answer generation
   - System adds source citations and confidence levels
   - For large contexts, system uses token management strategies

6. **Response Delivery**
   - Formatted answer is returned to client
   - Feedback UI is attached to response
   - Analytics data is logged

### Company-Specific Mode Flow

1. **Company Selection**
   - User selects "Company Chat" mode
   - User enters company name or website

2. **Research Phase**
   - System calls `/api/research` endpoint
   - Multiple parallel requests gather company information
   - Results are processed and structured

3. **Context Preloading**
   - Company information is loaded into chat context
   - System generates company profile summary card
   - Conversation starters are suggested

4. **Augmented Responses**
   - All subsequent queries are answered with company context
   - System maintains company information in memory
   - Additional research is performed as needed

## API Reference

### Main API Endpoints

#### `/api/query`

Primary endpoint for answering user questions.

**Request:**
```json
{
  "query": "What are Workstream's pricing tiers?",
  "conversationId": "conv_123456",
  "options": {
    "hybridRatio": 0.5,
    "includeSourceCitations": true
  },
  "context": "Previous conversation context..."
}
```

**Response:**
```json
{
  "answer": "Workstream offers three pricing tiers: Starter, Professional, and Enterprise...",
  "sources": [
    {
      "title": "Pricing Documentation",
      "source": "workstream-pricing-guide",
      "relevance": 0.92
    }
  ],
  "metadata": {
    "queryType": "FACTUAL",
    "primaryCategory": "PRICING",
    "confidence": 0.87
  }
}
```

#### `/api/research`

Company research endpoint.

**Request:**
```json
{
  "companyName": "Acme Corporation",
  "detail": "full",
  "fresh": true
}
```

**Response:**
```json
{
  "company": {
    "name": "Acme Corporation",
    "industry": "Manufacturing",
    "size": "1000-5000 employees",
    "location": "Chicago, IL",
    "founded": 1985,
    "description": "...",
    "products": [...],
    "news": [...],
    "painPoints": [...]
  },
  "metadata": {
    "sources": [...],
    "lastUpdated": "2023-06-15T14:30:00Z",
    "confidence": 0.85
  }
}
```

#### `/api/feedback`

Collects user feedback on responses.

**Request:**
```json
{
  "responseId": "resp_78910",
  "rating": "positive",
  "comments": "Very helpful information",
  "conversationId": "conv_123456",
  "query": "What are Workstream's pricing tiers?"
}
```

**Response:**
```json
{
  "success": true,
  "feedbackId": "feedback_12345"
}
```

### External API Integrations

#### OpenAI API

Used for:
- Text embeddings for vector search
- Answer generation for standard contexts
- Query expansion and reformulation

#### Gemini API

Used for:
- Context summarization for large documents
- Answer generation for large contexts
- Fallback when OpenAI has token limitations

#### Perplexity API

Used for:
- Real-time company research
- News and industry information
- Competitive analysis

## Data Storage

### Vector Store

The vector store is our primary knowledge repository:

```
/data/
├── vectorStore.json       # Legacy single file (deprecated)
└── vector_batches/        # Batched vector storage (current)
    ├── batch_1.json
    ├── batch_2.json
    └── metadata.json
```

**Vector item format:**
```json
{
  "id": "doc_12345",
  "text": "Workstream offers three pricing tiers...",
  "embedding": [0.123, 0.456, ...],
  "metadata": {
    "source": "pricing-documentation",
    "title": "Workstream Pricing Guide",
    "category": "PRICING",
    "technicalLevel": 3,
    "lastUpdated": "2023-05-10"
  }
}
```

### BM25 Text Search Index

To support keyword search, we maintain corpus statistics:

```
/data/corpus_stats/
├── term_frequencies.json  # Count of each term across all docs
├── doc_frequencies.json   # Number of docs containing each term
└── doc_count.json         # Total document count
```

### Feedback and Analytics Storage

User feedback and analytics are stored for continuous improvement:

```
/data/
├── feedback/
│   ├── ratings.json       # User ratings (up/down votes)
│   └── comments.json      # Detailed feedback
└── analytics/
    ├── queries.json       # Query patterns and frequency
    ├── usage.json         # System usage analytics
    └── performance.json   # Response time and quality metrics
```

## Search & Retrieval System

### Hybrid Search Implementation

The hybrid search system combines:

1. **Vector similarity search** - Using cosine similarity between embeddings
2. **BM25 keyword search** - Using term frequency and document frequency
3. **Metadata filtering** - For category, technical level, etc.

#### Vector Search

```typescript
function performVectorSearch(queryEmbedding, limit) {
  const items = getAllVectorStoreItems();
  
  return items
    .map(item => ({
      item,
      score: calculateCosineSimilarity(queryEmbedding, item.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

#### BM25 Search

```typescript
function performKeywordSearch(query, limit) {
  const tokens = tokenizeText(query);
  const items = getAllVectorStoreItems();
  
  return items
    .map(item => ({
      item,
      score: calculateBM25Score(tokens, item.text, corpusStats)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

#### Results Merging

```typescript
function mergeSearchResults(vectorResults, keywordResults, hybridRatio) {
  const combinedResults = new Map();
  
  // Add vector results with weight (1-hybridRatio)
  vectorResults.forEach(result => {
    combinedResults.set(result.item.id, {
      item: result.item,
      score: result.score * (1 - hybridRatio),
      vectorScore: result.score,
      bm25Score: 0
    });
  });
  
  // Add/merge keyword results with weight (hybridRatio)
  keywordResults.forEach(result => {
    if (combinedResults.has(result.item.id)) {
      const existing = combinedResults.get(result.item.id);
      existing.score += result.score * hybridRatio;
      existing.bm25Score = result.score;
    } else {
      combinedResults.set(result.item.id, {
        item: result.item,
        score: result.score * hybridRatio,
        vectorScore: 0,
        bm25Score: result.score
      });
    }
  });
  
  return Array.from(combinedResults.values())
    .sort((a, b) => b.score - a.score);
}
```

### Query Analysis System

The query analysis system determines:

1. **Query intent** - What type of information is being requested
2. **Entity recognition** - What specific entities are mentioned
3. **Technical level** - How complex the answer should be
4. **Category estimation** - Which document categories to prioritize

```typescript
async function analyzeQuery(query: string): Promise<QueryAnalysis> {
  // Check cache first
  const cachedAnalysis = getFromCache(query);
  if (cachedAnalysis) return cachedAnalysis;
  
  // Use LLM for comprehensive analysis
  const llmAnalysis = await analyzeLLM(query);
  
  // Process and normalize results
  const analysis = {
    categories: normalizeCategories(llmAnalysis.categories),
    primaryCategory: normalizePrimaryCategory(llmAnalysis.primaryCategory),
    entities: llmAnalysis.entities,
    queryType: normalizeQueryType(llmAnalysis.queryType),
    technicalLevel: llmAnalysis.technicalLevel,
    estimatedResultCount: llmAnalysis.estimatedResultCount,
    isTimeDependent: llmAnalysis.isTimeDependent,
    query: query
  };
  
  // Save to cache
  cacheWithExpiry(query, analysis, QUERY_ANALYSIS_CACHE_TIMEOUT);
  
  return analysis;
}
```

## AI Model Configuration

### OpenAI API Usage

The system uses the OpenAI API for the following purposes:

1. **Text Embeddings**
   - **Model**: `text-embedding-ada-002`
   - **Purpose**: Generates vector embeddings for both documents and user queries to enable vector similarity search
   - **Implementation**: `utils/openaiClient.ts` - `embedText()` function

2. **Primary Chat Completions**
   - **Model**: `gpt-4` (default)
   - **Purpose**: Main model for generating answers to user queries when context size permits
   - **Fallback Model**: `gpt-3.5-turbo-1106`
   - **Implementation**: `utils/openaiClient.ts` - `generateChatCompletion()` function

3. **Structured Data Generation**
   - **Models**: Supports JSON mode in `gpt-4-turbo`, `gpt-4-0125`, `gpt-3.5-turbo-0125`
   - **Purpose**: Generates structured responses (JSON) for query analysis, intent detection, and other structured outputs
   - **Implementation**: `utils/openaiClient.ts` - `generateStructuredResponse()` function

4. **Re-ranking**
   - **Model**: Typically uses fallback model (`gpt-3.5-turbo-1106`)
   - **Purpose**: Re-ranks search results based on relevance to the query
   - **Implementation**: `utils/openaiClient.ts` - `rankTextsForQuery()` function

### Gemini API Usage

The system uses Google's Gemini API for the following purposes:

1. **Large Context Handling**
   - **Model**: `gemini-2.0-flash`
   - **Purpose**: Handles large context when the document retrieval exceeds OpenAI token limits
   - **Implementation**: `utils/geminiClient.ts` - `generateGeminiChatCompletion()` function

2. **Context Summarization**
   - **Model**: `gemini-2.0-flash`
   - **Purpose**: Summarizes large context retrievals to fit within token limits
   - **Implementation**: `utils/answerGenerator.ts` - `summarizeContext()` function

3. **Structured Data Generation**
   - **Model**: `gemini-2.0-flash`
   - **Purpose**: Alternative to OpenAI for generating structured responses when needed
   - **Implementation**: `utils/geminiClient.ts` - `generateStructuredGeminiResponse()` function

### Model Routing Logic

The system intelligently routes between OpenAI and Gemini models based on:

1. **Context Size**: When retrieved context exceeds OpenAI's token limits (approximately 8,000 tokens), the system automatically switches to Gemini to handle the larger context.

2. **Cost Optimization**: Certain operations like context summarization use Gemini models for better cost efficiency.

3. **Availability**: If OpenAI models have rate limit issues or are temporarily unavailable, the system can fall back to Gemini models.

The model routing logic is primarily implemented in `utils/answerGenerator.ts`, where token estimation determines which model to use for answer generation. 

## Dual Chat Mode Implementation

### Base Chat Mode

The base chat mode provides general product information:

```typescript
// pages/chat.tsx (simplified)
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  // ...
  
  const handleSendMessage = async () => {
    // Add user message
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    
    // Call query API
    const response = await axios.post('/api/query', {
      query: input,
      context: getRecentMessages(messages)
    });
    
    // Add assistant response
    setMessages([
      ...messages, 
      userMessage,
      { role: 'assistant', content: response.data.answer }
    ]);
  };
  
  // Render chat UI
  return (
    <div>
      <ChatMessages messages={messages} />
      <ChatInput 
        value={input} 
        onChange={setInput} 
        onSend={handleSendMessage} 
      />
    </div>
  );
}
```

### Company-Specific Chat Mode

The company chat mode adds company context preloading:

```typescript
// pages/company-chat.tsx (simplified)
export default function CompanyChat() {
  const [company, setCompany] = useState<string>('');
  const [companyData, setCompanyData] = useState<CompanyProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Initialize chat with company data
  const initializeCompanyChat = async () => {
    setLoading(true);
    
    try {
      // Fetch company research
      const response = await axios.post('/api/research', {
        companyName: company
      });
      
      setCompanyData(response.data.company);
      
      // Add welcome message with company info
      setMessages([{
        role: 'assistant',
        content: `I've gathered information about ${company}. What would you like to know?`
      }]);
    } catch (error) {
      console.error('Error researching company:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle message sending with company context
  const handleSendMessage = async () => {
    // Add user message
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    
    // Call query API with company context
    const response = await axios.post('/api/query', {
      query: input,
      context: getRecentMessages(messages),
      options: {
        companyContext: companyData
      }
    });
    
    // Add assistant response
    setMessages([
      ...messages, 
      userMessage,
      { role: 'assistant', content: response.data.answer }
    ]);
  };
  
  // Render company chat UI
  return (
    <div>
      {!companyData ? (
        <CompanySelector 
          value={company}
          onChange={setCompany}
          onSubmit={initializeCompanyChat}
          loading={loading}
        />
      ) : (
        <>
          <CompanyProfile company={companyData} />
          <ChatMessages messages={messages} />
          <ChatInput 
            value={input} 
            onChange={setInput} 
            onSend={handleSendMessage} 
          />
        </>
      )}
    </div>
  );
}
```

## Real-Time Information System

### Internal API Connection

To provide real-time information, we connect to internal systems:

```typescript
// utils/realTimeInfo.ts
export async function getRealTimeInfo(topic: string): Promise<RealTimeInfo> {
  switch (topic) {
    case 'hiring':
      return getHiringInfo();
    case 'product_updates':
      return getProductUpdates();
    case 'system_status':
      return getSystemStatus();
    default:
      return getGenericInfo(topic);
  }
}

async function getHiringInfo(): Promise<RealTimeInfo> {
  // Connect to HR API or ATS system
  const response = await fetch(
    `${process.env.INTERNAL_API_URL}/hr/open-positions`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
      }
    }
  );
  
  const data = await response.json();
  
  return {
    topic: 'hiring',
    data: {
      openPositions: data.openPositions,
      departments: data.departments,
      locations: data.locations
    },
    lastUpdated: new Date(),
    source: 'HR System'
  };
}
```

### Factual Query Detection

To identify factual queries that need real-time data:

```typescript
// utils/queryAnalysis.ts
function isFactualQuery(query: string): boolean {
  // Check for factual query patterns
  const factualPatterns = [
    /are\s+(?:we|you)\s+hiring/i,
    /how\s+many\s+employees/i,
    /current\s+status/i,
    /latest\s+version/i,
    /when\s+will.*release/i
  ];
  
  return factualPatterns.some(pattern => pattern.test(query));
}
```

### Webhook Updates

To keep real-time information fresh:

```typescript
// pages/api/webhook/update-info.ts
export default async function handler(req, res) {
  // Validate webhook signature
  if (!validateWebhookSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { topic, data } = req.body;
  
  // Update the cached information
  try {
    await updateRealTimeInfo(topic, data);
    
    // Invalidate any affected query caches
    await invalidateRelatedCaches(topic);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating real-time info:', error);
    return res.status(500).json({ error: 'Failed to update information' });
  }
}
```

## Feedback & Analytics

The Sales Knowledge Assistant includes a comprehensive feedback collection and analytics system that helps improve response quality and provides insights for sales team training.

### Feedback Collection Architecture

The feedback system follows this architecture:

```
┌─────────────────┐     ┌───────────────┐     ┌───────────────┐
│  Feedback UI    │────▶│  Feedback API  │────▶│ Admin Feedback│
│ (Thumbs Up/Down)│     │  Endpoint     │     │ API Endpoint  │
└─────────────────┘     └───────────────┘     └───────────────┘
                              │                       │
                              ▼                       ▼
                        ┌───────────────┐     ┌───────────────┐
                        │ Topic Extractor│    │ In-Memory     │
                        │               │    │ Storage        │
                        └───────────────┘    └───────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Analytics     │
                                            │ Dashboard     │
                                            └───────────────┘
```

#### Feedback Data Collection

Each response from the assistant includes upvote/downvote buttons that users can click to provide immediate feedback. The system records:

- The query that prompted the response
- The response content
- User rating (positive/negative)
- Topics extracted from the query
- Sources referenced in the response
- Timestamp and session data

```typescript
// components/ChatInterface.tsx
// Handle feedback for a message
const handleFeedback = (index: number, feedbackType: 'positive' | 'negative') => {
  if (onFeedback) {
    onFeedback(index, feedbackType);
  }
};

// In pages/chat.tsx
const handleFeedback = async (messageIndex: number, feedbackType: 'positive' | 'negative') => {
  const message = messages[messageIndex];
  
  if (message.role !== 'bot') return;
  
  // Update UI immediately
  const updatedMessages = [...messages];
  updatedMessages[messageIndex] = {
    ...message,
    feedback: feedbackType
  };
  setMessages(updatedMessages);
  
  // Find the corresponding user query
  let userQuery = '';
  if (messageIndex > 0 && updatedMessages[messageIndex - 1].role === 'user') {
    userQuery = updatedMessages[messageIndex - 1].content;
  }
  
  // Submit feedback to API
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: userQuery,
        response: message.content,
        feedback: feedbackType,
        messageIndex,
        sessionId: sessionId,
        messageId: message.id,
        metadata: {
          sessionType: 'general'
        }
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to submit feedback');
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
};
```

### Browser-Compatible Implementation

Our implementation is fully browser-compatible, with no direct file system access in client-side code:

```typescript
// utils/feedbackManager.ts (client-side)
export async function recordFeedback(
  feedback: Omit<FeedbackItem, 'id' | 'timestamp'>
): Promise<string> {
  try {
    const response = await axios.post('/api/feedback', feedback);
    return response.data.id;
  } catch (error) {
    logError('Failed to record feedback', error);
    throw new Error('Failed to save feedback');
  }
}

// pages/api/feedback.ts (middleware)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Validate and process feedback
  try {
    const body = req.body;
    
    // Validate required fields and prepare feedback payload
    
    // Forward to admin API
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/feedback`,
      feedbackPayload,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      id: response.data.id
    });
  } catch (error) {
    logError('Error recording feedback', error);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
}
```

### Analytics Processing

The system processes feedback data to generate actionable insights:

```typescript
// pages/api/admin/analytics.ts
async function generateAnalytics(): Promise<AnalyticsData> {
  try {
    // Get all feedback from our feedback API
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const response = await axios.get(
      `${baseUrl}/api/admin/feedback`,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    const feedbackItems: FeedbackItem[] = response.data;
    
    // Calculate feedback stats
    const totalFeedback = feedbackItems.length;
    const positiveFeedback = feedbackItems.filter(item => item.feedback === 'positive').length;
    
    // Process common queries, referenced content, and session stats
    
    return {
      commonQueries,
      topReferencedContent,
      feedbackStats: {
        total: totalFeedback,
        positive: positiveFeedback,
        negative: totalFeedback - positiveFeedback,
        percentagePositive: totalFeedback > 0 ? (positiveFeedback / totalFeedback) * 100 : 0
      },
      lastUpdated: Date.now(),
      sessionStats
    };
  } catch (error) {
    logError('Failed to generate analytics', error);
    // Return empty analytics on error
    return {
      commonQueries: [],
      topReferencedContent: [],
      feedbackStats: {
        total: 0,
        positive: 0,
        negative: 0,
        percentagePositive: 0
      },
      lastUpdated: Date.now()
    };
  }
}
```

### Admin Analytics Dashboard

The admin dashboard visualizes the feedback data to provide insights:

```jsx
// components/AnalyticsDashboard.tsx
const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  refreshInterval = 60000  // Default refresh every minute
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch analytics data on load and periodically
  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);
  
  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/analytics', {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'dev-key'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render analytics visualizations
}
```

### Security Considerations

The feedback system implements several security measures:

1. **API Authentication**:
   - Admin API endpoints require an API key
   - Development mode has relaxed authentication for easier testing

2. **Input Validation**:
   - All user inputs are validated at both client and server levels
   - Proper error handling for malformed requests

3. **Separation of Concerns**:
   - Public feedback API separates from admin storage API
   - No direct client access to storage mechanisms

4. **Cross-API Communication**:
   - Internal API communication uses secure headers
   - Response sanitization prevents information leakage

### Benefits of the Feedback System

The integrated feedback system provides several benefits:

1. **Data-Driven Improvements**: Identifies which types of information need improvement
2. **Sales Training Insights**: Highlights common questions and areas for sales team education
3. **Content Prioritization**: Shows which reference materials are most useful
4. **User Satisfaction Tracking**: Monitors overall satisfaction with the assistant
5. **Knowledge Gap Identification**: Identifies areas where the system needs more information

### Future Enhancements

Planned enhancements to the feedback system include:

1. **User-Specific Analytics**: Track feedback patterns by individual users
2. **Feedback Categorization**: Categorize feedback by topic, product, or query type
3. **Proactive Alerts**: Generate alerts for consistently low-rated responses
4. **A/B Testing**: Compare different answer generation approaches
5. **Database Integration**: Move from in-memory storage to a scalable database solution

## Admin Dashboard

The Admin Dashboard provides a central interface for system administrators to manage the Sales Knowledge Assistant, monitor performance, review feedback, and analyze usage patterns.

### Dashboard Overview

The administrative interface (`pages/admin.tsx`) includes multiple tabs for different management functions:

```jsx
export default function Admin({ logs }: AdminProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'documents' | 'chatSessions' | 'analytics' | 'companySessions' | 'pending'>('metrics');
  
  // ...implementation details...
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        
        {/* Tab navigation */}
        <div className="flex border-b mb-6">
          <button 
            className={`px-4 py-2 ${activeTab === 'metrics' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <div className="flex items-center">
              <BarChart2 className="w-4 h-4 mr-2" />
              <span>System Metrics</span>
            </div>
          </button>
          
          {/* Other tabs including new Pending Documents tab */}
          <button 
            className={`px-4 py-2 ${activeTab === 'pending' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <div className="flex items-center">
              <InboxIcon className="w-4 h-4 mr-2" />
              <span>Pending Documents</span>
            </div>
          </button>
          
          {/* ... */}
        </div>
        
        {/* Tab content */}
        {activeTab === 'metrics' && <SystemMetrics />}
        {activeTab === 'documents' && <DocumentManager />}
        {activeTab === 'chatSessions' && <ChatSessionsList />}
        {activeTab === 'companySessions' && <CompanySessionsList />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'pending' && <PendingDocumentManager />}
      </div>
    </Layout>
  );
}
```

The admin dashboard includes the following tabs:
- **System Metrics**: Performance statistics about the system
- **Document Management**: Tools for managing the knowledge base
- **Chat Sessions**: General chat logs with feedback information
- **Analytics**: Visualizations of feedback and usage data
- **Company Sessions**: Company-specific chat sessions with detailed information
- **Pending Documents**: Approval workflow for newly submitted content

### Document Management System

#### Document Approval Workflow

The Sales Knowledge Assistant implements a robust document management system that ensures quality control through an approval workflow:

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  User Submits   │────▶│  Pending Document │────▶│ Admin Reviews  │
│  Content        │     │  Queue            │     │ Documents      │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                                          │
                                               ┌──────────┴───────────┐
                                               │                      │
                                               ▼                      ▼
                                        ┌────────────┐        ┌───────────┐
                                        │  Approve   │        │  Reject   │
                                        │  AI Tags   │        │           │
                                        └────────────┘        └───────────┘
                                               │
                                               ▼
                                     ┌───────────────────┐
                                     │  Knowledge Base   │
                                     │(With All AI Tags) │
                                     └───────────────────┘
```

#### Pending Document Storage

Documents submitted through the training interface are stored in a pending queue until reviewed by an administrator:

```typescript
// utils/pendingDocumentStore.ts
export interface PendingDocument {
  id: string;
  text: string;
  title: string;
  source: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  needsSummarization?: boolean;
  summary?: string;
  metadata?: Record<string, any>;
}

// Add a document to pending store
export function addPendingDocument(doc: Omit<PendingDocument, 'id' | 'status' | 'timestamp'>): PendingDocument {
  const documents = getAllPendingDocuments();
  
  const newDoc: PendingDocument = {
    ...doc,
    id: `pending-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  documents.push(newDoc);
  fs.writeFileSync(PENDING_INDEX_FILE, JSON.stringify({ documents }, null, 2));
  
  return newDoc;
}
```

#### Gemini LLM Processing

Administrators can choose to process approved documents with Gemini for summarization and metadata extraction:

```typescript
// utils/geminiClient.ts
export async function processWithGemini(text: string): Promise<{
  summary?: string;
  metadata?: Record<string, any>;
}> {
  try {
    const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const prompt = `
    Please analyze and process the following text content:
    
    ${text}
    
    Provide:
    1. A concise summary that preserves all key information
    2. A list of main topics/entities mentioned
    3. Categorization (product, pricing, features, etc.)
    4. Estimated technical complexity level (1-10)
    
    Format as JSON:
    {
      "summary": "concise summary here",
      "topics": ["topic1", "topic2"],
      "category": "category name",
      "technicalLevel": number,
      "containsSensitiveInfo": boolean
    }
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();
    
    // Parse the JSON response
    try {
      const parsed = JSON.parse(responseText);
      return {
        summary: parsed.summary,
        metadata: {
          topics: parsed.topics,
          category: parsed.category,
          technicalLevel: parsed.technicalLevel,
          containsSensitiveInfo: parsed.containsSensitiveInfo
        }
      };
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e);
      return {
        summary: responseText.substring(0, 1000),
        metadata: { processingError: true }
      };
    }
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    return {};
  }
}
```

#### Pending Document Manager Interface

The Pending Document Manager component allows administrators to:
- View all pending documents with their content and metadata
- Approve or reject individual documents
- Process documents with Gemini LLM for summarization
- Perform batch operations on multiple documents
- Toggle summarization on/off for processed documents

```jsx
// components/PendingDocumentManager.tsx
export default function PendingDocumentManager() {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [summarizeEnabled, setSummarizeEnabled] = useState(true);
  
  // Fetch pending documents
  useEffect(() => {
    fetchPendingDocuments();
  }, []);
  
  // Handle document approval with optional summarization
  const handleApprove = async (id) => {
    try {
      await fetch('/api/admin/pending-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'approve',
          summarize: summarizeEnabled
        })
      });
      
      // Refresh the list
      fetchPendingDocuments();
    } catch (error) {
      console.error('Error approving document:', error);
    }
  };
  
  // Batch approval functionality
  const handleBatchApprove = async () => {
    try {
      await fetch('/api/admin/pending-documents?batch=true', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedDocs,
          action: 'approve',
          summarize: summarizeEnabled
        })
      });
      
      // Refresh and clear selection
      fetchPendingDocuments();
      setSelectedDocs([]);
    } catch (error) {
      console.error('Error batch approving documents:', error);
    }
  };
  
  // Render UI for managing pending documents
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Interface implementation */}
    </div>
  );
}
```

#### Enhanced Document Manager

The Document Manager has been improved with pagination showing the newest documents first:

```typescript
// pages/api/admin/documents.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    
    const vectorStoreItems = getAllVectorStoreItems();
    
    // Sort by timestamp (newest first)
    vectorStoreItems.sort((a, b) => {
      const timestampA = a.metadata?.timestamp ? new Date(a.metadata.timestamp).getTime() : 0;
      const timestampB = b.metadata?.timestamp ? new Date(b.metadata.timestamp).getTime() : 0;
      return timestampB - timestampA;
    });
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = vectorStoreItems.slice(startIndex, endIndex);
    
    // Transform and return documents with pagination metadata
    return res.status(200).json({
      documents: paginatedItems.map(/* transformation logic */),
      total: vectorStoreItems.length,
      limit,
      page,
      totalPages: Math.ceil(vectorStoreItems.length / limit)
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json(standardizeApiErrorResponse(error));
  }
}
```

### Document Training and Submission Flow

1. **User Submission**:
   - Users click "Train Assistant" on the homepage
   - They can upload files or enter text directly
   - Content is sent to `/api/uploadText` endpoint
   - The content is stored in the pending documents queue instead of directly to the vector store

2. **Admin Review**:
   - Administrators see pending documents in the admin dashboard
   - They can review full content and metadata
   - For each document, they can:
     - Approve with summarization (processed by Gemini)
     - Approve without summarization (added directly)
     - Reject the document
   - Batch operations allow handling multiple documents at once

3. **Processing Steps**:
   - Approved documents are processed according to admin preferences
   - Gemini LLM extracts key information, summarizes, and categorizes content
   - Documents are split into appropriate chunks
   - Embeddings are created and added to the vector store
   - The document becomes searchable in the knowledge base

This workflow ensures that all new content undergoes proper review and quality control before being added to the knowledge base, while leveraging AI capabilities to enhance the content with proper metadata and summaries.

### Feedback System Integration

#### Feedback Collection Architecture

The feedback system follows this architecture:

```
┌─────────────────┐     ┌───────────────┐     ┌───────────────┐
│  Feedback UI    │────▶│  Feedback API  │────▶│ Admin Feedback│
│ (Thumbs Up/Down)│     │  Endpoint     │     │ API Endpoint  │
└─────────────────┘     └───────────────┘     └───────────────┘
                              │                       │
                              ▼                       ▼
                        ┌───────────────┐     ┌───────────────┐
                        │ Topic Extractor│    │ In-Memory     │
                        │               │    │ Storage        │
                        └───────────────┘    └───────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Analytics     │
                                            │ Dashboard     │
                                            └───────────────┘
```

#### Browser-Compatible Implementation

The feedback system is fully browser-compatible, with no direct file system access in client-side code:

```typescript
// utils/feedbackManager.ts (client-side)
export async function recordFeedback(
  feedback: Omit<FeedbackItem, 'id' | 'timestamp'>
): Promise<string> {
  try {
    const response = await axios.post('/api/feedback', feedback);
    return response.data.id;
  } catch (error) {
    logError('Failed to record feedback', error);
    throw new Error('Failed to save feedback');
  }
}

// pages/api/feedback.ts (middleware)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Validate and process feedback
  try {
    const body = req.body;
    
    // Validate required fields and prepare feedback payload
    
    // Forward to admin API
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/feedback`,
      feedbackPayload,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      id: response.data.id
    });
  } catch (error) {
    logError('Error recording feedback', error);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
}
```

#### Feedback Data Collection

Each response from the assistant includes upvote/downvote buttons that users can click to provide immediate feedback. The system records:

- The query that prompted the response
- The response content
- User rating (positive/negative)
- Topics extracted from the query
- Sources referenced in the response
- Timestamp and session data

```typescript
// In pages/chat.tsx
const handleFeedback = async (messageIndex: number, feedbackType: 'positive' | 'negative') => {
  const message = messages[messageIndex];
  
  if (message.role !== 'bot') return;
  
  // Update UI immediately
  const updatedMessages = [...messages];
  updatedMessages[messageIndex] = {
    ...message,
    feedback: feedbackType
  };
  setMessages(updatedMessages);
  
  // Find the corresponding user query
  let userQuery = '';
  if (messageIndex > 0 && updatedMessages[messageIndex - 1].role === 'user') {
    userQuery = updatedMessages[messageIndex - 1].content;
  }
  
  // Submit feedback to API
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: userQuery,
        response: message.content,
        feedback: feedbackType,
        messageIndex,
        sessionId: sessionId,
        messageId: message.id,
        metadata: {
          sessionType: 'general'
        }
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to submit feedback');
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
};
```

### Analytics Dashboard

The analytics dashboard visualizes the feedback data to provide insights:

```jsx
// components/AnalyticsDashboard.tsx
const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  refreshInterval = 60000  // Default refresh every minute
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch analytics data on load and periodically
  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);
  
  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/analytics', {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'dev-key'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render analytics visualizations
}
```

The analytics system processes feedback data to generate actionable insights:

```typescript
// pages/api/admin/analytics.ts
async function generateAnalytics(): Promise<AnalyticsData> {
  try {
    // Get all feedback from our feedback API
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const response = await axios.get(
      `${baseUrl}/api/admin/feedback`,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    const feedbackItems: FeedbackItem[] = response.data;
    
    // Calculate feedback stats
    const totalFeedback = feedbackItems.length;
    const positiveFeedback = feedbackItems.filter(item => item.feedback === 'positive').length;
    
    // Process common queries, referenced content, and session stats
    
    return {
      commonQueries,
      topReferencedContent,
      feedbackStats: {
        total: totalFeedback,
        positive: positiveFeedback,
        negative: totalFeedback - positiveFeedback,
        percentagePositive: totalFeedback > 0 ? (positiveFeedback / totalFeedback) * 100 : 0
      },
      lastUpdated: Date.now(),
      sessionStats
    };
  } catch (error) {
    logError('Failed to generate analytics', error);
    // Return empty analytics on error
    return {
      commonQueries: [],
      topReferencedContent: [],
      feedbackStats: {
        total: 0,
        positive: 0,
        negative: 0,
        percentagePositive: 0
      },
      lastUpdated: Date.now()
    };
  }
}
```

### Chat Sessions Management

The admin dashboard enables viewing and managing chat sessions:

```typescript
// Chat Sessions List Component (simplified)
function ChatSessionsList() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSessionDetailed | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchByContent, setSearchByContent] = useState(false);
  
  // Fetch sessions on load
  useEffect(() => {
    fetchSessions();
  }, []);
  
  // Handle session search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return fetchSessions();
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/chat-sessions?${searchByContent ? 'content' : 'query'}=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search sessions');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Error searching sessions:', error);
      setError('Failed to search sessions');
    } finally {
      setLoading(false);
    }
  };
  
  // View session details
  const viewSessionDetails = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
      if (!response.ok) throw new Error('Failed to load session details');
      const data = await response.json();
      setSelectedSession(data);
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };
  
  // Render session list and details view
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Session list */}
      <div className="md:col-span-1 bg-white p-4 rounded-lg shadow">
        <div className="mb-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="flex-grow p-2 border rounded"
            />
            <button type="submit" className="p-2 bg-blue-500 text-white rounded">
              <Search className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 flex items-center text-sm">
            <input
              type="checkbox"
              id="searchContent"
              checked={searchByContent}
              onChange={() => setSearchByContent(!searchByContent)}
              className="mr-2"
            />
            <label htmlFor="searchContent">Search in messages content</label>
          </div>
        </div>
        
        {/* Session list */}
        <div className="space-y-2 mt-4">
          {sessions.map(session => (
            <div
              key={session.id}
              className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => viewSessionDetails(session.id)}
            >
              <div className="font-medium">{session.title || 'Untitled Session'}</div>
              <div className="text-sm text-gray-500">
                {formatDate(session.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Session details */}
      {selectedSession && (
        <div className="md:col-span-2 bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">{selectedSession.title || 'Untitled Session'}</h2>
            <button 
              onClick={() => router.push(`/chat?session=${selectedSession.id}`)}
              className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
            >
              Open Chat
            </button>
          </div>
          
          {/* Message thread */}
          <div className="space-y-4 mt-6">
            {selectedSession.messages.map((message, index) => (
              <div key={index} className={`p-3 rounded ${
                message.role === 'user' ? 'bg-blue-50 ml-12' : 'bg-gray-50 mr-12'
              }`}>
                <div className="font-medium text-sm text-gray-600">
                  {message.role === 'user' ? 'User' : 'Assistant'}
                </div>
                <div className="mt-1 whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDate(message.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Security Considerations

The feedback system implements several security measures:

1. **API Authentication**:
   - Admin API endpoints require an API key
   - Development mode has relaxed authentication for easier testing

2. **Input Validation**:
   - All user inputs are validated at both client and server levels
   - Proper error handling for malformed requests

3. **Separation of Concerns**:
   - Public feedback API separates from admin storage API
   - No direct client access to storage mechanisms

4. **Cross-API Communication**:
   - Internal API communication uses secure headers
   - Response sanitization prevents information leakage

### Benefits of the Admin Dashboard

The integrated admin dashboard provides several benefits:

1. **Centralized Management**: Single interface for all administrative tasks
2. **Data-Driven Insights**: Analytics based on real user interactions
3. **Content Optimization**: Identify knowledge gaps and improvement areas
4. **User Satisfaction Tracking**: Monitor feedback trends over time
5. **Debugging & Troubleshooting**: Identify and address issues quickly

### Recent Implementation Updates

We have successfully resolved browser compatibility issues by:

1. **Removing all direct file system dependencies** from client-side code
2. **Creating browser-compatible versions** of core utilities:
   - Updated `utils/errorHandling.ts` to use console logging instead of file logging
   - Modified `utils/config.ts` to use environment variables instead of config files
3. **Implementing proper API-based feedback system** with separation of concerns:
   - Client-side code only makes API calls
   - Server-side code handles data persistence
   - Authentication for admin operations

### Future Enhancements

Planned enhancements to the admin dashboard include:

1. **User Management**: Add/remove users and manage permissions
2. **Advanced Analytics**: More detailed insights and custom reports
3. **Bulk Operations**: Manage multiple sessions or documents at once
4. **Export/Import**: Transfer data between environments
5. **Activity Logging**: Track admin actions for accountability

## Scaling with Supabase

As the Sales Knowledge Assistant grows in usage and data volume, transitioning from the current file-based storage to a proper database becomes necessary. This section outlines the migration to Supabase, a PostgreSQL-based Backend-as-a-Service platform, and the architecture changes needed to support multiple sales team members and larger knowledge bases.

### Current Limitations of File-Based Storage

The current implementation has several scaling limitations:

1. **Performance degradation** with large vector stores
2. **Limited concurrent access** for multiple users
3. **No built-in authentication/authorization**
4. **Manual synchronization** required across environments
5. **Inefficient updates** when adding new documents

### Database Schema Design

The Supabase migration involves creating the following tables:

#### Vector Store Tables

```sql
-- Documents table to store original document information
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  file_path TEXT,
  category TEXT,
  technical_level INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- Document chunks table to store individual chunks with embeddings
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding VECTOR(1536), -- For OpenAI embeddings, adjust dimension as needed
  chunk_index INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector index for similarity search
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

#### BM25 Related Tables

```sql
-- Term frequencies table
CREATE TABLE term_frequencies (
  term TEXT PRIMARY KEY,
  frequency INTEGER NOT NULL
);

-- Document frequencies table
CREATE TABLE document_frequencies (
  term TEXT PRIMARY KEY,
  frequency INTEGER NOT NULL
);

-- Document count record
CREATE TABLE corpus_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one record
  document_count INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### User and Feedback Tables

```sql
-- Users table (extends Supabase Auth)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  department TEXT,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  response_id TEXT NOT NULL,
  query TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  comments TEXT,
  conversation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Query logs table
CREATE TABLE query_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  response_text TEXT,
  hybrid_ratio FLOAT,
  result_count INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);
```

### Vector Operations with pgvector

Supabase supports the pgvector extension for PostgreSQL, which enables vector similarity operations directly in the database:

```typescript
// utils/vectorStore.ts (Supabase implementation)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export async function performVectorSearch(
  queryEmbedding: number[],
  limit: number = 10
): Promise<SearchResult[]> {
  // Query using cosine similarity
  const { data, error } = await supabase
    .rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit
    });
  
  if (error) {
    console.error('Error performing vector search:', error);
    return [];
  }
  
  return data.map(item => ({
    item: {
      id: item.id,
      text: item.text,
      metadata: item.metadata,
      embedding: item.embedding
    },
    score: item.similarity
  })).slice(0, limit);
}
```

The corresponding Supabase stored procedure:

```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  text TEXT,
  metadata JSONB,
  embedding VECTOR(1536),
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.text,
    document_chunks.metadata,
    document_chunks.embedding,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

### Multi-User Authentication

Integration with Supabase Auth for user management:

```typescript
// utils/auth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Server-side authentication check
export async function authenticateRequest(req) {
  // Get the token from the request
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return { user: null, error: 'No token provided' };
  
  // Verify the token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) return { user: null, error: error.message };
  
  // Get additional user profile data if needed
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return { user, profile, error: null };
}
```

### Data Migration Process

To migrate from file-based storage to Supabase:

```typescript
// scripts/migrate_to_supabase.ts
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function migrateVectorStore() {
  console.log('Starting vector store migration to Supabase...');
  
  // 1. Load vector batches
  const batchesDir = path.join(process.cwd(), 'data', 'vector_batches');
  const batchFiles = fs.readdirSync(batchesDir)
    .filter(file => file.startsWith('batch_') && file.endsWith('.json'));
  
  // 2. Process each batch
  for (const batchFile of batchFiles) {
    console.log(`Processing batch: ${batchFile}`);
    
    const batchPath = path.join(batchesDir, batchFile);
    const batchData = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
    
    // 3. Extract unique documents and chunks
    const documents = new Map();
    const chunks = [];
    
    batchData.items.forEach(item => {
      const docId = item.metadata?.source || `generated_${Date.now()}`;
      
      // Add document if not already processed
      if (!documents.has(docId)) {
        documents.set(docId, {
          title: item.metadata?.title || 'Unknown',
          source: item.metadata?.source || 'Unknown',
          category: item.metadata?.category || null,
          technical_level: item.metadata?.technicalLevel || 5,
          metadata: item.metadata || {}
        });
      }
      
      // Add chunk
      chunks.push({
        document_id: docId,
        text: item.text,
        embedding: item.embedding,
        metadata: {
          ...item.metadata,
          originalId: item.id
        }
      });
    });
    
    // 4. Insert documents
    for (const [docId, doc] of documents.entries()) {
      const { data, error } = await supabase
        .from('documents')
        .upsert({ id: docId, ...doc })
        .select();
      
      if (error) {
        console.error(`Error inserting document ${docId}:`, error);
        continue;
      }
    }
    
    // 5. Insert chunks (in batches to avoid timeouts)
    const BATCH_SIZE = 100;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const chunkBatch = chunks.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('document_chunks')
        .insert(chunkBatch);
      
      if (error) {
        console.error(`Error inserting chunks batch ${i / BATCH_SIZE}:`, error);
      }
    }
  }
  
  console.log('Vector store migration complete!');
}

// Start migration
migrateVectorStore().catch(console.error);
```

### Updating System Components for Database Integration

#### Hybrid Search Update

```typescript
// utils/hybridSearch.ts (database version)
export async function performHybridSearch(
  query: string,
  limit: number = 10,
  hybridRatio: number = 0.5,
  filter?: MetadataFilter
): Promise<SearchResult[]> {
  // 1. Get query embedding
  const queryEmbedding = await embedText(query);
  
  // 2. Perform vector search in database
  const vectorResults = await performDatabaseVectorSearch(
    queryEmbedding, 
    limit * 2,
    filter
  );
  
  // 3. Perform BM25 keyword search in database
  const keywordResults = await performDatabaseKeywordSearch(
    query, 
    limit * 2,
    filter
  );
  
  // 4. Merge results with hybridRatio weighting
  const mergedResults = mergeSearchResults(
    vectorResults, 
    keywordResults, 
    hybridRatio
  );
  
  // 5. Return top results
  return mergedResults.slice(0, limit);
}

async function performDatabaseVectorSearch(
  queryEmbedding: number[],
  limit: number,
  filter?: MetadataFilter
): Promise<SearchResult[]> {
  // Build the query with filters
  let query = supabase
    .rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit * 2 // Request more to allow for filtering
    });
  
  // Apply metadata filters if provided
  if (filter) {
    if (filter.categories && filter.categories.length > 0) {
      // Join to documents table to filter by category
      query = query.in('category', filter.categories);
    }
    
    if (filter.technicalLevelMin !== undefined) {
      query = query.gte('technical_level', filter.technicalLevelMin);
    }
    
    if (filter.technicalLevelMax !== undefined) {
      query = query.lte('technical_level', filter.technicalLevelMax);
    }
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error in database vector search:', error);
    return [];
  }
  
  // Map to common result format
  return data.map(item => ({
    item: {
      id: item.id,
      text: item.text,
      metadata: item.metadata
    },
    score: item.similarity
  })).slice(0, limit);
}
```

### Data Update Pipeline

When new documents are added to the system, the following processes need to happen:

```typescript
// utils/documentProcessor.ts (database version)
export async function processAndStoreDocument(
  file: File,
  metadata: DocumentMetadata
): Promise<string> {
  // 1. Process the document as before
  const processedDoc = await processDocument(file, metadata);
  
  // 2. Store document in Supabase
  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      title: metadata.title,
      source: metadata.source,
      file_path: file.name,
      category: metadata.primaryCategory,
      technical_level: metadata.technicalLevel,
      metadata: metadata
    })
    .select()
    .single();
  
  if (docError) {
    throw new Error(`Error storing document: ${docError.message}`);
  }
  
  // 3. Store document chunks with embeddings
  const chunks = processedDoc.chunks.map(chunk => ({
    document_id: document.id,
    text: chunk.text,
    embedding: chunk.embedding,
    chunk_index: chunk.metadata.chunkIndex,
    metadata: chunk.metadata
  }));
  
  // Insert chunks in smaller batches to avoid timeout
  const BATCH_SIZE = 50;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const chunkBatch = chunks.slice(i, i + BATCH_SIZE);
    
    const { error: chunkError } = await supabase
      .from('document_chunks')
      .insert(chunkBatch);
    
    if (chunkError) {
      throw new Error(`Error storing chunks: ${chunkError.message}`);
    }
  }
  
  // 4. Trigger BM25 corpus statistics update
  await updateCorpusStatistics();
  
  return document.id;
}

async function updateCorpusStatistics(): Promise<void> {
  // You may want to implement this as a background job
  // or serverless function trigger to avoid blocking
  const job = await supabase
    .rpc('rebuild_corpus_statistics');
  
  return job;
}
```

### Database-Backed BM25 Implementation

```sql
-- Function to rebuild corpus statistics
CREATE OR REPLACE FUNCTION rebuild_corpus_statistics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  doc_count INTEGER;
BEGIN
  -- Get document count
  SELECT COUNT(DISTINCT document_id) INTO doc_count FROM document_chunks;
  
  -- Clear existing statistics
  TRUNCATE term_frequencies;
  TRUNCATE document_frequencies;
  
  -- Rebuild term frequencies
  INSERT INTO term_frequencies (term, frequency)
  SELECT 
    word, 
    COUNT(*) as frequency
  FROM 
    document_chunks,
    unnest(string_to_array(lower(text), ' ')) as word
  WHERE 
    length(word) > 1
  GROUP BY 
    word;
  
  -- Rebuild document frequencies
  INSERT INTO document_frequencies (term, frequency)
  SELECT 
    word, 
    COUNT(DISTINCT document_id) as doc_frequency
  FROM 
    document_chunks,
    unnest(string_to_array(lower(text), ' ')) as word
  WHERE 
    length(word) > 1
  GROUP BY 
    word;
  
  -- Update corpus stats
  INSERT INTO corpus_stats (document_count, last_updated)
  VALUES (doc_count, NOW())
  ON CONFLICT (id) DO UPDATE
  SET document_count = EXCLUDED.document_count,
      last_updated = EXCLUDED.last_updated;
END;
$$;
```

### Multi-User Scaling Considerations

#### Connection Pooling

To handle many concurrent users:

```typescript
// Connection pool configuration for Supabase
const { createPool } = require('@supabase/pool');

const pool = createPool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING,
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000, // How long a client is kept idle
  connectionTimeoutMillis: 2000 // How long to wait for a connection
});

// Use the pool for database operations
export async function queryWithPool(query, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}
```

#### Query Caching

Implement Redis caching for frequent queries:

```typescript
// utils/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const DEFAULT_TTL = 60 * 60; // 1 hour

export async function getCachedQuery(query: string): Promise<any | null> {
  const cacheKey = `query:${hashString(query)}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  return null;
}

export async function setCachedQuery(
  query: string,
  results: any,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  const cacheKey = `query:${hashString(query)}`;
  await redis.set(cacheKey, JSON.stringify(results), 'EX', ttl);
}

function hashString(str: string): string {
  // Simple hash function for cache keys
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
```

### Real-Time Features with Supabase

Leverage Supabase's real-time capabilities:

```typescript
// client/hooks/useRealTimeQueries.ts
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useRecentQueries() {
  const [queries, setQueries] = useState([]);

  useEffect(() => {
    // Initial load of recent queries
    fetchRecentQueries();
    
    // Subscribe to real-time updates
    const subscription = supabase
      .from('query_logs')
      .on('INSERT', payload => {
        setQueries(current => [payload.new, ...current].slice(0, 10));
      })
      .subscribe();
      
    return () => {
      supabase.removeSubscription(subscription);
    };
  }, []);
  
  async function fetchRecentQueries() {
    const { data, error } = await supabase
      .from('query_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data && !error) {
      setQueries(data);
    }
  }
  
  return queries;
}
```

### Performance Optimization at Scale

#### Database Indexing

Essential indexes for performance:

```sql
-- Text search index on document chunks
CREATE INDEX idx_document_chunks_text_trgm 
ON document_chunks 
USING gin (text gin_trgm_ops);

-- Metadata index for filtering
CREATE INDEX idx_document_chunks_metadata 
ON document_chunks 
USING gin (metadata);

-- Document category index
CREATE INDEX idx_documents_category
ON documents (category);

-- Technical level index for filtering
CREATE INDEX idx_documents_technical_level
ON documents (technical_level);
```

#### Sharding Strategy for Large Datasets

For very large vector stores (millions of documents), implement sharding:

```typescript
// utils/vectorStore.ts (sharded version)
export async function performShardedVectorSearch(
  queryEmbedding: number[],
  limit: number = 10
): Promise<SearchResult[]> {
  // Determine which shards to query based on embedding clustering
  const targetShards = getRelevantShards(queryEmbedding);
  
  // Query each shard in parallel
  const shardResults = await Promise.all(
    targetShards.map(shardId => 
      queryVectorShard(shardId, queryEmbedding, limit)
    )
  );
  
  // Merge and rank results from all shards
  const mergedResults = mergeShardResults(shardResults);
  
  return mergedResults.slice(0, limit);
}

function getRelevantShards(embedding: number[]): string[] {
  // Simplified example - in practice, this would use clustering
  // to determine which shards are most relevant
  return ['shard_1', 'shard_2', 'shard_3']; 
}
```

### Monitoring and Maintenance

#### Health Checks and Alerts

```typescript
// scripts/monitor_db_health.ts
import { createClient } from '@supabase/supabase-js';
import { sendAlert } from './alerting';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkDatabaseHealth() {
  try {
    // Basic connectivity check
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('health_checks')
      .select('count')
      .maybeSingle();
      
    const responseTime = Date.now() - startTime;
    
    // Log response time
    await supabase
      .from('system_metrics')
      .insert({
        metric: 'db_response_time',
        value: responseTime,
        timestamp: new Date()
      });
    
    // Check for slow response
    if (responseTime > 1000) {
      await sendAlert('Database response time high', {
        responseTime,
        timestamp: new Date()
      });
    }
    
    // Check for errors
    if (error) {
      await sendAlert('Database health check failed', {
        error: error.message,
        timestamp: new Date()
      });
    }
    
    // Check vector store size
    const { count } = await supabase
      .from('document_chunks')
      .select('count', { count: 'exact' });
      
    // Log metrics
    await supabase
      .from('system_metrics')
      .insert({
        metric: 'vector_store_size',
        value: count,
        timestamp: new Date()
      });
  } catch (error) {
    await sendAlert('Database monitoring error', {
      error: error.message,
      timestamp: new Date()
    });
  }
}

// Run health check
checkDatabaseHealth();
```

#### Backup Strategy

```typescript
// scripts/backup_database.ts
import { exec } from 'child_process';
import { uploadToS3 } from './storage';

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${timestamp}.sql`;
  
  try {
    // Create backup using pg_dump (requires Supabase connection details)
    await new Promise((resolve, reject) => {
      exec(
        `pg_dump -d ${process.env.SUPABASE_DB_URL} -f ${backupFileName}`,
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(stdout);
        }
      );
    });
    
    // Upload to secure storage
    await uploadToS3(backupFileName, `backups/${backupFileName}`);
    
    console.log(`Backup completed: ${backupFileName}`);
    
    // Log backup event
    await supabase
      .from('maintenance_logs')
      .insert({
        operation: 'backup',
        status: 'success',
        details: { filename: backupFileName },
        timestamp: new Date()
      });
      
  } catch (error) {
    console.error('Backup failed:', error);
    
    // Log failure
    await supabase
      .from('maintenance_logs')
      .insert({
        operation: 'backup',
        status: 'failed',
        details: { error: error.message },
        timestamp: new Date()
      });
      
    // Send alert
    await sendAlert('Database backup failed', {
      error: error.message,
      timestamp: new Date()
    });
  }
}

// Execute backup
backupDatabase();
```

### Cost Optimization

#### Storage Tiers and Pruning

```typescript
// scripts/optimize_storage.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function optimizeStorage() {
  try {
    // 1. Identify unused documents
    const { data: unusedDocs } = await supabase
      .rpc('get_unused_documents', { days_threshold: 90 });
    
    console.log(`Found ${unusedDocs.length} unused documents`);
    
    // 2. Archive unused documents
    if (unusedDocs.length > 0) {
      // First, copy to archive
      for (const doc of unusedDocs) {
        await supabase
          .from('archived_documents')
          .insert({
            original_id: doc.id,
            title: doc.title,
            source: doc.source,
            metadata: doc.metadata,
            archived_reason: 'unused',
            archived_at: new Date()
          });
      }
      
      // Then delete from active storage
      const unusedIds = unusedDocs.map(doc => doc.id);
      await supabase
        .from('documents')
        .delete()
        .in('id', unusedIds);
        
      console.log(`Archived ${unusedIds.length} documents`);
    }
    
    // 3. Consolidate vector storage
    await supabase.rpc('consolidate_vector_storage');
    
    console.log('Storage optimization completed');
  } catch (error) {
    console.error('Storage optimization failed:', error);
  }
}

// Execute optimization
optimizeStorage();
```

#### Vector Pruning Stored Procedure

```sql
CREATE OR REPLACE FUNCTION consolidate_vector_storage()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove duplicate chunks with nearly identical embeddings
  WITH duplicate_chunks AS (
    SELECT a.id
    FROM document_chunks a
    JOIN document_chunks b ON (
      a.document_id = b.document_id AND
      a.id != b.id AND
      a.embedding <=> b.embedding < 0.05
    )
    WHERE a.created_at > b.created_at
  )
  DELETE FROM document_chunks
  WHERE id IN (SELECT id FROM duplicate_chunks);
  
  -- Update corpus statistics after consolidation
  PERFORM rebuild_corpus_statistics();
END;
$$;
```

### Migration Timeline and Strategy

To transition from the current file-based system to the Supabase-backed solution:

1. **Phase 1: Database Setup (Week 1)**
   - Create Supabase project
   - Set up tables and indexes
   - Configure authentication

2. **Phase 2: Core Services Migration (Weeks 2-3)**
   - Update vector storage service
   - Migrate BM25 implementation
   - Implement sharding if needed

3. **Phase 3: Data Migration (Week 4)**
   - Migrate existing documents and embeddings
   - Validate search quality
   - Optimize performance

4. **Phase 4: Multi-User Features (Weeks 5-6)**
   - Implement user management
   - Add usage tracking
   - Deploy access controls

5. **Phase 5: Testing & Optimization (Weeks 7-8)**
   - Load testing
   - Performance tuning
   - Monitoring setup

6. **Phase 6: Roll-out (Weeks 9-10)**
   - Phased deployment to sales team
   - Training sessions
   - Gather feedback and iterate

## Deployment Guide

### Environment Setup

Required environment variables:

```
# API Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
PERPLEXITY_API_KEY=...

# Configuration
VECTOR_STORE_PATH=./data/vector_batches
CORPUS_STATS_PATH=./data/corpus_stats
FEEDBACK_PATH=./data/feedback
ANALYTICS_PATH=./data/analytics

# Feature Flags
ENABLE_COMPANY_CHAT=true
ENABLE_REAL_TIME_INFO=true
ENABLE_FEEDBACK=true
```

### Deployment Steps

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Run database migrations**
   ```bash
   npm run migrate-up
   ```

3. **Update BM25 corpus statistics**
   ```bash
   npm run build-corpus
   ```

4. **Start the application**
   ```bash
   npm start
   ```

### Monitoring

Key metrics to monitor:

- API response times
- Query success rates
- Feedback ratings trends
- Token usage by API
- Cache hit rates
- Error rates by endpoint

## Troubleshooting

### Common Issues and Solutions

#### 1. No search results found

**Symptoms:**
- Empty search results
- "I don't know" or fallback responses

**Possible causes:**
- Vector store not initialized
- BM25 corpus statistics missing
- Query too specific or contains typos

**Solutions:**
- Check vector store connectivity
- Rebuild corpus statistics
- Use query expansion for specific queries

#### 2. Slow response times

**Symptoms:**
- Chat responses take >5 seconds
- Timeout errors

**Possible causes:**
- Large context size
- API rate limiting
- Inefficient search parameters

**Solutions:**
- Implement context summarization
- Optimize hybridRatio for faster retrieval
- Add caching for common queries

#### 3. Incorrect company information

**Symptoms:**
- Outdated company details
- Missing company data

**Possible causes:**
- Cache expiration settings too long
- API limits reached
- Research queries too narrow

**Solutions:**
- Adjust cache TTL settings
- Implement fallback data sources
- Broaden research query templates

#### 4. Feedback Analytics Issues

**Symptoms:**
- Missing feedback data
- Analytics don't match user reports

**Possible causes:**
- Feedback not being recorded
- Analytics aggregation error
- Data synchronization issues

**Solutions:**
- Check API endpoint connectivity
- Verify feedback storage permissions
- Rebuild analytics indexes

## Conclusion

This technical documentation provides a comprehensive overview of the Sales Knowledge Assistant system. By understanding the architecture, components, and data flows, developers can effectively maintain, extend, and troubleshoot the system.

For specific implementation tasks, refer to the roadmap document which outlines planned enhancements and feature additions.

---

## Change Log

- **v1.0.0** (2023-06-15): Initial documentation
- **v1.1.0** (2023-07-20): Added dual chat mode documentation
- **v1.2.0** (2023-08-12): Added feedback system details
- **v1.3.0** (2023-09-05): Added real-time information system
- **v1.4.0** (2023-10-18): Consolidated all documentation 

## Perplexity API Integration

The Sales Knowledge Assistant incorporates real-time company information through integration with the Perplexity API, enabling sales representatives to access up-to-date information about prospect companies within the chat interface.

### Overview

The Perplexity API integration provides:
1. Real-time company research capability
2. Automated extraction of key company details (industry, size, location)
3. Contextual recommendations based on company information
4. A dedicated company-specific chat mode
5. Sales rep note-taking capabilities for personalized context

### Components

#### 1. Perplexity Client (`utils/perplexityClient.ts`)

This module provides the core functionality for interacting with the Perplexity API:

- **API Configuration**: Manages API keys, endpoints, and rate limits
- **Company Information Retrieval**: Fetches comprehensive company profiles
- **Company Verification**: Validates company existence before fetching details
- **Type Definitions**: Provides TypeScript interfaces for company data structures
- **Error Handling**: Manages API failures and rate limiting gracefully

Key functions:
- `getCompanyInformation(companyName, options)`: Retrieves detailed company information
- `verifyCompanyIdentity(companyName)`: Confirms company existence and gets basic details

#### 2. Caching Mechanism (`utils/perplexityUtils.ts`)

Implements efficient caching to reduce API costs and improve performance:

- **In-Memory Cache**: Stores company information with configurable expiration
- **Cache Invalidation**: Manages cache clearing and updates
- **Usage Logging**: Tracks API usage for monitoring and optimization

Key functions:
- `cacheWithExpiry(key, data, ttl)`: Stores data with expiration time
- `getFromCache<T>(key)`: Type-safe retrieval of cached data
- `logPerplexityUsage(action, details, error)`: Tracks API usage

#### 3. API Endpoints

Two dedicated endpoints handle company information requests:

- **`/api/company/verify`**: Validates company existence
  - Input: Company name
  - Output: Verification status, official name, basic details
  
- **`/api/company/info`**: Retrieves comprehensive company information
  - Input: Verified company name
  - Output: Detailed company profile, industry, size, etc.

#### 4. Company Chat Interface

A specialized chat interface for company-specific conversations:

- **Company Search**: Allows users to search for and select companies
- **Profile Display**: Shows key company information
- **Sales Rep Notes**: Enables sales representatives to add personalized notes about the company
- **Contextual Chat**: Preloads company context for tailored responses
- **System Messages**: Automatically includes company information and sales notes in prompts

### Sales Rep Notes Feature

The Sales Rep Notes feature enables sales representatives to add their own insights, observations, and context about a company:

- **Persistent Notes**: Notes are maintained throughout the chat session
- **Editable Interface**: Simple editing interface with save functionality
- **Contextual Integration**: Notes are seamlessly integrated into the system prompt
- **Authority Weighting**: Notes are treated as authoritative information by the AI model
- **Visual Distinction**: Notes section is visually distinct from the company profile

#### Implementation Details

1. **UI Component**: A dedicated notes section with edit/save functionality
2. **State Management**: Notes are stored in React state and passed to the query API
3. **System Prompt Integration**: Notes are injected into the system prompt with clear labeling
4. **Prompt Engineering**: The model is explicitly instructed to prioritize notes information
5. **Context Updating**: System message is updated when notes are modified

#### Benefits

- **Personalized Context**: Sales reps can add information from previous calls or other sources
- **Specialized Knowledge**: Domain-specific insights that might not be publicly available
- **Follow-up Tracking**: Notes about previous discussions can be maintained
- **Decision Maker Details**: Information about key stakeholders can be recorded
- **Custom Priorities**: Sales reps can highlight specific company needs or interests

### API Usage & Rate Limiting

The Perplexity API implementation includes sophisticated rate limiting to manage costs:

- **Rate Window**: Limits API calls to 10 per hour
- **Automatic Failover**: Returns cached data when rate limits are reached
- **Usage Tracking**: Logs all API interactions for monitoring
- **Graceful Degradation**: Provides helpful messages when limits are reached

### Data Flow

1. **User Initiates Company Chat**: User enters a company name in the search interface
2. **Company Verification**: System verifies company existence via `/api/company/verify`
3. **Profile Retrieval**: System fetches detailed information via `/api/company/info`
4. **Context Building**: Company details are formatted into system context
5. **Note Taking**: Sales rep adds personalized notes about the company
6. **Chat Initialization**: System preloads company context and notes into the chat interface
7. **Query Enhancement**: User questions are augmented with company context and notes
8. **Response Generation**: Answers incorporate company-specific information and sales rep insights

### Integration with Query API

The existing query API (`/api/query`) has been enhanced to support company context and sales notes:

- When company information is available, it's included in the system prompt
- Sales rep notes are included in the system prompt with clear labeling
- The AI model is explicitly instructed to prioritize and incorporate sales rep notes
- The AI model receives structured company data to inform its responses
- Responses are specifically tailored to address company characteristics and concerns highlighted in the notes
- Product recommendations are aligned with company industry, size, and specific needs identified in the notes

### Example Usage

```typescript
// Example: Sending a query with company context and sales notes
const response = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: message,
    context: JSON.stringify(messages),
    options: {
      companyContext: {
        ...companyInfo,
        companyName: companyName,
        salesNotes: salesNotes
      },
    }
  }),
});
```

### Implementation Status

The Perplexity API integration with Sales Rep Notes is fully implemented and operational, providing:

- A dedicated company chat interface accessible from the main page
- Real-time company research capability
- Automated company profile generation
- Sales rep note-taking functionality
- Context-aware responses based on company details and sales rep notes
- Intelligent caching with 24-hour expiration

## Admin Dashboard

The Admin Dashboard provides a central interface for system administrators to manage the Sales Knowledge Assistant, monitor performance, review feedback, and analyze usage patterns.

### Dashboard Overview

The administrative interface (`pages/admin.tsx`) includes multiple tabs for different management functions:

```jsx
export default function Admin({ logs }: AdminProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'documents' | 'chatSessions' | 'analytics' | 'companySessions' | 'pending'>('metrics');
  
  // ...implementation details...
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        
        {/* Tab navigation */}
        <div className="flex border-b mb-6">
          <button 
            className={`px-4 py-2 ${activeTab === 'metrics' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <div className="flex items-center">
              <BarChart2 className="w-4 h-4 mr-2" />
              <span>System Metrics</span>
            </div>
          </button>
          
          {/* Other tabs including new Pending Documents tab */}
          <button 
            className={`px-4 py-2 ${activeTab === 'pending' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <div className="flex items-center">
              <InboxIcon className="w-4 h-4 mr-2" />
              <span>Pending Documents</span>
            </div>
          </button>
          
          {/* ... */}
        </div>
        
        {/* Tab content */}
        {activeTab === 'metrics' && <SystemMetrics />}
        {activeTab === 'documents' && <DocumentManager />}
        {activeTab === 'chatSessions' && <ChatSessionsList />}
        {activeTab === 'companySessions' && <CompanySessionsList />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'pending' && <PendingDocumentManager />}
      </div>
    </Layout>
  );
}
```

The admin dashboard includes the following tabs:
- **System Metrics**: Performance statistics about the system
- **Document Management**: Tools for managing the knowledge base
- **Chat Sessions**: General chat logs with feedback information
- **Analytics**: Visualizations of feedback and usage data
- **Company Sessions**: Company-specific chat sessions with detailed information
- **Pending Documents**: Approval workflow for newly submitted content

### Document Management System

#### Document Approval Workflow

The Sales Knowledge Assistant implements a robust document management system that ensures quality control through an approval workflow:

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  User Submits   │────▶│  Pending Document │────▶│ Admin Reviews  │
│  Content        │     │  Queue            │     │ Documents      │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                                          │
                                               ┌──────────┴───────────┐
                                               │                      │
                                               ▼                      ▼
                                        ┌────────────┐        ┌───────────┐
                                        │  Approve   │        │  Reject   │
                                        │  AI Tags   │        │           │
                                        └────────────┘        └───────────┘
                                               │
                                               ▼
                                     ┌───────────────────┐
                                     │  Knowledge Base   │
                                     │(With All AI Tags) │
                                     └───────────────────┘
```

#### Pending Document Storage

Documents submitted through the training interface are stored in a pending queue until reviewed by an administrator:

```typescript
// utils/pendingDocumentStore.ts
export interface PendingDocument {
  id: string;
  text: string;
  title: string;
  source: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  needsSummarization?: boolean;
  summary?: string;
  metadata?: Record<string, any>;
}

// Add a document to pending store
export function addPendingDocument(doc: Omit<PendingDocument, 'id' | 'status' | 'timestamp'>): PendingDocument {
  const documents = getAllPendingDocuments();
  
  const newDoc: PendingDocument = {
    ...doc,
    id: `pending-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  documents.push(newDoc);
  fs.writeFileSync(PENDING_INDEX_FILE, JSON.stringify({ documents }, null, 2));
  
  return newDoc;
}
```

#### Gemini LLM Processing

Administrators can choose to process approved documents with Gemini for summarization and metadata extraction:

```typescript
// utils/geminiClient.ts
export async function processWithGemini(text: string): Promise<{
  summary?: string;
  metadata?: Record<string, any>;
}> {
  try {
    const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const prompt = `
    Please analyze and process the following text content:
    
    ${text}
    
    Provide:
    1. A concise summary that preserves all key information
    2. A list of main topics/entities mentioned
    3. Categorization (product, pricing, features, etc.)
    4. Estimated technical complexity level (1-10)
    
    Format as JSON:
    {
      "summary": "concise summary here",
      "topics": ["topic1", "topic2"],
      "category": "category name",
      "technicalLevel": number,
      "containsSensitiveInfo": boolean
    }
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();
    
    // Parse the JSON response
    try {
      const parsed = JSON.parse(responseText);
      return {
        summary: parsed.summary,
        metadata: {
          topics: parsed.topics,
          category: parsed.category,
          technicalLevel: parsed.technicalLevel,
          containsSensitiveInfo: parsed.containsSensitiveInfo
        }
      };
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e);
      return {
        summary: responseText.substring(0, 1000),
        metadata: { processingError: true }
      };
    }
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    return {};
  }
}
```

#### Pending Document Manager Interface

The Pending Document Manager component allows administrators to:
- View all pending documents with their content and metadata
- Approve or reject individual documents
- Process documents with Gemini LLM for summarization
- Perform batch operations on multiple documents
- Toggle summarization on/off for processed documents

```jsx
// components/PendingDocumentManager.tsx
export default function PendingDocumentManager() {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [summarizeEnabled, setSummarizeEnabled] = useState(true);
  
  // Fetch pending documents
  useEffect(() => {
    fetchPendingDocuments();
  }, []);
  
  // Handle document approval with optional summarization
  const handleApprove = async (id) => {
    try {
      await fetch('/api/admin/pending-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'approve',
          summarize: summarizeEnabled
        })
      });
      
      // Refresh the list
      fetchPendingDocuments();
    } catch (error) {
      console.error('Error approving document:', error);
    }
  };
  
  // Batch approval functionality
  const handleBatchApprove = async () => {
    try {
      await fetch('/api/admin/pending-documents?batch=true', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedDocs,
          action: 'approve',
          summarize: summarizeEnabled
        })
      });
      
      // Refresh and clear selection
      fetchPendingDocuments();
      setSelectedDocs([]);
    } catch (error) {
      console.error('Error batch approving documents:', error);
    }
  };
  
  // Render UI for managing pending documents
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Interface implementation */}
    </div>
  );
}
```

#### Enhanced Document Manager

The Document Manager has been improved with pagination showing the newest documents first:

```typescript
// pages/api/admin/documents.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    
    const vectorStoreItems = getAllVectorStoreItems();
    
    // Sort by timestamp (newest first)
    vectorStoreItems.sort((a, b) => {
      const timestampA = a.metadata?.timestamp ? new Date(a.metadata.timestamp).getTime() : 0;
      const timestampB = b.metadata?.timestamp ? new Date(b.metadata.timestamp).getTime() : 0;
      return timestampB - timestampA;
    });
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = vectorStoreItems.slice(startIndex, endIndex);
    
    // Transform and return documents with pagination metadata
    return res.status(200).json({
      documents: paginatedItems.map(/* transformation logic */),
      total: vectorStoreItems.length,
      limit,
      page,
      totalPages: Math.ceil(vectorStoreItems.length / limit)
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json(standardizeApiErrorResponse(error));
  }
}
```

### Document Training and Submission Flow

1. **User Submission**:
   - Users click "Train Assistant" on the homepage
   - They can upload files or enter text directly
   - Content is sent to `/api/uploadText` endpoint
   - The content is stored in the pending documents queue instead of directly to the vector store

2. **Admin Review**:
   - Administrators see pending documents in the admin dashboard
   - They can review full content and metadata
   - For each document, they can:
     - Approve with summarization (processed by Gemini)
     - Approve without summarization (added directly)
     - Reject the document
   - Batch operations allow handling multiple documents at once

3. **Processing Steps**:
   - Approved documents are processed according to admin preferences
   - Gemini LLM extracts key information, summarizes, and categorizes content
   - Documents are split into appropriate chunks
   - Embeddings are created and added to the vector store
   - The document becomes searchable in the knowledge base

This workflow ensures that all new content undergoes proper review and quality control before being added to the knowledge base, while leveraging AI capabilities to enhance the content with proper metadata and summaries.

### Feedback System Integration

#### Feedback Collection Architecture

The feedback system follows this architecture:

```
┌─────────────────┐     ┌───────────────┐     ┌───────────────┐
│  Feedback UI    │────▶│  Feedback API  │────▶│ Admin Feedback│
│ (Thumbs Up/Down)│     │  Endpoint     │     │ API Endpoint  │
└─────────────────┘     └───────────────┘     └───────────────┘
                              │                       │
                              ▼                       ▼
                        ┌───────────────┐     ┌───────────────┐
                        │ Topic Extractor│    │ In-Memory     │
                        │               │    │ Storage        │
                        └───────────────┘    └───────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Analytics     │
                                            │ Dashboard     │
                                            └───────────────┘
```

#### Browser-Compatible Implementation

The feedback system is fully browser-compatible, with no direct file system access in client-side code:

```typescript
// utils/feedbackManager.ts (client-side)
export async function recordFeedback(
  feedback: Omit<FeedbackItem, 'id' | 'timestamp'>
): Promise<string> {
  try {
    const response = await axios.post('/api/feedback', feedback);
    return response.data.id;
  } catch (error) {
    logError('Failed to record feedback', error);
    throw new Error('Failed to save feedback');
  }
}

// pages/api/feedback.ts (middleware)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Validate and process feedback
  try {
    const body = req.body;
    
    // Validate required fields and prepare feedback payload
    
    // Forward to admin API
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/feedback`,
      feedbackPayload,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      id: response.data.id
    });
  } catch (error) {
    logError('Error recording feedback', error);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
}
```

#### Feedback Data Collection

Each response from the assistant includes upvote/downvote buttons that users can click to provide immediate feedback. The system records:

- The query that prompted the response
- The response content
- User rating (positive/negative)
- Topics extracted from the query
- Sources referenced in the response
- Timestamp and session data

```typescript
// In pages/chat.tsx
const handleFeedback = async (messageIndex: number, feedbackType: 'positive' | 'negative') => {
  const message = messages[messageIndex];
  
  if (message.role !== 'bot') return;
  
  // Update UI immediately
  const updatedMessages = [...messages];
  updatedMessages[messageIndex] = {
    ...message,
    feedback: feedbackType
  };
  setMessages(updatedMessages);
  
  // Find the corresponding user query
  let userQuery = '';
  if (messageIndex > 0 && updatedMessages[messageIndex - 1].role === 'user') {
    userQuery = updatedMessages[messageIndex - 1].content;
  }
  
  // Submit feedback to API
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: userQuery,
        response: message.content,
        feedback: feedbackType,
        messageIndex,
        sessionId: sessionId,
        messageId: message.id,
        metadata: {
          sessionType: 'general'
        }
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to submit feedback');
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
};
```

### Analytics Dashboard

The analytics dashboard visualizes the feedback data to provide insights:

```jsx
// components/AnalyticsDashboard.tsx
const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  refreshInterval = 60000  // Default refresh every minute
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch analytics data on load and periodically
  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);
  
  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/analytics', {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'dev-key'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render analytics visualizations
}
```

The analytics system processes feedback data to generate actionable insights:

```typescript
// pages/api/admin/analytics.ts
async function generateAnalytics(): Promise<AnalyticsData> {
  try {
    // Get all feedback from our feedback API
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const response = await axios.get(
      `${baseUrl}/api/admin/feedback`,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    const feedbackItems: FeedbackItem[] = response.data;
    
    // Calculate feedback stats
    const totalFeedback = feedbackItems.length;
    const positiveFeedback = feedbackItems.filter(item => item.feedback === 'positive').length;
    
    // Process common queries, referenced content, and session stats
    
    return {
      commonQueries,
      topReferencedContent,
      feedbackStats: {
        total: totalFeedback,
        positive: positiveFeedback,
        negative: totalFeedback - positiveFeedback,
        percentagePositive: totalFeedback > 0 ? (positiveFeedback / totalFeedback) * 100 : 0
      },
      lastUpdated: Date.now(),
      sessionStats
    };
  } catch (error) {
    logError('Failed to generate analytics', error);
    // Return empty analytics on error
    return {
      commonQueries: [],
      topReferencedContent: [],
      feedbackStats: {
        total: 0,
        positive: 0,
        negative: 0,
        percentagePositive: 0
      },
      lastUpdated: Date.now()
    };
  }
}
```

### Chat Sessions Management

The admin dashboard enables viewing and managing chat sessions:

```typescript
// Chat Sessions List Component (simplified)
function ChatSessionsList() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSessionDetailed | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchByContent, setSearchByContent] = useState(false);
  
  // Fetch sessions on load
  useEffect(() => {
    fetchSessions();
  }, []);
  
  // Handle session search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return fetchSessions();
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/chat-sessions?${searchByContent ? 'content' : 'query'}=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search sessions');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Error searching sessions:', error);
      setError('Failed to search sessions');
    } finally {
      setLoading(false);
    }
  };
  
  // View session details
  const viewSessionDetails = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
      if (!response.ok) throw new Error('Failed to load session details');
      const data = await response.json();
      setSelectedSession(data);
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };
  
  // Render session list and details view
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Session list */}
      <div className="md:col-span-1 bg-white p-4 rounded-lg shadow">
        <div className="mb-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="flex-grow p-2 border rounded"
            />
            <button type="submit" className="p-2 bg-blue-500 text-white rounded">
              <Search className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 flex items-center text-sm">
            <input
              type="checkbox"
              id="searchContent"
              checked={searchByContent}
              onChange={() => setSearchByContent(!searchByContent)}
              className="mr-2"
            />
            <label htmlFor="searchContent">Search in messages content</label>
          </div>
        </div>
        
        {/* Session list */}
        <div className="space-y-2 mt-4">
          {sessions.map(session => (
            <div
              key={session.id}
              className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => viewSessionDetails(session.id)}
            >
              <div className="font-medium">{session.title || 'Untitled Session'}</div>
              <div className="text-sm text-gray-500">
                {formatDate(session.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Session details */}
      {selectedSession && (
        <div className="md:col-span-2 bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">{selectedSession.title || 'Untitled Session'}</h2>
            <button 
              onClick={() => router.push(`/chat?session=${selectedSession.id}`)}
              className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
            >
              Open Chat
            </button>
          </div>
          
          {/* Message thread */}
          <div className="space-y-4 mt-6">
            {selectedSession.messages.map((message, index) => (
              <div key={index} className={`p-3 rounded ${
                message.role === 'user' ? 'bg-blue-50 ml-12' : 'bg-gray-50 mr-12'
              }`}>
                <div className="font-medium text-sm text-gray-600">
                  {message.role === 'user' ? 'User' : 'Assistant'}
                </div>
                <div className="mt-1 whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDate(message.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Security Considerations

The feedback system implements several security measures:

1. **API Authentication**:
   - Admin API endpoints require an API key
   - Development mode has relaxed authentication for easier testing

2. **Input Validation**:
   - All user inputs are validated at both client and server levels
   - Proper error handling for malformed requests

3. **Separation of Concerns**:
   - Public feedback API separates from admin storage API
   - No direct client access to storage mechanisms

4. **Cross-API Communication**:
   - Internal API communication uses secure headers
   - Response sanitization prevents information leakage

### Benefits of the Admin Dashboard

The integrated admin dashboard provides several benefits:

1. **Centralized Management**: Single interface for all administrative tasks
2. **Data-Driven Insights**: Analytics based on real user interactions
3. **Content Optimization**: Identify knowledge gaps and improvement areas
4. **User Satisfaction Tracking**: Monitor feedback trends over time
5. **Debugging & Troubleshooting**: Identify and address issues quickly

### Recent Implementation Updates

We have successfully resolved browser compatibility issues by:

1. **Removing all direct file system dependencies** from client-side code
2. **Creating browser-compatible versions** of core utilities:
   - Updated `utils/errorHandling.ts` to use console logging instead of file logging
   - Modified `utils/config.ts` to use environment variables instead of config files
3. **Implementing proper API-based feedback system** with separation of concerns:
   - Client-side code only makes API calls
   - Server-side code handles data persistence
   - Authentication for admin operations

### Future Enhancements

Planned enhancements to the admin dashboard include:

1. **User Management**: Add/remove users and manage permissions
2. **Advanced Analytics**: More detailed insights and custom reports
3. **Bulk Operations**: Manage multiple sessions or documents at once
4. **Export/Import**: Transfer data between environments
5. **Activity Logging**: Track admin actions for accountability

## Automated Document Tagging with Gemini AI

The Sales Knowledge Assistant implements a powerful automated document tagging system powered by Gemini AI. This system ensures that all documents uploaded and approved by administrators are properly analyzed, categorized, and augmented with rich metadata for optimal searchability.

### Overview

The automated document tagging system eliminates the need for manual tagging by implementing an AI-powered workflow:

1. Documents uploaded through the admin interface are automatically processed by Gemini AI
2. Gemini AI analyzes document content and generates comprehensive metadata
3. Administrators review and approve the AI-generated tags (without manual tagging)
4. Approved documents with their AI-generated metadata are added to the knowledge base
5. All metadata is preserved during the approval process and utilized by the search system

### Key Components

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│ Document Upload │────▶│ Gemini Processing│────▶│ Pending Queue  │
│                 │     │                  │     │                │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │ Admin Review   │
                                                 │ (No Manual     │
                                                 │  Tagging)      │
                                                 └────────────────┘
                                                          │
                                               ┌──────────┴───────────┐
                                               │                      │
                                               ▼                      ▼
                                        ┌────────────┐        ┌───────────┐
                                        │  Approve   │        │  Reject   │
                                        │  AI Tags   │        │           │
                                        └────────────┘        └───────────┘
                                               │
                                               ▼
                                     ┌───────────────────┐
                                     │  Knowledge Base   │
                                     │(With All AI Tags) │
                                     └───────────────────┘
```

### Automated Tagging Process

1. **Document Upload**: Administrators upload documents through the admin interface
2. **Gemini Processing**: The document is automatically processed by the Gemini AI system:
   - Text is extracted and analyzed
   - Content is categorized and labeled
   - Entities, relationships, and key concepts are identified
   - Technical level and other attributes are assessed
3. **Pending Queue**: Processed documents are placed in a pending queue with all AI-generated metadata
4. **Admin Review**: Administrators review the document content and AI-generated tags
5. **Approval/Rejection**: Administrators can approve or reject documents based on content quality
6. **Vector Store Integration**: Approved documents are added to the vector store with all AI-generated metadata preserved

### Implementation Details

#### Gemini Document Processor

The `utils/geminiProcessor.ts` utility handles document analysis with Gemini AI:

```typescript
// Interface for results from Gemini document analysis
interface GeminiDocumentAnalysis {
  summary: string;
  contentType: string;
  primaryCategory: string;
  secondaryCategories: string[];
  technicalLevel: number; // 0-3
  entities: {
    people: Array<{
      name: string;
      role?: string;
      importance: 'high' | 'medium' | 'low';
    }>;
    companies: Array<{
      name: string;
      relationship?: string;
    }>;
    products: string[];
    features: string[];
  };
  keywords: string[];
  topics: string[];
  confidenceScore: number;
}

// Expanded interface for enhanced document analysis
interface EnhancedGeminiDocumentAnalysis {
  summary: string;
  contentType: string;
  
  // Enhanced categorization
  primaryCategory: string;
  secondaryCategories: string[];
  industryCategories: string[];
  functionCategories: string[]; // e.g., "marketing", "sales", "technical support"
  useCases: string[];
  
  // Technical aspects
  technicalLevel: number; // 0-3
  complexityScore: number; // 0-5
  
  // Detailed topics
  topics: string[];
  subtopics: string[];
  
  // Enhanced entity recognition
  entities: {
    people: Array<{
      name: string;
      role?: string;
      importance: 'high' | 'medium' | 'low';
      sentiment?: 'positive' | 'neutral' | 'negative';
      relationships?: Array<{
        entity: string;
        relationship: string;
      }>;
    }>;
    companies: Array<{
      name: string;
      relationship?: string;
      type?: 'competitor' | 'partner' | 'customer' | 'vendor';
      importance: 'high' | 'medium' | 'low';
    }>;
    products: Array<{
      name: string;
      version?: string;
      category?: string;
    }>;
    features: Array<{
      name: string;
      product?: string;
      status?: 'current' | 'planned' | 'deprecated';
    }>;
    locations: string[];
    dates: Array<{
      date: string;
      context: string;
    }>;
  };
  
  // SEO and search enhancement
  keywords: string[];
  semanticKeywords: string[]; // Related terms for query expansion
  
  // Document quality metrics
  confidenceScore: number;
  authorityScore: number;
  recencyIndicators: {
    hasTimestamps: boolean;
    mostRecentDate?: string;
    likelyOutdated: boolean;
  };
}
```

#### Document Ingestion API

The document ingestion API (`pages/api/admin/ingest-document.ts`) provides the entry point for document processing:

```typescript
// API endpoint for ingesting documents
// POST /api/admin/ingest-document
async function ingestDocument(
  text: string,
  source: string,
  existingMetadata?: Record<string, any>,
  useEnhancedLabeling?: boolean
): Promise<{
  success: boolean;
  documentId: string;
  requiresApproval: boolean;
  analysis: GeminiAnalysisSummary;
  useEnhancedLabeling: boolean;
}>;
```

#### Admin Interface

The administrative interface includes components for managing documents:

```typescript
// Enhanced UI components for automated tagging workflow
// components/admin/PendingDocuments.tsx
interface MetadataViewerProps {
  document: PendingDocument;
}

const MetadataViewer: React.FC<MetadataViewerProps> = ({ document }) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-blue-50 p-4 border-b">
        <h3 className="text-lg font-medium text-blue-800">AI-Generated Metadata</h3>
        <p className="text-sm text-gray-600">
          These tags were automatically generated by Gemini AI and determine how 
          this document will be found in searches
        </p>
      </div>
      
      {/* Metadata display sections */}
      
      <div className="bg-yellow-50 p-3 border-t border-yellow-100">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> All tags are automatically generated by Gemini AI.
          Your role is to review the document content and ensure the AI-generated 
          tags are appropriate before approval.
        </p>
      </div>
    </div>
  );
};
```

#### Document Approval

The document approval API preserves all AI-generated metadata during the approval process:

```typescript
// Enhanced function to preserve AI metadata during approval
// utils/adminWorkflow.ts
async function addApprovedDocumentToVectorStore(
  pendingDoc: StoredPendingDocument
): Promise<void> {
  try {
    // Extract document information
    const { id, text, embedding, metadata } = pendingDoc;

    // Create a properly typed metadata object that preserves all Gemini-generated fields
    const enhancedMetadata: Record<string, any> = {
      ...metadata,
      approvedAt: new Date().toISOString()
    };

    // Process array fields for better searchability
    const arrayFields = [
      'keywords',
      'secondaryCategories',
      'industryCategories',
      'functionCategories',
      'useCases'
    ];

    // Convert arrays to strings for storage compatibility
    arrayFields.forEach(field => {
      if (Array.isArray(enhancedMetadata[field])) {
        enhancedMetadata[`${field}_str`] = enhancedMetadata[field].join(', ');
      }
    });

    // Add to vector store with all metadata preserved
    const vectorStoreItem: VectorStoreItem = {
      id: id,
      text: text,
      embedding: embedding || [],
      metadata: enhancedMetadata
    };
    await addToVectorStore(vectorStoreItem);
  } catch (error) {
    logError(`Failed to add approved document ${pendingDoc.id} to vector store`, error);
    throw error;
  }
}
```

### Automated Metadata Types

The Gemini AI system generates the following metadata types for each document:

| Metadata Type | Description | Example |
|---------------|-------------|---------|
| `primaryCategory` | Main category for the document | "Product" |
| `secondaryCategories` | Additional categories | ["Features", "API"] |
| `industryCategories` | Industry-specific categorization | ["Healthcare", "Finance"] |
| `functionCategories` | Business function categories | ["Marketing", "Sales"] |
| `technicalLevel` | Technical complexity (0-3) | 2 |
| `entities.people` | People mentioned with roles | [{"name": "John Smith", "role": "CEO"}] |
| `entities.companies` | Companies mentioned | [{"name": "Acme Corp", "relationship": "partner"}] |
| `entities.products` | Products mentioned | [{"name": "ProductX", "version": "2.0"}] |
| `keywords` | Key terms for search | ["integration", "API", "workflow"] |
| `summary` | Document summary | "This document explains the ProductX API..." |
| `useCases` | Use cases described | ["Customer onboarding", "Data migration"] |

### Benefits of Automated Tagging

1. **Consistency**: All documents are tagged using the same AI system with consistent criteria
2. **Efficiency**: Administrators save time by not having to manually tag documents
3. **Accuracy**: Gemini AI provides more comprehensive and nuanced tagging than manual processes
4. **Searchability**: Rich metadata improves search relevance and filtering capabilities
5. **Scalability**: The automated process can handle large volumes of documents

### Recent Implementation Improvements

Recent enhancements to the automated document tagging system include:

1. **UI Clarity**: Updated buttons and interfaces to clarify the admin's review-only role
2. **Help Documentation**: Added comprehensive help panels explaining the automated process
3. **Metadata Preservation**: Enhanced type handling to ensure all AI-generated tags are preserved
4. **Error Handling**: Improved handling of processing failures and retries
5. **Approval Confirmation**: Added clear dialogs confirming preservation of AI-generated tags

### Roadmap for Future Enhancements

1. **Feedback Loop**: Allow admins to provide feedback on AI tagging accuracy
2. **Custom Taxonomies**: Support for organization-specific category hierarchies
3. **Tag Suggestions**: AI-suggested improvements for existing document tags
4. **Batch Processing**: Enhanced batch operations for processing multiple documents
5. **Version Tracking**: Track changes to tags and metadata over time

## Implementation History and Current Status

The Sales Knowledge Assistant has undergone several phases of development, with each phase introducing new capabilities and improvements. Here is a summary of the completed work and current status:

### Completed Phases

#### Phase 1: Gemini-Based Document Processing
- ✅ Created Gemini document processor utility
  - Processes and analyzes documents using Gemini API
  - Extracts entities, topics, and relationships
  - Generates comprehensive metadata and summaries
  - Assigns confidence scores for categorization
- ✅ Designed comprehensive prompts for document analysis
  - Leadership/people identification prompt
  - Product and feature classification prompt
  - Technical level assessment prompt
- ✅ Expanded metadata schema
  - Added multi-dimensional categories
  - Supported richer entity relationships
  - Included confidence scores for metadata
- ✅ Updated document ingestion workflow
  - Preprocesses with Gemini before adding to pending queue
  - Implemented admin approval process for quality control
  - Stores enhanced metadata with documents

#### Phase 2: Enhanced Document Labeling
- ✅ Expanded automatic document labeling capabilities
  - Added broader range of category types with industry and function taxonomies
  - Implemented multi-label classification with hierarchical categories
  - Enhanced metadata with semantic keywords for better search
- ✅ Created more granular topic tagging
  - Added detailed subtopics within main categories
  - Implemented product and feature hierarchical relationships
  - Added version-specific information where applicable
- ✅ Enhanced entity recognition
  - Added improved person, organization, and product entity detection
  - Implemented relationship context between entities
  - Added sentiment and importance scoring for entities
- ✅ Implemented hierarchical classification in search
  - Created category structure with parent-child relationships
  - Enhanced search to leverage hierarchical structure
  - Implemented filtering capabilities based on category hierarchy

#### Phase 3: Fully Automated Document Tagging
- ✅ Eliminated manual tagging requirements
  - Implemented fully AI-powered tagging with no human intervention required
  - Modified approval process to preserve all AI-generated metadata
  - Enhanced type handling for consistent storage and retrieval
- ✅ Improved admin workflow
  - Redesigned UI to emphasize review-only role (no manual tagging)
  - Added comprehensive help documentation for admins
  - Modified button labels to reflect "Approve AI Tags" instead of just "Approve"
- ✅ Enhanced metadata preservation
  - Updated `adminWorkflow.ts` to handle all metadata types during approval
  - Added normalization for technical level and other numeric values
  - Implemented array field conversion for search compatibility
- ✅ Added data structure optimization
  - Created string representations of array fields for better search
  - Enhanced entity storage with proper JSON serialization
  - Added validation and normalization for consistency

#### Phase 4: Enhanced Conflict Detection
- ✅ Improved conflict detection with Gemini
  - Added semantic contradiction detection beyond pattern matching
  - Implemented information recency and reliability assessment
  - Added resolution suggestions with confidence scoring
- ✅ Enhanced admin interfaces for content management
  - Created pending documents dashboard
  - Integrated document ingestion with approval workflow
  - Document details view with analysis results

#### Phase 5: Improved Search & Hierarchical Navigation
- ✅ Enhanced hybrid search with hierarchical capabilities
  - Integrated category hierarchies directly into the main search system
  - Enabled category-based filtering that respects parent-child relationships
  - Improved ranking based on category structure
- ✅ Optimized existing search parameters
  - Refined hybrid search ratios based on query patterns
  - Implemented smarter fallback strategies for zero-result searches
  - Used pre-computed semantic keywords for query expansion
- ✅ Enhanced search result presentation
  - Grouped results by topic hierarchy where appropriate
  - Displayed category context for search results
  - Added related topics and suggested refinements
- ✅ Implemented entity-based filtering
  - Added support for filtering by people, companies, products, and features
  - Leveraged entity relationships for improved search
  - Enabled technical level range selection

### Current Development Status

The system has successfully implemented:
- ✅ Robust Query Routing
- ✅ Conflict Detection & Management
- ✅ Gemini-Based Document Processing
- ✅ Enhanced Document Labeling
- ✅ Automated Document Tagging
- ✅ Hierarchical Search Capabilities

### Upcoming Development

The following features are planned for future development:

1. **Version History Tracking**
   - Track changes to important information
   - Create audit trails for conflict resolution
   - Enable rollback capabilities

2. **Monitoring & Analytics**
   - Implement comprehensive search analytics
   - Track zero-result queries
   - Monitor content gaps
   - Analyze query patterns and success rates
   - Build admin dashboards for content health
   - Create automated content improvement suggestions

3. **Testing and Documentation**
   - Comprehensive system testing
   - Bug fixes and optimizations
   - Full documentation updates

### Success Metrics

The system has achieved or is on track to achieve the following success metrics:

1. **Search Success Rate**: >95% of queries return relevant results
2. **Conflict Resolution**: 100% of conflicting information is flagged and resolvable
3. **Tagging Accuracy**: >90% accuracy in automatic category assignment (Achieved with Gemini AI processing)
4. **User Satisfaction**: Positive feedback on answer relevance and correctness
5. **Document Classification Coverage**: >95% of documents have at least 5 relevant labels/categories (Achieved with automated tagging)
6. **Search Precision**: >85% of top 3 search results are highly relevant to the query

---

## Change Log

- **v1.0.0** (2023-06-15): Initial documentation
- **v1.1.0** (2023-07-20): Added dual chat mode documentation
- **v1.2.0** (2023-08-12): Added feedback system details
- **v1.3.0** (2023-09-05): Added real-time information system
- **v1.4.0** (2023-10-18): Consolidated all documentation 

## Perplexity API Integration

The Sales Knowledge Assistant incorporates real-time company information through integration with the Perplexity API, enabling sales representatives to access up-to-date information about prospect companies within the chat interface.

### Overview

The Perplexity API integration provides:
1. Real-time company research capability
2. Automated extraction of key company details (industry, size, location)
3. Contextual recommendations based on company information
4. A dedicated company-specific chat mode
5. Sales rep note-taking capabilities for personalized context

### Components

#### 1. Perplexity Client (`utils/perplexityClient.ts`)

This module provides the core functionality for interacting with the Perplexity API:

- **API Configuration**: Manages API keys, endpoints, and rate limits
- **Company Information Retrieval**: Fetches comprehensive company profiles
- **Company Verification**: Validates company existence before fetching details
- **Type Definitions**: Provides TypeScript interfaces for company data structures
- **Error Handling**: Manages API failures and rate limiting gracefully

Key functions:
- `getCompanyInformation(companyName, options)`: Retrieves detailed company information
- `verifyCompanyIdentity(companyName)`: Confirms company existence and gets basic details

#### 2. Caching Mechanism (`utils/perplexityUtils.ts`)

Implements efficient caching to reduce API costs and improve performance:

- **In-Memory Cache**: Stores company information with configurable expiration
- **Cache Invalidation**: Manages cache clearing and updates
- **Usage Logging**: Tracks API usage for monitoring and optimization

Key functions:
- `cacheWithExpiry(key, data, ttl)`: Stores data with expiration time
- `getFromCache<T>(key)`: Type-safe retrieval of cached data
- `logPerplexityUsage(action, details, error)`: Tracks API usage

#### 3. API Endpoints

Two dedicated endpoints handle company information requests:

- **`/api/company/verify`**: Validates company existence
  - Input: Company name
  - Output: Verification status, official name, basic details
  
- **`/api/company/info`**: Retrieves comprehensive company information
  - Input: Verified company name
  - Output: Detailed company profile, industry, size, etc.

#### 4. Company Chat Interface

A specialized chat interface for company-specific conversations:

- **Company Search**: Allows users to search for and select companies
- **Profile Display**: Shows key company information
- **Sales Rep Notes**: Enables sales representatives to add personalized notes about the company
- **Contextual Chat**: Preloads company context for tailored responses
- **System Messages**: Automatically includes company information and sales notes in prompts

### Sales Rep Notes Feature

The Sales Rep Notes feature enables sales representatives to add their own insights, observations, and context about a company:

- **Persistent Notes**: Notes are maintained throughout the chat session
- **Editable Interface**: Simple editing interface with save functionality
- **Contextual Integration**: Notes are seamlessly integrated into the system prompt
- **Authority Weighting**: Notes are treated as authoritative information by the AI model
- **Visual Distinction**: Notes section is visually distinct from the company profile

#### Implementation Details

1. **UI Component**: A dedicated notes section with edit/save functionality
2. **State Management**: Notes are stored in React state and passed to the query API
3. **System Prompt Integration**: Notes are injected into the system prompt with clear labeling
4. **Prompt Engineering**: The model is explicitly instructed to prioritize notes information
5. **Context Updating**: System message is updated when notes are modified

#### Benefits

- **Personalized Context**: Sales reps can add information from previous calls or other sources
- **Specialized Knowledge**: Domain-specific insights that might not be publicly available
- **Follow-up Tracking**: Notes about previous discussions can be maintained
- **Decision Maker Details**: Information about key stakeholders can be recorded
- **Custom Priorities**: Sales reps can highlight specific company needs or interests

### API Usage & Rate Limiting

The Perplexity API implementation includes sophisticated rate limiting to manage costs:

- **Rate Window**: Limits API calls to 10 per hour
- **Automatic Failover**: Returns cached data when rate limits are reached
- **Usage Tracking**: Logs all API interactions for monitoring
- **Graceful Degradation**: Provides helpful messages when limits are reached

### Data Flow

1. **User Initiates Company Chat**: User enters a company name in the search interface
2. **Company Verification**: System verifies company existence via `/api/company/verify`
3. **Profile Retrieval**: System fetches detailed information via `/api/company/info`
4. **Context Building**: Company details are formatted into system context
5. **Note Taking**: Sales rep adds personalized notes about the company
6. **Chat Initialization**: System preloads company context and notes into the chat interface
7. **Query Enhancement**: User questions are augmented with company context and notes
8. **Response Generation**: Answers incorporate company-specific information and sales rep insights

### Integration with Query API

The existing query API (`/api/query`) has been enhanced to support company context and sales notes:

- When company information is available, it's included in the system prompt
- Sales rep notes are included in the system prompt with clear labeling
- The AI model is explicitly instructed to prioritize and incorporate sales rep notes
- The AI model receives structured company data to inform its responses
- Responses are specifically tailored to address company characteristics and concerns highlighted in the notes
- Product recommendations are aligned with company industry, size, and specific needs identified in the notes

### Example Usage

```typescript
// Example: Sending a query with company context and sales notes
const response = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: message,
    context: JSON.stringify(messages),
    options: {
      companyContext: {
        ...companyInfo,
        companyName: companyName,
        salesNotes: salesNotes
      },
    }
  }),
});
```

### Implementation Status

The Perplexity API integration with Sales Rep Notes is fully implemented and operational, providing:

- A dedicated company chat interface accessible from the main page
- Real-time company research capability
- Automated company profile generation
- Sales rep note-taking functionality
- Context-aware responses based on company details and sales rep notes
- Intelligent caching with 24-hour expiration

## Admin Dashboard

The Admin Dashboard provides a central interface for system administrators to manage the Sales Knowledge Assistant, monitor performance, review feedback, and analyze usage patterns.

### Dashboard Overview

The administrative interface (`pages/admin.tsx`) includes multiple tabs for different management functions:

```jsx
export default function Admin({ logs }: AdminProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'documents' | 'chatSessions' | 'analytics' | 'companySessions' | 'pending'>('metrics');
  
  // ...implementation details...
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        
        {/* Tab navigation */}
        <div className="flex border-b mb-6">
          <button 
            className={`px-4 py-2 ${activeTab === 'metrics' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <div className="flex items-center">
              <BarChart2 className="w-4 h-4 mr-2" />
              <span>System Metrics</span>
            </div>
          </button>
          
          {/* Other tabs including new Pending Documents tab */}
          <button 
            className={`px-4 py-2 ${activeTab === 'pending' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <div className="flex items-center">
              <InboxIcon className="w-4 h-4 mr-2" />
              <span>Pending Documents</span>
            </div>
          </button>
          
          {/* ... */}
        </div>
        
        {/* Tab content */}
        {activeTab === 'metrics' && <SystemMetrics />}
        {activeTab === 'documents' && <DocumentManager />}
        {activeTab === 'chatSessions' && <ChatSessionsList />}
        {activeTab === 'companySessions' && <CompanySessionsList />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'pending' && <PendingDocumentManager />}
      </div>
    </Layout>
  );
}
```

The admin dashboard includes the following tabs:
- **System Metrics**: Performance statistics about the system
- **Document Management**: Tools for managing the knowledge base
- **Chat Sessions**: General chat logs with feedback information
- **Analytics**: Visualizations of feedback and usage data
- **Company Sessions**: Company-specific chat sessions with detailed information
- **Pending Documents**: Approval workflow for newly submitted content

### Document Management System

#### Document Approval Workflow

The Sales Knowledge Assistant implements a robust document management system that ensures quality control through an approval workflow:

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  User Submits   │────▶│  Pending Document │────▶│ Admin Reviews  │
│  Content        │     │  Queue            │     │ Documents      │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                                          │
                                               ┌──────────┴───────────┐
                                               │                      │
                                               ▼                      ▼
                                        ┌────────────┐        ┌───────────┐
                                        │  Approve   │        │  Reject   │
                                        │  AI Tags   │        │           │
                                        └────────────┘        └───────────┘
                                               │
                                               ▼
                                     ┌───────────────────┐
                                     │  Knowledge Base   │
                                     │(With All AI Tags) │
                                     └───────────────────┘
```

#### Pending Document Storage

Documents submitted through the training interface are stored in a pending queue until reviewed by an administrator:

```typescript
// utils/pendingDocumentStore.ts
export interface PendingDocument {
  id: string;
  text: string;
  title: string;
  source: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  needsSummarization?: boolean;
  summary?: string;
  metadata?: Record<string, any>;
}

// Add a document to pending store
export function addPendingDocument(doc: Omit<PendingDocument, 'id' | 'status' | 'timestamp'>): PendingDocument {
  const documents = getAllPendingDocuments();
  
  const newDoc: PendingDocument = {
    ...doc,
    id: `pending-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  documents.push(newDoc);
  fs.writeFileSync(PENDING_INDEX_FILE, JSON.stringify({ documents }, null, 2));
  
  return newDoc;
}
```

#### Gemini LLM Processing

Administrators can choose to process approved documents with Gemini for summarization and metadata extraction:

```typescript
// utils/geminiClient.ts
export async function processWithGemini(text: string): Promise<{
  summary?: string;
  metadata?: Record<string, any>;
}> {
  try {
    const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const prompt = `
    Please analyze and process the following text content:
    
    ${text}
    
    Provide:
    1. A concise summary that preserves all key information
    2. A list of main topics/entities mentioned
    3. Categorization (product, pricing, features, etc.)
    4. Estimated technical complexity level (1-10)
    
    Format as JSON:
    {
      "summary": "concise summary here",
      "topics": ["topic1", "topic2"],
      "category": "category name",
      "technicalLevel": number,
      "containsSensitiveInfo": boolean
    }
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();
    
    // Parse the JSON response
    try {
      const parsed = JSON.parse(responseText);
      return {
        summary: parsed.summary,
        metadata: {
          topics: parsed.topics,
          category: parsed.category,
          technicalLevel: parsed.technicalLevel,
          containsSensitiveInfo: parsed.containsSensitiveInfo
        }
      };
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e);
      return {
        summary: responseText.substring(0, 1000),
        metadata: { processingError: true }
      };
    }
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    return {};
  }
}
```

#### Pending Document Manager Interface

The Pending Document Manager component allows administrators to:
- View all pending documents with their content and metadata
- Approve or reject individual documents
- Process documents with Gemini LLM for summarization
- Perform batch operations on multiple documents
- Toggle summarization on/off for processed documents

```jsx
// components/PendingDocumentManager.tsx
export default function PendingDocumentManager() {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [summarizeEnabled, setSummarizeEnabled] = useState(true);
  
  // Fetch pending documents
  useEffect(() => {
    fetchPendingDocuments();
  }, []);
  
  // Handle document approval with optional summarization
  const handleApprove = async (id) => {
    try {
      await fetch('/api/admin/pending-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'approve',
          summarize: summarizeEnabled
        })
      });
      
      // Refresh the list
      fetchPendingDocuments();
    } catch (error) {
      console.error('Error approving document:', error);
    }
  };
  
  // Batch approval functionality
  const handleBatchApprove = async () => {
    try {
      await fetch('/api/admin/pending-documents?batch=true', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedDocs,
          action: 'approve',
          summarize: summarizeEnabled
        })
      });
      
      // Refresh and clear selection
      fetchPendingDocuments();
      setSelectedDocs([]);
    } catch (error) {
      console.error('Error batch approving documents:', error);
    }
  };
  
  // Render UI for managing pending documents
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Interface implementation */}
    </div>
  );
}
```

#### Enhanced Document Manager

The Document Manager has been improved with pagination showing the newest documents first:

```typescript
// pages/api/admin/documents.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    
    const vectorStoreItems = getAllVectorStoreItems();
    
    // Sort by timestamp (newest first)
    vectorStoreItems.sort((a, b) => {
      const timestampA = a.metadata?.timestamp ? new Date(a.metadata.timestamp).getTime() : 0;
      const timestampB = b.metadata?.timestamp ? new Date(b.metadata.timestamp).getTime() : 0;
      return timestampB - timestampA;
    });
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = vectorStoreItems.slice(startIndex, endIndex);
    
    // Transform and return documents with pagination metadata
    return res.status(200).json({
      documents: paginatedItems.map(/* transformation logic */),
      total: vectorStoreItems.length,
      limit,
      page,
      totalPages: Math.ceil(vectorStoreItems.length / limit)
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json(standardizeApiErrorResponse(error));
  }
}
```

### Document Training and Submission Flow

1. **User Submission**:
   - Users click "Train Assistant" on the homepage
   - They can upload files or enter text directly
   - Content is sent to `/api/uploadText` endpoint
   - The content is stored in the pending documents queue instead of directly to the vector store

2. **Admin Review**:
   - Administrators see pending documents in the admin dashboard
   - They can review full content and metadata
   - For each document, they can:
     - Approve with summarization (processed by Gemini)
     - Approve without summarization (added directly)
     - Reject the document
   - Batch operations allow handling multiple documents at once

3. **Processing Steps**:
   - Approved documents are processed according to admin preferences
   - Gemini LLM extracts key information, summarizes, and categorizes content
   - Documents are split into appropriate chunks
   - Embeddings are created and added to the vector store
   - The document becomes searchable in the knowledge base

This workflow ensures that all new content undergoes proper review and quality control before being added to the knowledge base, while leveraging AI capabilities to enhance the content with proper metadata and summaries.

### Feedback System Integration

#### Feedback Collection Architecture

The feedback system follows this architecture:

```
┌─────────────────┐     ┌───────────────┐     ┌───────────────┐
│  Feedback UI    │────▶│  Feedback API  │────▶│ Admin Feedback│
│ (Thumbs Up/Down)│     │  Endpoint     │     │ API Endpoint  │
└─────────────────┘     └───────────────┘     └───────────────┘
                              │                       │
                              ▼                       ▼
                        ┌───────────────┐     ┌───────────────┐
                        │ Topic Extractor│    │ In-Memory     │
                        │               │    │ Storage        │
                        └───────────────┘    └───────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │ Analytics     │
                                            │ Dashboard     │
                                            └───────────────┘
```

#### Browser-Compatible Implementation

The feedback system is fully browser-compatible, with no direct file system access in client-side code:

```typescript
// utils/feedbackManager.ts (client-side)
export async function recordFeedback(
  feedback: Omit<FeedbackItem, 'id' | 'timestamp'>
): Promise<string> {
  try {
    const response = await axios.post('/api/feedback', feedback);
    return response.data.id;
  } catch (error) {
    logError('Failed to record feedback', error);
    throw new Error('Failed to save feedback');
  }
}

// pages/api/feedback.ts (middleware)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Validate and process feedback
  try {
    const body = req.body;
    
    // Validate required fields and prepare feedback payload
    
    // Forward to admin API
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/feedback`,
      feedbackPayload,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      id: response.data.id
    });
  } catch (error) {
    logError('Error recording feedback', error);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
}
```

#### Feedback Data Collection

Each response from the assistant includes upvote/downvote buttons that users can click to provide immediate feedback. The system records:

- The query that prompted the response
- The response content
- User rating (positive/negative)
- Topics extracted from the query
- Sources referenced in the response
- Timestamp and session data

```typescript
// In pages/chat.tsx
const handleFeedback = async (messageIndex: number, feedbackType: 'positive' | 'negative') => {
  const message = messages[messageIndex];
  
  if (message.role !== 'bot') return;
  
  // Update UI immediately
  const updatedMessages = [...messages];
  updatedMessages[messageIndex] = {
    ...message,
    feedback: feedbackType
  };
  setMessages(updatedMessages);
  
  // Find the corresponding user query
  let userQuery = '';
  if (messageIndex > 0 && updatedMessages[messageIndex - 1].role === 'user') {
    userQuery = updatedMessages[messageIndex - 1].content;
  }
  
  // Submit feedback to API
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: userQuery,
        response: message.content,
        feedback: feedbackType,
        messageIndex,
        sessionId: sessionId,
        messageId: message.id,
        metadata: {
          sessionType: 'general'
        }
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to submit feedback');
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
};
```

### Analytics Dashboard

The analytics dashboard visualizes the feedback data to provide insights:

```jsx
// components/AnalyticsDashboard.tsx
const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  refreshInterval = 60000  // Default refresh every minute
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch analytics data on load and periodically
  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);
  
  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/analytics', {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || 'dev-key'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render analytics visualizations
}
```

The analytics system processes feedback data to generate actionable insights:

```typescript
// pages/api/admin/analytics.ts
async function generateAnalytics(): Promise<AnalyticsData> {
  try {
    // Get all feedback from our feedback API
    const adminKey = process.env.ADMIN_API_KEY || 'dev-key';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const response = await axios.get(
      `${baseUrl}/api/admin/feedback`,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
    
    const feedbackItems: FeedbackItem[] = response.data;
    
    // Calculate feedback stats
    const totalFeedback = feedbackItems.length;
    const positiveFeedback = feedbackItems.filter(item => item.feedback === 'positive').length;
    
    // Process common queries, referenced content, and session stats
    
    return {
      commonQueries,
      topReferencedContent,
      feedbackStats: {
        total: totalFeedback,
        positive: positiveFeedback,
        negative: totalFeedback - positiveFeedback,
        percentagePositive: totalFeedback > 0 ? (positiveFeedback / totalFeedback) * 100 : 0
      },
      lastUpdated: Date.now(),
      sessionStats
    };
  } catch (error) {
    logError('Failed to generate analytics', error);
    // Return empty analytics on error
    return {
      commonQueries: [],
      topReferencedContent: [],
      feedbackStats: {
        total: 0,
        positive: 0,
        negative: 0,
        percentagePositive: 0
      },
      lastUpdated: Date.now()
    };
  }
}
```

### Chat Sessions Management

The admin dashboard enables viewing and managing chat sessions:

```typescript
// Chat Sessions List Component (simplified)
function ChatSessionsList() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSessionDetailed | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchByContent, setSearchByContent] = useState(false);
  
  // Fetch sessions on load
  useEffect(() => {
    fetchSessions();
  }, []);
  
  // Handle session search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return fetchSessions();
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/chat-sessions?${searchByContent ? 'content' : 'query'}=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search sessions');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Error searching sessions:', error);
      setError('Failed to search sessions');
    } finally {
      setLoading(false);
    }
  };
  
  // View session details
  const viewSessionDetails = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
      if (!response.ok) throw new Error('Failed to load session details');
      const data = await response.json();
      setSelectedSession(data);
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };
  
  // Render session list and details view
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Session list */}
      <div className="md:col-span-1 bg-white p-4 rounded-lg shadow">
        <div className="mb-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="flex-grow p-2 border rounded"
            />
            <button type="submit" className="p-2 bg-blue-500 text-white rounded">
              <Search className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 flex items-center text-sm">
            <input
              type="checkbox"
              id="searchContent"
              checked={searchByContent}
              onChange={() => setSearchByContent(!searchByContent)}
              className="mr-2"
            />
            <label htmlFor="searchContent">Search in messages content</label>
          </div>
        </div>
        
        {/* Session list */}
        <div className="space-y-2 mt-4">
          {sessions.map(session => (
            <div
              key={session.id}
              className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => viewSessionDetails(session.id)}
            >
              <div className="font-medium">{session.title || 'Untitled Session'}</div>
              <div className="text-sm text-gray-500">
                {formatDate(session.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Session details */}
      {selectedSession && (
        <div className="md:col-span-2 bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">{selectedSession.title || 'Untitled Session'}</h2>
            <button 
              onClick={() => router.push(`/chat?session=${selectedSession.id}`)}
              className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
            >
              Open Chat
            </button>
          </div>
          
          {/* Message thread */}
          <div className="space-y-4 mt-6">
            {selectedSession.messages.map((message, index) => (
              <div key={index} className={`p-3 rounded ${
                message.role === 'user' ? 'bg-blue-50 ml-12' : 'bg-gray-50 mr-12'
              }`}>
                <div className="font-medium text-sm text-gray-600">
                  {message.role === 'user' ? 'User' : 'Assistant'}
                </div>
                <div className="mt-1 whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDate(message.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Security Considerations

The feedback system implements several security measures:

1. **API Authentication**:
   - Admin API endpoints require an API key
   - Development mode has relaxed authentication for easier testing

2. **Input Validation**:
   - All user inputs are validated at both client and server levels
   - Proper error handling for malformed requests

3. **Separation of Concerns**:
   - Public feedback API separates from admin storage API
   - No direct client access to storage mechanisms

4. **Cross-API Communication**:
   - Internal API communication uses secure headers
   - Response sanitization prevents information leakage

### Benefits of the Admin Dashboard

The integrated admin dashboard provides several benefits:

1. **Centralized Management**: Single interface for all administrative tasks
2. **Data-Driven Insights**: Analytics based on real user interactions
3. **Content Optimization**: Identify knowledge gaps and improvement areas
4. **User Satisfaction Tracking**: Monitor feedback trends over time
5. **Debugging & Troubleshooting**: Identify and address issues quickly

### Recent Implementation Updates

We have successfully resolved browser compatibility issues by:

1. **Removing all direct file system dependencies** from client-side code
2. **Creating browser-compatible versions** of core utilities:
   - Updated `utils/errorHandling.ts` to use console logging instead of file logging
   - Modified `utils/config.ts` to use environment variables instead of config files
3. **Implementing proper API-based feedback system** with separation of concerns:
   - Client-side code only makes API calls
   - Server-side code handles data persistence
   - Authentication for admin operations

### Future Enhancements

Planned enhancements to the admin dashboard include:

1. **User Management**: Add/remove users and manage permissions
2. **Advanced Analytics**: More detailed insights and custom reports
3. **Bulk Operations**: Manage multiple sessions or documents at once
4. **Export/Import**: Transfer data between environments
5. **Activity Logging**: Track admin actions for accountability

## Automated Document Tagging with Gemini AI

### Overview

The Sales Knowledge Assistant implements a fully automated document tagging system using Gemini AI. This system eliminates the need for manual tagging by administrators, instead relying on Gemini's advanced AI capabilities to automatically analyze and tag all ingested documents.

### Key Components

```
┌────────────────────────────────────────────────────────────────────┐
│                    Document Ingestion & Tagging Pipeline           │
│                                                                    │
│  ┌──────────────┐   ┌───────────────┐   ┌────────────────────────┐ │
│  │  Document    │──>│  Gemini AI    │──>│  Document with         │ │
│  │  Submission  │   │  Processing   │   │  AI-Generated Metadata │ │
│  └──────────────┘   └───────────────┘   └────────────────────────┘ │
│                                                │                    │
│                                                ▼                    │
│  ┌──────────────┐   ┌───────────────┐   ┌────────────────────────┐ │
│  │  Metadata    │<──│  Admin Review │<──│ Pending Documents Queue │ │
│  │  Preservation│   │  & Approval   │   │                        │ │
│  └──────────────┘   └───────────────┘   └────────────────────────┘ │
│          │                                                          │
│          ▼                                                          │
│  ┌────────────────────┐   ┌───────────────────────────────────────┐│
│  │ Vector Store with  │──>│ Enhanced Search with                  ││
│  │ Tagged Documents   │   │ Category, Technical Level, & Entities ││
│  └────────────────────┘   └───────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

### Automated Tagging Process

1. **Document Submission**
   - Documents can be submitted via various methods (file upload, direct text input, API)
   - Each document is assigned a unique ID and placed in a processing queue

2. **Gemini AI Processing**
   - Enhanced Analysis Mode: Used by default for rich, detailed metadata generation
   - Standard Analysis Mode: Used as fallback if enhanced processing fails
   - Automatic retry mechanism if initial processing fails

3. **AI-Generated Metadata**
   - Primary and secondary categories
   - Technical level (1-10 scale)
   - Industry and function categories
   - Entity extraction (people, companies, products)
   - Keywords and topic identification
   - Summary generation

4. **Admin Review**
   - Admins review documents and AI-generated tags for accuracy and appropriateness
   - Approval process preserves all AI-generated metadata
   - No manual tagging required from administrators

5. **Document Storage**
   - All AI-generated metadata is preserved in the vector store
   - Metadata is structured for optimal searchability

### Implementation Details

**Document Ingestion API (`pages/api/admin/ingest-document.ts`)**

```typescript
// Key aspects of document ingestion workflow with Gemini AI tagging
export default async function handler(req, res) {
  // Extract document text and metadata from request
  const { text, source, existingMetadata, useEnhancedLabeling = true } = req.body;

  // Check for potential content conflicts early
  const { hasConflicts, conflictingDocIds } = await checkForContentConflicts(
    { source, ...(existingMetadata || {}) },
    text
  );

  // Process document with Gemini - always try enhanced processing first
  try {
    // Use enhanced processing with more detailed categories and labels
    const enhancedAnalysis = await processDocumentWithEnhancedLabels(text);
    metadata = convertEnhancedAnalysisToMetadata(enhancedAnalysis);
  } catch (enhancedError) {
    // Fall back to standard processing if enhanced fails
    try {
      const standardAnalysis = await processDocumentWithGemini(text);
      metadata = convertAnalysisToMetadata(standardAnalysis);
    } catch (standardError) {
      // Apply minimal metadata if all processing fails
      metadata = {
        source,
        summary: text.substring(0, 200) + '...',
        primaryCategory: 'general',
        technicalLevel: 2,
        processingFailed: true
      };
    }
  }

  // Add to pending documents queue instead of vector store
  const documentId = await addToPendingDocuments(text, metadata, embedding);

  // Return success with analysis summary and conflict information
  return res.status(200).json({
    success: true,
    documentId,
    requiresApproval: true,
    processingSuccess,
    hasConflicts,
    conflictingDocIds: hasConflicts ? conflictingDocIds : [],
    analysis: analysisSummary
  });
}
```

**Document Approval Workflow (`utils/adminWorkflow.ts`)**

```typescript
// Key aspects of preserving AI-generated metadata during document approval
async function addApprovedDocumentToVectorStore(
  pendingDoc: StoredPendingDocument
): Promise<void> {
  try {
    // Extract document information
    const { id, text, embedding, metadata } = pendingDoc;

    // Create a properly typed metadata object that preserves all Gemini-generated fields
    const enhancedMetadata: Record<string, any> = {
      ...metadata,
      approvedAt: new Date().toISOString()
    };

    // Make sure all category fields are properly structured for search
    if (!enhancedMetadata.category && enhancedMetadata.primaryCategory) {
      enhancedMetadata.category = enhancedMetadata.primaryCategory;
    }

    // Ensure technical level is within range
    if (enhancedMetadata.technicalLevel !== undefined) {
      let techLevel = Number(enhancedMetadata.technicalLevel);
      if (isNaN(techLevel)) {
        techLevel = 5; // Default middle level
      }
      enhancedMetadata.technicalLevel = Math.max(1, Math.min(10, techLevel));
    }

    // Process array fields for better searchability
    const arrayFields = [
      'keywords',
      'secondaryCategories',
      'industryCategories',
      'functionCategories',
      'useCases'
    ];

    // Convert arrays to strings for storage compatibility
    arrayFields.forEach(field => {
      if (Array.isArray(enhancedMetadata[field])) {
        enhancedMetadata[`${field}_str`] = enhancedMetadata[field].join(', ');
      }
    });

    // Create vector store item with final metadata
    const vectorStoreItem: VectorStoreItem = {
      id: id,
      text: text,
      embedding: embedding || [], // Use provided embedding or empty array
      metadata: enhancedMetadata
    };

    // Add item to vector store
    await addToVectorStore(vectorStoreItem);
  } catch (error) {
    logError(`Failed to add approved document ${pendingDoc.id} to vector store`, error);
    throw error;
  }
}
```

### Admin User Interface

The admin interface clearly communicates that document tagging is fully automated and requires only review, not manual tagging:

- **Pending Documents Page**: Features a help panel explaining the automatic tagging process and admin role
- **Document Preview**: Shows all AI-generated tags for easy review
- **Approval Process**: Buttons explicitly labeled as "Approve AI Tags" to emphasize no manual tagging is needed
- **Confirmation Dialog**: Clearly states that approving preserves all AI-generated tags

**Key UI Components (`components/admin/PendingDocuments.tsx`)**

```jsx
// The admin UI emphasizes review rather than manual tagging
<Alert severity="info" className="mb-4">
  <strong>Automatic Document Tagging:</strong> All uploaded documents are automatically tagged by Gemini AI. 
  Your role is to review the document content and AI-generated tags, then either approve or reject.
</Alert>

// Document preview displays all AI-generated metadata for review
<div className="bg-blue-50 p-4 border-b">
  <h3 className="text-lg font-medium text-blue-800">AI-Generated Metadata</h3>
  <p className="text-sm text-gray-600">
    These tags were automatically generated by Gemini AI and determine how this document will be found in searches
  </p>
</div>

// Approval confirmation dialog emphasizes preserving AI-generated tags
<Dialog
  open={dialogState.open}
  onClose={handleCloseDialog}
  title={dialogState.action === 'approve' ? 'Approve Documents with AI Tagging' : 'Reject Documents'}
  actions={dialogActions}
>
  <p className="text-gray-700">
    Are you sure you want to {dialogState.action} {dialogState.documentIds.length} selected document(s)?
    {dialogState.action === 'approve' && " This will process and index them for search using the AI-generated tags."}
    {dialogState.action === 'reject' && " This will remove them from the pending queue."}
  </p>
  {dialogState.action === 'approve' && (
    <Alert severity="info" className="mt-3">
      Documents are automatically tagged by Gemini AI. Approving will accept these AI-generated tags without modification.
    </Alert>
  )}
</Dialog>
```

### Admin Role Documentation

The admin page includes clear documentation about the automated tagging process:

```jsx
// pages/admin/pending-documents.tsx
{helpOpen && (
  <Card className="mb-6 bg-blue-50 border border-blue-200">
    <CardContent>
      <Typography variant="h6" className="font-semibold mb-2">
        Automatic Document Tagging Process
      </Typography>
      
      <Alert severity="info" className="mb-3">
        <strong>All document tagging is fully automated by Gemini AI.</strong> There is no need for manual tagging.
      </Alert>
      
      <div className="mb-4">
        <h3 className="font-medium text-blue-800 mb-2">How Document Processing Works</h3>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>
            <strong>Document Upload:</strong> When a document is uploaded (PDF, text, etc.), it is automatically processed by Gemini AI.
          </li>
          <li>
            <strong>AI Tagging:</strong> Gemini analyzes the document content and automatically assigns tags.
          </li>
          <li>
            <strong>Admin Review:</strong> Your role is to review the document and AI-generated tags for accuracy and appropriateness.
          </li>
          <li>
            <strong>Approval:</strong> When you approve a document, all AI-generated tags are preserved and used for search indexing.
          </li>
        </ol>
      </div>
      
      <div>
        <h3 className="font-medium text-blue-800 mb-2">Your Role as an Admin</h3>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Review, don't tag:</strong> You don't need to manually tag or categorize documents. 
            Your primary role is to review the document and the AI-generated tags to ensure:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The document content is appropriate and relevant for the knowledge base</li>
            <li>The AI-generated tags seem reasonable for the document</li>
            <li>There are no concerning inaccuracies in how the document is classified</li>
          </ul>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

### Automated Metadata Types

The system captures a rich set of metadata through AI analysis:

| Metadata Category | Description | Purpose |
|-------------------|-------------|---------|
| Primary Category | Main topic category | Primary search facet |
| Secondary Categories | Related topics | Additional search facets |
| Technical Level | Score from 1-10 | Filtering for expertise level |
| Industry Categories | Relevant industries | Industry-specific search |
| Function Categories | Business functions | Role-based filtering |
| Use Cases | Application scenarios | Solution-focused search |
| Entities (People) | People mentioned | Entity search and relation mapping |
| Entities (Companies) | Organizations mentioned | Company-specific content |
| Entities (Products) | Products mentioned | Product documentation search |
| Keywords | Important terms | Keyword matching |
| Summary | Document overview | Preview in search results |

### API for Document Approval with Preserved AI Metadata

```typescript
// pages/api/admin/documents/approve.ts
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Process each document
  const approvalPromises = documentIds.map(async (id) => {
    try {
      // Get the document first to confirm it exists
      const pendingDoc = await getPendingDocumentById(id);
      if (!pendingDoc) {
        logError(`Document ${id} not found in pending queue`, null);
        results.failures++;
        return false;
      }

      // Log the metadata that will be preserved
      logInfo(`Approving document ${id} with AI-generated metadata`, { 
        metadataFields: Object.keys(pendingDoc.metadata)
      });
      
      // Approve document - this preserves all AI-generated metadata
      const success = await approveOrRejectDocument(id, {
        approved: true,
        reviewerComments: 'Approved with all AI-generated tags preserved',
        reviewedBy: req.headers['x-user-email'] as string || 'admin'
      });

      if (success) {
        results.documentsProcessed++;
        return true;
      } else {
        results.failures++;
        return false;
      }
    } catch (error) {
      logError(`Failed to approve document ${id}`, error);
      results.failures++;
      return false;
    }
  });

  // Return results with metadata preservation confirmation
  return res.status(results.success ? 200 : 500).json({
    ...results,
    preservedAIMetadata: true
  });
}
```

### Benefits of Automated Tagging

1. **Consistency**: Ensures uniform tagging across all documents
2. **Efficiency**: Eliminates manual tagging work for administrators
3. **Richness**: Captures more metadata than manual tagging would typically provide
4. **Scalability**: Processing scales with document volume without additional human resources
5. **Searchability**: Enhanced metadata improves search precision and recall
6. **Hierarchical Categorization**: Automatic mapping to category hierarchies
7. **Entity Recognition**: Automatic identification of key entities (people, companies, products)
8. **Technical Level Assessment**: Objective assessment of document complexity

### Implementation Improvements

Our implementation includes several key improvements to the document tagging workflow:

1. **Enhanced User Interface**:
   - Clear labeling of all buttons as "Approve AI Tags" instead of just "Approve"
   - Information alerts throughout the interface explaining the automated process
   - Detailed metadata viewer showing all AI-generated tags

2. **Metadata Preservation**:
   - Updated `adminWorkflow.ts` to properly preserve all AI-generated metadata fields
   - Added type handling to ensure compatibility with the vector store
   - Improved processing of array fields for better searchability

3. **Admin Documentation**:
   - Added comprehensive help panel explaining the automated process
   - Clear documentation of the admin's role as reviewer, not tagger
   - Guidance on when to approve or reject documents

4. **API Enhancements**:
   - Updated API endpoints to clearly track preserved metadata
   - Added logging of metadata fields being preserved
   - Improved error handling for failed AI processing

5. **Data Structure Optimization**:
   - Added string versions of array fields for better search compatibility
   - Ensured technical level values are properly normalized
   - Proper JSON handling for complex entity data

### Future Enhancements

Future improvements to the automated tagging system include:

1. **Tag improvement suggestion**: Allow admins to suggest modifications to tags for AI learning
2. **Tag confidence scores**: Display AI confidence in assigned tags to guide review priorities
3. **Category hierarchy learning**: AI learns organization-specific category hierarchies over time
4. **Cross-document relationship detection**: Automatically identify related documents
5. **Automatic version management**: Detect when new documents supersede older information
6. **Continuous learning**: Feedback loop to improve tag accuracy over time
7. **Custom taxonomy integration**: Support for organization-specific classification schemes
8. **Multi-language support**: Extend AI tagging to multiple languages

## Completed Implementation Phases

The Sales Knowledge Assistant has completed several development phases, each adding new capabilities:

### Phase 1: Gemini-Based Document Processing
- ✅ Created Gemini document processor utility
- ✅ Designed comprehensive prompts for document analysis
- ✅ Expanded metadata schema
- ✅ Updated document ingestion workflow

### Phase 2: Enhanced Document Labeling
- ✅ Expanded automatic document labeling capabilities
- ✅ Created more granular topic tagging
- ✅ Enhanced entity recognition
- ✅ Implemented hierarchical classification in search

### Phase 3: Fully Automated Document Tagging
- ✅ Eliminated manual tagging requirements
- ✅ Improved admin workflow
- ✅ Enhanced metadata preservation
- ✅ Added data structure optimization

### Phase 4: Enhanced Conflict Detection
- ✅ Improved conflict detection with Gemini
- ✅ Enhanced admin interfaces for content management

### Phase 5: Improved Search & Hierarchical Navigation
- ✅ Enhanced hybrid search with hierarchical capabilities
- ✅ Optimized existing search parameters
- ✅ Enhanced search result presentation