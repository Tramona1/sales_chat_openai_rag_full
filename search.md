# Deep Dive: Workstream's RAG System and Supabase Integration

## 1. Document Ingestion Process

### Crawling and Data Import

The system starts by reading crawl data from `data/workstream_crawl_data_transformed.json` using the `getCrawlData` function. Each document includes a URL, title, content, and timestamp. The system processes this data line by line to avoid memory issues with large files.

```javascript
// From scripts/rebuildVectorStoreGemini_modified.js
function getCrawlData(logger) {
  logger.info('Reading crawl data...');
  
  if (!fs.existsSync(CRAWL_DATA_FILE)) {
    logger.error(new Error(`Crawl data file not found: ${CRAWL_DATA_FILE}`));
    process.exit(1);
  }
  
  try {
    logger.info(`Reading crawl data from: ${CRAWL_DATA_FILE}`);
    
    // Read file line by line instead of all at once
    const rawData = fs.readFileSync(CRAWL_DATA_FILE, 'utf8');
    const lines = rawData.split('\n');
    
    let docs = [];
    let currentJson = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('{"url"')) {
        // If we have accumulated JSON from previous lines, try to parse it
        if (currentJson.length > 0) {
          try {
            const data = JSON.parse(currentJson);
            docs.push({
              url: data.url,
              title: data.title || data.url,
              content: data.content || '',
              timestamp: data.timestamp
            });
          } catch (e) {
            logger.warning(`Skipping malformed JSON at line ${i-1}: ${e.message}`);
          }
          
          // Reset for the next JSON object
          currentJson = '';
        }
        
        // Start accumulating the new JSON object
        currentJson = line;
      } else if (currentJson.length > 0) {
        // Continue accumulating the current JSON object
        currentJson += line;
      }
    }
    
    // Process the last JSON object if any
    if (currentJson.length > 0) {
      try {
        const data = JSON.parse(currentJson);
        docs.push({
          url: data.url,
          title: data.title || data.url,
          content: data.content || '',
          timestamp: data.timestamp
        });
      } catch (e) {
        logger.warning(`Skipping last malformed JSON: ${e.message}`);
      }
    }
    
    logger.info(`Found ${docs.length} documents in crawl data`);
    return docs;
  } catch (error) {
    logger.error('Error reading crawl data', error);
    process.exit(1);
  }
}
```

### Document Context Extraction

For each document, the `extractDocumentContext` function uses Gemini to analyze text and extract:
- `summary`: A concise summary of the document
- `documentType`: The type of document (blog post, product page, etc.)
- `technicalLevel`: A numeric rating (1-5) of technical complexity
- `mainTopics`: Key topics covered in the document
- `entities`: Important entities mentioned (companies, products, technologies)
- `audienceType`: The target audience for the content

