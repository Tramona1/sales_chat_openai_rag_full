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
/**
 * Extract document context using Gemini to understand the document content
 * @param documentText The text content of the document to analyze
 * @param metadata Optional existing metadata to enhance the analysis
 * @returns Structured document context including summary, topics, and more
 */
export declare function extractDocumentContext(documentText: string, metadata?: Record<string, any>): Promise<{
    summary: string;
    mainTopics: string[];
    entities: string[];
    documentType: string;
    technicalLevel: number;
    audienceType: string[];
}>;
/**
 * Generate context for a text chunk based on its content and optional document context
 * @param chunkText The text content of the chunk
 * @param documentContext Optional higher-level document context to inform analysis
 * @returns Structured chunk context including key points and characteristics
 */
export declare function generateChunkContext(chunkText: string, documentContext?: any): Promise<{
    description: string;
    keyPoints: string[];
    isDefinition: boolean;
    containsExample: boolean;
    relatedTopics: string[];
}>;
