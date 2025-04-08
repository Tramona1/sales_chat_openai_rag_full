# Smart Context Management with Gemini

## Overview

This document details the implementation of our smart context management system for the Workstream knowledge assistant. The system intelligently handles large contexts by combining token estimation, context summarization, and automatic model routing between OpenAI and Gemini APIs.

## Problem Statement

When retrieving information from our knowledge base, we sometimes encounter documents that are too large for efficient processing by language models. This leads to several issues:

1. **Token Limit Errors**: OpenAI models have context length restrictions (typically 8-16K tokens)
2. **Rate Limiting**: Large contexts can trigger rate limit errors due to high token usage
3. **Cost Inefficiency**: Processing large contexts is expensive, especially with premium models
4. **Response Quality**: Without proper management, truncated or incomplete responses may be returned

Our solution addresses these challenges by implementing intelligent context handling that maintains answer quality while avoiding API limitations.

## Implementation Components

### 1. Token Estimation System

The system includes a lightweight token estimation mechanism that:

- Approximates token counts quickly without API calls
- Identifies when contexts are too large for OpenAI models
- Enables proactive decision-making about model selection
- Supports effective logging and monitoring

```typescript
// Token estimation constants
const AVG_TOKENS_PER_WORD = 1.3; // A rough approximation for token estimation
const MAX_TOKENS_OPENAI = 8000; // Conservative limit for OpenAI (leaving room for response)
const MAX_CONTEXT_LENGTH = 15000; // Maximum context length for any model

/**
 * Estimate tokens in a text string
 * This is a rough estimation, not exact but helpful for preventing API errors
 */
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount * AVG_TOKENS_PER_WORD);
}
```

### 2. Context Summarization with Gemini

For extremely large contexts, the system uses Gemini to create intelligent, query-focused summaries:

- Preserves essential information while reducing token count
- Focuses on information relevant to the user's query
- Creates summaries optimized for the specific question
- Falls back to simple truncation if summarization fails

```typescript
/**
 * Summarize context when it's too large
 * Uses Gemini for efficient summarization
 */
async function summarizeContext(query: string, context: string): Promise<string> {
  try {
    console.log(`Context too large (${estimateTokenCount(context)} tokens), summarizing with Gemini...`);
    
    const systemPrompt = `You are an expert summarizer. Your task is to condense the knowledge from the provided text to answer a specific question. 
Focus on extracting the most relevant information while maintaining accuracy and comprehensiveness.
Include all factual details, specifications, and important points related to the question.`;

    const userPrompt = `Question: ${query}
    
Here is the content to summarize while keeping information relevant to the question:

${context}

Provide a detailed summary that maintains all key information and would allow someone to fully answer the question without needing the original text. 
Make sure to retain specific details like product names, features, pricing, and technical specifications.`;

    const summary = await generateGeminiChatCompletion(systemPrompt, userPrompt);
    console.log(`Successfully summarized context with Gemini. Reduced from ${estimateTokenCount(context)} to approximately ${estimateTokenCount(summary)} tokens`);
    return summary;
  } catch (error) {
    // Fallback to simple truncation if summarization fails
    // ...
  }
}
```

### 3. Intelligent API Routing

The system automatically routes requests between OpenAI and Gemini based on context size:

- Uses OpenAI models for standard contexts (under 8K tokens)
- Automatically switches to Gemini for larger contexts
- Provides fallback handling for token-related errors
- Maintains optimal cost-efficiency without sacrificing quality

### 4. Error Detection and Recovery

The system implements robust error detection specifically for token-related issues:

- Identifies context length exceeded errors
- Detects rate limit errors related to large requests
- Automatically falls back to alternative models
- Provides detailed logging for monitoring and debugging

```typescript
try {
  // Generate the answer using the LLM
  const answerPromise = generateChatCompletion(systemPrompt, userPrompt, model);
  return await Promise.race([answerPromise, timeoutPromise]);
} catch (error) {
  // Check if error is token limit related
  const errorStr = String(error);
  if (errorStr.includes('context_length_exceeded') || 
      errorStr.includes('maximum context length') || 
      errorStr.includes('Request too large') || 
      errorStr.includes('rate_limit_exceeded')) {
    
    console.log('Attempting with fallback model Gemini due to token limits...');
    return await generateGeminiAnswer(query, contextText, {
      includeSourceCitations,
      conversationHistory: options.conversationHistory
    });
  }
  
  // Re-throw other errors
  throw error;
}
```

## How It Works

The context management flow follows these steps:

1. **Retrieval**: When search results are found for a user query, the system retrieves the relevant documents.

2. **Token Estimation**: The system estimates the token count of:
   - The user's query
   - Retrieved documents
   - Conversation history
   - Prompt overhead

3. **Decision Making**: Based on token estimates, the system decides how to proceed:
   - If context size is under OpenAI limits (~8K tokens), use OpenAI for best quality
   - If context size exceeds OpenAI limits but is under 15K tokens, use Gemini directly
   - If context exceeds 15K tokens, use Gemini to summarize before answering

4. **Execution**: The system executes the chosen strategy:
   - For standard contexts: Process directly with OpenAI
   - For large contexts: Process with Gemini
   - For very large contexts: Summarize with Gemini, then process

5. **Error Recovery**: If OpenAI returns token-related errors during processing:
   - The system detects the error type
   - Automatically falls back to Gemini processing
   - Logs the error and fallback for monitoring

## Benefits

This intelligent context management system provides several key benefits:

1. **Enhanced Reliability**: Eliminates token limit errors and provides consistent responses.

2. **Improved Cost Efficiency**: Uses Gemini (much lower cost per token) for large contexts, reducing overall API costs.

3. **Better Answer Quality**: By summarizing rather than truncating, the system maintains information quality even with large contexts.

4. **Optimized User Experience**: Users receive complete, relevant answers without errors or timeouts.

5. **Scalability**: As our knowledge base grows, the system will continue to handle increasingly complex and detailed contexts.

## Logging and Monitoring

The system includes comprehensive logging to track:

- Token usage estimates for each component
- Model selection decisions (OpenAI vs. Gemini)
- Summarization performance metrics
- Error states and recovery actions

Example log output:
```
Estimated tokens: 15653 (Context: 15374, History: 268, Overhead: 11)
Context too large (15653 tokens), applying summarization
Context too large (15374 tokens), summarizing with Gemini...
Successfully summarized context with Gemini. Reduced from 15374 to approximately 64 tokens
Using Gemini for answer generation due to large context (15653 tokens)
```

## Future Improvements

Potential enhancements to consider:

1. **Chunked Processing**: Breaking very large contexts into smaller chunks for parallel processing.

2. **Dynamic Summarization Strategy**: Adjusting summarization approach based on content type.

3. **Token Budgeting**: Allocating token budgets to different parts of the context based on relevance.

4. **Cost Optimization**: Dynamically choosing models based on query complexity, not just context size.

5. **Structured Data Extraction**: For certain query types, extracting structured data before summarization.

## Conclusion

The smart context management system significantly enhances our knowledge assistant's ability to handle complex queries and large contexts. By intelligently routing between models and implementing query-focused summarization, we ensure consistent, high-quality responses while maintaining cost efficiency. 