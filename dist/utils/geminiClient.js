"use strict";
/**
 * Gemini Client
 *
 * This module provides functions for interacting with Google's Gemini API
 * to generate structured responses at a lower cost than GPT-4.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStructuredGeminiResponse = generateStructuredGeminiResponse;
exports.generateGeminiChatCompletion = generateGeminiChatCompletion;
exports.extractDocumentContext = extractDocumentContext;
exports.generateChunkContext = generateChunkContext;
const generative_ai_1 = require("@google/generative-ai");
const errorHandling_js_1 = require("./errorHandling.js");
const modelConfig_js_1 = require("./modelConfig.js");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Get API key from environment
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
// Initialize the Google Generative AI client
let genAI;
try {
    genAI = new generative_ai_1.GoogleGenerativeAI(apiKey || '');
}
catch (error) {
    console.error('Error initializing Google Generative AI client:', error);
}
// Available Gemini models:
// - gemini-2.0-flash: Latest model, faster and more efficient
// - gemini-2.0-pro: High capability model for complex tasks
// - gemini-1.0-pro: Earlier generation model
/**
 * Generate a structured response using Gemini API
 * @param systemPrompt The system instructions
 * @param userPrompt The user query or content to analyze
 * @param responseSchema JSON schema for the response structure
 * @returns Structured response object
 */
async function generateStructuredGeminiResponse(systemPrompt, userPrompt, responseSchema) {
    if (!apiKey || apiKey === 'your_google_ai_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured in environment');
    }
    try {
        // Combine system prompt with schema instructions
        const combinedPrompt = `${systemPrompt}
    
You MUST return a JSON object that matches the following schema:

${JSON.stringify(responseSchema, null, 2)}

Your response must be ONLY the JSON object, with no other text.`;
        // Get model configuration from the central config
        const modelConfig = (0, modelConfig_js_1.getModelForTask)(undefined, 'context');
        // Create a Gemini model instance
        const model = genAI.getGenerativeModel({
            model: modelConfig.model,
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
            ],
        });
        // Generate content
        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: combinedPrompt }] },
                { role: 'model', parts: [{ text: 'I understand. I will analyze the document and provide a structured JSON response according to the schema.' }] },
                { role: 'user', parts: [{ text: userPrompt }] }
            ],
            generationConfig: {
                temperature: modelConfig.settings.temperature,
                maxOutputTokens: modelConfig.settings.maxTokens || 4000,
            },
        });
        const response = result.response;
        const text = response.text();
        // Extract JSON from response
        try {
            // Try direct parsing
            return JSON.parse(text);
        }
        catch (e) {
            // If direct parsing fails, try to extract JSON from the text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            else {
                throw new Error('Failed to extract valid JSON from Gemini response');
            }
        }
    }
    catch (error) {
        (0, errorHandling_js_1.logError)('Error in generateStructuredGeminiResponse', error);
        throw error;
    }
}
/**
 * Generate a chat completion using Gemini API
 * @param systemPrompt System instructions
 * @param userPrompt User query or content
 * @returns Generated text response
 */
async function generateGeminiChatCompletion(systemPrompt, userPrompt) {
    if (!apiKey || apiKey === 'your_google_ai_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured in environment');
    }
    try {
        // Get model configuration from the central config
        const modelConfig = (0, modelConfig_js_1.getModelForTask)(undefined, 'chat');
        // Create a Gemini model instance
        const model = genAI.getGenerativeModel({
            model: modelConfig.model,
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
            ],
        });
        // Generate content
        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: 'I understand and will follow these instructions.' }] },
                { role: 'user', parts: [{ text: userPrompt }] }
            ],
            generationConfig: {
                temperature: modelConfig.settings.temperature,
                maxOutputTokens: modelConfig.settings.maxTokens || 2048,
            },
        });
        return result.response.text();
    }
    catch (error) {
        (0, errorHandling_js_1.logError)('Error in generateGeminiChatCompletion', error);
        return 'I apologize, but I encountered an issue processing your request. Please try again later.';
    }
}
/**
 * Extract document context using Gemini to understand the document content
 * @param documentText The text content of the document to analyze
 * @param metadata Optional existing metadata to enhance the analysis
 * @returns Structured document context including summary, topics, and more
 */
