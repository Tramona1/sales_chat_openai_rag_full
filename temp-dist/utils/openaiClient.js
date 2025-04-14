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
Object.defineProperty(exports, "__esModule", { value: true });
exports.openai = void 0;
exports.embedText = embedText;
exports.generateChatCompletion = generateChatCompletion;
exports.generateStructuredResponse = generateStructuredResponse;
exports.batchProcessPrompts = batchProcessPrompts;
exports.rankTextsForQuery = rankTextsForQuery;
var openai_1 = require("openai");
var dotenv = __importStar(require("dotenv"));
var logger_1 = require("./logger");
// Load environment variables
dotenv.config();
// Default settings in case imports fail
var AI_SETTINGS = {
    defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
    fallbackModel: process.env.FALLBACK_LLM_MODEL || 'gpt-3.5-turbo-1106',
    embeddingModel: 'models/text-embedding-004',
    embeddingDimension: 768,
    maxTokens: 1000,
    temperature: 0.7,
    systemPrompt: 'You are a helpful assistant that answers based only on provided context.'
};
// Initialize AI_SETTINGS asynchronously
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var modelConfig, error_1, fallbackConfig, fallbackError_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 7]);
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./modelConfig')); })];
            case 1:
                modelConfig = _a.sent();
                AI_SETTINGS = modelConfig.AI_SETTINGS;
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
                AI_SETTINGS = fallbackConfig.AI_SETTINGS;
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
// Initialize OpenAI client
exports.openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * Generate embeddings for text using the OpenAI API
 * @param text The text to embed
 * @returns An embedding vector
 */
