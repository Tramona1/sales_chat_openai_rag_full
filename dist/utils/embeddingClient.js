"use strict";
/**
 * Embedding Client Factory
 *
 * This module provides a unified interface for generating embeddings
 * from different providers (OpenAI and Gemini).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmbeddingClient = getEmbeddingClient;
exports.embedText = embedText;
exports.embedBatch = embedBatch;
const openai_1 = require("openai");
const generative_ai_1 = require("@google/generative-ai");
const modelConfig_js_1 = require("./modelConfig.js");
const errorHandling_js_1 = require("./errorHandling.js");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Initialize OpenAI client
const openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// Initialize Gemini client
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey || '');
/**
 * OpenAI implementation of the EmbeddingClient
 */
class OpenAIEmbeddingClient {
    constructor() {
        this.dimensions = 1536; // Ada-002 embedding dimensions
    }
    async embedText(text) {
        try {
            // Clean and prepare text
            const cleanedText = text.trim().replace(/\n+/g, ' ');
            // Get embedding from OpenAI
            const response = await openai.embeddings.create({
                model: modelConfig_js_1.AI_SETTINGS.embeddingModel,
                input: cleanedText,
            });
            // Return the embedding vector
            return response.data[0].embedding;
        }
        catch (error) {
            (0, errorHandling_js_1.logError)('Error generating OpenAI embedding', error);
            // In case of error, return a zero vector as fallback
            console.error('Error generating OpenAI embedding:', error);
            return Array(this.dimensions).fill(0);
        }
    }
    async embedBatch(texts) {
        try {
            // Clean all texts
            const cleanedTexts = texts.map(text => text.trim().replace(/\n+/g, ' '));
            // Get embeddings from OpenAI
            const response = await openai.embeddings.create({
                model: modelConfig_js_1.AI_SETTINGS.embeddingModel,
                input: cleanedTexts,
            });
            // Return the embedding vectors
            return response.data.map(item => item.embedding);
        }
        catch (error) {
            (0, errorHandling_js_1.logError)('Error generating batch OpenAI embeddings', error);
            // In case of error, return zero vectors as fallback
            console.error('Error generating batch OpenAI embeddings:', error);
            return texts.map(() => Array(this.dimensions).fill(0));
        }
    }
    getProvider() {
        return 'openai';
    }
    getDimensions() {
        return this.dimensions;
    }
}
/**
 * Gemini implementation of the EmbeddingClient
 */
class GeminiEmbeddingClient {
    constructor() {
        this.dimensions = 768; // Gemini embedding dimensions
        this.embeddingModel = 'models/text-embedding-004';
    }
    async embedText(text) {
        try {
            // Clean and prepare text
            const cleanedText = text.trim().replace(/\n+/g, ' ');
            // Get the embedding model
            const embeddingModel = genAI.getGenerativeModel({
                model: this.embeddingModel
            });
            // Generate embedding
            const result = await embeddingModel.embedContent({
                content: { parts: [{ text: cleanedText }], role: 'user' },
                taskType: generative_ai_1.TaskType.RETRIEVAL_DOCUMENT
            });
            // Return the embedding vector
            return result.embedding.values;
        }
        catch (error) {
            (0, errorHandling_js_1.logError)('Error generating Gemini embedding', error);
            // In case of error, return a zero vector as fallback
            console.error('Error generating Gemini embedding:', error);
            return Array(this.dimensions).fill(0);
        }
    }
    async embedBatch(texts, taskType = 'RETRIEVAL_DOCUMENT') {
        // Google's API doesn't support batching natively, so we do it sequentially
        try {
            // Convert the task type string to the enum value if provided
            const task = taskType === 'RETRIEVAL_DOCUMENT'
                ? generative_ai_1.TaskType.RETRIEVAL_DOCUMENT
                : generative_ai_1.TaskType.RETRIEVAL_QUERY;
            // Get the embedding model once
            const embeddingModel = genAI.getGenerativeModel({
                model: this.embeddingModel
            });
            // Process texts in batches to avoid overwhelming the API
            const batchSize = 10;
            const results = [];
            // Process in smaller batches
            for (let i = 0; i < texts.length; i += batchSize) {
                const batchTexts = texts.slice(i, i + batchSize);
                // Process the batch with Promise.all for parallel execution
                const batchResults = await Promise.all(batchTexts.map(async (text) => {
                    const cleanedText = text.trim().replace(/\n+/g, ' ');
                    try {
                        const result = await embeddingModel.embedContent({
                            content: { parts: [{ text: cleanedText }], role: 'user' },
                            taskType: task
                        });
                        return result.embedding.values;
                    }
                    catch (error) {
                        (0, errorHandling_js_1.logError)(`Error embedding text at index ${i}`, error);
                        return Array(this.dimensions).fill(0);
                    }
                }));
                results.push(...batchResults);
            }
            return results;
        }
        catch (error) {
            (0, errorHandling_js_1.logError)('Error in Gemini batch embedding', error);
            console.error('Error in Gemini batch embedding:', error);
            return texts.map(() => Array(this.dimensions).fill(0));
        }
    }
    getProvider() {
        return 'gemini';
    }
    getDimensions() {
        return this.dimensions;
    }
}
/**
 * Factory function to get the appropriate embedding client
 * Always returns the Gemini embedding client after migration
 */
function getEmbeddingClient() {
    // After migration, we exclusively use Gemini embeddings
    console.log('Using Gemini for embeddings (models/text-embedding-004)');
    return new GeminiEmbeddingClient();
}
/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
async function embedText(text) {
    const client = getEmbeddingClient();
    return client.embedText(text);
}
/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
async function embedBatch(texts) {
    const client = getEmbeddingClient();
    return client.embedBatch(texts);
}
