import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { standardizeApiErrorResponse } from '../../utils/errorHandling';
import { logInfo, logError, logDebug, logWarning, logApiCall } from '../../utils/logger';
import { testSupabaseConnection } from '../../utils/supabaseClient';
import { hybridSearch } from '@/utils/hybridSearch';

// Create a function to get embedding since it's missing from imports
async function getEmbedding(text: string): Promise<number[]> {
  // This is a placeholder implementation; actual implementation should be in utils/embedding.ts
  // We'll call the GoogleAI API to get embeddings
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: "embedding-001" });
  
  const result = await model.embedContent(text);
  const embedding = result.embedding?.values || [];
  return embedding;
}

// Define interface for search results
interface SearchResult {
  id: string;
  text: string;
  score?: number;
  metadata?: {
    source?: string;
    title?: string;
    [key: string]: any;
  };
}

// Define constants for source attribution
const MAX_CONTEXT_DOCS = 20;
const SIMILARITY_THRESHOLD = 0.8;

// Helper function to detect low-value boilerplate content
function isLikelyBoilerplateContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const boilerplateIndicators = [
    /this (website|site) (uses|stores) cookies/i,
    /cookie (policy|notice|preferences|settings)/i,
    /privacy (policy|notice|statement)/i,
    /terms (of service|of use|and conditions)/i,
    /all rights reserved/i,
    /copyright © \d{4}/i,
    /by (using|continuing to use|browsing) (this|our) (site|website)/i,
    /we (use|collect) (personal information|data|cookies)/i,
    /login|sign in|create( an)? account|forgot password/i,
    /contact (us|form|details|information)/i,
    /follow us on/i,
    /share (this|on)/i,
    /subscribe to (our|the) newsletter/i,
    /404 (not found|error)/i,
  ];

  // Check for multiple indicators
  let matchCount = 0;
  for (const indicator of boilerplateIndicators) {
    if (indicator.test(text)) {
      matchCount++;
      // If we find multiple matches, it's very likely boilerplate
      if (matchCount >= 2) return true;
    }
  }

  // Check content length - very short content is often navigation or headers
  if (text.length < 100 && /copyright|rights reserved|privacy|terms|cookies/i.test(text)) {
    return true;
  }

  // Check ratio of navigation/boilerplate terms to content length
  const boilerplateTerms = ['home', 'about', 'contact', 'privacy', 'terms', 'cookies', 
                           'login', 'sign in', 'register', 'copyright', 'all rights'];
  let termCount = 0;
  for (const term of boilerplateTerms) {
    if (text.toLowerCase().includes(term)) {
      termCount++;
    }
  }

  // If more than 25% of the text consists of boilerplate terms, it's likely boilerplate
  if (termCount > 3 && text.length < termCount * 50) {
    return true;
  }

  return false;
}