```javascript
// From scripts/rebuildVectorStoreGemini_modified.js
async function extractDocumentContext(text, metadata) {
  try {
    // Use a prompt to extract key information with a structured example
    const model = googleAI.getGenerativeModel({ model: GENERATION_MODEL });
    
    const prompt = `
      Analyze this document and extract the following information in JSON format.
      
      Document content:
      ---
      ${text.substring(0, 4000)}... [truncated]
      ---
      
      Extract and return a properly formatted JSON object with these fields:
      - summary: A brief summary (2-3 sentences)
      - documentType: Document type (e.g., blog post, product page, FAQ, tutorial)
      - technicalLevel: Numeric value 1-5, where 1 is beginner and 5 is expert
      - mainTopics: Array of 3-5 key topics (strings)
      - entities: Array of key entities mentioned (organizations, products, technologies)
      - audienceType: Array of target audiences (e.g., developers, managers, general users)
      
      IMPORTANT: Your response must be a valid, parseable JSON object. Use double quotes for keys and string values. Arrays must be in the format ["item1", "item2"]. Do not include any text before or after the JSON.
      
      Example of expected JSON format:
      {
        "summary": "This document describes features of a product called Workstream.",
        "documentType": "product page",
        "technicalLevel": 2,
        "mainTopics": ["HR software", "hiring", "payroll", "employee management"],
        "entities": ["Workstream", "HR", "Payroll", "ATS"],
        "audienceType": ["HR professionals", "business owners", "recruiters"]
      }
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract the JSON from the response (handling possible additional text)
    let contextData;
    try {
      // Try first as direct JSON
      contextData = JSON.parse(response.trim());
    } catch (parseError) {
      // If direct parsing fails, try to find JSON in the text
      const jsonMatch = response.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          contextData = JSON.parse(jsonMatch[0]);
        } catch (nestedError) {
          // If that also fails, create a basic structure with extracted info
          contextData = extractBasicContext(response, metadata);
        }
      } else {
        // If no JSON found, create a basic structure
        contextData = extractBasicContext(response, metadata);
      }
    }
    
    // Validate and ensure all expected fields exist with proper types
    return {
      summary: typeof contextData.summary === 'string' ? contextData.summary : metadata.title || '',
      documentType: typeof contextData.documentType === 'string' ? contextData.documentType : 'webpage',
      technicalLevel: typeof contextData.technicalLevel === 'number' ? 
        Math.min(Math.max(contextData.technicalLevel, 1), 5) : 3, // Ensure between 1-5
      mainTopics: Array.isArray(contextData.mainTopics) ? 
        contextData.mainTopics : extractTopicsFromText(text, metadata.title),
      entities: Array.isArray(contextData.entities) ? 
        contextData.entities : extractEntitiesFromText(text, metadata.title),
      audienceType: Array.isArray(contextData.audienceType) ? 
        contextData.audienceType : inferAudienceType(text, metadata.title)
    };
  } catch (error) {
    console.error('Error extracting document context:', error);
    // Return backup context if extraction fails
    return generateBackupContext(text, metadata);
  }
}
```

### Chunking Strategy

Each document is split into smaller chunks using the `splitTextIntoChunks` function. The default chunk size is 500 words, which balances context retention with vector database constraints.

```javascript
// From scripts/rebuildVectorStoreGemini_modified.js
function splitTextIntoChunks(text, chunkSize = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const word of words) {
    if (currentSize + word.length + 1 > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      currentSize = word.length;
    } else {
      currentChunk.push(word);
      currentSize += word.length + 1; // +1 for the space
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}
```

### Chunk Enhancement and Storage

Each chunk is enhanced with context using `prepareTextForEmbedding`, and embeddings are generated using the Gemini model:

```javascript
// From scripts/rebuildVectorStoreGemini_modified.js
function prepareTextForEmbedding({ originalText, context }) {
  // Create a contextual prefix that will help the embedding model understand the text better
  let contextualPrefix = "";
  
  if (context && context.document) {
    // Include document-level context if available
    const doc = context.document;
    
    if (doc.summary) {
      contextualPrefix += `Document Summary: ${doc.summary}\n`;
    }
    
    if (doc.documentType) {
      contextualPrefix += `Document Type: ${doc.documentType}\n`;
    }
    
    if (doc.mainTopics && Array.isArray(doc.mainTopics) && doc.mainTopics.length > 0) {
      contextualPrefix += `Topics: ${doc.mainTopics.join(', ')}\n`;
    }
    
    if (doc.entities && Array.isArray(doc.entities) && doc.entities.length > 0) {
      contextualPrefix += `Key Entities: ${doc.entities.join(', ')}\n`;
    }
    
    if (doc.technicalLevel) {
      contextualPrefix += `Technical Level: ${doc.technicalLevel}\n`;
    }
    
    if (doc.audienceType && Array.isArray(doc.audienceType) && doc.audienceType.length > 0) {
      contextualPrefix += `Target Audience: ${doc.audienceType.join(', ')}\n`;
    }
  }
  
  // Combine the contextual prefix with the original text
  // Add a separator to distinguish context from content
  return contextualPrefix ? `${contextualPrefix}\n---\n${originalText}` : originalText;
}

// Embedding generation
async function embedText(text) {
  try {
    const model = googleAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
```

## 2. Search Implementation

### Hybrid Search Architecture

The system uses a sophisticated hybrid search combining vector and keyword search via Supabase functions:

```sql
-- From scripts/update_text_search.sql
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INTEGER DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.7,
  vector_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3,
  filter JSONB DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_id UUID,
  content TEXT,
  text TEXT,
  metadata JSONB,
  vector_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT,
  search_type TEXT
) LANGUAGE plpgsql
AS $$
DECLARE
  processed_query TEXT;
BEGIN
  -- Validate weights
  IF (vector_weight + keyword_weight) <> 1.0 THEN
    RAISE WARNING 'Vector weight (%) and keyword weight (%) must sum to 1.0, adjusting automatically', 
      vector_weight, keyword_weight;
    -- Auto-adjust to ensure they sum to 1.0
    vector_weight := vector_weight / (vector_weight + keyword_weight);
    keyword_weight := 1.0 - vector_weight;
  END IF;

  -- Process query safely
  processed_query := process_search_query(query_text);

  -- Apply metadata filters if provided
  -- Process filters from the filter JSON parameter
  DECLARE
    filter_clauses TEXT := '';
    filter_values TEXT[];
    i INTEGER := 0;
  BEGIN
    IF filter IS NOT NULL AND jsonb_typeof(filter) = 'object' THEN
      -- Extract filter conditions
      IF filter ? 'categories' AND jsonb_typeof(filter->'categories') = 'array' THEN
        filter_clauses := filter_clauses || ' AND metadata->>''category'' IN (SELECT jsonb_array_elements_text($' || (i+1) || '::jsonb))';
        filter_values := filter_values || (filter->'categories')::TEXT;
        i := i + 1;
      END IF;
      
      -- Add more filter types as needed
    END IF;
  END;

  -- Combined results from vector and keyword search
  WITH combined_results AS (
    SELECT 
      COALESCE(v.id, k.id) as id,
      COALESCE(v.document_id, k.document_id) as document_id,
      COALESCE(v.chunk_id, k.chunk_id) as chunk_id,
      COALESCE(v.chunk_index, k.chunk_index) as chunk_index,
      COALESCE(v.content, k.content) as content,
      COALESCE(v.text, k.text) as text,
      COALESCE(v.metadata, k.metadata) as metadata,
      COALESCE(v.similarity, 0) as vector_score,
      COALESCE(k.rank, 0) as keyword_score,
      CASE 
        WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 
          (vector_weight * COALESCE(v.similarity, 0)) + (keyword_weight * COALESCE(k.rank, 0))
        WHEN v.id IS NOT NULL THEN 
          vector_weight * v.similarity
        ELSE 
          keyword_weight * k.rank
      END as combined_score,
      CASE 
        WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 'hybrid'
        WHEN v.id IS NOT NULL THEN 'vector'
        ELSE 'keyword'
      END as search_type
    FROM 
      vector_results v
    FULL OUTER JOIN 
      keyword_results k
    ON 
      v.id = k.id
  )
  SELECT * FROM combined_results
  ORDER BY combined_score DESC
  LIMIT match_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in hybrid_search: %', SQLERRM;
    -- Return empty result set
    RETURN QUERY
    SELECT 
      NULL::UUID as id,
      NULL::UUID as document_id,
      NULL::UUID as chunk_id,
      NULL::TEXT as content,
      NULL::TEXT as text,
      NULL::JSONB as metadata,
      NULL::FLOAT as vector_score,
      NULL::FLOAT as keyword_score,
      NULL::FLOAT as combined_score,
      'error'::TEXT as search_type
    WHERE FALSE;
END;
$$;
```

### Search Implementation in TypeScript

The JavaScript/TypeScript implementation that calls this function:

```typescript
// From utils/supabaseClient.ts
export async function hybridSearch(query: string, limit = 5, threshold = 0.5) {
  try {
    // Get vector embedding for the query using the embedText function from appropriate client
    let embedding;
    try {
      // We'll import the embedText function dynamically to avoid circular dependencies
      const { embedText } = await import('./openaiClient');
      embedding = await embedText(query);
    } catch (error) {
      logError('Error generating embedding for search query', error);
      throw new Error('Failed to generate embedding for search query');
    }

    // Call the hybrid_search function we defined in our Supabase schema
    // with the correct parameter names based on the stored procedure
    const { data, error } = await getSupabaseAdmin().rpc('hybrid_search', {
      query_text: query,
      query_embedding: embedding,
      match_count: limit,
      match_threshold: threshold,
      vector_weight: 0.7,
      keyword_weight: 0.3,
      filter: {} // Empty filter to ensure we use the right overload
    });

    if (error) {
      logError('Supabase hybrid search error', error);
      throw error;
    }

    logDebug(`Hybrid search found ${data?.length || 0} results for query: "${query}"`);
    return data || [];
  } catch (error) {
    logError('Error in hybrid search', error);
    throw error;
  }
}
```

## 3. Chat and Response Generation

### Chat API Implementation

The chat API endpoint processes user messages and generates responses using retrieved context:

```typescript
// From pages/api/chat.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', code: 'method_not_allowed' } });
  }

  try {
    // Extract request parameters
    const { messages, model = 'gemini', sessionId, useAdmin = false, useHybridSearch = true } = req.body;

    // Get the latest user message
    const userMessage = messages[messages.length - 1].content;
    
    // Get relevant documents using Supabase hybrid search
    let retrievedDocuments: SearchResult[] = [];
    try {
      logInfo('Performing hybrid search with Supabase');
      const searchResults = await hybridSearch(userMessage, 30, 0.7);
      logDebug(`Retrieved ${searchResults.length} documents from hybrid search`);
      
      retrievedDocuments = searchResults.map((item: any) => ({
        id: item.id || `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: item.content || '', // Using content field from Supabase
        score: item.similarity,
        metadata: {
          source: item.source || item.title || 'Unknown Source',
          title: item.title || 'Untitled Document',
          ...(item.metadata || {})
        }
      }));
    } catch (error) {
      logError('Error retrieving similar documents:', error);
      return res.status(500).json(standardizeApiErrorResponse({
        message: 'Failed to retrieve relevant documents',
        details: error
      }));
    }

    // Filter and sort documents by relevance
    retrievedDocuments = retrievedDocuments
      .filter(doc => (typeof doc.score === 'number' && doc.score >= SIMILARITY_THRESHOLD) || doc.score === undefined)
      .sort((a, b) => {
        const scoreA = typeof a.score === 'number' ? a.score : 0;
        const scoreB = typeof b.score === 'number' ? b.score : 0;
        return scoreB - scoreA;
      })
      .slice(0, MAX_CONTEXT_DOCS);

    // Format documents for context
    const contextString = retrievedDocuments.map((doc, index) => {
      const source = doc.metadata?.source || 'Unknown Source';
      return `[${index + 1}] ${doc.text}\nSource: ${source}`;
    }).join('\n\n');

    // Generate the completion
    let completion;
    if (model.startsWith('gpt')) {
      completion = await generateOpenAICompletion(messages, systemMessage, model);
    } else {
      completion = await generateGeminiCompletion(messages, systemMessage);
    }

    // Return the result
    return res.status(200).json({
      completion,
      sources: sourceList,
      model
    });
  } catch (error) {
    logError('Error in chat API:', error);
    return res.status(500).json(standardizeApiErrorResponse(error));
  }
}
```

### Gemini Completion

The `generateGeminiCompletion` function formats messages and calls the Gemini API:

```javascript
// From pages/api/chat.ts
function processMessageForGemini(messages: any[], systemMessage: string): string {
  // Combine all messages into a single string for Gemini
  let combinedMessage = systemMessage + "\n\n";
  
  messages.forEach((msg: any, index: number) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    combinedMessage += `${role}: ${msg.content}\n\n`;
  });
  
  return combinedMessage;
}

// Helper function to generate Gemini completion
async function generateGeminiCompletion(messages: any[], systemMessage: string) {
  logInfo('Generating Gemini completion');
  
  // Initialize Google AI
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // Process and format the messages for Gemini
  const formattedMessages = processMessageForGemini(messages, systemMessage);

  // Call the Gemini API
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: formattedMessages }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1500,
    },
  });

  const response = result.response;
  return response.text() || '';
}
```

## 4. Why Leadership Information Is Missing

Despite the About Us page appearing in the database (`ade16135-a490-469f-99ab-70c449aaa39c`), the leadership information isn't being retrieved correctly. Here are the likely reasons:

1. **Chunking Issues**: The leadership section might be split in a way that loses context during chunking. If the leadership information is separated from identifiable headings, chunks may not retain the connection.

2. **Embedding Quality**: The embedding process might not capture the semantic relationship between "CEO" or "leadership" and specific names well enough.

3. **Keyword Mismatch**: If users ask for "CEO" but the page uses terms like "Co-founder" instead, keyword matching might fail.

4. **Insufficient Context Enhancement**: The document context extraction might not properly identify leadership roles as entities.

5. **Query-Document Mismatch**: The specific wording of leadership queries might not match well with how the information is presented in the documents.

## 5. Improvement Recommendations

### Short-term Fixes

1. **Recrawl the About Us Page**: Ensure the About Us page with leadership information is properly crawled and included in the next rebuild.

2. **Adjust Chunking Strategy**: For "About Us" pages, use smaller overlapping chunks to ensure important information isn't split across chunk boundaries:

```javascript
// Modify splitTextIntoChunks function in rebuildVectorStoreGemini_modified.js
function splitTextIntoChunks(text, chunkSize = 500, overlap = 0, documentType = 'general') {
  // For About Us pages, use smaller chunks with greater overlap
  if (documentType === 'about' || documentType === 'team' || documentType === 'leadership') {
    chunkSize = 250;
    overlap = 100;
  }
  
  const words = text.split(/\s+/);
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + chunkSize, words.length);
    chunks.push(words.slice(startIndex, endIndex).join(' '));
    
    // Move start index by chunkSize - overlap for next chunk
    startIndex += chunkSize - overlap;
  }
  
  return chunks;
}
```

3. **Enhanced Metadata**: Explicitly tag leadership information as metadata during ingestion:

```javascript
// Add to processDocument function in rebuildVectorStoreGemini_modified.js
if (url.includes('/about') || title.toLowerCase().includes('about us')) {
  // Extract leadership info from the document text using regex
  const leadershipMatch = documentText.match(/leadership.*?(CEO|Chief Executive Officer|founder).*?([\w\s]+)/is);
  if (leadershipMatch) {
    // Add leadership info to metadata
    documentToInsert.metadata.leadership_info = leadershipMatch[0];
    documentToInsert.metadata.leadership_mentioned = true;
    
    // Try to extract specific leadership roles
    const ceoMatch = documentText.match(/(?:CEO|Chief Executive Officer|co-founder)[\s:]*([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (ceoMatch) {
      documentToInsert.metadata.ceo_name = ceoMatch[1];
    }
  }
}
```

4. **Post-Processing Rule**: Add a special rule in the query processing to prioritize About Us content for leadership queries:

```javascript
// Add to hybridSearch function in utils/hybridSearch.ts
if (query.toLowerCase().includes('ceo') || 
    query.toLowerCase().includes('leadership') ||
    query.toLowerCase().includes('founder')) {
  
  // Add a filter to prioritize About Us pages
  filter.leadership_query = true;
  
  // Adjust vector-keyword weights to favor keyword matches
  vectorWeight = 0.3;
  keywordWeight = 0.7;
  
  // Add a more specific filter to the SQL query
  const { data: aboutUsData, error: aboutUsError } = await getSupabaseAdmin()
    .from('documents')
    .select('id')
    .or('title.ilike.%about%,title.ilike.%team%,title.ilike.%leadership%');
    
  if (!aboutUsError && aboutUsData && aboutUsData.length > 0) {
    // Add a filter to boost results from these documents
    filter.priority_documents = aboutUsData.map(doc => doc.id);
  }
}
```

### Long-term Improvements

1. **Entity Extraction Improvements**: Enhance the `extractDocumentContext` function to better identify people and their roles:

```javascript
// Modify the prompt in extractDocumentContext
const prompt = `
  Analyze this document and extract the following information in JSON format.
  
  Document content:
  ---
  ${text.substring(0, 4000)}... [truncated]
  ---
  
  Extract and return a properly formatted JSON object with these fields:
  - summary: A brief summary (2-3 sentences)
  - documentType: Document type (e.g., blog post, product page, FAQ, tutorial)
  - technicalLevel: Numeric value 1-5, where 1 is beginner and 5 is expert
  - mainTopics: Array of 3-5 key topics (strings)
  - entities: Array of key entities mentioned (organizations, products, technologies)
  - audienceType: Array of target audiences (e.g., developers, managers, general users)
  - leadership: Array of objects with name and role if any leadership team members are mentioned
  
  For the leadership field, identify specific people mentioned with their roles in the company.
  Example "leadership": [{"name": "Desmond Lim", "role": "CEO & Co-founder"}, {"name": "Max Wang", "role": "CTO & Co-founder"}]
  
  IMPORTANT: Your response must be a valid, parseable JSON object.
`;
```

2. **Structured Data Extraction**: For About Us pages, extract structured data about the leadership team:

```javascript
// Add to processDocument function
if (url.includes('/about') || title.toLowerCase().includes('team')) {
  const leadershipData = await extractStructuredLeadership(documentText);
  
  // Add structured leadership data for better searchability
  if (leadershipData && leadershipData.length > 0) {
    documentToInsert.leadership = leadershipData;
    
    // Store leadership info in a separate table for direct querying
    for (const leader of leadershipData) {
      try {
        await supabase.from('leadership').insert({
          name: leader.name,
          role: leader.role,
          document_id: documentId,
          source_url: url
        });
      } catch (leaderError) {
        logger.warning(`Failed to insert leadership data for ${leader.name}`, leaderError);
      }
    }
  }
}

// New function to extract leadership info
async function extractStructuredLeadership(text) {
  const model = googleAI.getGenerativeModel({ model: GENERATION_MODEL });
  
  const prompt = `
    Extract leadership information from this text. 
    Return a JSON array of objects, each with name and role properties.
    
    Text:
    ${text.substring(0, 8000)}
    
    Expected format:
    [
      {"name": "Full Name", "role": "Role Title"},
      {"name": "Another Name", "role": "Another Role"}
    ]
    
    Only include actual leadership team members mentioned in the text.
  `;
  
  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  try {
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to parse leadership data:', error);
    return [];
  }
}
```

3. **Query Intent Classification**: Add intent classification to route leadership queries to a specialized retrieval method:

```javascript
// Add to pages/api/query.ts
function classifyQueryIntent(query) {
  const intents = {
    leadership: /\b(ceo|leadership|executive|founder|team|who.*lead)/i,
    product: /\b(product|feature|capability|how.*work)/i,
    pricing: /\b(price|cost|subscription|plan|payment)/i,
    support: /\b(help|support|assistance|contact)/i,
    general: /.*/
  };
  
  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(query)) {
      return intent;
    }
  }
  
  return 'general';
}

// Then in the handler
const queryIntent = classifyQueryIntent(query);

// Use different search strategies based on intent
if (queryIntent === 'leadership') {
  // First try a direct lookup in the leadership table
  const { data: leadershipData, error: leadershipError } = await supabase
    .from('leadership')
    .select('*')
    .or(`name.ilike.%${query}%,role.ilike.%${query}%`)
    .limit(5);
    
  if (!leadershipError && leadershipData && leadershipData.length > 0) {
    // Use leadership data directly
    searchResults = leadershipData.map(leader => ({
      id: leader.id,
      text: `${leader.name} is the ${leader.role} at Workstream.`,
      score: 0.95,
      metadata: {
        source: 'Leadership Database',
        title: 'Leadership Information'
      }
    }));
  } else {
    // Fall back to specialized leadership search
    searchResults = await performLeadershipSearch(query);
  }
} else {
  // Use standard search for other intents
  searchResults = await hybridSearch(query, searchOptions);
}
```

4. **Domain-Specific Knowledge Base**: Create a separate smaller knowledge base for company-specific information that's always searched first for relevant queries.

```javascript
// Create structured company info for direct lookup
const companyInfo = {
  leadership: {
    CEO: {
      name: "Desmond Lim",
      title: "CEO & Co-founder",
      bio: "Desmond Lim is the CEO and co-founder of Workstream."
    },
    CSO: {
      name: "Lei Xu",
      title: "CSO & Co-founder",
      bio: "Lei Xu is the CSO and co-founder of Workstream."
    },
    CTO: {
      name: "Max Wang", 
      title: "CTO & Co-founder",
      bio: "Max Wang is the CTO and co-founder of Workstream."
    }
  },
  board: [
    {
      name: "Keith Rabois",
      title: "Board Member",
      description: "General Partner at Founders Fund and former COO of Square"
    },
    {
      name: "Jay Simons",
      title: "Board Observer",
      description: "General Partner at BOND and former President of Atlassian"
    }
  ]
};

// Store this in a Supabase table
async function storeCompanyInfo() {
  // Flatten the structure for database storage
  const entries = [];
  
  // Add leadership
  for (const [role, info] of Object.entries(companyInfo.leadership)) {
    entries.push({
      type: 'leadership',
      role: role,
      name: info.name,
      title: info.title,
      description: info.bio
    });
  }
  
  // Add board members
  for (const member of companyInfo.board) {
    entries.push({
      type: 'board',
      role: member.title,
      name: member.name,
      description: member.description
    });
  }
  
  // Store in Supabase
  const { data, error } = await supabase
    .from('company_info')
    .insert(entries);
    
  if (error) {
    console.error('Failed to store company info:', error);
  } else {
    console.log('Company info stored successfully');
  }
}

// Query function for company info
async function getCompanyInfo(category, query) {
  const { data, error } = await supabase
    .from('company_info')
    .select('*')
    .eq('type', category)
    .or(`name.ilike.%${query}%,role.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(10);
    
  if (error) {
    console.error('Failed to get company info:', error);
    return [];
  }
  
  return data;
}
```

By implementing these improvements, your system will better capture, index, and retrieve important company information like leadership details, ensuring users get accurate answers to these fundamental questions.

## 6. Chat Storage in Supabase

The chat system uses Supabase for storing and retrieving conversation history:

```sql
-- From scripts/create_chat_sessions.sql
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL CHECK (session_type IN ('company', 'general')),
  company_name TEXT,
  company_info JSONB,
  title TEXT NOT NULL,
  sales_notes TEXT,
  messages JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sales_rep_id TEXT,
  sales_rep_name TEXT,
  tags TEXT[],
  keywords TEXT[]
);

-- Create indices for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at 
ON chat_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_type 
ON chat_sessions(session_type);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_title_search 
ON chat_sessions USING GIN (to_tsvector('english', title));

CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_name 
ON chat_sessions(company_name);
```

The TypeScript interface for chat sessions:

```typescript
// From utils/supabaseChatStorage.ts
export interface StoredChatSession {
  id: string;
  sessionType: 'company' | 'general';
  companyName?: string;
  companyInfo?: Partial<CompanyInformation>;
  title: string;
  salesNotes?: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
  salesRepId?: string;
  salesRepName?: string;
  tags?: string[];
  keywords?: string[];
}

export interface StoredChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}
```

The system implements CRUD operations for chat sessions:

```typescript
// From utils/supabaseChatStorage.ts
export async function saveChatSession(session: Omit<StoredChatSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
    
    // Extract keywords from messages for better searchability
    const keywords = extractKeywords(session.messages);
    
    // Generate a title if one isn't provided
    const title = session.title || generateSessionTitle(session.messages);
    
    // Prepare the session object for insertion
    const sessionToInsert = {
      session_type: session.sessionType,
      company_name: session.companyName || null,
      company_info: session.companyInfo || null,
      title,
      sales_notes: session.salesNotes || null,
      messages: session.messages,
      sales_rep_id: session.salesRepId || null,
      sales_rep_name: session.salesRepName || null,
      tags: session.tags || [],
      keywords: keywords
    };
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(sessionToInsert)
      .select('id')
      .single();
    
    if (error) {
      console.error('Error saving chat session to Supabase:', error);
      throw error;
    }
    
    return data.id;
  } catch (error) {
    console.error('Error in saveChatSession:', error);
    throw error;
  }
}
```

## 7. Analytics and Performance Monitoring

The system uses Supabase to track search queries, results, and user feedback:

```sql
-- From migrations/analytics_tables.sql
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  event_data JSONB,
  source_page TEXT,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  device_info JSONB
);

CREATE TABLE IF NOT EXISTS search_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT,
  query_text TEXT NOT NULL,
  search_type TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  execution_time_ms INTEGER,
  clicked_results JSONB,
  relevance_feedback JSONB,
  filter_used JSONB,
  company_context TEXT,
  query_category TEXT
);

