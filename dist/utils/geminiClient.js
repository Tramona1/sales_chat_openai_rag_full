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
const generative_ai_1 = require("@google/generative-ai");
const errorHandling_1 = require("./errorHandling");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Get API key from environment
const apiKey = process.env.GOOGLE_AI_API_KEY;
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
// - gemini-1.5-pro: High capability model for complex tasks
// - gemini-1.5-flash: Faster version of 1.5
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
        throw new Error('GOOGLE_AI_API_KEY is not configured in environment');
    }
    try {
        // Combine system prompt with schema instructions
        const combinedPrompt = `${systemPrompt}
    
You MUST return a JSON object that matches the following schema:

${JSON.stringify(responseSchema, null, 2)}

Your response must be ONLY the JSON object, with no other text.`;
        // Create a Gemini model instance
        // Using gemini-2.0-flash for best performance/cost ratio
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
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
                temperature: 0.2,
                maxOutputTokens: 4000,
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
        (0, errorHandling_1.logError)('Error in generateStructuredGeminiResponse', error);
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
        throw new Error('GOOGLE_AI_API_KEY is not configured in environment');
    }
    try {
        // Create a Gemini model instance
        // Using gemini-2.0-flash for best performance/cost ratio
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
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
                temperature: 0.7,
                maxOutputTokens: 2048,
            },
        });
        return result.response.text();
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error in generateGeminiChatCompletion', error);
        return 'I apologize, but I encountered an issue processing your request. Please try again later.';
    }
}
