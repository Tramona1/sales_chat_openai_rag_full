"use strict";
/**
 * Supabase client utilities for connecting to and interacting with Supabase.
 * This file provides functions to create Supabase clients for different purposes.
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
exports.createPublicClient = createPublicClient;
exports.createServiceClient = createServiceClient;
exports.createAuthenticatedClient = createAuthenticatedClient;
exports.isSupabaseConfigured = isSupabaseConfigured;
exports.testSupabaseConnection = testSupabaseConnection;
exports.getSupabase = getSupabase;
exports.getSupabaseAdmin = getSupabaseAdmin;
exports.insertDocumentChunks = insertDocumentChunks;
exports.insertDocument = insertDocument;
exports.documentExists = documentExists;
exports.getDocumentById = getDocumentById;
exports.getChunksByDocumentId = getChunksByDocumentId;
exports.deleteDocument = deleteDocument;
exports.vectorSearch = vectorSearch;
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv_1 = __importDefault(require("dotenv"));
var logger_1 = require("./logger");
// Load environment variables (only works in non-Next.js environments)
dotenv_1.default.config();
/**
 * Gets Supabase configuration from environment variables
 * This is done as a function to ensure values are loaded at runtime
 */
function getSupabaseConfig() {
    var url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    var anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    var serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
    // <<< TEMPORARY DIAGNOSTIC LOG >>>
    console.log('*** [DEBUG] Reading Supabase Config: ***');
    console.log(" - NEXT_PUBLIC_SUPABASE_URL: ".concat(process.env.NEXT_PUBLIC_SUPABASE_URL));
    console.log(" - NEXT_PUBLIC_SUPABASE_ANON_KEY: ".concat(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
    console.log(" - SUPABASE_SERVICE_KEY: ".concat(process.env.SUPABASE_SERVICE_KEY));
    console.log('*** --- ***');
    // <<< END TEMPORARY DIAGNOSTIC LOG >>>
    // Validate that environment variables are set
    if (!url || !anonKey || !serviceKey) {
        var missingVars = [];
        if (!url)
            missingVars.push('SUPABASE_URL');
        if (!anonKey)
            missingVars.push('SUPABASE_ANON_KEY');
        if (!serviceKey)
            missingVars.push('SUPABASE_SERVICE_KEY');
        (0, logger_1.logError)("Missing Supabase environment variables: ".concat(missingVars.join(', ')));
        console.error("Missing Supabase environment variables: ".concat(missingVars.join(', ')), {
            url: !!url,
            anonKey: !!anonKey,
            serviceKey: !!serviceKey
        });
    }
    return { url: url, anonKey: anonKey, serviceKey: serviceKey };
}
/**
 * Creates a Supabase client using the public/anonymous key.
 * Use this for operations that should be accessible to unauthenticated users.
 *
 * @returns SupabaseClient instance with anon key
 */
function createPublicClient() {
    var _a = getSupabaseConfig(), url = _a.url, anonKey = _a.anonKey;
    if (!url || !anonKey) {
        throw new Error('Missing Supabase configuration for public client');
    }
    return (0, supabase_js_1.createClient)(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
/**
 * Creates a Supabase client using the service role key.
 * This has admin privileges and should only be used for server-side operations.
 *
 * @returns SupabaseClient instance with service role key, or null if creation fails
 */
function createServiceClient() {
    try {
        var _a = getSupabaseConfig(), url = _a.url, serviceKey = _a.serviceKey;
        if (!url || !serviceKey) {
            (0, logger_1.logError)('Missing Supabase configuration for service client');
            // Instead of throwing, log and return null
            return null;
        }
        // Add try...catch around the actual client creation
        var client = (0, supabase_js_1.createClient)(url, serviceKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
        (0, logger_1.logDebug)('[createServiceClient] Client created successfully.');
        return client;
    }
    catch (error) {
        (0, logger_1.logError)('[createServiceClient] Error during Supabase client creation', error);
        return null; // Return null on error
    }
}
/**
 * Creates a Supabase client with the specified JWT token for authenticated user operations.
 *
 * @param token JWT token from authenticated user
 * @returns SupabaseClient instance with the user's JWT
 */
function createAuthenticatedClient(token) {
    var _a = getSupabaseConfig(), url = _a.url, anonKey = _a.anonKey;
    if (!url || !anonKey) {
        throw new Error('Missing Supabase configuration for authenticated client');
    }
    return (0, supabase_js_1.createClient)(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            headers: {
                Authorization: "Bearer ".concat(token),
            },
        },
    });
}
/**
 * Check if Supabase is properly configured
 *
 * @returns boolean indicating if Supabase is configured
 */
function isSupabaseConfigured() {
    var _a = getSupabaseConfig(), url = _a.url, anonKey = _a.anonKey, serviceKey = _a.serviceKey;
    return Boolean(url && anonKey && serviceKey);
}
/**
 * Initializes connection to Supabase and tests that it's working
 *
 * @returns Promise resolving to true if connection successful, false otherwise
 */
function testSupabaseConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var supabase, _a, data, error, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    if (!isSupabaseConfigured()) {
                        (0, logger_1.logError)('Supabase is not configured properly. Check environment variables.');
                        return [2 /*return*/, false];
                    }
                    supabase = createServiceClient();
                    // Check if client creation failed
                    if (!supabase) {
                        (0, logger_1.logError)('Failed to create Supabase service client for connection test.');
                        return [2 /*return*/, false];
                    }
                    return [4 /*yield*/, supabase.from('documents').select('id').limit(1)];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        (0, logger_1.logError)('Failed to connect to Supabase:', error.message);
                        return [2 /*return*/, false];
                    }
                    (0, logger_1.logInfo)('Successfully connected to Supabase');
                    return [2 /*return*/, true];
                case 2:
                    err_1 = _b.sent();
                    (0, logger_1.logError)('Error testing Supabase connection:', err_1);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Create lazy-loaded service clients
// These will be initialized on first use
var _supabase = null;
var _supabaseAdmin = null;
// Getter for service client
// Returns SupabaseClient or null if creation failed
function getSupabase() {
    if (!_supabase) {
        _supabase = createServiceClient();
    }
    return _supabase;
}
// Getter for admin client
function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        var _a = getSupabaseConfig(), url = _a.url, serviceKey = _a.serviceKey;
        if (!url || !serviceKey) {
            throw new Error('Missing Supabase configuration for admin client');
        }
        try {
            // Create a proper client with explicit options to ensure all methods are available
            _supabaseAdmin = (0, supabase_js_1.createClient)(url, serviceKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
                // Add global database options if needed
                db: {
                    schema: 'public',
                },
                // Enable debug mode in development
                global: {
                    headers: {},
                },
            });
            // Verify that the client has the expected RPC method
            if (typeof _supabaseAdmin.rpc !== 'function') {
                (0, logger_1.logError)('Supabase client is missing the rpc method. This may indicate a version incompatibility.');
                // Log the issue and suggest solutions
                console.error('The Supabase client is missing the rpc method - possible solutions:');
                console.error('1. Update @supabase/supabase-js to the latest version');
                console.error('2. Check for TypeScript errors in your implementation');
                console.error('3. Consider using direct SQL queries as a fallback');
            }
            // Test connectivity in development environments
            if (process.env.NODE_ENV === 'development') {
                // Use setTimeout to avoid blocking initialization
                setTimeout(function () {
                    testSupabaseConnection()
                        .then(function (isConnected) {
                        if (isConnected) {
                            (0, logger_1.logInfo)('Supabase connection verified successfully');
                        }
                        else {
                            (0, logger_1.logError)('Failed to connect to Supabase');
                        }
                    });
                }, 0);
            }
        }
        catch (err) {
            var error = err;
            (0, logger_1.logError)('Error creating Supabase admin client', error);
            throw new Error("Failed to initialize Supabase admin client: ".concat(error.message));
        }
    }
    return _supabaseAdmin;
}
/**
 * Insert document chunks into the document_chunks table
 * @param chunks Array of document chunk objects to insert
 * @returns The inserted chunks
 */