CREATE TABLE IF NOT EXISTS search_queries_aggregated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_normalized TEXT UNIQUE,
  total_count INTEGER DEFAULT 0,
  successful_count INTEGER DEFAULT 0,
  zero_results_count INTEGER DEFAULT 0,
  avg_result_count FLOAT DEFAULT 0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT,
  query_id UUID REFERENCES search_metrics(id),
  document_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  feedback_category TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

The system automatically tracks events with the `analytics_events` table and aggregates search queries with triggers:

```sql
-- From migrations/fixed_analytics_trigger.sql
CREATE OR REPLACE FUNCTION update_search_queries_aggregated()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO search_queries_aggregated (
        query_normalized, 
        total_count,
        successful_count,
        zero_results_count,
        avg_result_count,
        first_seen,
        last_seen
    ) VALUES (
        LOWER(TRIM(NEW.query_text)),
        1,
        CASE WHEN NEW.result_count > 0 THEN 1 ELSE 0 END,
        CASE WHEN NEW.result_count = 0 THEN 1 ELSE 0 END,
        NEW.result_count,
        NEW.timestamp,
        NEW.timestamp
    )
    ON CONFLICT (query_normalized) DO UPDATE SET
        total_count = search_queries_aggregated.total_count + 1,
        successful_count = search_queries_aggregated.successful_count + 
            CASE WHEN NEW.result_count > 0 THEN 1 ELSE 0 END,
        zero_results_count = search_queries_aggregated.zero_results_count + 
            CASE WHEN NEW.result_count = 0 THEN 1 ELSE 0 END,
        avg_result_count = (search_queries_aggregated.avg_result_count * 
            search_queries_aggregated.total_count + NEW.result_count) / 
            (search_queries_aggregated.total_count + 1),
        last_seen = NEW.timestamp;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_search_queries_aggregated_trigger
AFTER INSERT ON search_metrics
FOR EACH ROW
EXECUTE FUNCTION update_search_queries_aggregated();
```

