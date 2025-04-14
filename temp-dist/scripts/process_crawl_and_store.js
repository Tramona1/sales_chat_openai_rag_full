"use strict";
/**
 * Process Crawl Data and Store in Supabase
 * ----------------------------------------
 * This script processes the raw data from the Universal Crawler,
 * chunks it, generates embeddings, and stores it in Supabase.
 *
 * This script will:
 * 1. Read crawled data from a directory
 * 2. Process each document with document analysis
 * 3. Split into chunks with context
 * 4. Generate embeddings
 * 5. Store in Supabase
 * 6. Purge existing data in Supabase (optional)
 *
 * Usage:
 * npx ts-node scripts/process_crawl_and_store.ts [input_dir] [--purge] [--limit=n]
 *
 * Options:
 * --purge         Clear existing data in Supabase before inserting new data
 * --limit=n       Process only n files (for testing)
 * --skip-analysis Skip the document analysis step (faster, but less metadata)
 * --chunk-size=n  Set custom chunk size (default: 500)
 *
 * Example:
 * npx ts-node scripts/process_crawl_and_store.ts ./data/crawl_data --purge --limit=10
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
// Keep external/built-in imports static
var generative_ai_1 = require("@google/generative-ai");
// Revert uuid import back to named export
var uuid_1 = require("uuid");
// --- Core Utility function imports will be done dynamically below ---
// Setup dirname, load dotenv etc.
// dotenv.config(); // Removed - will rely on node -r dotenv/config
// Constants
var CRAWL_DATA_DIR = path_1.default.resolve(process.cwd(), 'data/workstream_crawl_data');
var PROCESSING_BATCH_SIZE = 5;
var SUPABASE_INSERT_BATCH_SIZE = 50;
var REBUILD_LOG_PATH = path_1.default.resolve(process.cwd(), 'data/logs/rebuild_crawl_data.log');
var DEFAULT_CHUNK_SIZE = 700;
var DEFAULT_CHUNK_OVERLAP = 100;
// Ensure log directory exists
var logDir = path_1.default.dirname(REBUILD_LOG_PATH);
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
// Simple inline logger
var logger = {
    info: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return console.log.apply(console, __spreadArray(["[INFO] ".concat(message)], args, false));
    },
    error: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return console.error.apply(console, __spreadArray(["[ERROR] ".concat(message)], args, false));
    },
    warning: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return console.warn.apply(console, __spreadArray(["[WARN] ".concat(message)], args, false));
    },
    debug: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return console.debug.apply(console, __spreadArray(["[DEBUG] ".concat(message)], args, false));
    },
    success: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return console.log.apply(console, __spreadArray(["[SUCCESS] ".concat(message)], args, false));
    },
};
// --- Helper: Read Source Data (from JSON files in a directory) ---
function getCrawlData(loggerInstance, inputDir, startIndex, endIndex) {
    if (startIndex === void 0) { startIndex = 0; }
    if (endIndex === void 0) { endIndex = Infinity; }
    var resolvedInputDir = path_1.default.resolve(process.cwd(), inputDir);
    loggerInstance.info("Reading crawl data from directory: ".concat(resolvedInputDir));
    if (!fs_1.default.existsSync(resolvedInputDir)) {
        loggerInstance.error("Crawl data directory not found: ".concat(resolvedInputDir));
        return [];
    }
    var allData = [];
    try {
        var files = fs_1.default.readdirSync(resolvedInputDir);
        var jsonFiles = files.filter(function (file) { return path_1.default.extname(file).toLowerCase() === '.json'; });
        var totalFilesFound = jsonFiles.length;
        loggerInstance.info("Found ".concat(totalFilesFound, " JSON files in the directory."));
        // --- Apply slicing based on indices --- 
        // Ensure indices are within bounds
        var actualStartIndex = Math.max(0, startIndex);
        var actualEndIndex = Math.min(totalFilesFound, endIndex); // endIndex is exclusive for slice
        if (actualStartIndex >= actualEndIndex) {
            loggerInstance.warning("Start index (".concat(startIndex, ") is not before end index (").concat(endIndex, "). No files will be processed for this range."));
            jsonFiles = [];
        }
        else {
            jsonFiles = jsonFiles.slice(actualStartIndex, actualEndIndex);
            loggerInstance.info("Processing files from index ".concat(actualStartIndex, " to ").concat(actualEndIndex - 1, " (Count: ").concat(jsonFiles.length, ")"));
        }
        // --- End slicing ---
        for (var _i = 0, jsonFiles_1 = jsonFiles; _i < jsonFiles_1.length; _i++) {
            var file = jsonFiles_1[_i];
            var filePath = path_1.default.join(resolvedInputDir, file);
            try {
                var fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
                var parsedData = JSON.parse(fileContent); // Assuming each file contains one object
                // Basic validation (optional but recommended)
                if (parsedData && parsedData.url && parsedData.content) {
                    allData.push(parsedData);
                }
                else {
                    loggerInstance.warning("Skipping file ".concat(file, " due to missing required fields (url, content)."));
                }
            }
            catch (parseError) {
                loggerInstance.error("Failed to read or parse JSON file: ".concat(filePath), parseError);
            }
        }
        loggerInstance.info("Successfully read and parsed data from ".concat(allData.length, " files."));
        return allData;
    }
    catch (error) {
        loggerInstance.error("Failed to read directory: ".concat(resolvedInputDir), error);
        return [];
    }
}
// --- Main Rebuild Function ---
function rebuildVectorStore() {
    return __awaiter(this, void 0, void 0, function () {
        var getEmbeddingClient, analyzeDocument, _a, splitIntoChunksWithContext, prepareTextForEmbedding, _b, addToVectorStore, clearVectorStore, _c, getSupabaseAdmin, testSupabaseConnection, DocumentCategoryType, generateGeminiChatCompletion, args, shouldPurge, fileLimit, startIndex, endIndex, inputDirArg, _i, args_1, arg, _d, args_2, arg, value, value, value, inputDirectory, embeddingClient_1, supabase, isConnected, docDeleteError, sourceDocs, processedDocsCount, failedDocsCount_1, totalChunksCreated_1, _loop_1, i, _e, finalDocCount, finalDocError, _f, finalChunkCount, finalChunkError, verificationError_1, error_1;
        var _this = this;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/embeddingClient.js')); })];
                case 1:
                    getEmbeddingClient = (_g.sent()).getEmbeddingClient;
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/documentAnalysis.js')); })];
                case 2:
                    analyzeDocument = (_g.sent()).analyzeDocument;
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/documentProcessing.js')); })];
                case 3:
                    _a = _g.sent(), splitIntoChunksWithContext = _a.splitIntoChunksWithContext, prepareTextForEmbedding = _a.prepareTextForEmbedding;
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/vectorStoreFactory.js')); })];
                case 4:
                    _b = _g.sent(), addToVectorStore = _b.addToVectorStore, clearVectorStore = _b.clearVectorStore;
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/supabaseClient.js')); })];
                case 5:
                    _c = _g.sent(), getSupabaseAdmin = _c.getSupabaseAdmin, testSupabaseConnection = _c.testSupabaseConnection;
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/documentCategories.js')); })];
                case 6:
                    DocumentCategoryType = (_g.sent()).DocumentCategoryType;
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/geminiClient.js')); })];
                case 7:
                    generateGeminiChatCompletion = (_g.sent()).generateGeminiChatCompletion;
                    logger.info('--- Starting Vector Store Rebuild from Crawl Data ---');
                    logger.info("Using Crawl Data: ".concat(CRAWL_DATA_DIR));
                    args = process.argv.slice(2);
                    shouldPurge = args.includes('--purge');
                    fileLimit = undefined;
                    startIndex = 0;
                    endIndex = Infinity;
                    inputDirArg = null;
                    // Find the input directory argument (doesn't start with --)
                    for (_i = 0, args_1 = args; _i < args_1.length; _i++) {
                        arg = args_1[_i];
                        if (!arg.startsWith('--')) {
                            inputDirArg = arg;
                            break; // Assume first non-flag argument is the input directory
                        }
                    }
                    if (!inputDirArg) {
                        logger.error("Input directory argument is required.");
                        process.exit(1);
                    }
                    // Parse flag arguments
                    for (_d = 0, args_2 = args; _d < args_2.length; _d++) {
                        arg = args_2[_d];
                        if (arg.startsWith('--limit=')) {
                            value = arg.split('=')[1];
                            fileLimit = value ? parseInt(value, 10) : undefined;
                            logger.warning('--limit is respected but may overlap/conflict with --start-index/--end-index logic. Consider using only index args for splitting.');
                        }
                        if (arg.startsWith('--start-index=')) {
                            value = arg.split('=')[1];
                            startIndex = value ? parseInt(value, 10) : 0;
                        }
                        if (arg.startsWith('--end-index=')) {
                            value = arg.split('=')[1];
                            endIndex = value ? parseInt(value, 10) : Infinity;
                        }
                    }
                    inputDirectory = inputDirArg;
                    logger.info("Using input directory: ".concat(inputDirectory));
                    _g.label = 8;
                case 8:
                    _g.trys.push([8, 22, , 23]);
                    embeddingClient_1 = getEmbeddingClient();
                    logger.info("Using Embedding Client: ".concat(embeddingClient_1.getProvider(), ", Dimensions: ").concat(embeddingClient_1.getDimensions()));
                    supabase = getSupabaseAdmin();
                    return [4 /*yield*/, testSupabaseConnection()];
                case 9:
                    isConnected = _g.sent();
                    if (!isConnected) {
                        logger.error('Failed to connect to Supabase. Check environment variables. Aborting.');
                        process.exit(1);
                    }
                    else {
                        logger.info('Supabase connection verified.');
                    }
                    if (!shouldPurge) return [3 /*break*/, 12];
                    logger.warning('--- PURGE FLAG DETECTED ---');
                    logger.info('Clearing existing data from document_chunks and documents tables...');
                    return [4 /*yield*/, clearVectorStore()];
                case 10:
                    _g.sent(); // Now available
                    return [4 /*yield*/, supabase.from('documents').delete().neq('id', (0, uuid_1.v4)())];
                case 11:
                    docDeleteError = (_g.sent()).error;
                    if (docDeleteError) {
                        logger.error('Failed to clear documents table.', docDeleteError);
                    }
                    else {
                        logger.info('Existing documents and chunks purged successfully.');
                    }
                    _g.label = 12;
                case 12:
                    sourceDocs = getCrawlData(logger, inputDirectory, startIndex, endIndex);
                    if (sourceDocs.length === 0) {
                        logger.error(new Error('No source documents found in crawl data directory for the specified index range. Aborting.'));
                        process.exit(1);
                    }
                    logger.info("Loaded ".concat(sourceDocs.length, " source documents to process for this instance."));
                    // Apply limit if provided (NOTE: This applies AFTER slicing by index)
                    if (fileLimit && fileLimit > 0 && fileLimit < sourceDocs.length) {
                        logger.info("Applying limit: Processing only the first ".concat(fileLimit, " documents from the sliced range."));
                        sourceDocs = sourceDocs.slice(0, fileLimit);
                    }
                    processedDocsCount = 0;
                    failedDocsCount_1 = 0;
                    totalChunksCreated_1 = 0;
                    _loop_1 = function (i) {
                        var batchDocs, batchPromises, batchResults, successfulResults, failedResults, documentsToInsert, _h, insertedDocs, docInsertError, docIdMap_1, chunksToInsertForBatch, j, chunkInsertBatch, chunkInsertError_1;
                        return __generator(this, function (_j) {
                            switch (_j.label) {
                                case 0:
                                    batchDocs = sourceDocs.slice(i, i + PROCESSING_BATCH_SIZE);
                                    logger.info("Processing document batch ".concat(Math.floor(i / PROCESSING_BATCH_SIZE) + 1, "/").concat(Math.ceil(sourceDocs.length / PROCESSING_BATCH_SIZE), " (").concat(batchDocs.length, " docs)"));
                                    batchPromises = batchDocs.map(function (doc) { return __awaiter(_this, void 0, void 0, function () {
                                        var docIdentifier, analysisResult_1, derivedCategory_1, urlPath, docContext_1, llmError_1, documentRecord, chunks, textsToEmbed, embeddings_1, chunkRecords, error_2;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0:
                                                    docIdentifier = doc.title || doc.url;
                                                    _a.label = 1;
                                                case 1:
                                                    _a.trys.push([1, 9, , 10]);
                                                    return [4 /*yield*/, analyzeDocument(doc.content, doc.url, { useCaching: false })];
                                                case 2:
                                                    analysisResult_1 = _a.sent();
                                                    logger.info("Analyzed content for: ".concat(docIdentifier));
                                                    derivedCategory_1 = DocumentCategoryType.GENERAL;
                                                    try {
                                                        urlPath = new URL(doc.url).pathname.toLowerCase();
                                                        // Example rules based on URL structure
                                                        if (urlPath.startsWith('/platform') || urlPath.startsWith('/features') || urlPath.startsWith('/product')) {
                                                            derivedCategory_1 = DocumentCategoryType.DOCUMENTS; // Closest match for product docs
                                                        }
                                                        else if (urlPath.startsWith('/blog')) {
                                                            derivedCategory_1 = DocumentCategoryType.GENERAL;
                                                        }
                                                        else if (urlPath.startsWith('/about') || urlPath.startsWith('/team') || urlPath.startsWith('/company')) {
                                                            derivedCategory_1 = DocumentCategoryType.GENERAL; // Company info
                                                        }
                                                        else if (urlPath.startsWith('/investors')) {
                                                            derivedCategory_1 = DocumentCategoryType.GENERAL; // Investor info
                                                        }
                                                        else if (urlPath.includes('pricing')) {
                                                            derivedCategory_1 = DocumentCategoryType.GENERAL;
                                                        }
                                                        else if (urlPath.startsWith('/careers') || urlPath.startsWith('/jobs')) {
                                                            derivedCategory_1 = DocumentCategoryType.HIRING;
                                                        }
                                                        else if (urlPath.includes('onboarding')) {
                                                            derivedCategory_1 = DocumentCategoryType.ONBOARDING;
                                                        }
                                                        else if (urlPath.includes('payroll')) {
                                                            derivedCategory_1 = DocumentCategoryType.PAYROLL;
                                                        }
                                                        else if (urlPath.includes('compliance')) {
                                                            derivedCategory_1 = DocumentCategoryType.COMPLIANCE;
                                                        }
                                                        else if (urlPath.includes('scheduling')) {
                                                            derivedCategory_1 = DocumentCategoryType.SCHEDULING;
                                                        }
                                                        logger.info("Derived category '".concat(derivedCategory_1, "' from URL: ").concat(doc.url));
                                                    }
                                                    catch (urlError) {
                                                        logger.warning("Could not parse URL for category derivation: ".concat(doc.url), urlError);
                                                    }
                                                    docContext_1 = {
                                                        summary: "",
                                                        entities: {},
                                                        keywords: []
                                                    };
                                                    _a.label = 3;
                                                case 3:
                                                    _a.trys.push([3, 5, , 6]);
                                                    return [4 /*yield*/, getDocumentLevelContextFromLLM(doc.content, doc.url)];
                                                case 4:
                                                    docContext_1 = _a.sent();
                                                    logger.info("Generated document-level context via LLM for: ".concat(docIdentifier));
                                                    return [3 /*break*/, 6];
                                                case 5:
                                                    llmError_1 = _a.sent();
                                                    logger.warning("Failed to generate document-level context via LLM for: ".concat(docIdentifier), llmError_1);
                                                    return [3 /*break*/, 6];
                                                case 6:
                                                    documentRecord = {
                                                        title: doc.title,
                                                        content: doc.content.substring(0, 500) + '...', // Truncated preview
                                                        source: doc.url,
                                                        source_type: 'web_crawl',
                                                        metadata: __assign({ primaryCategory: analysisResult_1.primaryCategory, secondaryCategories: analysisResult_1.secondaryCategories || [], technicalLevel: analysisResult_1.technicalLevel, qualityScore: analysisResult_1.confidenceScore, timestamp: doc.timestamp, urlDerivedCategory: derivedCategory_1, llmSummary: docContext_1.summary, llmExtractedEntities: docContext_1.entities, llmKeywords: docContext_1.keywords, crawlTimestamp: doc.timestamp }, (doc.metadata || {}))
                                                    };
                                                    return [4 /*yield*/, splitIntoChunksWithContext(doc.content, DEFAULT_CHUNK_SIZE, doc.url, true, analysisResult_1.documentContext)];
                                                case 7:
                                                    chunks = _a.sent();
                                                    logger.info("Created ".concat(chunks.length, " chunks for: ").concat(docIdentifier));
                                                    if (chunks.length === 0) {
                                                        logger.warning("No chunks generated for document: ".concat(docIdentifier));
                                                        return [2 /*return*/, { success: true, document: documentRecord, chunks: [] }];
                                                    }
                                                    textsToEmbed = chunks.map(function (chunk) { return chunk.text; });
                                                    return [4 /*yield*/, embeddingClient_1.embedBatch(textsToEmbed, generative_ai_1.TaskType.RETRIEVAL_DOCUMENT)];
                                                case 8:
                                                    embeddings_1 = _a.sent();
                                                    logger.info("Generated ".concat(embeddings_1.length, " embeddings for ").concat(docIdentifier));
                                                    chunkRecords = chunks.map(function (chunk, index) {
                                                        var _a;
                                                        if (!embeddings_1[index] || embeddings_1[index].length !== embeddingClient_1.getDimensions()) {
                                                            logger.error("Invalid embedding generated for chunk ".concat(index, " of ").concat(docIdentifier, ". Skipping chunk."));
                                                            return null;
                                                        }
                                                        return {
                                                            chunk_index: index,
                                                            embedding: embeddings_1[index],
                                                            original_text: chunk.text, // Keep original text here
                                                            text: chunk.text, // Store the clean chunk text (that was embedded) here
                                                            metadata: __assign(__assign({}, (chunk.metadata || {})), { primaryCategory: analysisResult_1.primaryCategory, secondaryCategories: analysisResult_1.secondaryCategories, technicalLevel: analysisResult_1.technicalLevel, keywords: analysisResult_1.keywords, entities: analysisResult_1.entities, qualityFlags: analysisResult_1.qualityFlags, confidenceScore: analysisResult_1.confidenceScore, routingPriority: analysisResult_1.routingPriority, 
                                                                // Add URL-derived category and document context
                                                                urlDerivedCategory: derivedCategory_1, docSummary: docContext_1.summary, docEntities: docContext_1.entities }),
                                                            context: ((_a = chunk.metadata) === null || _a === void 0 ? void 0 : _a.context) || {},
                                                        };
                                                    }).filter(function (record) { return record !== null; });
                                                    if (chunkRecords.length !== chunks.length) {
                                                        logger.warning("Skipped ".concat(chunks.length - chunkRecords.length, " chunks due to embedding issues for ").concat(docIdentifier));
                                                    }
                                                    totalChunksCreated_1 += chunkRecords.length;
                                                    return [2 /*return*/, { success: true, document: documentRecord, chunks: chunkRecords }];
                                                case 9:
                                                    error_2 = _a.sent();
                                                    logger.error("Failed to process document: ".concat(docIdentifier), error_2);
                                                    return [2 /*return*/, { success: false, document: { title: docIdentifier, source: doc.url }, chunks: [] }];
                                                case 10: return [2 /*return*/];
                                            }
                                        });
                                    }); });
                                    return [4 /*yield*/, Promise.all(batchPromises)];
                                case 1:
                                    batchResults = _j.sent();
                                    successfulResults = batchResults.filter(function (r) { return r.success; });
                                    failedResults = batchResults.filter(function (r) { return !r.success; });
                                    failedDocsCount_1 += failedResults.length;
                                    if (failedResults.length > 0) {
                                        logger.warning("Failed to process ".concat(failedResults.length, " documents in this batch."));
                                        failedResults.forEach(function (fr) { return logger.debug("Failed doc source: ".concat(fr.document.source)); });
                                    }
                                    documentsToInsert = successfulResults.map(function (r) { return r.document; });
                                    if (!(documentsToInsert.length > 0)) return [3 /*break*/, 14];
                                    logger.info("Inserting ".concat(documentsToInsert.length, " document records for batch..."));
                                    return [4 /*yield*/, supabase
                                            .from('documents')
                                            .insert(documentsToInsert)
                                            .select('id, source')];
                                case 2:
                                    _h = _j.sent(), insertedDocs = _h.data, docInsertError = _h.error;
                                    if (!docInsertError) return [3 /*break*/, 3];
                                    logger.error("Failed to insert document batch", docInsertError);
                                    // Mark all docs in this batch as failed that were intended for insert
                                    failedDocsCount_1 += documentsToInsert.length; // Increment failures
                                    return [3 /*break*/, 13];
                                case 3:
                                    if (!(insertedDocs && insertedDocs.length > 0)) return [3 /*break*/, 12];
                                    logger.success("Inserted ".concat(insertedDocs.length, " document records."));
                                    processedDocsCount += insertedDocs.length;
                                    failedDocsCount_1 += (documentsToInsert.length - insertedDocs.length); // Account for partial insert failures if any
                                    docIdMap_1 = new Map(insertedDocs.map(function (d) { return [d.source, d.id]; }));
                                    chunksToInsertForBatch = successfulResults
                                        .filter(function (r) { return r.chunks.length > 0; }) // Only results with chunks
                                        .flatMap(function (r) {
                                        var docId = docIdMap_1.get(r.document.source);
                                        if (!docId) {
                                            // This case should be rare if doc insert succeeded and we selected source
                                            logger.warning("Could not find inserted document ID for source: ".concat(r.document.source, ". Skipping ").concat(r.chunks.length, " chunks."));
                                            failedDocsCount_1++; // Count the parent doc as failed if we can't link chunks
                                            return []; // Skip chunks if parent doc insert failed or wasn't found
                                        }
                                        // Assign the parent document_id to each chunk
                                        return r.chunks.map(function (chunk) { return (__assign(__assign({}, chunk), { document_id: docId })); });
                                    });
                                    if (!(chunksToInsertForBatch.length > 0)) return [3 /*break*/, 10];
                                    logger.info("Preparing to insert ".concat(chunksToInsertForBatch.length, " chunks for batch..."));
                                    j = 0;
                                    _j.label = 4;
                                case 4:
                                    if (!(j < chunksToInsertForBatch.length)) return [3 /*break*/, 9];
                                    chunkInsertBatch = chunksToInsertForBatch.slice(j, j + SUPABASE_INSERT_BATCH_SIZE);
                                    _j.label = 5;
                                case 5:
                                    _j.trys.push([5, 7, , 8]);
                                    // --- Add Logging Here ---
                                    if (chunkInsertBatch.length > 0) {
                                        logger.debug('Metadata being sent to addToVectorStore (first chunk):', chunkInsertBatch[0].metadata);
                                    }
                                    // --- End Logging ---
                                    // Use the factory pattern to add chunks
                                    return [4 /*yield*/, addToVectorStore(chunkInsertBatch)];
                                case 6:
                                    // --- End Logging ---
                                    // Use the factory pattern to add chunks
                                    _j.sent(); // This calls insertDocumentChunks internally
                                    logger.info("Inserted chunk batch ".concat(Math.floor(j / SUPABASE_INSERT_BATCH_SIZE) + 1, "/").concat(Math.ceil(chunksToInsertForBatch.length / SUPABASE_INSERT_BATCH_SIZE)));
                                    return [3 /*break*/, 8];
                                case 7:
                                    chunkInsertError_1 = _j.sent();
                                    logger.error("Failed to insert chunk batch (Size: ".concat(chunkInsertBatch.length, "). Error: ").concat(chunkInsertError_1.message || chunkInsertError_1), chunkInsertError_1);
                                    return [3 /*break*/, 8];
                                case 8:
                                    j += SUPABASE_INSERT_BATCH_SIZE;
                                    return [3 /*break*/, 4];
                                case 9:
                                    logger.success("Finished inserting chunks for document batch.");
                                    return [3 /*break*/, 11];
                                case 10:
                                    logger.info('No valid chunks to insert for this batch.');
                                    _j.label = 11;
                                case 11: return [3 /*break*/, 13];
                                case 12:
                                    logger.warning('Document insert operation returned no data or error. Assuming failure.');
                                    failedDocsCount_1 += documentsToInsert.length;
                                    _j.label = 13;
                                case 13: return [3 /*break*/, 15];
                                case 14:
                                    logger.info("No successful documents to insert in this batch.");
                                    _j.label = 15;
                                case 15:
                                    logger.info("Batch Complete. Processed Docs: ".concat(processedDocsCount, ", Failed Docs: ").concat(failedDocsCount_1, ", Total Chunks Added: ").concat(totalChunksCreated_1));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _g.label = 13;
                case 13:
                    if (!(i < sourceDocs.length)) return [3 /*break*/, 16];
                    return [5 /*yield**/, _loop_1(i)];
                case 14:
                    _g.sent();
                    _g.label = 15;
                case 15:
                    i += PROCESSING_BATCH_SIZE;
                    return [3 /*break*/, 13];
                case 16:
                    logger.info('--- Verification ---');
                    _g.label = 17;
                case 17:
                    _g.trys.push([17, 20, , 21]);
                    return [4 /*yield*/, supabase.from('documents').select('*', { count: 'exact', head: true })];
                case 18:
                    _e = _g.sent(), finalDocCount = _e.count, finalDocError = _e.error;
                    return [4 /*yield*/, supabase.from('document_chunks').select('*', { count: 'exact', head: true })];
                case 19:
                    _f = _g.sent(), finalChunkCount = _f.count, finalChunkError = _f.error;
                    if (finalDocError || finalChunkError) {
                        logger.error('Could not get final counts from Supabase.', { finalDocError: finalDocError, finalChunkError: finalChunkError });
                    }
                    else {
                        logger.info("Final Supabase counts - Documents: ".concat(finalDocCount, ", Chunks: ").concat(finalChunkCount));
                    }
                    return [3 /*break*/, 21];
                case 20:
                    verificationError_1 = _g.sent();
                    logger.error('Error during final Supabase count verification.', verificationError_1);
                    return [3 /*break*/, 21];
                case 21:
                    logger.success('--- Vector Store Rebuild Completed ---');
                    logger.info("Total Documents Processed Attempted: ".concat(sourceDocs.length));
                    logger.info("Total Documents Successfully Inserted: ".concat(processedDocsCount));
                    logger.info("Total Documents Failed: ".concat(failedDocsCount_1));
                    logger.info("Total Chunks Created & Inserted: ".concat(totalChunksCreated_1));
                    return [3 /*break*/, 23];
                case 22:
                    error_1 = _g.sent();
                    logger.error('--- FATAL ERROR during vector store rebuild ---', error_1);
                    process.exit(1);
                    return [3 /*break*/, 23];
                case 23: return [2 /*return*/];
            }
        });
    });
}
/**
 * Extract document-level context from content using LLM
 */
