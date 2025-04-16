/**
 * Answer generation utility for the RAG system
 * Generates accurate answers from search results using the OpenAI API
 * With fallback to Gemini for handling large contexts
 */

import { logError, logInfo, logWarning, logDebug, logApiCall } from './logger';
import { generateGeminiChatCompletion } from './geminiClient';
import { AI_SETTINGS } from './modelConfig';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getModelForTask } from './modelConfig';
import { recordMetric } from './performanceMonitoring';
import { getGeminiClient } from './geminiClient';

/**
 * Interface for search result items that will be passed to the answer generator
 */
export interface SearchResultItem {
  text: string;
  source?: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
}

// Token estimation constants
const AVG_TOKENS_PER_WORD = 1.3; // A rough approximation for token estimation
const MAX_TOKENS_OPENAI = 8000; // Conservative limit for OpenAI (leaving room for response)
const MAX_CONTEXT_LENGTH = 60000; // Increased maximum context length for Gemini 2.0 Flash

/**
 * Estimate tokens in a text string
 * This is a rough estimation, not exact but helpful for preventing API errors
 */
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount * AVG_TOKENS_PER_WORD);
}

/**
 * Check if the query is a common greeting or conversational input with no information need
 * Using a much more restrictive list to ensure we search documents for most queries
 */
function isBasicConversational(query: string): boolean {
  const conversationalPatterns = [
    // Basic greetings
    'hello', 'hi', 'hey', 'greetings', 'howdy', 'hola', 'yo', 'sup', 
    'good morning', 'good afternoon', 'good evening', 'morning', 'afternoon', 'evening',
    // Simple gratitude
    'thanks', 'thank you', 'thx', 'ty',
    // Basic farewells
    'bye', 'goodbye', 'see you', 'cya',
    // Very short, vague responses
    'ok', 'okay', 'k', 'hmm', 'um', 'uh', 'eh',
    'not sure', 'dunno', 'don\'t know', 'idk', 
    'maybe', 'perhaps', 'possibly',
    'cool', 'nice', 'great', 'awesome', 'sounds good'
  ];
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Match exact greetings or very simple patterns
  if (conversationalPatterns.some(pattern => 
    lowerQuery === pattern || 
    lowerQuery === pattern + '!' ||
    lowerQuery === pattern + '.' ||
    lowerQuery === pattern + '?')) {
    return true;
  }
  
  // Check for very short queries (1-2 words) that are likely not substantive questions
  const wordCount = lowerQuery.split(/\s+/).length;
  if (wordCount <= 2 && lowerQuery.length < 12) {
    return true;
  }
  
  return false;
}

/**
 * Handle simple conversational queries that don't need knowledge base
 */