function embedText(text) {
    return __awaiter(this, void 0, void 0, function () {
        var embedTextFromClient, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.warn('embedText from openaiClient is deprecated. Please use embedText from embeddingClient.ts instead.');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./embeddingClient')); })];
                case 2:
                    embedTextFromClient = (_a.sent()).embedText;
                    return [2 /*return*/, embedTextFromClient(text)];
                case 3:
                    error_2 = _a.sent();
                    (0, logger_1.logError)('Error in openaiClient.embedText redirection', error_2);
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generate a chat completion using OpenAI
 */
function generateChatCompletion(systemPrompt_1, userPrompt_1) {
    return __awaiter(this, arguments, void 0, function (systemPrompt, userPrompt, model, jsonMode) {
        var messages, modelToUse, supportsJsonMode, response, error_3;
        if (model === void 0) { model = AI_SETTINGS.defaultModel; }
        if (jsonMode === void 0) { jsonMode = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    messages = [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        {
                            role: 'user',
                            content: userPrompt,
                        },
                    ];
                    modelToUse = model || AI_SETTINGS.defaultModel;
                    supportsJsonMode = modelToUse.includes('gpt-4') ||
                        modelToUse.includes('gpt-3.5-turbo-16k') ||
                        modelToUse.includes('gpt-3.5-turbo-1106');
                    return [4 /*yield*/, exports.openai.chat.completions.create({
                            model: modelToUse,
                            messages: messages,
                            temperature: AI_SETTINGS.temperature,
                            max_tokens: AI_SETTINGS.maxTokens,
                            response_format: jsonMode && supportsJsonMode ? { type: 'json_object' } : undefined,
                        })];
                case 1:
                    response = _a.sent();
                    // Extract and return the response text
                    return [2 /*return*/, response.choices[0].message.content || ''];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error generating chat completion:', error_3);
                    // Try fallback model if primary fails
                    if (model === AI_SETTINGS.defaultModel) {
                        console.log('Attempting with fallback model...');
                        return [2 /*return*/, generateChatCompletion(systemPrompt, userPrompt, AI_SETTINGS.fallbackModel, jsonMode)];
                    }
                    // If fallback also fails, return error message
                    return [2 /*return*/, 'I apologize, but I encountered an issue processing your request. Please try again later.'];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generate a structured response from OpenAI API
 */
function generateStructuredResponse(systemPrompt_1, userPrompt_1, responseSchema_1) {
    return __awaiter(this, arguments, void 0, function (systemPrompt, userPrompt, responseSchema, model) {
        var supportsJsonMode, response, content, enhancedSystemPrompt, response, content, jsonMatch, error_4;
        var _a, _b, _c, _d, _e;
        if (model === void 0) { model = AI_SETTINGS.defaultModel; }
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 5, , 6]);
                    supportsJsonMode = model.includes("gpt-4-turbo") ||
                        model.includes("gpt-4-0125") ||
                        model.includes("gpt-3.5-turbo-0125");
                    if (!supportsJsonMode) return [3 /*break*/, 2];
                    return [4 /*yield*/, exports.openai.chat.completions.create({
                            model: model,
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userPrompt }
                            ],
                            response_format: { type: "json_object" },
                            temperature: 0.2,
                            max_tokens: 4000
                        })];
                case 1:
                    response = _f.sent();
                    content = ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "{}";
                    return [2 /*return*/, JSON.parse(content)];
                case 2:
                    enhancedSystemPrompt = "".concat(systemPrompt, "\n\nYou must respond with a valid JSON object that follows this schema:\n").concat(JSON.stringify(responseSchema, null, 2), "\n\nDo not include any text before or after the JSON. Only respond with the JSON object.");
                    return [4 /*yield*/, exports.openai.chat.completions.create({
                            model: model,
                            messages: [
                                { role: "system", content: enhancedSystemPrompt },
                                { role: "user", content: userPrompt }
                            ],
                            temperature: 0.2,
                            max_tokens: 4000
                        })];
                case 3:
                    response = _f.sent();
                    content = ((_d = (_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "{}";
                    // Extract JSON from the response - handle potential extra text
                    try {
                        // Try parsing directly
                        return [2 /*return*/, JSON.parse(content)];
                    }
                    catch (e) {
                        jsonMatch = content.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            return [2 /*return*/, JSON.parse(jsonMatch[0])];
                        }
                        else {
                            throw new Error("Failed to extract valid JSON from response");
                        }
                    }
                    _f.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_4 = _f.sent();
                    if (((_e = error_4 === null || error_4 === void 0 ? void 0 : error_4.message) === null || _e === void 0 ? void 0 : _e.includes('json_object')) &&
                        model !== AI_SETTINGS.fallbackModel) {
                        console.log("Attempting with fallback model...");
                        // Try again with fallback model
                        return [2 /*return*/, generateStructuredResponse(systemPrompt, userPrompt, responseSchema, AI_SETTINGS.fallbackModel)];
                    }
                    console.error("Error generating structured response:", error_4);
                    throw error_4;
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Batch process multiple prompts with a single API call
 * Useful for re-ranking to save on API calls
 */
function batchProcessPrompts(systemPrompt_1, userPrompts_1) {
    return __awaiter(this, arguments, void 0, function (systemPrompt, userPrompts, model, options) {
        var timeoutMs, apiPromise, timeoutPromise, error_5;
        if (model === void 0) { model = AI_SETTINGS.defaultModel; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeoutMs = options.timeoutMs || 10000;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    apiPromise = Promise.all(userPrompts.map(function (userPrompt) {
                        return generateChatCompletion(systemPrompt, userPrompt, model, options.jsonMode || false);
                    }));
                    timeoutPromise = new Promise(function (_, reject) {
                        setTimeout(function () {
                            reject(new Error("Batch processing timed out after ".concat(timeoutMs, "ms")));
                        }, timeoutMs);
                    });
                    return [4 /*yield*/, Promise.race([apiPromise, timeoutPromise])];
                case 2: 
                // Race the API call against the timeout
                return [2 /*return*/, _a.sent()];
                case 3:
                    error_5 = _a.sent();
                    (0, logger_1.logError)('Error in batch processing prompts', error_5);
                    // Return empty results on error
                    return [2 /*return*/, userPrompts.map(function () { return ""; })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Process a batch of texts with an LLM for re-ranking
 * Specialized function for re-ranking that processes multiple documents
 * with a single API call for efficiency
 */
function rankTextsForQuery(query_1, texts_1) {
    return __awaiter(this, arguments, void 0, function (query, texts, model, options) {
        var systemPrompt, userPrompt, timeoutMs_1, rankingPromise, timeoutPromise, response, error_6;
        if (model === void 0) { model = AI_SETTINGS.fallbackModel; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    systemPrompt = "You are a document relevance judge. Rate how relevant each document is to the query on a scale of 0-10 where:\n- 10: Perfect match with specific details answering the query\n- 7-9: Highly relevant with key information related to the query\n- 4-6: Somewhat relevant but lacks specific details\n- 1-3: Only tangentially related to the query\n- 0: Not relevant at all\n\nReturn a JSON object with only scores in this format:\n{\"scores\": [score1, score2, ...]}\n\nYour response MUST be a valid JSON object with no additional text, explanations, or formatting.";
                    userPrompt = "Query: ".concat(query, "\n\n").concat(texts.map(function (text, i) { return "DOCUMENT ".concat(i + 1, ":\n").concat(text.substring(0, 600)).concat(text.length > 600 ? '...' : ''); }).join('\n\n'), "\n\nProvide a relevance score from 0-10 for each document based on how well it answers the query.");
                    timeoutMs_1 = options.timeoutMs || 15000;
                    rankingPromise = generateStructuredResponse(systemPrompt, userPrompt, { scores: [] }, model);
                    timeoutPromise = new Promise(function (_, reject) {
                        setTimeout(function () {
                            reject(new Error("Re-ranking timed out after ".concat(timeoutMs_1, "ms")));
                        }, timeoutMs_1);
                    });
                    return [4 /*yield*/, Promise.race([rankingPromise, timeoutPromise])];
                case 1:
                    response = _a.sent();
                    // Return scores
                    if (response && Array.isArray(response.scores)) {
                        return [2 /*return*/, response.scores];
                    }
                    else {
                        console.warn('Invalid scores format received, using default scores');
                        return [2 /*return*/, texts.map(function () { return 5; })]; // Default to middle score if failed
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_6 = _a.sent();
                    console.error('Error in rankTextsForQuery:', error_6);
                    return [2 /*return*/, texts.map(function () { return 5; })]; // Default score on error
                case 3: return [2 /*return*/];
            }
        });
    });
}
