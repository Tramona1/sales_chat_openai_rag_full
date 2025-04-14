"use strict";
/**
 * Gemini Client
 *
 * This module provides functions for interacting with Google's Gemini API
 * to generate structured responses at a lower cost than GPT-4.
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStructuredGeminiResponse = generateStructuredGeminiResponse;
exports.generateGeminiChatCompletion = generateGeminiChatCompletion;
exports.extractDocumentContext = extractDocumentContext;
exports.generateChunkContext = generateChunkContext;
exports.embedTextWithGemini = embedTextWithGemini;
var generative_ai_1 = require("@google/generative-ai");
var logger_1 = require("./logger");
var dotenv_1 = __importDefault(require("dotenv"));
var jsonRepairUtils_js_1 = require("./jsonRepairUtils.js");
// Load environment variables
dotenv_1.default.config();
// Use dynamic import for modelConfig
var getModelForTask = function (config, task) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        // Default implementation in case imports fail
        return [2 /*return*/, {
                provider: 'gemini',
                model: 'gemini-2.0-flash',
                settings: {
                    temperature: 0.2,
                    maxTokens: 4000
                }
            }];
    });
}); };
// Initialize getModelForTask asynchronously
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var modelConfig, error_1, fallbackConfig, fallbackError_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 7]);
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./modelConfig')); })];
            case 1:
                modelConfig = _a.sent();
                getModelForTask = modelConfig.getModelForTask;
                return [3 /*break*/, 7];
            case 2:
                error_1 = _a.sent();
                console.warn('Error importing from modelConfig, using fallback', error_1);
                _a.label = 3;
            case 3:
                _a.trys.push([3, 5, , 6]);
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./modelConfigFallback')); })];
            case 4:
                fallbackConfig = _a.sent();
                getModelForTask = fallbackConfig.getModelForTask;
                return [3 /*break*/, 6];
            case 5:
                fallbackError_1 = _a.sent();
                console.error('Failed to import from modelConfigFallback too', fallbackError_1);
                return [3 /*break*/, 6];
            case 6: return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); })();
// Get API key from environment
var apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
// Initialize the Google Generative AI client
var genAI;
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
 * Robustly extract a JSON object from text that may contain markdown, code blocks, or other formatting
 * @returns parsed JSON object or a Promise that will resolve to the parsed JSON if LLM repair is needed
 */
function extractJsonFromText(text) {
    // Try direct parsing first
    try {
        return JSON.parse(text);
    }
    catch (e) {
        // Check for JSON in code blocks (```json {...} ``` or ```json [...] ```)
        var codeBlockMatch = text.match(/```(?:json)?\s*([\[\{][\s\S]*?[\]\}])\s*```/);
        if (codeBlockMatch) {
            try {
                return JSON.parse(codeBlockMatch[1]);
            }
            catch (innerError) {
                // Try to fix common JSON syntax errors in the matched code block
                try {
                    var cleanedText = codeBlockMatch[1]
                        .replace(/(\w+):/g, '"$1":') // Convert unquoted keys to quoted keys
                        .replace(/'/g, '"') // Replace single quotes with double quotes
                        .replace(/,\s*}/g, '}') // Remove trailing commas in objects
                        .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
                    return JSON.parse(cleanedText);
                }
                catch (cleanError) {
                    // Continue to other approaches
                }
            }
        }
        // Try to extract any JSON object or array with balanced braces/brackets
        var jsonMatch = text.match(/([\[\{][\s\S]*?[\]\}])/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            }
            catch (innerError) {
                // If still failing, try cleaning the text more aggressively
                try {
                    var cleanedText = jsonMatch[0]
                        .replace(/(\w+):/g, '"$1":') // Convert unquoted keys to quoted keys
                        .replace(/'/g, '"') // Replace single quotes with double quotes
                        .replace(/,\s*}/g, '}') // Remove trailing commas in objects
                        .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
                        .replace(/\n/g, '') // Remove newlines
                        .replace(/\t/g, '') // Remove tabs
                        .replace(/\\/g, '\\\\') // Escape backslashes
                        .replace(/"\s*:\s*([^"[\]{},\s][^,\s}]*)/g, '":"$1"'); // Quote unquoted string values
                    // Fix common patterns with missing quotes around values
                    cleanedText = cleanedText.replace(/":\s*(\w+)/g, function (match, p1) {
                        // Don't add quotes to true, false, null, or numbers
                        if (p1 === 'true' || p1 === 'false' || p1 === 'null' || !isNaN(Number(p1))) {
                            return match;
                        }
                        return '":"' + p1 + '"';
                    });
                    return JSON.parse(cleanedText);
                }
                catch (finalError) {
                    // Last resort: try to parse with a custom JSON-like structure repair
                    try {
                        // Replace consecutive commas with a single comma
                        var repairText = jsonMatch[0].replace(/,\s*,+/g, ',');
                        // Ensure object keys are properly quoted
                        repairText = repairText.replace(/(\w+)\s*:/g, '"$1":');
                        // Replace any comma followed by a closing bracket with just the bracket
                        repairText = repairText.replace(/,(\s*[\]}])/g, '$1');
                        // Quote unquoted values that aren't numbers, booleans or null
                        repairText = repairText.replace(/":\s*([^",\{\}\[\]\s]+)([,\}\]])/g, function (match, value, delimiter) {
                            if (value === 'true' || value === 'false' || value === 'null' || !isNaN(Number(value))) {
                                return '":' + value + delimiter;
                            }
                            return '":"' + value + '"' + delimiter;
                        });
                        return JSON.parse(repairText);
                    }
                    catch (lastError) {
                        // All traditional repair methods failed
                        // Log the text that we couldn't parse
                        console.error('Failed to extract valid JSON. Text sample:', text.substring(0, 200));
                        console.log('All traditional JSON parsing methods failed, will try LLM repair');
                        // Return a rejection object that the calling function can handle
                        return {
                            needsLLMRepair: true,
                            text: text
                        };
                    }
                }
            }
        }
        // Log the text that we couldn't parse
        console.error('Failed to extract valid JSON. Text sample:', text.substring(0, 200));
        console.log('No JSON structure detected, will try LLM repair');
        // Return a rejection object that the calling function can handle
        return {
            needsLLMRepair: true,
            text: text
        };
    }
}
/**
 * Last-resort method that uses the LLM itself to repair malformed JSON
 * Only called when all other JSON extraction methods have failed
 */