async function extractDocumentContext(documentText, metadata) {
    // Get a limited version of the text to avoid token limits
    const truncatedText = documentText.substring(0, 12000);
    // Create a descriptive prompt that includes any existing metadata
    let metadataHint = '';
    if (metadata) {
        metadataHint = `\nExisting metadata: ${JSON.stringify(metadata)}`;
    }
    const prompt = `
Analyze the following document and extract key information.
${metadataHint}

DOCUMENT:
${truncatedText}

Provide your analysis in JSON format with the following fields:
- summary: A concise 1-2 sentence summary of the document
- mainTopics: An array of 3-5 main topics covered
- entities: An array of key entities (people, companies, products) mentioned
- documentType: The type of document (e.g., "technical documentation", "marketing material", "educational content")
- technicalLevel: A number from 0-3 indicating technical complexity (0=non-technical, 3=highly technical)
- audienceType: An array of likely target audiences (e.g., ["developers", "sales team", "executives"])
`;
    try {
        // Define the expected schema
        const responseSchema = {
            summary: "string",
            mainTopics: "string[]",
            entities: "string[]",
            documentType: "string",
            technicalLevel: "number",
            audienceType: "string[]"
        };
        // Get model configuration from the central config
        const modelConfig = (0, modelConfig_js_1.getModelForTask)(undefined, 'context');
        // Create the model instance
        const model = genAI.getGenerativeModel({
            model: modelConfig.model,
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
            ],
        });
        // Generate content
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: modelConfig.settings.temperature,
                maxOutputTokens: modelConfig.settings.maxTokens || 4000,
            },
        });
        const response = result.response;
        const text = response.text();
        // Parse JSON response
        try {
            return JSON.parse(text);
        }
        catch (e) {
            // If direct parsing fails, try to extract JSON from the text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            else {
                throw new Error('Failed to extract valid JSON from Gemini response');
            }
        }
    }
    catch (error) {
        console.error("Error generating document context:", error);
        // Return a basic fallback in case of error
        return {
            summary: documentText.substring(0, 200) + "...",
            mainTopics: [],
            entities: [],
            documentType: "unknown",
            technicalLevel: 0,
            audienceType: []
        };
    }
}
/**
 * Generate context for a text chunk based on its content and optional document context
 * @param chunkText The text content of the chunk
 * @param documentContext Optional higher-level document context to inform analysis
 * @returns Structured chunk context including key points and characteristics
 */
async function generateChunkContext(chunkText, documentContext) {
    var _a, _b;
    // If we have document context, use it to inform chunk analysis
    let contextPrefix = "";
    if (documentContext) {
        contextPrefix = `This is part of a ${documentContext.documentType || 'document'} about ${((_a = documentContext.mainTopics) === null || _a === void 0 ? void 0 : _a.join(", ")) || 'various topics'}.`;
        if (documentContext.technicalLevel !== undefined) {
            const techLevelText = ["non-technical", "basic technical", "intermediate technical", "highly technical"][documentContext.technicalLevel] || "";
            contextPrefix += ` The document has a ${techLevelText} complexity level.`;
        }
        if ((_b = documentContext.audienceType) === null || _b === void 0 ? void 0 : _b.length) {
            contextPrefix += ` The audience is ${documentContext.audienceType.join(", ")}.`;
        }
    }
    const prompt = `
${contextPrefix}

Analyze the following text chunk and extract key information:

"${chunkText}"

Provide your analysis in JSON format with the following fields:
- description: A 1-sentence description of what this chunk is about
- keyPoints: 1-3 key points from this chunk
- isDefinition: boolean indicating if this chunk contains a definition
- containsExample: boolean indicating if this chunk contains an example
- relatedTopics: 1-3 related topics this chunk might connect to
`;
    try {
        // Get model configuration from the central config
        const modelConfig = (0, modelConfig_js_1.getModelForTask)(undefined, 'context');
        // Create the model instance
        const model = genAI.getGenerativeModel({
            model: modelConfig.model,
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
            ],
        });
        // Generate content
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: modelConfig.settings.temperature,
                maxOutputTokens: modelConfig.settings.maxTokens || 1024,
            },
        });
        const response = result.response;
        const text = response.text();
        // Parse JSON response
        try {
            return JSON.parse(text);
        }
        catch (e) {
            // If direct parsing fails, try to extract JSON from the text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            else {
                throw new Error('Failed to extract valid JSON from Gemini response');
            }
        }
    }
    catch (error) {
        console.error("Error generating chunk context:", error);
        // Return a basic fallback in case of error
        return {
            description: chunkText.substring(0, 100) + "...",
            keyPoints: [],
            isDefinition: false,
            containsExample: false,
            relatedTopics: []
        };
    }
}