API endpoints provide access to analytics data:

```typescript
// From pages/api/analytics/reports/top-searches.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Parse query parameters
    const { start, end, limit = 10 } = req.query;
    
    // Validate required parameters
    if (!start || !end) {
      return res.status(400).json({ error: 'Missing required query parameters: start and end' });
    }

    // Create Supabase client
    const supabase = createServiceClient();

    // Use the top_searches view to get data
    const { data, error } = await supabase
      .from('v_top_searches')
      .select('*')
      .limit(parseInt(limit as string, 10) || 10);

    if (error) {
      console.error('Error fetching top searches:', error);
      return res.status(500).json({ error: 'Failed to fetch top searches' });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Error in top-searches API:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
```

Frontend components allow users to provide feedback on search results:

```typescript
// From components/enhanced-tracking/ChatFeedback.tsx
const handleFeedback = async (type: 'positive' | 'negative') => {
  setFeedbackSubmitted(type);
  
  try {
    // Record the feedback
    await trackFeedback({
      user_id: userId,
      session_id: sessionId,
      rating: type === 'positive' ? 5 : 1,
      feedback_category: type === 'positive' ? 'helpful' : 'not_helpful',
      feedback_text: detailedFeedback
    });
    
    // Call the callback if provided
    if (onFeedbackSubmitted) {
      onFeedbackSubmitted(type);
    }
    
    // Show success message
    setFeedbackMessage('Thank you for your feedback!');
    setTimeout(() => setFeedbackMessage(''), 3000);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    setFeedbackMessage('Failed to submit feedback. Please try again.');
  }
};
```

