/**
 * OpenAI client utility for the RAG system
 * Handles API interactions with OpenAI including embeddings and chat completions
 */
import { OpenAI } from 'openai';
export declare const openai: OpenAI;
/**
 * Generate embeddings for text using OpenAI
 * Used for vector similarity search
 */
export declare function embedText(text: string): Promise<number[]>;
/**
 * Generate a chat completion using OpenAI
 */
export declare function generateChatCompletion(systemPrompt: string, userPrompt: string, model?: string, jsonMode?: boolean): Promise<string>;
/**
 * Generate a structured response with JSON output
 */
export declare function generateStructuredResponse(systemPrompt: string, userPrompt: string, responseSchema: any, model?: string): Promise<any>;
/**
 * Batch process multiple prompts with a single API call
 * Useful for re-ranking to save on API calls
 */
export declare function batchProcessPrompts(systemPrompt: string, userPrompts: string[], model?: string, options?: {
    timeoutMs?: number;
    jsonMode?: boolean;
}): Promise<string[]>;
/**
 * Process a batch of texts with an LLM for re-ranking
 * Specialized function for re-ranking that processes multiple documents
 * with a single API call for efficiency
 */
export declare function rankTextsForQuery(query: string, texts: string[], model?: string, options?: {
    returnScoresOnly?: boolean;
    timeoutMs?: number;
}): Promise<number[]>;
