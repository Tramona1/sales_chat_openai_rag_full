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
    defaultModel: process.env.DEFAULT_LLM_MODEL || 'gemini-2.0-flash',
    // Fallback model when primary is unavailable or for less critical operations
    fallbackModel: process.env.FALLBACK_LLM_MODEL || 'gpt-3.5-turbo-1106',
    // Embedding model for vector operations - MIGRATED TO GEMINI
    embeddingModel: 'text-embedding-004',
    // Embedding dimension - 768 for Gemini text-embedding-004
    embeddingDimension: 768,
    // Default max tokens for generation
    maxTokens: 1000,
    // Default temperature for most operations
    temperature: 0.7,
    // Default system prompt for RAG queries
    systemPrompt: "You are an AI assistant for the sales team for Workstream. Workstream is a leading HR, payroll, and hiring platform designed specifically for managing the hourly workforce, offering a suite of tools that automate hiring, onboarding, scheduling, and payroll processes to streamline operations for businesses across various industries. By integrating these functions into a mobile-first platform, Workstream helps companies reduce labor costs, improve compliance, and enhance employee engagement.\nAnswer the question based ONLY on the context provided. \nIf the answer cannot be determined from the context, say \"I don't have enough information to answer this question, please add more training information to help me learn.\"\nDo not make up or infer information that is not in the context.\nProvide concise, accurate responses with all relevant details from the context.",
    // Updated contextual generation model settings for multi-modal RAG
    contextGenerationModel: {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.2,
        maxTokens: 1024
    },
    // Updated reranker model settings for visual content awareness
    rerankerModel: {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.1
    }
};
/**
 * Different preset system prompts for various use cases
 */
exports.SYSTEM_PROMPTS = {
    standard: exports.AI_SETTINGS.systemPrompt,
    technical: "You are an AI assistant for the sales team specializing in technical questions.\nAnswer the question based ONLY on the context provided.\nUse technical language and be precise in your explanations.\nIf the answer cannot be determined from the context, say \"I don't have enough information to answer this question, please add more training information to help me learn.\"\nDo not make up or infer information that is not in the context.",
    sales: "You are an AI assistant for the sales team specializing in sales queries.\nAnswer the question based ONLY on the context provided.\nFocus on value propositions, competitive advantages, and addressing customer pain points.\nIf the answer cannot be determined from the context, say \"I don't have enough information to answer this question, please add more training information to help me learn.\"\nDo not make up or infer information that is not in the context.",
    pricing: "You are an AI assistant for the sales team specializing in pricing questions.\nAnswer the question based ONLY on the context provided.\nBe very precise about pricing details, plans, and subscription options.\nIf the answer cannot be determined from the context, say \"I don't have enough information to answer this question, please add more training information to help me learn.\"\nDo not make up or infer information that is not in the context."
};
/**
 * Get system prompt based on query type
 */
function getSystemPromptForQuery(query) {
    var lowerQuery = query.toLowerCase();
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
function getModelForTask(config, task) {
    if (config === void 0) { config = exports.AI_SETTINGS; }
    switch (task) {
        case 'chat':
            // Check the model name BUT prioritize Gemini if 'gemini' is in the name
            var modelName = config.defaultModel.toLowerCase();
            // If the defaultModel name contains 'gemini', OR if we generally prefer Gemini,
            // return Gemini provider and the default model name.
            // This removes the automatic fallback to 'openai' provider just based on name.
            // Ensure defaultModel is actually a valid Gemini model if this path is taken.
            // We assume here the intention is to use Gemini primarily.
            // if (modelName.includes('gemini')) { 
            return {
                provider: 'gemini',
                model: config.defaultModel, // Use the configured default model
                settings: {
                    temperature: config.temperature,
                    maxTokens: config.maxTokens
                }
            };
        // } else {
        //   // REMOVED: Assume OpenAI for models like gpt-x
        //   // This was likely causing the issue if DEFAULT_LLM_MODEL was set to 'gpt-4'
        //   return {
        //     provider: 'openai',
        //     model: config.defaultModel,
        //     settings: {
        //       temperature: config.temperature,
        //       maxTokens: config.maxTokens
        //     }
        //   };
        // }
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
            // Default case also checks model name
            var defaultModelName = config.defaultModel.toLowerCase();
            if (defaultModelName.includes('gemini')) {
                return {
                    provider: 'gemini',
                    model: config.defaultModel,
                    settings: {
                        temperature: config.temperature,
                        maxTokens: config.maxTokens
                    }
                };
            }
            else {
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
}
// Create a default export object with all the named exports as properties
var modelConfig = {
    AI_SETTINGS: exports.AI_SETTINGS,
    SYSTEM_PROMPTS: exports.SYSTEM_PROMPTS,
    getSystemPromptForQuery: getSystemPromptForQuery,
    getModelForTask: getModelForTask
};
// Export as default
exports.default = modelConfig;