## 8. Multi-Modal Search Capabilities

The system supports multi-modal search including images, charts, and tables:

```typescript
// From utils/visualStorageManager.ts
export interface VisualMetadata {
  id: string;
  originalFilename: string;
  filePath: string;
  mimeType: string;
  type: VisualType | string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
  description?: string;
  extractedText?: string;
  thumbnailPath?: string;
  uploadedAt: string;
  associatedDocumentId?: string;
  pageNumber?: number;
  figureNumber?: number;
  hasBeenAnalyzed: boolean;
  analysisResults?: {
    detectedType?: string;
    description?: string;
    extractedText?: string;
    structuredData?: any;
  };
  contextualMetadata?: {
    documentContext: string;
    chunkContext: string;
  };
}
```

Images are analyzed using the Gemini Vision model:

```typescript
// From utils/imageAnalysis/imageAnalyzer.ts
export class ImageAnalyzer {
  private visionModel!: GenerativeModel;
  private apiKey: string;
  private isInitialized: boolean = false;

  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY || '';
  }

  private initializeModel() {
    if (this.isInitialized) return;
    
    const genAI = new GoogleGenerativeAI(this.apiKey);
    this.visionModel = genAI.getGenerativeModel({
      model: "gemini-pro-vision"
    });
    
    this.isInitialized = true;
  }

  public async analyze(
    imageBuffer: Buffer, 
    pageNumber: number,
    contextHints?: string
  ): Promise<AnalyzedVisualElement> {
    this.initializeModel();
    
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    
    // Prepare the prompt
    const prompt = `
      Analyze this image in detail and provide the following information:
      1. Describe what the image shows
      2. If it's a chart, table, or diagram, extract its key data points
      3. Identify any text visible in the image
      4. Determine what type of visual this is (chart, table, diagram, screenshot, etc.)
      
      ${contextHints ? `Additional context about this image: ${contextHints}` : ''}
    `;
    
    try {
      // Call Gemini Vision API
      const result = await this.visionModel.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg"
          }
        }
      ]);
      
      const response = await result.response;
      const responseText = response.text();
      
      // Extract structured info from the response
      return {
        pageNumber,
        contentDescription: extractDescription(responseText),
        visualType: this.validateVisualType(extractVisualType(responseText)),
        detectedText: extractText(responseText),
        structuredData: this.extractStructuredData(responseText),
        confidence: 0.95 // Default confidence
      };
    } catch (error) {
      console.error("Error analyzing image:", error);
      
      // Return basic info on error
      return {
        pageNumber,
        contentDescription: "Error analyzing image",
        visualType: "image",
        detectedText: "",
        confidence: 0.1
      };
    }
  }
}
```