async function handleConversationalQuery(
  query: string, 
  conversationHistory?: string | Array<{role: string; content: string}>
): Promise<string> {
  const systemPrompt = `
You are a helpful, professional AI assistant supporting the sales team at Workstream, a company providing HR, Payroll, and Hiring solutions for the hourly workforce.

Your responses should be friendly, engaging, and conversational. For short or vague queries, provide a helpful, friendly response that encourages more specific questions about Workstream's products and services.

Remember:
- Be concise but helpful
- Maintain a friendly, conversational tone
- Gently guide the conversation toward Workstream's products/services without being pushy
- If the user seems unsure, offer some suggestions for topics they might want to learn about`;

  // Process conversation history to a string format if provided
  const historyText = conversationHistory ? formatConversationHistory(conversationHistory) : '';
  
  let userPrompt = query;
  if (historyText) {
    userPrompt = `Previous conversation:\n${historyText}\n\nCurrent message: ${query}`;
  }
  
  try {
    return await generateGeminiChatCompletion(systemPrompt, userPrompt);
  } catch (error) {
    logError('Error generating conversational response with Gemini', error);
    
    // Provide different fallback responses based on query type
    const lowerQuery = query.toLowerCase().trim();
    
    if (lowerQuery.match(/^(hi|hey|hello|howdy|sup|yo)/)) {
      return "Hi there! I'm the Workstream assistant. How can I help you learn about our HR, hiring, and payroll solutions for hourly workers today?";
    } else if (lowerQuery.match(/^(not sure|idk|don't know|dunno)/)) {
      return "No problem! I can help with information about Workstream's products like Text-to-Apply for hiring, our onboarding platform, payroll solutions, and more. What specific area would you like to explore?";
    } else {
      return "I'm here to help with any questions about Workstream's HR, hiring, and payroll solutions. Would you like to learn about specific products, features, or how we help businesses with hourly workers?";
    }
  }
}

/**
 * Summarize context when it's too large
 * Uses Gemini for efficient summarization
 */
async function summarizeContext(query: string, context: string): Promise<string> {
  try {
    console.log(`Context too large (${estimateTokenCount(context)} tokens), summarizing with Gemini...`);
    
    const systemPrompt = `
You are a summarization expert for Workstream, an HR, Payroll, and Hiring platform for the hourly workforce.

Your job is to condense the provided context into a clean, helpful summary that allows someone to accurately answer a user's question.

Always:
- Focus only on what's relevant to the question.
- Avoid speculation. Prioritize factual information.
- Maintain Workstream's tone: confident, concise, and clear.
- Speak from our perspective using "we", "our", or "us" where appropriate.`;

    const userPrompt = `Question: ${query}
    
Here is the content to summarize while keeping information relevant to the question:

${context}

Provide a detailed summary that maintains all key information and would allow someone to fully answer the question without needing the original text. 
Remember to maintain the company's voice - when using "our," "we," or "us," speak from Workstream's perspective.`;

    // Log before the call
    logDebug('[API AnswerGen] Calling Gemini for context summarization');
    const summary = await generateGeminiChatCompletion(systemPrompt, userPrompt);
    logInfo('[API AnswerGen] Gemini Context Summarization Success');

    console.log(`Successfully summarized context with Gemini. Reduced from ${estimateTokenCount(context)} to approximately ${estimateTokenCount(summary)} tokens`);
    return summary;
  } catch (error) {
    logError('[API AnswerGen] Gemini Context Summarization Error', { error: error instanceof Error ? error.message : String(error) });
    logError('Error summarizing context with Gemini', error);
    // If summarization fails, we'll need to truncate instead
    console.log('Falling back to simple truncation for context');
    // Take first part of each context item to fit within limits
    const contextItems = context.split('\n\n');
    let truncatedContext = '';
    const maxCharsPerItem = Math.floor(8000 / contextItems.length);
    
    for (const item of contextItems) {
      truncatedContext += item.substring(0, maxCharsPerItem) + '\n\n';
    }
    
    return truncatedContext;
  }
}

/**
 * Generate an answer using Gemini based on the query and context.
 * Includes retry logic and timeout.
 */
async function generateGeminiAnswer(
  query: string, 
  contextText: string, 
  options: {
    systemPrompt?: string;
    includeSourceCitations?: boolean;
    conversationHistory?: string | Array<{role: string; content: string}>;
    model?: string;
    timeout?: number;
  } = {}
): Promise<string> {
  const modelInfo = getModelForTask(AI_SETTINGS, 'chat');
  const modelName = options.model || (typeof modelInfo === 'string' ? modelInfo : modelInfo.model);
  const timeout = options.timeout || 30000;
  const maxRetries = 2;
  let attempt = 0;

  const conversationHistoryStr = formatConversationHistory(options.conversationHistory);

  const systemPrompt = options.systemPrompt || "You are a helpful assistant.";
  const citationsInstruction = options.includeSourceCitations 
    ? "Cite relevant source documents using [number] notation (e.g., [1], [2])."
    : "Do not include source citations.";

  // <<< USER PROMPT ENHANCEMENT >>>
  const userDirective = "\n\nStrict Instructions: Answer based strictly on the provided context. List all specific names requested if they appear in the text."

  // <<< PROMPT CONSTRUCTION & LOGGING >>>
  const prompt = `
${systemPrompt}

${citationsInstruction}

${conversationHistoryStr ? `Previous conversation:\n${conversationHistoryStr}\n` : ''}
Context:
${contextText}

Query: ${query}
${userDirective}

Answer:
`;

  // <<< LOG THE FULL PROMPT >>>
  logDebug(`[generateGeminiAnswer] Final prompt being sent to model (${modelName}):\n--- START PROMPT ---\n${prompt}\n--- END PROMPT ---`);

  while (attempt <= maxRetries) {
    attempt++;
    const apiCallStartTime = Date.now();
    try {
      // Use the getGeminiClient utility to ensure proper API key handling
      const genAI = getGeminiClient();
      
      const model = genAI.getGenerativeModel({ model: modelName });
      const generationPromise = model.generateContent(prompt);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Gemini answer generation timed out after ${timeout}ms`)), timeout)
      );
      
      const result = await Promise.race([generationPromise, timeoutPromise]) as any;
      const duration = Date.now() - apiCallStartTime;
      const responseText = result.response?.text();

      if (!responseText) {
        logApiCall('gemini', 'answer_generation', 'error', duration, 'Empty response from Gemini', { model: modelName, attempt });
        throw new Error('Gemini returned an empty response.');
      }

      logInfo('[API AnswerGen] Gemini Answer Generation Success');
      logApiCall('gemini', 'answer_generation', 'success', duration, undefined, { model: modelName, attempt });
      return responseText;

    } catch (error) {
      const duration = Date.now() - apiCallStartTime;
      logError(`[API AnswerGen] Gemini Answer Generation Error (Attempt ${attempt})`, { error: error instanceof Error ? error.message : String(error), model: modelName });
      if (!(error instanceof Error && error.message === 'Gemini returned an empty response.')) {
          logApiCall('gemini', 'answer_generation', 'error', duration, error instanceof Error ? error.message : String(error), { model: modelName, attempt });
      }

      if (attempt > maxRetries) {
        logError('[API AnswerGen] Max retries reached. Failing answer generation.');
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt)); 
    }
  }
  throw new Error('Answer generation failed after retries.'); 
}

/**
 * Generate an answer based on retrieved context and the user's query
 * 
 * @param query The user's original query
 * @param searchResults The search results from the retrieval system
 * @param options Optional settings for answer generation
 * @returns A string with the generated answer
 */
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
  const startTime = Date.now();
  const answerId = `answer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${answerId}] ANSWER GENERATION STARTED for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
  console.log(`[${answerId}] SearchResults: ${searchResults.length} items, History items: ${Array.isArray(options.conversationHistory) ? options.conversationHistory.length : (options.conversationHistory ? 'string-format' : 'none')}`);
  
  let contextText = '';
  try {
    // Set a default timeout if not provided (25 seconds)
    const timeoutMs = options.timeout || 25000;
    console.log(`[${answerId}] Using timeout: ${timeoutMs}ms`);
    
    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => {
        console.log(`[${answerId}] TIMEOUT REACHED after ${timeoutMs}ms`);
        reject(new Error(`Answer generation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    // Create the actual answer generation promise
    const answerPromise = (async () => {
      // Handle simple conversational queries first
      if (isBasicConversational(query)) {
        console.log(`[${answerId}] Detected basic conversational query, using simpler response path`);
        return handleConversationalQuery(query, options.conversationHistory);
      }

      console.log(`[${answerId}] Preparing context from ${searchResults.length} search results`);
      
      // Prepare the context
      const includedSources: string[] = [];
      let totalContextTokens = 0;

      // Default system prompt with stronger directives added
      const baseSystemPrompt = options.systemPrompt || `
You are a helpful, professional AI assistant supporting the sales team at Workstream, a company providing HR, Payroll, and Hiring solutions for the hourly workforce.
Your job is to assist with any sales-related questions—ranging from product features, pricing, onboarding, customer types, or processes—based on our internal knowledge.
Stay concise, helpful, and accurate. Use a tone that reflects Workstream's brand: confident, supportive, and human.

IMPORTANT INSTRUCTIONS:
- Answer based *strictly* on the provided context ONLY. Do not use any prior knowledge.
- If the context does not contain the information needed to answer the query, explicitly state that the information is not available in the provided context.
- If the context *does* provide specific names answering the user's query (e.g., investor names, CEO name, CTO name, leadership team members), you MUST list those specific names clearly in your answer. Do not summarize generically (e.g., 'we have investors') if names are available.
- When answering questions about leadership or team members, prioritize information from COMPANY_INFO category documents.
- If the question relates to a specific industry (e.g., restaurants, healthcare), prioritize information from sources with relevant industry tags.
- For questions about specific features or capabilities, focus on information from documents with appropriate feature or technical categories.
- Pay attention to pain points and value propositions in the context when answering sales-related questions.
- Extract and present all relevant factual details found, especially for specific queries about people, features, or technical capabilities.

FOLLOW-UP QUESTION HANDLING:
- When responding to follow-up questions, maintain continuity with previous responses in the conversation context.
- If the user refers to information from previous messages (using pronouns like "they", "it", "this", etc.), reference the appropriate content from the conversation history to ensure your response is coherent.
- For incomplete or ambiguous follow-up questions, try to understand the intent based on the conversation history before answering.
- If you cannot determine what a follow-up question refers to, politely ask for clarification rather than making assumptions.
`;

      // Prepare context from search results with enhanced metadata
      const maxSources = options.maxSourcesInAnswer || 5;
      searchResults.slice(0, maxSources).forEach((result, index) => {
        // Basic context text
        contextText += `Source [${index + 1}]: ${result.source || 'Unknown'}\n`;
        
        // Add enhanced metadata if available
        const metadata = result.metadata || {};
        if (metadata) {
          contextText += 'Metadata: ';
          
          // Add primary and secondary categories
          if (metadata.primaryCategory) {
            contextText += `[Primary Category: ${metadata.primaryCategory}] `;
          }
          
          if (metadata.secondaryCategories && metadata.secondaryCategories.length > 0) {
            contextText += `[Secondary Categories: ${Array.isArray(metadata.secondaryCategories) ? metadata.secondaryCategories.join(', ') : metadata.secondaryCategories}] `;
          }
          
          // Add industry categories if available
          if (metadata.industryCategories && metadata.industryCategories.length > 0) {
            contextText += `[Industry: ${Array.isArray(metadata.industryCategories) ? metadata.industryCategories.join(', ') : metadata.industryCategories}] `;
          }
          
          // Add technical features if available
          if (metadata.technicalFeatureCategories && metadata.technicalFeatureCategories.length > 0) {
            contextText += `[Technical Features: ${Array.isArray(metadata.technicalFeatureCategories) ? metadata.technicalFeatureCategories.join(', ') : metadata.technicalFeatureCategories}] `;
          }
          
          // Add pain points if available
          if (metadata.painPointCategories && metadata.painPointCategories.length > 0) {
            contextText += `[Pain Points: ${Array.isArray(metadata.painPointCategories) ? metadata.painPointCategories.join(', ') : metadata.painPointCategories}] `;
          }
          
          // Add value propositions if available
          if (metadata.valuePropositionCategories && metadata.valuePropositionCategories.length > 0) {
            contextText += `[Value Propositions: ${Array.isArray(metadata.valuePropositionCategories) ? metadata.valuePropositionCategories.join(', ') : metadata.valuePropositionCategories}] `;
          }
          
          // Add document-level entities if available for leadership questions
          if (metadata.docEntities && metadata.docEntities.length > 0) {
            const peopleEntities = metadata.docEntities.filter((e: {type?: string; text?: string}) => 
              e.type?.toLowerCase() === 'person' || 
              e.type?.toLowerCase() === 'people'
            );
            
            if (peopleEntities.length > 0) {
              contextText += `[People Mentioned: ${peopleEntities.map((p: {text?: string}) => p.text || '').join(', ')}] `;
            }
          }
          
          contextText += '\n';
        }
        
        // Add content text
        contextText += `Content: ${result.text}\n\n`;
        
        if (result.source) {
          includedSources.push(result.source);
        }
      });
      contextText = contextText.trim();

      // Estimate token count for the combined query + context
      const promptEstimate = estimateTokenCount(query + contextText);
      logInfo(`Estimated prompt tokens (query + context): ${promptEstimate}`);
      console.log(`[${answerId}] Estimated prompt tokens (query + context): ${promptEstimate}`);

      // Check if context needs summarization (Using Gemini 2.0 Flash's expanded context window of 1M tokens)
      // We use a conservative limit of 70000 tokens to leave space for query, prompt, and response
      const MAX_GEMINI_CONTEXT_TOKENS = 70000; 
      if (promptEstimate > MAX_GEMINI_CONTEXT_TOKENS) {
        console.log(`[${answerId}] Context too large (${promptEstimate} tokens), will summarize`);
        logWarning(`Context estimate (${promptEstimate} tokens) exceeds limit (${MAX_GEMINI_CONTEXT_TOKENS}). Summarizing...`);
        contextText = await summarizeContext(query, contextText);
        logInfo(`Summarized context token estimate: ${estimateTokenCount(contextText)}`);
        console.log(`[${answerId}] Context summarized to ${estimateTokenCount(contextText)} tokens`);
      }

      console.log(`[${answerId}] Calling Gemini for answer generation with ${estimateTokenCount(contextText)} tokens of context`);
      
      // *** Generate the final answer using the prepared context ***
      const finalAnswer = await generateGeminiAnswer(
        query,
        contextText,
        {
          systemPrompt: baseSystemPrompt, // Use the enhanced prompt
          includeSourceCitations: options.includeSourceCitations,
          conversationHistory: options.conversationHistory,
          model: options.model,
          timeout: options.timeout
        }
      );

      const duration = Date.now() - startTime;
      console.log(`[${answerId}] Gemini answer generation successful in ${duration}ms, answer length: ${finalAnswer.length}`);
      
      // Record metric on success (Restore metadata argument despite linter warning)
      recordMetric('answerGeneration', 'gemini', duration, true, {
          contextLength: contextText.length,
          resultCount: searchResults.length,
          // Add other relevant metadata if needed from options or answer
      });
      return finalAnswer;
    })();
    
    // Race the answer generation against the timeout
    console.log(`[${answerId}] Starting race between answer generation and timeout`);
    return await Promise.race([answerPromise, timeoutPromise]);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${answerId}] Error in generateAnswer function after ${duration}ms:`, error);
    logError('Error in generateAnswer function', error);
    
    // Special handling for timeout errors
    if (error instanceof Error && error.message.includes('timed out')) {
      console.error(`[${answerId}] TIMEOUT ERROR: Answer generation timed out`);
      logError('Answer generation timed out', { 
        query: query.substring(0, 100), 
        elapsedTime: Date.now() - startTime 
      });
      return "I'm sorry, but it's taking longer than expected to generate a response. Please try asking a more specific question or try again later.";
    }
    
    // Record metric on failure
    recordMetric('answerGeneration', 'gemini', Date.now() - startTime, false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        contextLength: contextText.length,
    });
    return "An unexpected error occurred while processing your request.";
  }
}

/**
 * Interface for multi-modal search result items
 */
export interface MultiModalSearchResultItem extends SearchResultItem {
  matchedVisual?: any;
  matchType?: 'text' | 'visual' | 'both';
  visualContent?: Array<{
    type: string;
    description: string;
    extractedText?: string;
    structuredData?: any;
    imageUrl?: string;
    position?: {
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}

/**
 * Options for generating answers with visual context
 */
export interface VisualAnswerOptions {
  /** Include source citations in the answer */
  includeSourceCitations?: boolean;
  
  /** Maximum number of sources to include in the answer */
  maxSourcesInAnswer?: number;
  
  /** LLM model to use for generation */
  model?: string;
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Previous conversation history */
  conversationHistory?: string;
  
  /** Whether the query has visual focus */
  visualFocus?: boolean;
  
  /** Types of visual content the query is asking about */
  visualTypes?: string[];
  
  /** Whether to include image URLs in the response */
  includeImageUrls?: boolean;
}

/**
 * Generate an answer based on retrieved context with multi-modal awareness
 * This function handles both text and visual elements in the search results
 * 
 * @param query The user's original query
 * @param searchResults The multi-modal search results from the retrieval system
 * @param options Optional settings for answer generation
 * @returns A string with the generated answer
 */
export async function generateAnswerWithVisualContext(
  query: string,
  searchResults: MultiModalSearchResultItem[],
  options: VisualAnswerOptions = {}
): Promise<string> {
    logWarning('[generateAnswerWithVisualContext] Function is a placeholder and not fully implemented.');
    // TODO: Implement proper multi-modal answer generation logic here.
    // For now, return a simple fallback message.
    return "Analyzing visual content is currently under development. Please ask about the text content.";
}

// +++ Enhance formatConversationHistory with clearer formatting and better context handling +++
function formatConversationHistory(history: string | Array<{role: string; content: string}> | undefined): string {
  if (!history) return '';
  
  if (typeof history === 'string') return history.trim();
  
  if (Array.isArray(history)) {
    // Skip the initial greeting message if it exists (common pattern in many implementations)
    const startIndex = history.length > 0 && 
                       history[0].role === 'assistant' && 
                       history[0].content.includes('Welcome') ? 1 : 0;
    
    // Format the conversation in a way that's clearer for the model to understand
    return history.slice(startIndex).map((msg, index) => {
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
      // Adding message numbers helps the model understand the flow of conversation
      return `[Message ${index + 1}] ${roleLabel}: ${msg.content}`;
    }).join('\n\n');
  }
  
  return '';
}

// ... (Keep other helpers like formatVisualType, etc. ONLY IF THEY ARE USED by the actual visual logic when implemented) ...
// Otherwise, they can be removed if generateAnswerWithVisualContext remains a placeholder.
