"use strict";
/**
 * Embedding Client Factory
 *
 * This module provides a unified interface for generating embeddings
 * from different providers (OpenAI and Gemini).
 */
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
exports.getEmbeddingClient = getEmbeddingClient;
exports.embedText = embedText;
exports.embedBatch = embedBatch;
var openai_1 = require("openai");
var generative_ai_1 = require("@google/generative-ai");
var modelConfig_1 = require("./modelConfig");
var logger_1 = require("./logger");
var dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Initialize OpenAI client
var openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// Initialize Gemini client
var geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
var genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey || '');
/**
 * OpenAI implementation of the EmbeddingClient
 */
var OpenAIEmbeddingClient = /** @class */ (function () {
    function OpenAIEmbeddingClient() {
        this.dimensions = 1536; // Ada-002 embedding dimensions
    }
    OpenAIEmbeddingClient.prototype.embedText = function (text, taskType) {
        return __awaiter(this, void 0, void 0, function () {
            var cleanedText, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        cleanedText = text.replace(/\\s+/g, ' ').trim();
                        return [4 /*yield*/, openai.embeddings.create({
                                model: modelConfig_1.AI_SETTINGS.embeddingModel,
                                input: cleanedText,
                            })];
                    case 1:
                        response = _a.sent();
                        // Return the embedding vector
                        return [2 /*return*/, response.data[0].embedding];
                    case 2:
                        error_1 = _a.sent();
                        (0, logger_1.logError)('Error generating OpenAI embedding', error_1);
                        // In case of error, return a zero vector as fallback
                        console.error('Error generating OpenAI embedding:', error_1);
                        return [2 /*return*/, Array(this.dimensions).fill(0)];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    OpenAIEmbeddingClient.prototype.embedBatch = function (texts, taskType) {
        return __awaiter(this, void 0, void 0, function () {
            var cleanedTexts, response, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        cleanedTexts = texts.map(function (text) { return text.replace(/\\s+/g, ' ').trim(); });
                        return [4 /*yield*/, openai.embeddings.create({
                                model: modelConfig_1.AI_SETTINGS.embeddingModel,
                                input: cleanedTexts,
                            })];
                    case 1:
                        response = _a.sent();
                        // Return the embedding vectors
                        return [2 /*return*/, response.data.map(function (item) { return item.embedding; })];
                    case 2:
                        error_2 = _a.sent();
                        (0, logger_1.logError)('Error generating batch OpenAI embeddings', error_2);
                        // In case of error, return zero vectors as fallback
                        console.error('Error generating batch OpenAI embeddings:', error_2);
                        return [2 /*return*/, texts.map(function () { return Array(_this.dimensions).fill(0); })];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    OpenAIEmbeddingClient.prototype.getProvider = function () {
        return 'openai';
    };
    OpenAIEmbeddingClient.prototype.getDimensions = function () {
        return this.dimensions;
    };
    return OpenAIEmbeddingClient;
}());
/**
 * Convert string task type to Gemini TaskType enum
 * @param taskType String representation of task type
 * @returns TaskType enum value
 */
function getTaskTypeEnum(taskType) {
    switch (taskType) {
        case 'RETRIEVAL_DOCUMENT':
            return generative_ai_1.TaskType.RETRIEVAL_DOCUMENT;
        case 'RETRIEVAL_QUERY':
            return generative_ai_1.TaskType.RETRIEVAL_QUERY;
        case 'SEMANTIC_SIMILARITY':
            return generative_ai_1.TaskType.SEMANTIC_SIMILARITY;
        case 'CLASSIFICATION':
            return generative_ai_1.TaskType.CLASSIFICATION;
        case 'CLUSTERING':
            return generative_ai_1.TaskType.CLUSTERING;
        default:
            // Default based on common use case
            return taskType.includes('QUERY')
                ? generative_ai_1.TaskType.RETRIEVAL_QUERY
                : generative_ai_1.TaskType.RETRIEVAL_DOCUMENT;
    }
}
/**
 * Gemini implementation of the EmbeddingClient
 */
var GeminiEmbeddingClient = /** @class */ (function () {
    function GeminiEmbeddingClient(apiKey, modelName, dimensions) {
        if (modelName === void 0) { modelName = modelConfig_1.AI_SETTINGS.embeddingModel; }
        if (dimensions === void 0) { dimensions = modelConfig_1.AI_SETTINGS.embeddingDimension; }
        this.batchSize = 100; // Gemini batch limit
        if (!apiKey)
            throw new Error('Gemini API key is required for GeminiEmbeddingClient');
        this.client = new generative_ai_1.GoogleGenerativeAI(apiKey);
        this.modelName = modelName;
        this.dimensions = dimensions;
        (0, logger_1.logInfo)("[EmbeddingClient] Gemini client initialized with model: ".concat(this.modelName, ", dimensions: ").concat(this.dimensions));
    }
    GeminiEmbeddingClient.prototype.getProvider = function () { return 'gemini'; };
    GeminiEmbeddingClient.prototype.getDimensions = function () { return this.dimensions; };
    GeminiEmbeddingClient.prototype.embedText = function (text_1) {
        return __awaiter(this, arguments, void 0, function (text, taskType) {
            var cleanedText, model, startTime, result, duration, embedding, error_3, duration;
            var _a;
            if (taskType === void 0) { taskType = generative_ai_1.TaskType.RETRIEVAL_DOCUMENT; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        cleanedText = text.replace(/\s+/g, ' ').trim();
                        if (!cleanedText)
                            return [2 /*return*/, []];
                        model = this.client.getGenerativeModel({ model: this.modelName });
                        (0, logger_1.logDebug)("[EmbeddingClient] Requesting Gemini embedding for text (Task: ".concat(taskType, ")"));
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, model.embedContent({ content: { parts: [{ text: cleanedText }], role: "user" }, taskType: taskType })];
                    case 2:
                        result = _b.sent();
                        duration = Date.now() - startTime;
                        embedding = ((_a = result.embedding) === null || _a === void 0 ? void 0 : _a.values) || [];
                        if (embedding.length === 0) {
                            (0, logger_1.logWarning)('[EmbeddingClient] Gemini embedding returned empty array for text.');
                            // Log as error since empty embedding is usually problematic
                            (0, logger_1.logApiCall)('gemini', 'embedding', 'error', duration, 'Empty embedding returned', { model: this.modelName, taskType: generative_ai_1.TaskType[taskType] });
                        }
                        else {
                            (0, logger_1.logInfo)('[API Embedding] Gemini Embedding Success (Single Text)'); // Keep original log
                            (0, logger_1.logApiCall)('gemini', 'embedding', 'success', duration, undefined, { model: this.modelName, taskType: generative_ai_1.TaskType[taskType], inputLength: cleanedText.length });
                        }
                        return [2 /*return*/, embedding];
                    case 3:
                        error_3 = _b.sent();
                        duration = Date.now() - startTime;
                        (0, logger_1.logError)('[API Embedding] Gemini Embedding Error (Single Text)', { error: error_3 instanceof Error ? error_3.message : String(error_3) }); // Keep original log
                        (0, logger_1.logApiCall)('gemini', 'embedding', 'error', duration, error_3 instanceof Error ? error_3.message : String(error_3), { model: this.modelName, taskType: generative_ai_1.TaskType[taskType] });
                        throw new Error("Gemini embedding failed: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GeminiEmbeddingClient.prototype.embedBatch = function (texts_1) {
        return __awaiter(this, arguments, void 0, function (texts, taskType) {
            var cleanedTexts, model, embeddings, i, batchTexts, requests, startTime, result, duration, batchEmbeddings, batchError_1, duration, _i, batchTexts_1, text, singleEmbedding, sequentialError_1;
            var _a;
            if (taskType === void 0) { taskType = generative_ai_1.TaskType.RETRIEVAL_DOCUMENT; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        cleanedTexts = texts.map(function (text) { return text.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
                        if (cleanedTexts.length === 0)
                            return [2 /*return*/, []];
                        model = this.client.getGenerativeModel({ model: this.modelName });
                        embeddings = [];
                        (0, logger_1.logDebug)("[EmbeddingClient] Requesting Gemini embedding for batch of ".concat(cleanedTexts.length, " texts (Task: ").concat(taskType, ")"));
                        i = 0;
                        _b.label = 1;
                    case 1:
                        if (!(i < cleanedTexts.length)) return [3 /*break*/, 13];
                        batchTexts = cleanedTexts.slice(i, i + this.batchSize);
                        requests = batchTexts.map(function (text) { return ({ content: { parts: [{ text: text }], role: "user" }, taskType: taskType }); });
                        startTime = Date.now();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 12]);
                        return [4 /*yield*/, model.batchEmbedContents({ requests: requests })];
                    case 3:
                        result = _b.sent();
                        duration = Date.now() - startTime;
                        batchEmbeddings = ((_a = result.embeddings) === null || _a === void 0 ? void 0 : _a.map(function (e) { return e.values || []; })) || [];
                        embeddings.push.apply(embeddings, batchEmbeddings);
                        (0, logger_1.logInfo)("[API Embedding] Gemini Embedding Success (Batch Index ".concat(i / this.batchSize, ")")); // Keep original log
                        (0, logger_1.logApiCall)('gemini', 'embedding', 'success', duration, undefined, { model: this.modelName, taskType: generative_ai_1.TaskType[taskType], batchSize: batchTexts.length });
                        return [3 /*break*/, 12];
                    case 4:
                        batchError_1 = _b.sent();
                        duration = Date.now() - startTime;
                        (0, logger_1.logWarning)("[EmbeddingClient] Gemini batch embedding failed at index ".concat(i, ". Trying sequential fallback..."), { error: batchError_1 });
                        (0, logger_1.logError)('[API Embedding] Gemini Embedding Error (Batch)', { error: batchError_1 instanceof Error ? batchError_1.message : String(batchError_1) }); // Keep original log
                        // Log the BATCH error first
                        (0, logger_1.logApiCall)('gemini', 'embedding', 'error', duration, batchError_1 instanceof Error ? batchError_1.message : String(batchError_1), { model: this.modelName, taskType: generative_ai_1.TaskType[taskType], batchSize: batchTexts.length, note: 'Batch API call failed' });
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 10, , 11]);
                        _i = 0, batchTexts_1 = batchTexts;
                        _b.label = 6;
                    case 6:
                        if (!(_i < batchTexts_1.length)) return [3 /*break*/, 9];
                        text = batchTexts_1[_i];
                        return [4 /*yield*/, this.embedText(text, taskType)];
                    case 7:
                        singleEmbedding = _b.sent();
                        embeddings.push(singleEmbedding);
                        _b.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 6];
                    case 9:
                        (0, logger_1.logInfo)('[EmbeddingClient] Sequential embedding fallback successful for batch.');
                        return [3 /*break*/, 11];
                    case 10:
                        sequentialError_1 = _b.sent();
                        (0, logger_1.logError)('[EmbeddingClient] Sequential embedding fallback ALSO failed.', { error: sequentialError_1 });
                        (0, logger_1.logError)('[API Embedding] Gemini Embedding Error (Sequential Fallback)', { error: sequentialError_1 instanceof Error ? sequentialError_1.message : String(sequentialError_1) }); // Keep original log
                        // Log the SEQUENTIAL error - embedText already logs its own attempt, so maybe just log the context here
                        (0, logger_1.logError)('[EmbeddingClient] Error during sequential fallback attempt', { note: 'Individual errors logged by embedText' });
                        return [3 /*break*/, 11];
                    case 11: return [3 /*break*/, 12];
                    case 12:
                        i += this.batchSize;
                        return [3 /*break*/, 1];
                    case 13: return [2 /*return*/, embeddings];
                }
            });
        });
    };
    return GeminiEmbeddingClient;
}());
/**
 * Factory function to get the appropriate embedding client
 * Always returns the Gemini embedding client after migration
 */
function getEmbeddingClient() {
    // After migration, we exclusively use Gemini embeddings
    console.log('Using Gemini for embeddings (text-embedding-004)');
    return new GeminiEmbeddingClient(geminiApiKey || '', modelConfig_1.AI_SETTINGS.embeddingModel, modelConfig_1.AI_SETTINGS.embeddingDimension);
}
/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
function embedText(text_1) {
    return __awaiter(this, arguments, void 0, function (text, taskType) {
        var client;
        if (taskType === void 0) { taskType = 'RETRIEVAL_QUERY'; }
        return __generator(this, function (_a) {
            client = getEmbeddingClient();
            return [2 /*return*/, client.embedText(text, getTaskTypeEnum(taskType))];
        });
    });
}
/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
function embedBatch(texts_1) {
    return __awaiter(this, arguments, void 0, function (texts, taskType) {
        var client;
        if (taskType === void 0) { taskType = 'RETRIEVAL_DOCUMENT'; }
        return __generator(this, function (_a) {
            client = getEmbeddingClient();
            return [2 /*return*/, client.embedBatch(texts, getTaskTypeEnum(taskType))];
        });
    });
}