## 9. Company Information Cache

The system uses Supabase to cache company information retrieved from the Perplexity API:

```sql
-- From scripts/create_company_cache_table.sql
CREATE TABLE IF NOT EXISTS company_information_cache (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create an index on expires_at for faster cache cleanup
CREATE INDEX IF NOT EXISTS idx_company_information_cache_expires_at 
ON company_information_cache(expires_at);
```

The `perplexityClient.ts` utility manages fetching and caching company information:

```typescript
// From utils/perplexityClient.ts
export async function getCompanyInformation(
  companyName: string,
  options: {
    forceRefresh?: boolean;
    searchMode?: 'low' | 'medium' | 'high';
  } = {}
): Promise<CompanyInformation> {
  const { forceRefresh = false, searchMode = 'medium' } = options;
  
  if (!isPerplexityEnabled()) {
    return getPlaceholderCompanyInfo(companyName);
  }
  
  try {
    // Generate a cache key
    const cacheKey = encodeURIComponent(companyName.toLowerCase().trim());
    
    // Check if we have this info cached and it's not expired
    if (!forceRefresh) {
      const { data: cachedData, error: cacheError } = await getSupabaseAdmin()
        .from('company_information_cache')
        .select('data, expires_at')
        .eq('id', cacheKey)
        .single();
      
      if (!cacheError && cachedData && new Date(cachedData.expires_at) > new Date()) {
        logInfo(`Using cached company info for ${companyName}`);
        return cachedData.data as CompanyInformation;
      }
    }
    
    // No valid cache entry, fetch from Perplexity
    logInfo(`Fetching company info for ${companyName} from Perplexity API`);
    
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('Perplexity API key not configured');
    }
    
    // Call Perplexity API to get company information
    const companyInfo = await fetchCompanyInfoFromPerplexity(companyName, searchMode);
    
    // Cache the result in Supabase
    const cacheHours = parseInt(process.env.PERPLEXITY_CACHE_HOURS || '24', 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + cacheHours);
    
    await getSupabaseAdmin()
      .from('company_information_cache')
      .upsert({
        id: cacheKey,
        data: companyInfo,
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'id'
      });
    
    return companyInfo;
  } catch (error) {
    logError(`Error fetching company information for ${companyName}:`, error);
    
    // Return a placeholder on error
    return {
      companyInfo: `Unable to retrieve information about ${companyName} at this time.`,
      citations: [],
      lastUpdated: new Date(),
      isRateLimited: error.message?.includes('rate limit') || false
    };
  }
}
```

The Perplexity cache enhances the conversational capabilities by providing rich company information for sales-focused conversations.

## 10. Complete System Architecture

The complete RAG system architecture involves:

1. **Document Processing Pipeline**:
   - Document ingestion, chunking, and context extraction
   - Embedding generation with Gemini or OpenAI
   - Storage in Supabase's vector database

2. **Search System**:
   - Hybrid vector and keyword search via Supabase functions
   - Multi-modal search capabilities for visual content
   - Query analysis and intent classification

3. **Chat System**:
   - Session management and storage in Supabase
   - Context-aware response generation with Gemini or OpenAI
   - Company information augmentation via Perplexity API

4. **Analytics and Feedback**:
   - Search metrics tracking and aggregation
   - User feedback collection and analysis
   - Performance monitoring and optimization

5. **Metadata Services**:
   - Entity extraction and categorization
   - Technical level assessment
   - Structured data extraction from visuals

All these components are integrated through Supabase tables, functions, and APIs to provide a cohesive, powerful RAG system for sales enablement.

## 11. Current Issues and Root Cause Analysis

### The CEO Information Problem

Despite having a robust RAG system, we're encountering a persistent issue: users asking about the CEO or leadership team aren't receiving accurate information, even though this information exists in the About Us page that has been crawled and indexed. This section analyzes why this happens and proposes targeted solutions.

### Root Cause Analysis

After examining the system architecture and implementation, several interconnected issues contribute to this problem:

1. **Semantic Disconnection in Chunking**: The most likely root cause is that our chunking strategy inadvertently separates leadership names from their roles. When the About Us page is split into chunks of 500 words, the title "CEO" might appear in one chunk while the name "Desmond Lim" appears in another. Since each chunk is embedded separately, the semantic connection between the role and name is lost.

