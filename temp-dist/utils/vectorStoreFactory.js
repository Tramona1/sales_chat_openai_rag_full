"use strict";
/**
 * Vector Store Factory
 *
 * This factory module selects between file-based and Supabase vector store implementations
 * based on the USE_SUPABASE environment variable.
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
exports.addToVectorStore = addToVectorStore;
exports.getSimilarItems = getSimilarItems;
exports.getVectorStoreSize = getVectorStoreSize;
exports.getAllVectorStoreItems = getAllVectorStoreItems;
exports.clearVectorStore = clearVectorStore;
var logger_1 = require("./logger");
// Flag to determine which vector store implementation to use
// Default to Supabase unless explicitly set otherwise in environment
// Determine if we should use Supabase
// REMOVED: No longer needed as we assume Supabase
// const useSupabase = process.env.USE_SUPABASE === 'true';
// Log which implementation is being used
// REMOVED: No longer needed
// logInfo(`Using ${useSupabase ? 'Supabase' : 'file-based'} vector store implementation`);
/**
 * Add item(s) to the vector store
 * @param items Single item or array of items to add to vector store
 */
function addToVectorStore(items) {
    return __awaiter(this, void 0, void 0, function () {
        var insertDocumentChunks, itemsArray, chunks, validChunksToInsert, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./supabaseClient')); })];
                case 1:
                    insertDocumentChunks = (_a.sent()).insertDocumentChunks;
                    itemsArray = Array.isArray(items) ? items : [items];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    chunks = itemsArray.map(function (item) {
                        var _a;
                        return ({
                            document_id: item.document_id, // Could be undefined
                            chunk_index: item.chunk_index, // Could be undefined
                            // Use originalText as fallback for text if text is missing or empty
                            text: ((_a = item.text) === null || _a === void 0 ? void 0 : _a.trim()) ? item.text : (item.originalText || ''),
                            embedding: item.embedding,
                            metadata: item.metadata || {},
                            context: item.context || {}
                        });
                    });
                    validChunksToInsert = chunks.filter(function (chunk) {
                        var hasRequiredFields = chunk.document_id !== undefined &&
                            typeof chunk.chunk_index === 'number' &&
                            chunk.text.trim() !== '';
                        if (!hasRequiredFields) {
                            (0, logger_1.logWarning)("VectorStoreFactory: Skipping chunk due to missing required fields (doc_id, chunk_idx, text) or empty text.", {
                                document_id: chunk.document_id,
                                chunk_index: chunk.chunk_index
                            });
                        }
                        return hasRequiredFields;
                    });
                    if (validChunksToInsert.length < chunks.length) {
                        (0, logger_1.logWarning)("VectorStoreFactory: Skipped ".concat(chunks.length - validChunksToInsert.length, " chunks during conversion."));
                    }
                    if (!(validChunksToInsert.length > 0)) return [3 /*break*/, 4];
                    // Now validChunksToInsert matches DocumentChunkInsertData[] type
                    return [4 /*yield*/, insertDocumentChunks(validChunksToInsert)];
                case 3:
                    // Now validChunksToInsert matches DocumentChunkInsertData[] type
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    (0, logger_1.logWarning)('VectorStoreFactory: No valid chunks to insert after conversion.');
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    (0, logger_1.logError)('Error adding items to Supabase vector store', error_1);
                    throw error_1;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get similar items from the vector store
 * @param queryEmbedding Vector embedding to compare against
 * @param limit Maximum number of results to return
 * @param options Additional options for the search (e.g., match_threshold)
 */
function getSimilarItems(queryEmbedding_1) {
    return __awaiter(this, arguments, void 0, function (queryEmbedding, limit, options) {
        var vectorSearch, error_2;
        if (limit === void 0) { limit = 5; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./supabaseClient')); })];
                case 1:
                    vectorSearch = (_a.sent()).vectorSearch;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, vectorSearch(queryEmbedding, limit, {
                            match_threshold: options === null || options === void 0 ? void 0 : options.match_threshold
                        })];
                case 3: 
                // Call the vectorSearch function from supabaseClient
                // Pass relevant options (like match_threshold)
                // Note: Filters beyond match_threshold aren't directly supported by this factory function signature
                // If more complex filtering is needed here, the factory signature must be updated.
                return [2 /*return*/, _a.sent()];
                case 4:
                    error_2 = _a.sent();
                    (0, logger_1.logError)('Error getting similar items from Supabase via supabaseClient', error_2);
                    throw error_2;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get the size of the vector store
 */
function getVectorStoreSize() {
    return __awaiter(this, void 0, void 0, function () {
        var getSupabaseAdmin, _a, count, error, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./supabaseClient')); })];
                case 1:
                    getSupabaseAdmin = (_b.sent()).getSupabaseAdmin;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('document_chunks')
                            .select('*', { count: 'exact', head: true })];
                case 3:
                    _a = _b.sent(), count = _a.count, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    return [2 /*return*/, count || 0];
                case 4:
                    error_3 = _b.sent();
                    (0, logger_1.logError)('Error getting vector store size from Supabase', error_3);
                    throw error_3;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get all items from the vector store
 */
function getAllVectorStoreItems() {
    return __awaiter(this, void 0, void 0, function () {
        var getSupabaseAdmin, _a, data, error, error_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./supabaseClient')); })];
                case 1:
                    getSupabaseAdmin = (_b.sent()).getSupabaseAdmin;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('document_chunks')
                            .select('id, document_id, chunk_index, content, original_text, metadata')];
                case 3:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    // Format results to match the expected VectorStoreItem format
                    return [2 /*return*/, (data || []).map(function (item) { return ({
                            id: item.id,
                            document_id: item.document_id,
                            chunk_index: item.chunk_index,
                            text: item.content,
                            originalText: item.original_text,
                            embedding: [], // Embeddings are not returned by default
                            metadata: item.metadata
                        }); })];
                case 4:
                    error_4 = _b.sent();
                    (0, logger_1.logError)('Error getting all vector store items from Supabase', error_4);
                    throw error_4;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Clear the vector store
 */
function clearVectorStore() {
    return __awaiter(this, void 0, void 0, function () {
        var getSupabaseAdmin, chunksError, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./supabaseClient')); })];
                case 1:
                    getSupabaseAdmin = (_a.sent()).getSupabaseAdmin;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('document_chunks')
                            .delete()
                            .not('id', 'eq', '00000000-0000-0000-0000-000000000000')];
                case 3:
                    chunksError = (_a.sent()).error;
                    if (chunksError) {
                        throw chunksError;
                    }
                    (0, logger_1.logInfo)('Successfully cleared document_chunks table');
                    return [3 /*break*/, 5];
                case 4:
                    error_5 = _a.sent();
                    (0, logger_1.logError)('Error clearing vector store in Supabase', error_5);
                    throw error_5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
