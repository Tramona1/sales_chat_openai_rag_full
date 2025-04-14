"use strict";
/**
 * Fallback implementations for modelConfig
 * This provides backup implementations if the main imports fail
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_SETTINGS = void 0;
exports.getModelForTask = getModelForTask;
exports.getSystemPromptForQuery = getSystemPromptForQuery;
// Default model settings
exports.AI_SETTINGS = {
    defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
    fallbackModel: process.env.FALLBACK_LLM_MODEL || 'gpt-3.5-turbo-1106',
    embeddingModel: 'text-embedding-004',
    embeddingDimension: 768,
    maxTokens: 1000,
    temperature: 0.7,
    systemPrompt: 'You are a helpful assistant that answers based only on provided context.',
    contextGenerationModel: {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.2,
        maxTokens: 1024
    },
    rerankerModel: {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.1
    }
};
// Fallback implementation for getModelForTask
function getModelForTask(config, task) {
    if (config === void 0) { config = exports.AI_SETTINGS; }
    if (task === void 0) { task = 'chat'; }
    switch (task) {
        case 'chat':
            return {
                provider: 'gemini',
                model: config.defaultModel,
                settings: {
                    temperature: config.temperature,
                    maxTokens: config.maxTokens
                }
            };
        case 'embedding':
            return {
                provider: 'gemini',
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
                provider: 'gemini',
                model: config.defaultModel,
                settings: {
                    temperature: config.temperature,
                    maxTokens: config.maxTokens
                }
            };
    }
}
// Simple implementation for getSystemPromptForQuery
function getSystemPromptForQuery(query) {
    // Simple implementation that always returns the standard prompt
    return exports.AI_SETTINGS.systemPrompt;
}
// Create a default export with all the named exports
var modelConfigFallback = {
    AI_SETTINGS: exports.AI_SETTINGS,
    getModelForTask: getModelForTask,
    getSystemPromptForQuery: getSystemPromptForQuery
};
// Export as default
exports.default = modelConfigFallback;
