/**
 * OpenAI client utility for the RAG system
 * Handles API interactions with OpenAI including embeddings and chat completions
 */

import { OpenAI } from 'openai';
import { AI_SETTINGS } from './modelConfig';
import { logError } from './errorHandling';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embeddings for text using OpenAI
 * Used for vector similarity search
 */
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
    
    // In case of error, return a zero vector as fallback
    // This should be handled by the calling function
    console.error('Error generating embedding:', error);
    return Array(1536).fill(0);
  }
}

/**
 * Interface for chat message format
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Generate a chat completion using OpenAI
 */
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
    
    // If model isn't specified, use default
    const modelToUse = model || AI_SETTINGS.defaultModel;
    
    // Only include response_format if jsonMode is true and we're using a compatible model (GPT-4 and above)
    const supportsJsonMode = modelToUse.includes('gpt-4') || 
                            modelToUse.includes('gpt-3.5-turbo-16k') || 
                            modelToUse.includes('gpt-3.5-turbo-1106');
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages,
      temperature: AI_SETTINGS.temperature,
      max_tokens: AI_SETTINGS.maxTokens,
      response_format: jsonMode && supportsJsonMode ? { type: 'json_object' } : undefined,
    });
    
    // Extract and return the response text
    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error generating chat completion:', error);
    
    // Try fallback model if primary fails
    if (model === AI_SETTINGS.defaultModel) {
      console.log('Attempting with fallback model...');
      return generateChatCompletion(
        systemPrompt,
        userPrompt,
        AI_SETTINGS.fallbackModel,
        jsonMode
      );
    }
    
    // If fallback also fails, return error message
    return 'I apologize, but I encountered an issue processing your request. Please try again later.';
  }
}

/**
 * Generate a structured response from OpenAI API
 */
export async function generateStructuredResponse(
  systemPrompt: string,
  userPrompt: string,
  responseSchema: any,
  model: string = AI_SETTINGS.defaultModel
): Promise<any> {
  try {
    // Check if model supports JSON mode
    const supportsJsonMode = model.includes("gpt-4-turbo") || 
                             model.includes("gpt-4-0125") || 
                             model.includes("gpt-3.5-turbo-0125");
    
    if (supportsJsonMode) {
      // Use JSON mode for models that support it
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 4000
      });
      
      const content = response.choices[0]?.message?.content || "{}";
      return JSON.parse(content);
    } else {
      // For models that don't support JSON mode
      const enhancedSystemPrompt = `${systemPrompt}\n\nYou must respond with a valid JSON object that follows this schema:\n${JSON.stringify(responseSchema, null, 2)}\n\nDo not include any text before or after the JSON. Only respond with the JSON object.`;
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 4000
      });
      
      const content = response.choices[0]?.message?.content || "{}";
      
      // Extract JSON from the response - handle potential extra text
      try {
        // Try parsing directly
        return JSON.parse(content);
      } catch (e) {
        // If direct parsing fails, try to extract JSON from the text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Failed to extract valid JSON from response");
        }
      }
    }
  } catch (error: any) {
    if (error?.message?.includes('json_object') && 
        model !== AI_SETTINGS.fallbackModel) {
      console.log("Attempting with fallback model...");
      // Try again with fallback model
      return generateStructuredResponse(systemPrompt, userPrompt, responseSchema, AI_SETTINGS.fallbackModel);
    }
    
    console.error("Error generating structured response:", error);
    throw error;
  }
}

/**
 * Batch process multiple prompts with a single API call 
 * Useful for re-ranking to save on API calls
 */
export async function batchProcessPrompts(
  systemPrompt: string,
  userPrompts: string[],
  model: string = AI_SETTINGS.defaultModel,
  options: {
    timeoutMs?: number;
    jsonMode?: boolean;
  } = {}
): Promise<string[]> {
  // Set a timeout
  const timeoutMs = options.timeoutMs || 10000;
  
  try {
    // Create a Promise for the API call
    const apiPromise = Promise.all(
      userPrompts.map(userPrompt => 
        generateChatCompletion(
          systemPrompt,
          userPrompt,
          model,
          options.jsonMode || false
        )
      )
    );
    
    // Create a timeout Promise
    const timeoutPromise = new Promise<string[]>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Batch processing timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    // Race the API call against the timeout
    return await Promise.race([apiPromise, timeoutPromise]);
  } catch (error) {
    logError('Error in batch processing prompts', error);
    
    // Return empty results on error
    return userPrompts.map(() => "");
  }
}

/**
 * Process a batch of texts with an LLM for re-ranking
 * Specialized function for re-ranking that processes multiple documents
 * with a single API call for efficiency
 */
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
- 0: Not relevant at all

Return a JSON object with only scores in this format:
{"scores": [score1, score2, ...]}

Your response MUST be a valid JSON object with no additional text, explanations, or formatting.`;

    // Create a single user prompt with all texts
    const userPrompt = `Query: ${query}

${texts.map((text, i) => `DOCUMENT ${i+1}:
${text.substring(0, 600)}${text.length > 600 ? '...' : ''}`).join('\n\n')}

Provide a relevance score from 0-10 for each document based on how well it answers the query.`;

    // Generate the ranking with a timeout
    const timeoutMs = options.timeoutMs || 15000;
    const rankingPromise = generateStructuredResponse(
      systemPrompt,
      userPrompt,
      { scores: [] },
      model
    );
    
    // Create a timeout Promise
    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Re-ranking timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    // Race the API call against the timeout
    const response = await Promise.race([rankingPromise, timeoutPromise]);
    
    // Return scores
    if (response && Array.isArray(response.scores)) {
      return response.scores;
    } else {
      console.warn('Invalid scores format received, using default scores');
      return texts.map(() => 5); // Default to middle score if failed
    }
  } catch (error) {
    console.error('Error in rankTextsForQuery:', error);
    return texts.map(() => 5); // Default score on error
  }
} 