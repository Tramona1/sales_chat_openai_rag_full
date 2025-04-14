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
    // Basic greetings only
    'hello', 'hi', 'hey', 'greetings', 'howdy', 
    // Simple gratitude
    'thanks', 'thank you',
    // Basic farewells
    'bye', 'goodbye'
  ];
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Only match exact greetings or very simple patterns
  return conversationalPatterns.some(pattern => 
    lowerQuery === pattern || 
    lowerQuery === pattern + '!' ||
    lowerQuery === pattern + '.'
  );
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

Your job is to assist with any sales-related questions—ranging from product features, pricing, onboarding, customer types, or processes—based on our internal knowledge.

Stay concise, helpful, and accurate. Use a tone that reflects Workstream's brand: confident, supportive, and human.`;

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
    return "Hello! I'm here to help with your sales questions. What would you like to know about our company, products, or services?";
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
${userDirective} // Append the user directive

Answer:
`;

  // <<< LOG THE FULL PROMPT >>>
  logDebug(`[generateGeminiAnswer] Final prompt being sent to model (${modelName}):\n--- START PROMPT ---\n${prompt}\n--- END PROMPT ---`);

  while (attempt <= maxRetries) {
    attempt++;
    const apiCallStartTime = Date.now();
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: modelName });
      const generationPromise = model.generateContent(prompt);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Gemini answer generation timed out after ${timeout}ms`)), timeout)
      );
      
      const result = await Promise.race([generationPromise, timeoutPromise]) as any;
      const duration = Date.now() - apiCallStartTime;
      const responseText = result.response?.text() || '';

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
  let contextText = '';
  try {
    // Handle simple conversational queries first
    if (isBasicConversational(query)) {
      return handleConversationalQuery(query, options.conversationHistory);
    }

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

    // Check if context needs summarization (Using Gemini 2.0 Flash's expanded context window of 1M tokens)
    // We use a conservative limit of 70000 tokens to leave space for query, prompt, and response
    const MAX_GEMINI_CONTEXT_TOKENS = 70000; 
    if (promptEstimate > MAX_GEMINI_CONTEXT_TOKENS) {
      logWarning(`Context estimate (${promptEstimate} tokens) exceeds limit (${MAX_GEMINI_CONTEXT_TOKENS}). Summarizing...`);
      contextText = await summarizeContext(query, contextText);
      logInfo(`Summarized context token estimate: ${estimateTokenCount(contextText)}`);
    }

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
    
    // Record metric on success (Restore metadata argument despite linter warning)
    recordMetric('answerGeneration', 'gemini', duration, true, {
        contextLength: contextText.length,
        resultCount: searchResults.length,
        // Add other relevant metadata if needed from options or answer
    });
    return finalAnswer;
  } catch (error) {
    logError('Error in generateAnswer function', error);
    // Record metric on failure (Restore metadata argument despite linter warning)
    recordMetric('answerGeneration', 'gemini', Date.now() - startTime, false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        contextLength: contextText.length, // contextText might be empty if error happened early
        // Add other relevant metadata if needed
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

// +++ Ensure formatConversationHistory is correctly defined +++
function formatConversationHistory(history: string | Array<{role: string; content: string}> | undefined): string {
  if (!history) return '';
  if (typeof history === 'string') return history.trim();
  if (Array.isArray(history)) {
    return history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
  }
  return '';
} 

// ... (Keep other helpers like formatVisualType, etc. ONLY IF THEY ARE USED by the actual visual logic when implemented) ...
// Otherwise, they can be removed if generateAnswerWithVisualContext remains a placeholder.
