"use strict";
/**
 * AI model configuration settings for the RAG system
 * This provides centralized configuration for all AI model settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_PROMPTS = exports.AI_SETTINGS = void 0;
exports.getSystemPromptForQuery = getSystemPromptForQuery;
exports.getModelForTask = getModelForTask;
/**
 * Application AI settings
 */
exports.AI_SETTINGS = {
    // Default model for standard operations
    defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
    // Fallback model when primary is unavailable or for less critical operations
    fallbackModel: process.env.FALLBACK_LLM_MODEL || 'gpt-3.5-turbo-1106',
    // Embedding model for vector operations - MIGRATED TO GEMINI
    embeddingModel: 'models/text-embedding-004',
    // Embedding dimension - 768 for Gemini models/text-embedding-004
    embeddingDimension: 768,
    // Default max tokens for generation
    maxTokens: 1000,
    // Default temperature for most operations
    temperature: 0.7,
    // Default system prompt for RAG queries
    systemPrompt: `You are an AI assistant for the sales team. 
Answer the question based ONLY on the context provided. 
If the answer cannot be determined from the context, say "I don't have enough information to answer this question."
Do not make up or infer information that is not in the context.
Provide concise, accurate responses with all relevant details from the context.`,
    // Updated contextual generation model settings for multi-modal RAG
    contextGenerationModel: {
        provider: 'gemini',
        model: 'gemini-2.0-flash', // Fast model for context generation
        temperature: 0.2,
        maxTokens: 1024
    },
    // Updated reranker model settings for visual content awareness
    rerankerModel: {
        provider: 'gemini',
        model: 'gemini-2.0-pro', // Use Pro model for better visual understanding in reranking
        temperature: 0.1
    }
};
/**
 * Different preset system prompts for various use cases
 */
exports.SYSTEM_PROMPTS = {
    standard: exports.AI_SETTINGS.systemPrompt,
    technical: `You are an AI assistant for the sales team specializing in technical questions.
Answer the question based ONLY on the context provided.
Use technical language and be precise in your explanations.
If the answer cannot be determined from the context, say "I don't have enough information to answer this question."
Do not make up or infer information that is not in the context.`,
    sales: `You are an AI assistant for the sales team specializing in sales queries.
Answer the question based ONLY on the context provided.
Focus on value propositions, competitive advantages, and addressing customer pain points.
If the answer cannot be determined from the context, say "I don't have enough information to answer this question."
Do not make up or infer information that is not in the context.`,
    pricing: `You are an AI assistant for the sales team specializing in pricing questions.
Answer the question based ONLY on the context provided.
Be very precise about pricing details, plans, and subscription options.
If the answer cannot be determined from the context, say "I don't have enough information to answer this question."
Do not make up or infer information that is not in the context.`
};
/**
 * Get system prompt based on query type
 */
function getSystemPromptForQuery(query) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('price') ||
        lowerQuery.includes('cost') ||
        lowerQuery.includes('subscription') ||
        lowerQuery.includes('plan')) {
        return exports.SYSTEM_PROMPTS.pricing;
    }
    if (lowerQuery.includes('technical') ||
        lowerQuery.includes('architecture') ||
        lowerQuery.includes('infrastructure') ||
        lowerQuery.includes('integration')) {
        return exports.SYSTEM_PROMPTS.technical;
    }
    if (lowerQuery.includes('competitor') ||
        lowerQuery.includes('comparison') ||
        lowerQuery.includes('vs') ||
        lowerQuery.includes('pitch') ||
        lowerQuery.includes('sell')) {
        return exports.SYSTEM_PROMPTS.sales;
    }
    return exports.SYSTEM_PROMPTS.standard;
}
/**
 * Get model configuration for a specific task
 * @param config Model settings
 * @param task The task to get the model for
 * @returns Model provider, name and settings
 */
function getModelForTask(config = exports.AI_SETTINGS, task) {
    switch (task) {
        case 'chat':
            return {
                provider: 'openai',
                model: config.defaultModel,
                settings: {
                    temperature: config.temperature,
                    maxTokens: config.maxTokens
                }
            };
        case 'embedding':
            return {
                provider: 'gemini', // UPDATED: Always use Gemini for embeddings
                model: config.embeddingModel,
                settings: {
                    dimensions: config.embeddingDimension || 768
                }
            };
        case 'context':
            return {
                provider: config.contextGenerationModel.provider,
                model: config.contextGenerationModel.model,
                settings: {
                    temperature: config.contextGenerationModel.temperature,
                    maxTokens: config.contextGenerationModel.maxTokens
                }
            };
        case 'reranking':
            return {
                provider: config.rerankerModel.provider,
                model: config.rerankerModel.model,
                settings: {
                    temperature: config.rerankerModel.temperature
                }
            };
        default:
            return {
                provider: 'openai',
                model: config.defaultModel,
                settings: {
                    temperature: config.temperature,
                    maxTokens: config.maxTokens
                }
            };
    }
}