function getDocumentLevelContextFromLLM(text, source) {
    return __awaiter(this, void 0, void 0, function () {
        var maxInputLength, inputText, prompt, generateGeminiChatCompletion, response, structuredResponse, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    maxInputLength = 18000;
                    inputText = text.length > maxInputLength ? text.substring(0, maxInputLength) + "\\n...[TRUNCATED]" : text;
                    prompt = "Analyze the following document text from source: ".concat(source, ".\n    Provide:\n    1.  summary: A concise 2-3 sentence summary focusing on the main purpose and key takeaways.\n    2.  entities: Extract key named entities (people, organizations, specific product names, locations) mentioned. Specifically identify and categorize if possible: \"CEO\", \"CTO\", \"INVESTOR_FIRM\", \"INVESTOR_PERSON\", \"PRODUCT_NAME\". List names under their category.\n    3.  keywords: Generate a list of 5-10 relevant keywords or tags describing the core content.\n\n    Respond ONLY with a valid JSON object adhering to this structure:\n    {\n      \"summary\": \"string\",\n      \"entities\": {\n        \"PERSON\": [\"string\", ...],\n        \"ORG\": [\"string\", ...],\n        \"PRODUCT_NAME\": [\"string\", ...],\n        \"CEO\": [\"string\", ...],\n        \"CTO\": [\"string\", ...],\n        \"INVESTOR_FIRM\": [\"string\", ...],\n        \"INVESTOR_PERSON\": [\"string\", ...]\n      },\n      \"keywords\": [\"string\", ...]\n    }\n\n    Document Text:\n    \"\"\"\n    ").concat(inputText, "\n    \"\"\"");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/geminiClient.js')); })];
                case 2:
                    generateGeminiChatCompletion = (_a.sent()).generateGeminiChatCompletion;
                    return [4 /*yield*/, generateGeminiChatCompletion("", prompt)];
                case 3:
                    response = _a.sent();
                    structuredResponse = void 0;
                    try {
                        structuredResponse = JSON.parse(response);
                    }
                    catch (parseError) {
                        logger.warning("Failed to parse LLM response as JSON: ".concat(response.substring(0, 200), "..."), parseError);
                        return [2 /*return*/, { summary: "LLM analysis failed (parsing error).", entities: {}, keywords: [] }];
                    }
                    // Basic validation
                    if (structuredResponse && structuredResponse.summary && structuredResponse.entities && structuredResponse.keywords) {
                        logger.info("Successfully extracted document context via LLM for ".concat(source));
                        return [2 /*return*/, structuredResponse];
                    }
                    else {
                        logger.warning("LLM returned incomplete context for ".concat(source, ". Response: ").concat(JSON.stringify(structuredResponse)));
                        return [2 /*return*/, { summary: "LLM analysis incomplete.", entities: {}, keywords: [] }];
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_3 = _a.sent();
                    logger.error("LLM document context extraction failed for ".concat(source), error_3);
                    return [2 /*return*/, { summary: "LLM analysis failed.", entities: {}, keywords: [] }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// --- Run the rebuild ---
rebuildVectorStore();
