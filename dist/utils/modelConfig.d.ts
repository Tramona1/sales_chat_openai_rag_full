/**
 * AI model configuration settings for the RAG system
 * This provides centralized configuration for all AI model settings
 */
/**
 * Interface for model settings
 */
export interface ModelSettings {
    defaultModel: string;
    fallbackModel: string;
    embeddingModel: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
}
/**
 * Application AI settings
 */
export declare const AI_SETTINGS: ModelSettings;
/**
 * Different preset system prompts for various use cases
 */
export declare const SYSTEM_PROMPTS: {
    standard: string;
    technical: string;
    sales: string;
    pricing: string;
};
/**
 * Get system prompt based on query type
 */
export declare function getSystemPromptForQuery(query: string): string;