// Function to handle the API request
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', code: 'method_not_allowed' } });
  }

  try {
    // Extract request parameters
    const { messages, model = 'gemini', sessionId, useAdmin = false, useHybridSearch = true } = req.body;

    // Validate inputs
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Invalid request: messages array is required and must not be empty',
          code: 'invalid_request'
        }
      });
    }

    if (!['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gemini', 'gemini-pro'].includes(model)) {
      return res.status(400).json({
        error: {
          message: `Invalid model specified: ${model}. Supported models are: gpt-4, gpt-4-turbo, gpt-3.5-turbo, gemini, gemini-pro`,
          code: 'invalid_model'
        }
      });
    }

    // Get the latest user message
    const userMessage = messages[messages.length - 1].content;
    logInfo(`Processing chat request with model: ${model}, sessionId: ${sessionId || 'n/a'}`);
    logDebug(`User message: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);

    // Verify Supabase connection
    const isSupabaseConnected = await testSupabaseConnection();
    if (!isSupabaseConnected) {
      logError('Failed to connect to Supabase database');
      return res.status(500).json(standardizeApiErrorResponse({
        message: 'Database connection error',
        details: 'Could not connect to Supabase'
      }));
    }

    // Get relevant documents using Supabase hybrid search
    let retrievedDocuments: SearchResult[] = [];
    try {
      logInfo('Performing hybrid search with Supabase');
      const response = await hybridSearch(userMessage, { 
        limit: 30, 
        matchThreshold: 0.2,  // More lenient threshold for better recall
        vectorWeight: 0.3,    // Emphasize keywords more for better exact match retrieval
        keywordWeight: 0.7    // Emphasize keywords for better exact match retrieval
      });
      const searchResults = response.results;
      logDebug(`Retrieved ${searchResults.length} documents from hybrid search`);
      
      retrievedDocuments = searchResults.map((item: any) => ({
        id: item.id || `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: item.text || item.originalText || '',
        score: item.score,
        metadata: {
          source: item.metadata?.source || item.metadata?.title || 'Unknown Source',
          title: item.metadata?.title || 'Untitled Document',
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

    // Sort by relevance score and filter by threshold
    retrievedDocuments = retrievedDocuments
      .sort((a, b) => {
        const scoreA = typeof a.score === 'number' ? a.score : 0;
        const scoreB = typeof b.score === 'number' ? b.score : 0;
        return scoreB - scoreA;
      })
      // Filter out boilerplate content
      .filter(doc => {
        const isBoilerplate = isLikelyBoilerplateContent(doc.text);
        if (isBoilerplate) {
          logInfo(`Filtered out boilerplate content: "${doc.text.substring(0, 100)}..."`);
        }
        return !isBoilerplate;
      })
      .slice(0, MAX_CONTEXT_DOCS);

    logInfo(`Selected ${retrievedDocuments.length} most relevant documents as context`);
    
    // Check if we have any quality content or if all results were filtered
    const hasQualityContent = retrievedDocuments.length > 0;
    
    // If no quality content was found, prepare a fallback response
    if (!hasQualityContent) {
      logWarning(`No quality content found for query: "${userMessage}"`);
      return res.status(200).json({
        completion: "I'm sorry, but I don't have specific information about that in my knowledge base. Could you try rephrasing your question or asking about a different aspect of Workstream's products or services?",
        sources: [],
        model,
        noQualityContentFound: true
      });
    }

    // Format documents for context
    const contextString = retrievedDocuments.map((doc, index) => {
      const source = doc.metadata?.source || 'Unknown Source';
      return `[${index + 1}] ${doc.text}\nSource: ${source}`;
    }).join('\n\n');

    // Prepare source references for attribution
    const sourceList = retrievedDocuments.map((doc, index) => {
      return {
        index: index + 1,
        source: doc.metadata?.source || 'Unknown Source',
        title: doc.metadata?.title || doc.metadata?.source || 'Untitled Document'
      };
    });

    logDebug('Constructed context and source attribution information');

    // Prepare the system message with context and instructions
    let systemMessage = '';
    if (model.startsWith('gpt')) {
      systemMessage = constructOpenAISystemMessage(contextString, useAdmin, sourceList);
    } else {
      systemMessage = constructGeminiSystemMessage(contextString, useAdmin, sourceList);
    }

    // Generate the completion
    let completion;
    if (model.startsWith('gpt')) {
      completion = await generateOpenAICompletion(messages, systemMessage, model);
    } else {
      completion = await generateGeminiCompletion(messages, systemMessage);
    }

    // Return the result
    logInfo('Successfully generated completion, returning response');
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

// Helper function to construct OpenAI system message
function constructOpenAISystemMessage(contextString: string, useAdmin: boolean, sourceList: any[]) {
  let systemMessage = 'You are Workstream Sales Assistant, an AI designed to help with sales-related questions.\n\n';

  if (contextString) {
    systemMessage += 'CONTEXT INFORMATION:\n' + contextString + '\n\n';
  }

  systemMessage += `INSTRUCTIONS:
1. Answer questions based on the context provided above.
2. If the context doesn't contain the answer, say "I don't have specific information about that in my knowledge base."
3. Use the source numbers [1], [2], etc. when referring to information from specific sources in your answer.
4. Be concise and focus on providing accurate, helpful information.
5. Do not make up information or provide speculative answers.`;

  if (useAdmin) {
    systemMessage += `\n6. You are in ADMIN mode, so you can explain your reasoning and discuss the quality of matches.`;
  }

  return systemMessage;
}

// Helper function to construct Gemini system message
function constructGeminiSystemMessage(contextString: string, useAdmin: boolean, sourceList: any[]) {
  let systemMessage = 'You are Workstream Sales Assistant, an AI designed to help with sales-related questions.\n\n';

  if (contextString) {
    systemMessage += 'CONTEXT INFORMATION:\n' + contextString + '\n\n';
  }

  systemMessage += `INSTRUCTIONS:
1. Answer questions based on the context provided above.
2. If the context doesn't contain the answer, say "I don't have specific information about that in my knowledge base."
3. Use the source numbers [1], [2], etc. when referring to information from specific sources in your answer.
4. Be concise and focus on providing accurate, helpful information.
5. Do not make up information or provide speculative answers.`;

  if (useAdmin) {
    systemMessage += `\n6. You are in ADMIN mode, so you can explain your reasoning and discuss the quality of matches.`;
  }

  return systemMessage;
}

// Helper function to generate OpenAI completion
async function generateOpenAICompletion(messages: any[], systemMessage: string, model: string) {
  logInfo(`Generating OpenAI completion with model: ${model}`);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const formattedMessages = [ { role: 'system', content: systemMessage }, ...messages ];
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: formattedMessages,
      temperature: 0.5,
      max_tokens: 1500,
      n: 1,
    });
    const duration = Date.now() - startTime;
    logInfo('[API Chat] OpenAI Chat Completion Success', { model }); 
    logApiCall('openai', 'chat_completion', 'success', duration, undefined, { model });
    return response.choices[0].message?.content || '';
  } catch (error) {
    const duration = Date.now() - startTime;
    logError('[API Chat] OpenAI Chat Completion Error', { model, error: error instanceof Error ? error.message : String(error) }); 
    logApiCall('openai', 'chat_completion', 'error', duration, error instanceof Error ? error.message : String(error), { model });
    throw error; // Re-throw the error for the main handler
  }
}

// Process messages for Gemini
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
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
  const modelName = "gemini-pro"; // Assuming this model is used
  const model = genAI.getGenerativeModel({ model: modelName });
  const formattedMessages = processMessageForGemini(messages, systemMessage);
  const startTime = Date.now();

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: formattedMessages }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1500,
      },
    });
    const duration = Date.now() - startTime;
    const response = result.response;
    logInfo('[API Chat] Gemini Chat Completion Success'); 
    logApiCall('gemini', 'chat_completion', 'success', duration, undefined, { model: modelName });
    return response.text() || '';
  } catch (error) {
    const duration = Date.now() - startTime;
    logError('[API Chat] Gemini Chat Completion Error', { error: error instanceof Error ? error.message : String(error) }); 
    logApiCall('gemini', 'chat_completion', 'error', duration, error instanceof Error ? error.message : String(error), { model: modelName });
    throw error; // Re-throw the error for the main handler
  }
} 