function tryLLMJsonRepair(text) {
    return __awaiter(this, void 0, void 0, function () {
        var modelConfig, model, repairPrompt, result, repairedText, jsonMatch, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('[JSON Repair] Attempting LLM-based JSON repair as last resort');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, getModelForTask(undefined, 'context')];
                case 2:
                    modelConfig = _a.sent();
                    model = genAI.getGenerativeModel({
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
                    repairPrompt = "\nI need you to fix the following malformed JSON and return ONLY the corrected, valid JSON with no explanations or additional text.\nDon't change the structure or content, just fix the syntax to make it valid JSON.\n\n".concat(text, "\n");
                    return [4 /*yield*/, model.generateContent({
                            contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
                            generationConfig: {
                                temperature: 0.1, // Very low temperature for deterministic repairs
                                maxOutputTokens: modelConfig.settings.maxTokens || 2048,
                            },
                        })];
                case 3:
                    result = _a.sent();
                    repairedText = result.response.text();
                    console.log('[JSON Repair] LLM generated repair:', repairedText.substring(0, 100) + '...');
                    // Try parsing the repaired text
                    try {
                        return [2 /*return*/, JSON.parse(repairedText)];
                    }
                    catch (parseError) {
                        jsonMatch = repairedText.match(/([\[\{][\s\S]*?[\]\}])/);
                        if (jsonMatch) {
                            return [2 /*return*/, JSON.parse(jsonMatch[0])];
                        }
                        // If that fails too, give up and throw the error
                        console.error('[JSON Repair] Failed to parse LLM-repaired JSON:', parseError);
                        throw parseError;
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.error('[JSON Repair] LLM-based repair failed:', error_2);
                    throw new Error('LLM-based JSON repair failed');
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generate a structured response using Gemini API
 * @param systemPrompt The system instructions
 * @param userPrompt The user query or content to analyze
 * @param responseSchema JSON schema for the response structure
 * @returns Structured response object
 */
function generateStructuredGeminiResponse(systemPrompt, userPrompt, responseSchema) {
    return __awaiter(this, void 0, void 0, function () {
        var combinedPrompt, modelConfig, model, result, response, text, error_3, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!apiKey || apiKey === 'your_google_ai_api_key_here') {
                        throw new Error('GEMINI_API_KEY is not configured in environment');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    combinedPrompt = "".concat(systemPrompt, "\n    \nYou MUST return a JSON object that matches the following schema:\n\n").concat(JSON.stringify(responseSchema, null, 2), "\n\nIMPORTANT: Return ONLY the raw JSON data with NO markdown formatting, no code blocks, and no extra text.\nDO NOT wrap the JSON in ```json or any other formatting.\nThe response should begin with either { or [ and end with } or ], with no text before or after.\nEnsure all JSON keys and string values are in double quotes.\nDo not use trailing commas in objects or arrays.");
                    return [4 /*yield*/, getModelForTask(undefined, 'context')];
                case 2:
                    modelConfig = _a.sent();
                    model = genAI.getGenerativeModel({
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
                    return [4 /*yield*/, model.generateContent({
                            contents: [
                                { role: 'user', parts: [{ text: combinedPrompt }] },
                                { role: 'model', parts: [{ text: 'I understand. I will provide a properly formatted JSON object that matches the schema, with no additional text or formatting.' }] },
                                { role: 'user', parts: [{ text: userPrompt }] }
                            ],
                            generationConfig: {
                                temperature: modelConfig.settings.temperature,
                                maxOutputTokens: modelConfig.settings.maxTokens || 4000,
                            },
                        })];
                case 3:
                    result = _a.sent();
                    response = result.response;
                    text = response.text();
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, (0, jsonRepairUtils_js_1.parseAndRepairJson)(text, { genAI: genAI })];
                case 5: return [2 /*return*/, _a.sent()];
                case 6:
                    error_3 = _a.sent();
                    // If even our robust parsing/repair failed, return an error object
                    (0, logger_1.logError)('Failed to parse Gemini response as JSON even with repair', error_3);
                    return [2 /*return*/, {
                            error: true,
                            message: "Failed to parse Gemini response as JSON",
                            rawResponse: text.substring(0, 500) // Include a sample of the raw response for debugging
                        }];
                case 7: return [3 /*break*/, 9];
                case 8:
                    error_4 = _a.sent();
                    (0, logger_1.logError)('Error in generateStructuredGeminiResponse', error_4);
                    throw error_4;
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generate a chat completion using Gemini API
 * @param systemPrompt System instructions
 * @param userPrompt User query or content
 * @returns Generated text response
 */
function generateGeminiChatCompletion(systemPrompt, userPrompt) {
    return __awaiter(this, void 0, void 0, function () {
        var modelConfig, model, result, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!apiKey || apiKey === 'your_google_ai_api_key_here') {
                        throw new Error('GEMINI_API_KEY is not configured in environment');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, getModelForTask(undefined, 'chat')];
                case 2:
                    modelConfig = _a.sent();
                    // <<< ADDED LOGGING >>>
                    (0, logger_1.logDebug)("[generateGeminiChatCompletion] Using model name from config: ".concat(modelConfig.model));
                    model = genAI.getGenerativeModel({
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
                    return [4 /*yield*/, model.generateContent({
                            contents: [
                                { role: 'user', parts: [{ text: systemPrompt }] },
                                { role: 'model', parts: [{ text: 'I understand and will follow these instructions.' }] },
                                { role: 'user', parts: [{ text: userPrompt }] }
                            ],
                            generationConfig: {
                                temperature: modelConfig.settings.temperature,
                                maxOutputTokens: modelConfig.settings.maxTokens || 2048,
                            },
                        })];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, result.response.text()];
                case 4:
                    error_5 = _a.sent();
                    (0, logger_1.logError)('Error in generateGeminiChatCompletion', error_5);
                    return [2 /*return*/, 'I apologize, but I encountered an issue processing your request. Please try again later.'];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Extract document context using Gemini to understand the document content
 * @param documentText The text content of the document to analyze
 * @param metadata Optional existing metadata to enhance the analysis
 * @returns Structured document context including summary, topics, and more
 */
function extractDocumentContext(documentText, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var truncatedText, metadataHint, prompt, responseSchema, modelConfig, model, result, response, text, parsedResult, error_6, extractedContext, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    truncatedText = documentText.substring(0, 12000);
                    metadataHint = '';
                    if (metadata) {
                        metadataHint = "\nExisting metadata: ".concat(JSON.stringify(metadata));
                    }
                    prompt = "\nAnalyze the following document and extract key information.\n".concat(metadataHint, "\n\nDOCUMENT:\n").concat(truncatedText, "\n\nProvide your analysis in JSON format with the following fields:\n- summary: A concise 1-2 sentence summary of the document\n- mainTopics: An array of 3-5 main topics covered\n- entities: An array of key entities (people, companies, products) mentioned\n- documentType: The type of document (e.g., \"technical documentation\", \"marketing material\", \"educational content\", \"product documentation\", \"case study\", \"white paper\", \"tutorial\", \"guide\", \"API reference\")\n- technicalLevel: A number from 0-3 indicating technical complexity (0=non-technical, 3=highly technical)\n- audienceType: An array of specific target audiences. Consider multiple dimensions:\n  * Role types: developers, data scientists, executives, sales reps, marketing team, product managers, support staff, IT admins, DevOps, designers, architects, consultants, etc.\n  * Seniority: junior, mid-level, senior, executive, C-suite\n  * Industries: healthcare, finance, education, retail, manufacturing, tech, telecom, media, government, etc.\n  * Technical knowledge: technical, semi-technical, non-technical\n  * Buying stage: prospect, evaluating, customer, partner\n  * Department: engineering, marketing, sales, operations, HR, finance, legal, customer success\nBe specific and comprehensive with audience tags.\n");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    responseSchema = {
                        summary: "string",
                        mainTopics: "string[]",
                        entities: "string[]",
                        documentType: "string",
                        technicalLevel: "number",
                        audienceType: "string[]"
                    };
                    return [4 /*yield*/, getModelForTask(undefined, 'context')];
                case 2:
                    modelConfig = _a.sent();
                    model = genAI.getGenerativeModel({
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
                    return [4 /*yield*/, model.generateContent({
                            contents: [{ role: 'user', parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: modelConfig.settings.temperature,
                                maxOutputTokens: modelConfig.settings.maxTokens || 4000,
                            },
                        })];
                case 3:
                    result = _a.sent();
                    response = result.response;
                    text = response.text();
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, (0, jsonRepairUtils_js_1.parseAndRepairJson)(text, { genAI: genAI })];
                case 5:
                    parsedResult = _a.sent();
                    return [2 /*return*/, parsedResult];
                case 6:
                    error_6 = _a.sent();
                    console.error("Error parsing JSON response:", error_6);
                    // Fallback to extracting information using regex patterns
                    try {
                        extractedContext = extractBasicContext(text, metadata);
                        // If we got something meaningful, return it
                        if (extractedContext.summary && extractedContext.mainTopics.length > 0) {
                            return [2 /*return*/, extractedContext];
                        }
                    }
                    catch (fallbackError) {
                        console.error("Error in fallback extraction:", fallbackError);
                    }
                    // If all else fails, use rule-based extraction from the original text
                    return [2 /*return*/, {
                            summary: documentText.substring(0, 200) + "...",
                            mainTopics: extractTopicsFromText(documentText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || ''),
                            entities: extractEntitiesFromText(documentText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || ''),
                            documentType: inferDocumentType(documentText),
                            technicalLevel: inferTechnicalLevel(documentText),
                            audienceType: inferAudienceType(documentText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || '')
                        }];
                case 7: return [3 /*break*/, 9];
                case 8:
                    error_7 = _a.sent();
                    console.error("Error generating document context:", error_7);
                    // Return a basic fallback in case of error
                    return [2 /*return*/, {
                            summary: documentText.substring(0, 200) + "...",
                            mainTopics: extractTopicsFromText(documentText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || ''),
                            entities: extractEntitiesFromText(documentText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || ''),
                            documentType: inferDocumentType(documentText),
                            technicalLevel: inferTechnicalLevel(documentText),
                            audienceType: inferAudienceType(documentText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || '')
                        }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Extract basic context using regex patterns from LLM response text
 */
function extractBasicContext(responseText, metadata) {
    // Try to extract data using regex patterns
    var summaryMatch = responseText.match(/summary["\s:]+([^"]+)/i) ||
        responseText.match(/summary["\s:]+(.+?)(?=\n|main)/is);
    var summary = summaryMatch ? summaryMatch[1].trim() : ((metadata === null || metadata === void 0 ? void 0 : metadata.title) || '');
    // Extract topics using various patterns
    var topicsPattern = /main\s*topics["\s:]+\[(.*?)\]/is;
    var topicsListPattern = /main\s*topics["\s:]+\s*(?:\n\s*[-*]\s*(.+))+/im;
    var mainTopics = [];
    var topicsMatch = responseText.match(topicsPattern);
    if (topicsMatch && topicsMatch[1]) {
        // Handle JSON-style array
        mainTopics = topicsMatch[1].split(',')
            .map(function (topic) { return topic.replace(/"/g, '').trim(); })
            .filter(Boolean);
    }
    else {
        // Try to handle bullet-point style
        var topicsListMatch = responseText.match(topicsListPattern);
        if (topicsListMatch) {
            var bulletMatches = responseText.matchAll(/[-*]\s*(.+)/g);
            mainTopics = Array.from(bulletMatches, function (m) { return m[1].trim(); });
        }
        else {
            // Fallback: just look for any mentions of topics
            var topicsMentionMatch = responseText.match(/topics[^:]*:(.+?)(?=\n\n|\n[a-z]+:)/is);
            if (topicsMentionMatch) {
                mainTopics = topicsMentionMatch[1].split(',')
                    .map(function (topic) { return topic.trim(); })
                    .filter(Boolean);
            }
        }
    }
    // Extract entities using similar approach
    var entitiesPattern = /entities["\s:]+\[(.*?)\]/is;
    var entitiesListPattern = /entities["\s:]+\s*(?:\n\s*[-*]\s*(.+))+/im;
    var entities = [];
    var entitiesMatch = responseText.match(entitiesPattern);
    if (entitiesMatch && entitiesMatch[1]) {
        entities = entitiesMatch[1].split(',')
            .map(function (entity) { return entity.replace(/"/g, '').trim(); })
            .filter(Boolean);
    }
    else {
        var entitiesListMatch = responseText.match(entitiesListPattern);
        if (entitiesListMatch) {
            var bulletMatches = responseText.matchAll(/[-*]\s*(.+)/g);
            entities = Array.from(bulletMatches, function (m) { return m[1].trim(); })
                .filter(function (entity) { return !mainTopics.includes(entity); }); // Avoid duplicates
        }
        else {
            var entitiesMentionMatch = responseText.match(/entities[^:]*:(.+?)(?=\n\n|\n[a-z]+:)/is);
            if (entitiesMentionMatch) {
                entities = entitiesMentionMatch[1].split(',')
                    .map(function (entity) { return entity.trim(); })
                    .filter(Boolean);
            }
        }
    }
    // Extract document type
    var documentTypeMatch = responseText.match(/document\s*type["\s:]+([^"\n,]+)/i);
    var documentType = documentTypeMatch ? documentTypeMatch[1].trim() : inferDocumentType(responseText);
    // Extract technical level
    var technicalLevelMatch = responseText.match(/technical\s*level["\s:]+(\d)/i);
    var technicalLevel = 0;
    if (technicalLevelMatch) {
        technicalLevel = parseInt(technicalLevelMatch[1], 10);
        if (isNaN(technicalLevel) || technicalLevel < 0 || technicalLevel > 3) {
            technicalLevel = inferTechnicalLevel(responseText);
        }
    }
    else {
        technicalLevel = inferTechnicalLevel(responseText);
    }
    // Extract audience types
    var audiencePattern = /audience\s*type["\s:]+\[(.*?)\]/is;
    var audienceListPattern = /audience\s*type["\s:]+\s*(?:\n\s*[-*]\s*(.+))+/im;
    var audienceType = [];
    var audienceMatch = responseText.match(audiencePattern);
    if (audienceMatch && audienceMatch[1]) {
        audienceType = audienceMatch[1].split(',')
            .map(function (audience) { return audience.replace(/"/g, '').trim(); })
            .filter(Boolean);
    }
    else {
        var audienceListMatch = responseText.match(audienceListPattern);
        if (audienceListMatch) {
            var bulletMatches = responseText.matchAll(/[-*]\s*(.+)/g);
            audienceType = Array.from(bulletMatches, function (m) { return m[1].trim(); });
        }
        else {
            var audienceMentionMatch = responseText.match(/audience[^:]*:(.+?)(?=\n\n|\n[a-z]+:|\Z)/is);
            if (audienceMentionMatch) {
                audienceType = audienceMentionMatch[1].split(',')
                    .map(function (audience) { return audience.trim(); })
                    .filter(Boolean);
            }
        }
    }
    // If audience type is empty, infer it from the text
    if (!audienceType.length) {
        audienceType = inferAudienceType(responseText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || '');
    }
    return {
        summary: summary,
        mainTopics: mainTopics.length ? mainTopics : extractTopicsFromText(responseText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || ''),
        entities: entities.length ? entities : extractEntitiesFromText(responseText, (metadata === null || metadata === void 0 ? void 0 : metadata.title) || ''),
        documentType: documentType,
        technicalLevel: technicalLevel,
        audienceType: audienceType
    };
}
/**
 * Extract potential topics from document text
 */
function extractTopicsFromText(text, title) {
    // Extract potential topics based on frequency and position
    var words = text.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 3; });
    var titleWords = title ? title.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 3; }) : [];
    // Count word frequency, giving more weight to words in the title
    var wordCount = {};
    for (var _i = 0, words_1 = words; _i < words_1.length; _i++) {
        var word = words_1[_i];
        wordCount[word] = (wordCount[word] || 0) + 1;
    }
    for (var _a = 0, titleWords_1 = titleWords; _a < titleWords_1.length; _a++) {
        var word = titleWords_1[_a];
        wordCount[word] = (wordCount[word] || 0) + 5; // Title words get extra weight
    }
    // Remove common stop words
    var stopWords = ['this', 'that', 'these', 'those', 'with', 'from', 'about', 'which', 'their', 'have', 'will'];
    for (var _b = 0, stopWords_1 = stopWords; _b < stopWords_1.length; _b++) {
        var word = stopWords_1[_b];
        delete wordCount[word];
    }
    // Get top words by frequency
    var sortedWords = Object.entries(wordCount)
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 10)
        .map(function (entry) { return entry[0]; });
    // Try to combine adjacent common words to form phrases
    var phrases = new Set();
    var textLower = text.toLowerCase();
    for (var i = 0; i < sortedWords.length; i++) {
        var word = sortedWords[i];
        for (var j = i + 1; j < sortedWords.length; j++) {
            var nextWord = sortedWords[j];
            var phrase = "".concat(word, " ").concat(nextWord);
            if (textLower.includes(phrase)) {
                phrases.add(phrase);
            }
        }
        // Add single words as fallback
        if (phrases.size < 3) {
            phrases.add(word);
        }
    }
    // If we have title words, ensure they're included in topics
    for (var _c = 0, titleWords_2 = titleWords; _c < titleWords_2.length; _c++) {
        var titleWord = titleWords_2[_c];
        if (phrases.size < 5) {
            phrases.add(titleWord);
        }
    }
    return Array.from(phrases).slice(0, 5);
}
/**
 * Extract potential entities from document text
 */
function extractEntitiesFromText(text, title) {
    var entities = new Set();
    // Look for potential company/product names (capitalized phrases)
    var capitalizedPhrases = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
    for (var _i = 0, capitalizedPhrases_1 = capitalizedPhrases; _i < capitalizedPhrases_1.length; _i++) {
        var phrase = capitalizedPhrases_1[_i];
        if (phrase.length > 4 && !phrase.match(/^(The|This|That|These|Those|When|Where|Why|How)/)) {
            entities.add(phrase);
        }
    }
    // Look for words that are all caps (potential acronyms/product names)
    var allCapsWords = text.match(/\b[A-Z]{2,}\b/g) || [];
    for (var _a = 0, allCapsWords_1 = allCapsWords; _a < allCapsWords_1.length; _a++) {
        var word = allCapsWords_1[_a];
        if (word.length >= 2 && word !== 'IT' && word !== 'API') {
            entities.add(word);
        }
    }
    // Add title as a potential entity if it looks like a proper noun
    if (title && title.match(/^[A-Z]/)) {
        entities.add(title);
    }
    return Array.from(entities).slice(0, 10);
}
/**
 * Infer document type from content
 */
function inferDocumentType(text) {
    var lowerText = text.toLowerCase();
    // Check for patterns that suggest document types
    if (lowerText.includes('api') && (lowerText.includes('reference') || lowerText.includes('endpoint'))) {
        return 'API reference';
    }
    else if (lowerText.includes('tutorial') || lowerText.includes('step by step') || lowerText.includes('how to')) {
        return 'tutorial';
    }
    else if (lowerText.includes('guide') || lowerText.includes('best practices')) {
        return 'guide';
    }
    else if (lowerText.includes('white paper') || lowerText.includes('research')) {
        return 'white paper';
    }
    else if (lowerText.includes('case study') || lowerText.includes('success story')) {
        return 'case study';
    }
    else if (lowerText.includes('product') && (lowerText.includes('specification') || lowerText.includes('features'))) {
        return 'product documentation';
    }
    else if (lowerText.includes('marketing') || lowerText.includes('promotion') || lowerText.includes('advertisement')) {
        return 'marketing material';
    }
    else {
        return 'documentation';
    }
}
/**
 * Infer technical level from document content
 */
function inferTechnicalLevel(text) {
    // Simple heuristic based on presence of technical terms
    var technicalTerms = [
        'api', 'code', 'function', 'method', 'class', 'object', 'variable', 'algorithm',
        'database', 'query', 'schema', 'authentication', 'encryption', 'protocol',
        'implementation', 'architecture', 'framework', 'library', 'dependency',
        'deployment', 'infrastructure', 'configuration', 'parameters'
    ];
    var lowerText = text.toLowerCase();
    var technicalTermCount = 0;
    technicalTerms.forEach(function (term) {
        var regex = new RegExp("\\b".concat(term, "\\b"), 'g');
        var matches = lowerText.match(regex);
        if (matches) {
            technicalTermCount += matches.length;
        }
    });
    // Calculate density (terms per 1000 words)
    var wordCount = text.split(/\s+/).length;
    var termDensity = (technicalTermCount * 1000) / wordCount;
    // Assign technical level based on density
    if (termDensity > 15)
        return 3;
    if (termDensity > 8)
        return 2;
    if (termDensity > 3)
        return 1;
    return 0;
}
/**
 * Infer audience types from document content
 */
function inferAudienceType(text, title) {
    var audiences = new Set();
    var lowerText = text.toLowerCase();
    var lowerTitle = title ? title.toLowerCase() : '';
    // Check for role indicators
    var roleIndicators = [
        ['develop', 'developers'],
        ['code', 'developers'],
        ['programming', 'developers'],
        ['enginee', 'engineers'],
        ['architect', 'architects'],
        ['design', 'designers'],
        ['product manag', 'product managers'],
        ['user experience', 'UX designers'],
        ['data scien', 'data scientists'],
        ['analytics', 'analysts'],
        ['market', 'marketing team'],
        ['sales', 'sales representatives'],
        ['executive', 'executives'],
        ['leadership', 'executives'],
        ['c-suite', 'C-suite executives'],
        ['ceo', 'C-suite executives'],
        ['cto', 'C-suite executives'],
        ['operation', 'operations team'],
        ['support', 'support staff'],
        ['customer service', 'customer service'],
        ['legal', 'legal team'],
        ['compliance', 'compliance officers'],
        ['IT', 'IT administrators'],
        ['sysadmin', 'system administrators'],
        ['devops', 'DevOps engineers']
    ];
    // Check for technical level indicators
    var technicalLevel = inferTechnicalLevel(text);
    if (technicalLevel >= 3) {
        audiences.add('technical');
    }
    else if (technicalLevel >= 1) {
        audiences.add('semi-technical');
    }
    else {
        audiences.add('non-technical');
    }
    // Check for role indicators in the text
    for (var _i = 0, roleIndicators_1 = roleIndicators; _i < roleIndicators_1.length; _i++) {
        var _a = roleIndicators_1[_i], indicator = _a[0], audience = _a[1];
        if (lowerText.includes(indicator) || lowerTitle.includes(indicator)) {
            audiences.add(audience);
        }
    }
    // Check for industry indicators
    var industryIndicators = [
        ['healthcare', 'healthcare'],
        ['medical', 'healthcare'],
        ['finance', 'finance'],
        ['banking', 'finance'],
        ['investment', 'finance'],
        ['education', 'education'],
        ['learning', 'education'],
        ['retail', 'retail'],
        ['commerce', 'retail'],
        ['manufactur', 'manufacturing'],
        ['industr', 'manufacturing'],
        ['tech', 'technology'],
        ['software', 'technology'],
        ['hardware', 'technology'],
        ['telecom', 'telecommunications'],
        ['media', 'media'],
        ['entertainment', 'media'],
        ['government', 'government'],
        ['public sector', 'government']
    ];
    // Check for industry indicators
    for (var _b = 0, industryIndicators_1 = industryIndicators; _b < industryIndicators_1.length; _b++) {
        var _c = industryIndicators_1[_b], indicator = _c[0], industry = _c[1];
        if (lowerText.includes(indicator) || lowerTitle.includes(indicator)) {
            audiences.add(industry + ' industry');
        }
    }
    // Ensure we have at least some audiences
    if (audiences.size < 2) {
        // Add general roles based on technical level
        if (technicalLevel >= 2) {
            audiences.add('developers');
            audiences.add('engineers');
        }
        else if (technicalLevel >= 1) {
            audiences.add('product managers');
            audiences.add('technical managers');
        }
        else {
            audiences.add('business users');
            audiences.add('general audience');
        }
    }
    return Array.from(audiences);
}
/**
 * Generate context for an individual text chunk using Gemini
 * @param chunkText The text content of the chunk to analyze
 * @param metadata Optional metadata to enhance the analysis
 * @returns Structured chunk context including summary and key points
 */
function generateChunkContext(chunkText, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var truncatedText, metadataHint, prompt, responseSchema, modelConfig, model, result, response, text, parsedResult, error_8, summaryMatch, keyPointsMatch, summary, keyPoints, keyPointsText, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    truncatedText = chunkText.substring(0, 6000);
                    metadataHint = '';
                    if (metadata) {
                        metadataHint = "\nDocument metadata: ".concat(JSON.stringify(metadata));
                    }
                    prompt = "\nAnalyze the following text chunk and extract key information.\n".concat(metadataHint, "\n\nTEXT CHUNK:\n").concat(truncatedText, "\n\nProvide your analysis in JSON format with the following fields:\n- summary: A concise 1-2 sentence summary of the key information in this chunk\n- keyPoints: An array of 3-5 main points or facts covered in this text chunk\n");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    responseSchema = {
                        summary: "string",
                        keyPoints: "string[]"
                    };
                    return [4 /*yield*/, getModelForTask(undefined, 'context')];
                case 2:
                    modelConfig = _a.sent();
                    model = genAI.getGenerativeModel({
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
                    return [4 /*yield*/, model.generateContent({
                            contents: [{ role: 'user', parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: modelConfig.settings.temperature,
                                maxOutputTokens: modelConfig.settings.maxTokens || 4000,
                            },
                        })];
                case 3:
                    result = _a.sent();
                    response = result.response;
                    text = response.text();
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, (0, jsonRepairUtils_js_1.parseAndRepairJson)(text, { genAI: genAI })];
                case 5:
                    parsedResult = _a.sent();
                    return [2 /*return*/, parsedResult];
                case 6:
                    error_8 = _a.sent();
                    console.error("Error parsing JSON response:", error_8);
                    summaryMatch = text.match(/summary["\s:]+([^"]+)/i);
                    keyPointsMatch = text.match(/keyPoints["\s:]+\[(.*?)\]/is);
                    summary = summaryMatch ? summaryMatch[1].trim() : truncatedText.substring(0, 100) + "...";
                    keyPoints = [];
                    if (keyPointsMatch) {
                        keyPointsText = keyPointsMatch[1];
                        // Extract items from array format
                        keyPoints = keyPointsText
                            .split(/",\s*"/)
                            .map(function (point) { return point.replace(/^["'\s]+|["'\s]+$/g, ''); })
                            .filter(Boolean);
                    }
                    if (keyPoints.length === 0) {
                        // Split the text into sentences and take first few as key points
                        keyPoints = truncatedText
                            .split(/[.!?]+/)
                            .filter(function (s) { return s.trim().length > 20; })
                            .slice(0, 3)
                            .map(function (s) { return s.trim(); });
                    }
                    return [2 /*return*/, {
                            summary: summary,
                            keyPoints: keyPoints.length > 0 ? keyPoints : [truncatedText.substring(0, 100) + "..."]
                        }];
                case 7: return [3 /*break*/, 9];
                case 8:
                    error_9 = _a.sent();
                    console.error("Error generating chunk context:", error_9);
                    // Return a basic fallback in case of error
                    return [2 /*return*/, {
                            summary: truncatedText.substring(0, 100) + "...",
                            keyPoints: [
                                truncatedText.substring(0, 100) + "...",
                                truncatedText.substring(100, 200) + "...",
                                truncatedText.substring(200, 300) + "..."
                            ].filter(Boolean)
                        }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generate embeddings for text using Google's Gemini text-embedding-004 model
 * This function should be used for consistency with the Supabase migration
 * @param text The text to embed
 * @returns An embedding vector
 */
function embedTextWithGemini(text) {
    return __awaiter(this, void 0, void 0, function () {
        var embedText, error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.warn('embedTextWithGemini is deprecated. Please use embedText from embeddingClient.ts instead.');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./embeddingClient')); })];
                case 2:
                    embedText = (_a.sent()).embedText;
                    return [2 /*return*/, embedText(text)];
                case 3:
                    error_10 = _a.sent();
                    (0, logger_1.logError)('Error in embedTextWithGemini redirection', error_10);
                    throw error_10;
                case 4: return [2 /*return*/];
            }
        });
    });
}