2. **Retrieval Bias in Vector Search**: The current vector search implementation has a bias toward topical similarity rather than entity recognition. When a user asks "Who is the CEO?", the vector search finds chunks containing the term "CEO" but may not retrieve chunks containing the actual CEO's name if they're not in the same context.

3. **Metadata Extraction Limitations**: Our `extractDocumentContext` function isn't specifically optimized to identify and extract leadership information as distinct metadata. Examining the function shows it extracts general entities but doesn't have special handling for leadership roles:

```javascript
// Current entity extraction doesn't prioritize leadership info
entities: Array.isArray(contextData.entities) ? 
  contextData.entities : extractEntitiesFromText(text, metadata.title)
```

4. **Suboptimal SQL Function Parameters**: The `hybrid_search` SQL function uses a default ratio of 0.7 for vector weight and 0.3 for keyword weight, which may not be optimal for retrieving specific named entities:

```sql
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INTEGER DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.7,
  vector_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3,
  filter JSONB DEFAULT NULL
)
```

5. **Query Understanding Gap**: The current system doesn't have specialized handling for leadership queries. When it encounters a query like "Who is the CEO?", it doesn't recognize this as a special type of query that should trigger entity-focused retrieval.

### Tactical Solutions and Implementation

#### 1. Specialized Leadership Information Store

The most direct solution is to create a dedicated table for leadership information that doesn't rely on vector search:

```sql
CREATE TABLE IF NOT EXISTS leadership_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  contact_info JSONB,
  social_links JSONB,
  image_url TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indices for fast lookups
CREATE INDEX idx_leadership_info_role ON leadership_info USING gin (to_tsvector('english', role));
CREATE INDEX idx_leadership_info_name ON leadership_info USING gin (to_tsvector('english', name));
```

Populate this table with known leadership information:

```javascript
// In scripts/seed_leadership_data.js
const leadershipData = [
  {
    name: "Desmond Lim",
    role: "CEO & Co-founder",
    bio: "Desmond Lim is the CEO and co-founder of Workstream...",
    department: "Executive",
    social_links: {
      linkedin: "https://www.linkedin.com/in/desmondlim/",
      twitter: "https://twitter.com/desmondlim"
    }
  },
  {
    name: "Lei Xu",
    role: "CSO & Co-founder",
    bio: "Lei Xu is the CSO and co-founder of Workstream...",
    department: "Executive",
    social_links: {
      linkedin: "https://www.linkedin.com/in/leixu/"
    }
  },
  {
    name: "Max Wang",
    role: "CTO & Co-founder",
    bio: "Max Wang is the CTO and co-founder of Workstream...",
    department: "Engineering",
    social_links: {
      linkedin: "https://www.linkedin.com/in/maxwang/"
    }
  }
];

// Insert into Supabase
async function seedLeadershipData() {
  try {
    const { data, error } = await supabase
      .from('leadership_info')
      .upsert(leadershipData, { onConflict: 'role,name' });
      
    if (error) throw error;
    console.log('Leadership data inserted successfully');
  } catch (error) {
    console.error('Error seeding leadership data:', error);
  }
}

seedLeadershipData();
```

#### 2. Query Intent Classification and Router

Implement a focused intent detection for leadership queries:

```typescript
// In utils/queryClassification.ts
export function isLeadershipQuery(query: string): boolean {
  const leadershipPatterns = [
    /who\s+is\s+(?:the\s+)?(?:ceo|chief\s+executive\s+officer)/i,
    /who\s+(?:leads|runs|manages|founded)/i,
    /(?:ceo|chief\s+executive|leadership|founder|co-founder)/i,
    /(?:executive|management)\s+team/i
  ];
  
  return leadershipPatterns.some(pattern => pattern.test(query));
}

// In pages/api/query.ts - modify the handler
if (isLeadershipQuery(query)) {
  // Direct database lookup for leadership information
  const { data: leadershipData, error } = await supabase
    .from('leadership_info')
    .select('*');
    
  if (!error && leadershipData?.length > 0) {
    // Format leadership data as search results
    const formattedResults = leadershipData.map(leader => ({
      id: leader.id,
      title: `${leader.name} - ${leader.role}`,
      text: leader.bio || `${leader.name} is the ${leader.role} at Workstream.`,
      source: 'Leadership Database',
      score: 0.99, // High confidence for direct lookups
      metadata: {
        name: leader.name,
        role: leader.role,
        department: leader.department,
        socialLinks: leader.social_links
      }
    }));
    
    return res.status(200).json({
      results: formattedResults,
      query,
      executionTimeMs: Date.now() - startTime
    });
  }
  
  // If no direct match, continue with specialized leadership search
  // ...rest of the search logic
}
```

#### 3. Overhaul the Chunking Strategy for About Us Pages

Implement a specialized chunking strategy for About Us pages:

```javascript
// In scripts/rebuildVectorStoreGemini_modified.js
function splitTextIntoChunks(text, metadata) {
  // Default chunking for most pages
  const defaultChunkSize = 500;
  const defaultOverlap = 50;
  
  // Special chunking for About Us and leadership pages
  let chunkSize = defaultChunkSize;
  let overlap = defaultOverlap;
  
  // Check if this is an About Us or leadership-related page
  const isAboutPage = (
    metadata.url?.toLowerCase().includes('/about') ||
    metadata.title?.toLowerCase().includes('about') ||
    metadata.title?.toLowerCase().includes('team') ||
    metadata.title?.toLowerCase().includes('leadership')
  );
  
  if (isAboutPage) {
    // Use smaller chunks with greater overlap for About pages
    chunkSize = 200;
    overlap = 100;
    console.log(`Using specialized chunking for About page: ${metadata.url}`);
  }
  
  // Perform the chunking
  const words = text.split(/\s+/);
  const chunks = [];
  
  for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
    const end = Math.min(i + chunkSize, words.length);
    chunks.push(words.slice(i, end).join(' '));
  }
  
  return chunks;
}
```

#### 4. Enhanced Entity Extraction for Leadership

Modify the document context extraction to specifically identify leadership information:

