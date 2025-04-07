"use strict";
/**
 * AI model configuration settings for the RAG system
 * This provides centralized configuration for all AI model settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_PROMPTS = exports.AI_SETTINGS = void 0;
exports.getSystemPromptForQuery = getSystemPromptForQuery;
/**
 * Application AI settings
 */
exports.AI_SETTINGS = {
    // Default model for standard operations
    defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
    // Fallback model when primary is unavailable or for less critical operations
    fallbackModel: process.env.FALLBACK_LLM_MODEL || 'gpt-3.5-turbo-1106',
    // Embedding model for vector operations
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
    // Default max tokens for generation
    maxTokens: 1000,
    // Default temperature for most operations
    temperature: 0.7,
    // Default system prompt for RAG queries
    systemPrompt: `You are an AI assistant for the sales team. 
Answer the question based ONLY on the context provided. 
If the answer cannot be determined from the context, say "I don't have enough information to answer this question."
Do not make up or infer information that is not in the context.
Provide concise, accurate responses with all relevant details from the context.`
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