function insertDocumentChunks(chunks) {
    return __awaiter(this, void 0, void 0, function () {
        var validChunks, _a, data, error, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    if (!chunks || chunks.length === 0) {
                        (0, logger_1.logWarning)('insertDocumentChunks called with empty or null chunks array.');
                        return [2 /*return*/, []];
                    }
                    validChunks = chunks.reduce(function (acc, chunk, index) {
                        // Basic structure check
                        if (!chunk || typeof chunk !== 'object') {
                            (0, logger_1.logWarning)("Invalid chunk structure at index ".concat(index, ". Skipping."));
                            return acc;
                        }
                        // Validate required fields, especially 'text'
                        if (!chunk.document_id || typeof chunk.chunk_index !== 'number' || !chunk.embedding || typeof chunk.text !== 'string' || chunk.text.trim() === '') {
                            (0, logger_1.logWarning)("Chunk at index ".concat(index, " is missing required fields or has empty text. Skipping."), { document_id: chunk.document_id, chunk_index: chunk.chunk_index });
                            return acc;
                        }
                        // Construct the valid chunk object
                        var validChunk = {
                            document_id: chunk.document_id,
                            chunk_index: chunk.chunk_index,
                            embedding: chunk.embedding,
                            text: chunk.text, // Validated text
                            metadata: chunk.metadata || {},
                            context: chunk.context || {}
                            // Map other fields if needed
                        };
                        acc.push(validChunk);
                        return acc;
                    }, []);
                    if (validChunks.length === 0) {
                        (0, logger_1.logError)('No valid chunks remaining after validation in insertDocumentChunks.');
                        // Decide if this should be an error or just return empty
                        // throw new Error('No valid chunks to insert after validation.');
                        return [2 /*return*/, []]; // Or return empty array if it's not a critical error
                    }
                    if (validChunks.length < chunks.length) {
                        (0, logger_1.logWarning)("Skipped ".concat(chunks.length - validChunks.length, " invalid chunks during insertion."));
                    }
                    // ** Add detailed logging before insert **
                    (0, logger_1.logInfo)('Attempting to insert the following valid chunks:');
                    validChunks.forEach(function (chunk, index) {
                        var _a, _b;
                        (0, logger_1.logDebug)("Chunk ".concat(index, " - document_id: ").concat(chunk.document_id, ", chunk_index: ").concat(chunk.chunk_index, ", text length: ").concat((_a = chunk.text) === null || _a === void 0 ? void 0 : _a.length, ", text starts with: '").concat((_b = chunk.text) === null || _b === void 0 ? void 0 : _b.substring(0, 50), "...'"));
                        // Log the full text only if debugging extensively, as it can be large
                        // logDebug(`Chunk ${index} Full Text: ${chunk.text}`); 
                    });
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('document_chunks')
                            .insert(validChunks) // Insert only the validated chunks
                            .select()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        (0, logger_1.logError)('Error inserting document chunks', error);
                        throw error;
                    }
                    return [2 /*return*/, data];
                case 2:
                    error_1 = _b.sent();
                    (0, logger_1.logError)('Document chunks insertion failed', error_1);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Insert a document into the documents table
 * @param document Document object to insert
 * @returns The inserted document
 */
function insertDocument(document) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('documents')
                            .insert(document)
                            .select()
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        (0, logger_1.logError)('Error inserting document', error);
                        throw error;
                    }
                    return [2 /*return*/, data];
                case 2:
                    error_2 = _b.sent();
                    (0, logger_1.logError)('Document insertion failed', error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check if a document with the given content hash already exists
 * @param contentHash The hash of the document content
 * @returns Boolean indicating if document exists
 */
function documentExists(contentHash) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('documents')
                            .select('id')
                            .eq('content_hash', contentHash)
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error && error.code !== 'PGRST116') {
                        // PGRST116 is the error code for "no rows returned"
                        (0, logger_1.logError)('Error checking document existence', error);
                        throw error;
                    }
                    return [2 /*return*/, !!data];
                case 2:
                    error_3 = _b.sent();
                    (0, logger_1.logError)('Error checking if document exists', error_3);
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get a document by its ID
 * @param id The document ID
 * @returns The document object
 */
function getDocumentById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, error_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('documents')
                            .select('*')
                            .eq('id', id)
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        (0, logger_1.logError)("Error fetching document with ID ".concat(id), error);
                        throw error;
                    }
                    return [2 /*return*/, data];
                case 2:
                    error_4 = _b.sent();
                    (0, logger_1.logError)("Failed to get document with ID ".concat(id), error_4);
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get document chunks by document ID
 * @param documentId The document ID
 * @returns Array of document chunks
 */