```javascript
// In scripts/rebuildVectorStoreGemini_modified.js
async function extractDocumentContext(text, metadata) {
  try {
    // Existing code...
    
    // Add specific leadership extraction to the prompt
    const prompt = `
      Analyze this document and extract the following information in JSON format.
      
      Document content:
      ---
      ${text.substring(0, 4000)}... [truncated]
      ---
      
      Extract and return a properly formatted JSON object with these fields:
      - summary: A brief summary (2-3 sentences)
      - documentType: Document type (e.g., blog post, product page, FAQ, tutorial)
      - technicalLevel: Numeric value 1-5, where 1 is beginner and 5 is expert
      - mainTopics: Array of 3-5 key topics (strings)
      - entities: Array of key entities mentioned (organizations, products, technologies)
      - audienceType: Array of target audiences (e.g., developers, managers, general users)
      - leadership: Array of objects with name and role if any leadership team members are mentioned
      
      For the leadership field, identify specific people mentioned with their roles in the company.
      Example "leadership": [{"name": "Desmond Lim", "role": "CEO & Co-founder"}, {"name": "Max Wang", "role": "CTO & Co-founder"}]
      
      IMPORTANT: Your response must be a valid, parseable JSON object.
    `;
    
    // Process the result and extract leadership information
    contextData.leadership = Array.isArray(contextData.leadership) ? 
      contextData.leadership : extractLeadershipFromText(text, metadata.title);
      
    // If this is an About page and we found leadership info, save it to the leadership_info table
    if (contextData.leadership && contextData.leadership.length > 0 && 
        (metadata.url?.includes('/about') || metadata.title?.toLowerCase().includes('about'))) {
      try {
        for (const leader of contextData.leadership) {
          await supabase.from('leadership_info').upsert({
            name: leader.name,
            role: leader.role,
            bio: `${leader.name} is the ${leader.role} at Workstream.`,
            department: guessLeadershipDepartment(leader.role)
          }, { onConflict: 'name' });
        }
        console.log(`Saved ${contextData.leadership.length} leadership records from ${metadata.url || metadata.title}`);
      } catch (leadershipError) {
        console.error('Error saving leadership data:', leadershipError);
      }
    }
    
    // Continue with existing code...
  } catch (error) {
    console.error('Error extracting document context:', error);
    // Return backup context if extraction fails
    return generateBackupContext(text, metadata);
  }
}

function extractLeadershipFromText(text, title = '') {
  // Simple extraction of leadership information using regex patterns
  const leadership = [];
  
  // Look for CEO pattern
  const ceoPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\s+is|\s*,)?\s+(?:the\s+)?(?:CEO|Chief\s+Executive\s+Officer|Co-founder|Founder)/i;
  const ceoMatch = text.match(ceoPattern);
  if (ceoMatch) {
    leadership.push({
      name: ceoMatch[1].trim(),
      role: "CEO"
    });
  }
  
  // Look for other executive roles (CTO, CFO, etc.)
  const executivePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\s+is|\s*,)?\s+(?:the\s+)?(CTO|CFO|COO|CSO|CMO|Chief\s+[A-Za-z]+\s+Officer)/i;
  const execMatches = [...text.matchAll(new RegExp(executivePattern, 'gi'))];
  for (const match of execMatches) {
    leadership.push({
      name: match[1].trim(),
      role: match[2].trim()
    });
  }
  
  return leadership;
}

function guessLeadershipDepartment(role) {
  if (role.includes('CEO') || role.includes('Chief Executive') || role.includes('Founder')) {
    return 'Executive';
  } else if (role.includes('CTO') || role.includes('Chief Technology') || role.includes('Engineering')) {
    return 'Engineering';
  } else if (role.includes('CFO') || role.includes('Chief Financial') || role.includes('Finance')) {
    return 'Finance';
  } else if (role.includes('CMO') || role.includes('Chief Marketing') || role.includes('Marketing')) {
    return 'Marketing';
  } else if (role.includes('CSO') || role.includes('Sales')) {
    return 'Sales';
  } else if (role.includes('COO') || role.includes('Operations')) {
    return 'Operations';
  } else {
    return 'Leadership';
  }
}
```

#### 5. Adjusting Query Processing for Leadership Questions

Modify the hybrid search to adapt weights for leadership queries:

```typescript
// In utils/supabaseClient.ts - modify the hybridSearch function
export async function hybridSearch(query: string, limit = 5, threshold = 0.5) {
  try {
    // Detect if this is a leadership query
    const isLeadershipQuery = /\b(ceo|chief|executive|founder|leadership|team)\b/i.test(query);
    
    // Adjust weights for leadership queries to prioritize keyword matches
    const vectorWeight = isLeadershipQuery ? 0.3 : 0.7;
    const keywordWeight = isLeadershipQuery ? 0.7 : 0.3;
    
    // Log the adjustment
    if (isLeadershipQuery) {
      logInfo(`Leadership query detected: "${query}". Adjusting search weights to prioritize keywords.`);
    }
    
    // Generate embedding
    let embedding;
    try {
      const { embedText } = await import('./openaiClient');
      embedding = await embedText(query);
    } catch (error) {
      logError('Error generating embedding for search query', error);
      throw new Error('Failed to generate embedding for search query');
    }

    // Call hybrid_search with appropriate weights
    const { data, error } = await getSupabaseAdmin().rpc('hybrid_search', {
      query_text: query,
      query_embedding: embedding,
      match_count: limit,
      match_threshold: threshold,
      vector_weight: vectorWeight,
      keyword_weight: keywordWeight,
      filter: isLeadershipQuery ? { prioritizeAboutPages: true } : {}
    });

    if (error) {
      logError('Supabase hybrid search error', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logError('Error in hybrid search', error);
    throw error;
  }
}
```

### The Problem with Entity Retrieval in RAG Systems

The difficulty in retrieving leadership information highlights a fundamental limitation in many RAG systems: **embeddings are optimized for semantic similarity but not entity recall**. 

When chunking documents, we create a trade-off:
- **Larger chunks** preserve more context but dilute the embedding representation
- **Smaller chunks** create more focused embeddings but may break important relationships

This is particularly problematic for entity-centric queries like "Who is the CEO?" where the user expects precise factual information rather than topically similar content.

### Long-term Architectural Solutions

To fundamentally solve these issues, a multi-faceted approach is needed:

1. **Implement Entity Extraction Pipeline**: Create a separate processing pipeline that extracts named entities and their relationships during ingestion, storing them in a structured database for direct lookup.

2. **Hybrid Architecture**: Develop an intent classifier that routes entity-centric questions to structured data lookups, while routing conceptual questions to the RAG system.

3. **Entity-enriched Embeddings**: Modify the embedding process to explicitly encode entity information in the embedding space, making entity-centric retrieval more accurate.

4. **Two-Stage Retrieval**: Implement a two-stage retrieval process where the RAG system first retrieves relevant chunks, then a second system extracts precise entity information from those chunks.

By implementing these changes, the system will be able to handle both conceptual queries ("How does the hiring process work?") and entity-centric queries ("Who is the CEO?") effectively, providing users with accurate information regardless of query type.
