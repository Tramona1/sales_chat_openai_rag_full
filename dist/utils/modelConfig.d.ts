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
    embeddingDimension: number;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
    contextGenerationModel: {
        provider: 'gemini' | 'openai';
        model: string;
        temperature: number;
        maxTokens: number;
    };
    rerankerModel: {
        provider: 'gemini' | 'openai';
        model: string;
        temperature: number;
    };
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
/**
 * Get model configuration for a specific task
 * @param config Model settings
 * @param task The task to get the model for
 * @returns Model provider, name and settings
 */
export declare function getModelForTask(config: ModelSettings | undefined, task: 'chat' | 'embedding' | 'context' | 'reranking'): {
    provider: string;
    model: string;
    settings: any;
};
