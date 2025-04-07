"use strict";
/**
 * OpenAI client utility for the RAG system
 * Handles API interactions with OpenAI including embeddings and chat completions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.openai = void 0;
exports.embedText = embedText;
exports.generateChatCompletion = generateChatCompletion;
exports.generateStructuredResponse = generateStructuredResponse;
exports.batchProcessPrompts = batchProcessPrompts;
exports.rankTextsForQuery = rankTextsForQuery;
const openai_1 = require("openai");
const modelConfig_1 = require("./modelConfig");
const errorHandling_1 = require("./errorHandling");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
// Initialize OpenAI client
exports.openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * Generate embeddings for text using OpenAI
 * Used for vector similarity search
 */
async function embedText(text) {
    try {
        // Clean and prepare text
        const cleanedText = text.trim().replace(/\n+/g, ' ');
        // Get embedding from OpenAI
        const response = await exports.openai.embeddings.create({
            model: modelConfig_1.AI_SETTINGS.embeddingModel,
            input: cleanedText,
        });
        // Return the embedding vector
        return response.data[0].embedding;
    }
    catch (error) {
        (0, errorHandling_1.logError)(error, 'embedText');
        // In case of error, return a zero vector as fallback
        // This should be handled by the calling function
        console.error('Error generating embedding:', error);
        return Array(1536).fill(0);
    }
}
/**
 * Generate a chat completion using OpenAI
 */
async function generateChatCompletion(systemPrompt, userPrompt, model = modelConfig_1.AI_SETTINGS.defaultModel, jsonMode = false) {
    try {
        const messages = [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: userPrompt,
            },
        ];
        // If model isn't specified, use default
        const modelToUse = model || modelConfig_1.AI_SETTINGS.defaultModel;
        // Only include response_format if jsonMode is true and we're using a compatible model (GPT-4 and above)
        const supportsJsonMode = modelToUse.includes('gpt-4') ||
            modelToUse.includes('gpt-3.5-turbo-16k') ||
            modelToUse.includes('gpt-3.5-turbo-1106');
        // Call OpenAI API
        const response = await exports.openai.chat.completions.create({
            model: modelToUse,
            messages,
            temperature: modelConfig_1.AI_SETTINGS.temperature,
            max_tokens: modelConfig_1.AI_SETTINGS.maxTokens,
            response_format: jsonMode && supportsJsonMode ? { type: 'json_object' } : undefined,
        });
        // Extract and return the response text
        return response.choices[0].message.content || '';
    }
    catch (error) {
        console.error('Error generating chat completion:', error);
        // Try fallback model if primary fails
        if (model === modelConfig_1.AI_SETTINGS.defaultModel) {
            console.log('Attempting with fallback model...');
            return generateChatCompletion(systemPrompt, userPrompt, modelConfig_1.AI_SETTINGS.fallbackModel, jsonMode);
        }
        // If fallback also fails, return error message
        return 'I apologize, but I encountered an issue processing your request. Please try again later.';
    }
}
/**
 * Generate a structured response with JSON output
 */
async function generateStructuredResponse(systemPrompt, userPrompt, responseSchema, model = modelConfig_1.AI_SETTINGS.defaultModel) {
    try {
        // Append schema information to system prompt
        const schemaPrompt = `${systemPrompt}
    
Return your response in the following JSON format:
${JSON.stringify(responseSchema, null, 2)}

Your response MUST be a valid JSON object with no additional text, explanations, or formatting.`;
        // Generate completion with JSON mode enabled if the model supports it
        const response = await generateChatCompletion(schemaPrompt, userPrompt, model, true);
        try {
            // Try to parse JSON response
            return JSON.parse(response);
        }
        catch (jsonError) {
            // If JSON parsing fails, try to extract JSON from the response
            // This can happen with models that don't support jsonMode
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            console.error('Failed to parse JSON response:', jsonError);
            return null;
        }
    }
    catch (error) {
        console.error('Error generating structured response:', error);
        return null;
    }
}
/**
 * Batch process multiple prompts with a single API call
 * Useful for re-ranking to save on API calls
 */
async function batchProcessPrompts(systemPrompt, userPrompts, model = modelConfig_1.AI_SETTINGS.defaultModel, options = {}) {
    // Set a timeout
    const timeoutMs = options.timeoutMs || 10000;
    try {
        // Create a Promise for the API call
        const apiPromise = Promise.all(userPrompts.map(userPrompt => generateChatCompletion(systemPrompt, userPrompt, model, options.jsonMode || false)));
        // Create a timeout Promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Batch processing timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        // Race the API call against the timeout
        return await Promise.race([apiPromise, timeoutPromise]);
    }
    catch (error) {
        (0, errorHandling_1.logError)(error, 'batchProcessPrompts');
        // Return empty results on error
        return userPrompts.map(() => "");
    }
}
/**
 * Process a batch of texts with an LLM for re-ranking
 * Specialized function for re-ranking that processes multiple documents
 * with a single API call for efficiency
 */
async function rankTextsForQuery(query, texts, model = modelConfig_1.AI_SETTINGS.fallbackModel, options = {}) {
    try {
        // Create the system prompt for re-ranking
        const systemPrompt = `You are a document relevance judge. Rate how relevant each document is to the query on a scale of 0-10 where:
- 10: Perfect match with specific details answering the query
- 7-9: Highly relevant with key information related to the query
- 4-6: Somewhat relevant but lacks specific details
- 1-3: Only tangentially related to the query
- 0: Not relevant at all

Return a JSON object with only scores in this format:
{"scores": [score1, score2, ...]}

Your response MUST be a valid JSON object with no additional text, explanations, or formatting.`;
        // Create a single user prompt with all texts
        const userPrompt = `Query: ${query}

${texts.map((text, i) => `DOCUMENT ${i + 1}:
${text.substring(0, 600)}${text.length > 600 ? '...' : ''}`).join('\n\n')}

Provide a relevance score from 0-10 for each document based on how well it answers the query.`;
        // Generate the ranking with a timeout
        const timeoutMs = options.timeoutMs || 15000;
        const rankingPromise = generateStructuredResponse(systemPrompt, userPrompt, { scores: [] }, model);
        // Create a timeout Promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Re-ranking timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        // Race the API call against the timeout
        const response = await Promise.race([rankingPromise, timeoutPromise]);
        // Return scores
        if (response && Array.isArray(response.scores)) {
            return response.scores;
        }
        else {
            console.warn('Invalid scores format received, using default scores');
            return texts.map(() => 5); // Default to middle score if failed
        }
    }
    catch (error) {
        console.error('Error in rankTextsForQuery:', error);
        return texts.map(() => 5); // Default score on error
    }
}