function getChunksByDocumentId(documentId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, error_5;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('document_chunks')
                            .select('*')
                            .eq('document_id', documentId)];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        (0, logger_1.logError)("Error fetching chunks for document ID ".concat(documentId), error);
                        throw error;
                    }
                    return [2 /*return*/, data || []];
                case 2:
                    error_5 = _b.sent();
                    (0, logger_1.logError)("Failed to get chunks for document ID ".concat(documentId), error_5);
                    throw error_5;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Delete a document and its associated chunks
 * @param documentId The document ID
 * @returns Boolean indicating success
 */
function deleteDocument(documentId) {
    return __awaiter(this, void 0, void 0, function () {
        var chunksError, docError, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('document_chunks')
                            .delete()
                            .eq('document_id', documentId)];
                case 1:
                    chunksError = (_a.sent()).error;
                    if (chunksError) {
                        (0, logger_1.logError)("Error deleting chunks for document ID ".concat(documentId), chunksError);
                        throw chunksError;
                    }
                    return [4 /*yield*/, getSupabaseAdmin()
                            .from('documents')
                            .delete()
                            .eq('id', documentId)];
                case 2:
                    docError = (_a.sent()).error;
                    if (docError) {
                        (0, logger_1.logError)("Error deleting document with ID ".concat(documentId), docError);
                        throw docError;
                    }
                    return [2 /*return*/, true];
                case 3:
                    error_6 = _a.sent();
                    (0, logger_1.logError)("Failed to delete document with ID ".concat(documentId), error_6);
                    throw error_6;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Performs a pure vector similarity search using the match_documents RPC function.
 *
 * @param queryEmbedding The vector embedding of the query.
 * @param limit Max number of results.
 * @param options Search options including match_threshold and potential filters.
 * @returns Array of matching VectorStoreItems with similarity scores.
 */
function vectorSearch(queryEmbedding_1) {
    return __awaiter(this, arguments, void 0, function (queryEmbedding, limit, options) {
        var supabase, match_threshold, _a, data, error, results, error_7;
        var _b;
        if (limit === void 0) { limit = 5; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    supabase = getSupabaseAdmin();
                    match_threshold = (_b = options === null || options === void 0 ? void 0 : options.match_threshold) !== null && _b !== void 0 ? _b : 0.7;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, supabase.rpc('match_documents', {
                            query_embedding: queryEmbedding,
                            match_threshold: match_threshold,
                            match_count: limit,
                            // Pass optional filters if provided in options
                            filter_category: options === null || options === void 0 ? void 0 : options.filter_category,
                            filter_technical_level: options === null || options === void 0 ? void 0 : options.filter_technical_level,
                            filter_document_ids: options === null || options === void 0 ? void 0 : options.filter_document_ids
                        })];
                case 2:
                    _a = _c.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        (0, logger_1.logError)('Error calling match_documents RPC', error);
                        throw error;
                    }
                    if (!data) {
                        return [2 /*return*/, []];
                    }
                    results = data.map(function (item) { return ({
                        id: item.id, // Chunk UUID
                        document_id: item.document_id, // Document UUID
                        chunk_index: item.chunk_index, // Chunk index (now returned by SQL)
                        text: item.text, // Processed chunk text
                        originalText: item.original_text, // Original chunk text
                        metadata: item.metadata, // Chunk metadata
                        context: item.context, // Chunk context (returned by SQL)
                        // visualContent: item.visual_content, // Also available if needed
                        embedding: [], // Not returned by search
                        score: item.similarity // Similarity score
                    }); });
                    return [2 /*return*/, results];
                case 3:
                    error_7 = _c.sent();
                    (0, logger_1.logError)('Error during vectorSearch', error_7);
                    // Re-throw or return empty depending on desired error handling
                    throw error_7;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Create
