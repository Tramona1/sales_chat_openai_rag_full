/**
 * Gemini Client
 *
 * This module provides functions for interacting with Google's Gemini API
 * to generate structured responses at a lower cost than GPT-4.
 */
/**
 * Generate a structured response using Gemini API
 * @param systemPrompt The system instructions
 * @param userPrompt The user query or content to analyze
 * @param responseSchema JSON schema for the response structure
 * @returns Structured response object
 */
export declare function generateStructuredGeminiResponse(systemPrompt: string, userPrompt: string, responseSchema: any): Promise<any>;
/**
 * Generate a chat completion using Gemini API
 * @param systemPrompt System instructions
 * @param userPrompt User query or content
 * @returns Generated text response
 */
export declare function generateGeminiChatCompletion(systemPrompt: string, userPrompt: string): Promise<string>;
