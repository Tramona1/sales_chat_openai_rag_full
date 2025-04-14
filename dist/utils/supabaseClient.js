/**
 * Supabase client utilities for connecting to and interacting with Supabase.
 * This file provides functions to create Supabase clients for different purposes.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logError, logInfo, logDebug, logWarning } from './logger';
// Load environment variables (only works in non-Next.js environments)
dotenv.config();
/**
 * Gets Supabase configuration from environment variables
 * This is done as a function to ensure values are loaded at runtime
 */
function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
    // Validate that environment variables are set
    if (!url || !anonKey || !serviceKey) {
        const missingVars = [];
        if (!url)
            missingVars.push('SUPABASE_URL');
        if (!anonKey)
            missingVars.push('SUPABASE_ANON_KEY');
        if (!serviceKey)
            missingVars.push('SUPABASE_SERVICE_KEY');
        logError(`Missing Supabase environment variables: ${missingVars.join(', ')}`);
        console.error(`Missing Supabase environment variables: ${missingVars.join(', ')}`, {
            url: !!url,
            anonKey: !!anonKey,
            serviceKey: !!serviceKey
        });
    }
    return { url, anonKey, serviceKey };
}
/**
 * Creates a Supabase client using the public/anonymous key.
 * Use this for operations that should be accessible to unauthenticated users.
 *
 * @returns SupabaseClient instance with anon key
 */
export function createPublicClient() {
    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) {
        throw new Error('Missing Supabase configuration for public client');
    }
    return createClient(url, anonKey, {
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
 * @returns SupabaseClient instance with service role key
 */
export function createServiceClient() {
    const { url, serviceKey } = getSupabaseConfig();
    if (!url || !serviceKey) {
        throw new Error('Missing Supabase configuration for service client');
    }
    return createClient(url, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
/**
 * Creates a Supabase client with the specified JWT token for authenticated user operations.
 *
 * @param token JWT token from authenticated user
 * @returns SupabaseClient instance with the user's JWT
 */
export function createAuthenticatedClient(token) {
    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) {
        throw new Error('Missing Supabase configuration for authenticated client');
    }
    return createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });
}
/**
 * Check if Supabase is properly configured
 *
 * @returns boolean indicating if Supabase is configured
 */
export function isSupabaseConfigured() {
    const { url, anonKey, serviceKey } = getSupabaseConfig();
    return Boolean(url && anonKey && serviceKey);
}
/**
 * Initializes connection to Supabase and tests that it's working
 *
 * @returns Promise resolving to true if connection successful, false otherwise
 */
export async function testSupabaseConnection() {
    try {
        if (!isSupabaseConfigured()) {
            logError('Supabase is not configured properly. Check environment variables.');
            return false;
        }
        const supabase = createServiceClient();
        // Test connection by querying a simple system table
        const { data, error } = await supabase.from('documents').select('id').limit(1);
        if (error) {
            logError('Failed to connect to Supabase:', error.message);
            return false;
        }
        logInfo('Successfully connected to Supabase');
        return true;
    }
    catch (err) {
        logError('Error testing Supabase connection:', err);
        return false;
    }
}
// Create lazy-loaded service clients
// These will be initialized on first use
let _supabase = null;
let _supabaseAdmin = null;
// Getter for service client
export function getSupabase() {
    if (!_supabase) {
        _supabase = createServiceClient();
    }
    return _supabase;
}
// Getter for admin client
export function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        const { url, serviceKey } = getSupabaseConfig();
        if (!url || !serviceKey) {
            throw new Error('Missing Supabase configuration for admin client');
        }
        try {
            // Create a proper client with explicit options to ensure all methods are available
            _supabaseAdmin = createClient(url, serviceKey, {
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
                logError('Supabase client is missing the rpc method. This may indicate a version incompatibility.');
                // Log the issue and suggest solutions
                console.error('The Supabase client is missing the rpc method - possible solutions:');
                console.error('1. Update @supabase/supabase-js to the latest version');
                console.error('2. Check for TypeScript errors in your implementation');
                console.error('3. Consider using direct SQL queries as a fallback');
            }
            // Test connectivity in development environments
            if (process.env.NODE_ENV === 'development') {
                // Use setTimeout to avoid blocking initialization
                setTimeout(() => {
                    testSupabaseConnection()
                        .then(isConnected => {
                        if (isConnected) {
                            logInfo('Supabase connection verified successfully');
                        }
                        else {
                            logError('Failed to connect to Supabase');
                        }
                    });
                }, 0);
            }
        }
        catch (err) {
            const error = err;
            logError('Error creating Supabase admin client', error);
            throw new Error(`Failed to initialize Supabase admin client: ${error.message}`);
        }
    }
    return _supabaseAdmin;
}
/**
 * Insert document chunks into the document_chunks table
 * @param chunks Array of document chunk objects to insert
 * @returns The inserted chunks
 */
export async function insertDocumentChunks(chunks) {
    try {
        if (!chunks || chunks.length === 0) {
            logWarning('insertDocumentChunks called with empty or null chunks array.');
            return [];
        }
        // Validate and filter chunks using reduce for better type handling
        const validChunks = chunks.reduce((acc, chunk, index) => {
            // Basic structure check
            if (!chunk || typeof chunk !== 'object') {
                logWarning(`Invalid chunk structure at index ${index}. Skipping.`);
                return acc;
            }
            // Validate required fields, especially 'text'
            if (!chunk.document_id || typeof chunk.chunk_index !== 'number' || !chunk.embedding || typeof chunk.text !== 'string' || chunk.text.trim() === '') {
                logWarning(`Chunk at index ${index} is missing required fields or has empty text. Skipping.`, { document_id: chunk.document_id, chunk_index: chunk.chunk_index });
                return acc;
            }
            // Construct the valid chunk object
            const validChunk = {
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
        }, []); // Initialize accumulator with the correct type
        if (validChunks.length === 0) {
            logError('No valid chunks remaining after validation in insertDocumentChunks.');
            // Decide if this should be an error or just return empty
            // throw new Error('No valid chunks to insert after validation.');
            return []; // Or return empty array if it's not a critical error
        }
        if (validChunks.length < chunks.length) {
            logWarning(`Skipped ${chunks.length - validChunks.length} invalid chunks during insertion.`);
        }
        // ** Add detailed logging before insert **
        logInfo('Attempting to insert the following valid chunks:');
        validChunks.forEach((chunk, index) => {
            logDebug(`Chunk ${index} - document_id: ${chunk.document_id}, chunk_index: ${chunk.chunk_index}, text length: ${chunk.text?.length}, text starts with: \'${chunk.text?.substring(0, 50)}...'`);
            // Log the full text only if debugging extensively, as it can be large
            // logDebug(`Chunk ${index} Full Text: ${chunk.text}`); 
        });
        // ** End detailed logging **
        const { data, error } = await getSupabaseAdmin()
            .from('document_chunks')
            .insert(validChunks) // Insert only the validated chunks
            .select();
        if (error) {
            logError('Error inserting document chunks', error);
            throw error;
        }
        return data;
    }
    catch (error) {
        logError('Document chunks insertion failed', error);
        throw error;
    }
}
/**
 * Insert a document into the documents table
 * @param document Document object to insert
 * @returns The inserted document
 */
export async function insertDocument(document) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('documents')
            .insert(document)
            .select()
            .single();
        if (error) {
            logError('Error inserting document', error);
            throw error;
        }
        return data;
    }
    catch (error) {
        logError('Document insertion failed', error);
        throw error;
    }
}
/**
 * Check if a document with the given content hash already exists
 * @param contentHash The hash of the document content
 * @returns Boolean indicating if document exists
 */
export async function documentExists(contentHash) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('documents')
            .select('id')
            .eq('content_hash', contentHash)
            .single();
        if (error && error.code !== 'PGRST116') {
            // PGRST116 is the error code for "no rows returned"
            logError('Error checking document existence', error);
            throw error;
        }
        return !!data;
    }
    catch (error) {
        logError('Error checking if document exists', error);
        throw error;
    }
}
/**
 * Get a document by its ID
 * @param id The document ID
 * @returns The document object
 */
export async function getDocumentById(id) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('documents')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            logError(`Error fetching document with ID ${id}`, error);
            throw error;
        }
        return data;
    }
    catch (error) {
        logError(`Failed to get document with ID ${id}`, error);
        throw error;
    }
}
/**
 * Get document chunks by document ID
 * @param documentId The document ID
 * @returns Array of document chunks
 */
export async function getChunksByDocumentId(documentId) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('document_chunks')
            .select('*')
            .eq('document_id', documentId);
        if (error) {
            logError(`Error fetching chunks for document ID ${documentId}`, error);
            throw error;
        }
        return data || [];
    }
    catch (error) {
        logError(`Failed to get chunks for document ID ${documentId}`, error);
        throw error;
    }
}
/**
 * Delete a document and its associated chunks
 * @param documentId The document ID
 * @returns Boolean indicating success
 */
export async function deleteDocument(documentId) {
    try {
        // Delete document chunks first (due to foreign key constraint)
        const { error: chunksError } = await getSupabaseAdmin()
            .from('document_chunks')
            .delete()
            .eq('document_id', documentId);
        if (chunksError) {
            logError(`Error deleting chunks for document ID ${documentId}`, chunksError);
            throw chunksError;
        }
        // Then delete the document
        const { error: docError } = await getSupabaseAdmin()
            .from('documents')
            .delete()
            .eq('id', documentId);
        if (docError) {
            logError(`Error deleting document with ID ${documentId}`, docError);
            throw docError;
        }
        return true;
    }
    catch (error) {
        logError(`Failed to delete document with ID ${documentId}`, error);
        throw error;
    }
}
/**
 * Performs a pure vector similarity search using the match_documents RPC function.
 *
 * @param queryEmbedding The vector embedding of the query.
 * @param limit Max number of results.
 * @param options Search options including match_threshold and potential filters.
 * @returns Array of matching VectorStoreItems with similarity scores.
 */
export async function vectorSearch(queryEmbedding, limit = 5, options) {
    const supabase = getSupabaseAdmin();
    const match_threshold = options?.match_threshold ?? 0.7; // Default threshold if not provided
    try {
        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: match_threshold,
            match_count: limit,
            // Pass optional filters if provided in options
            filter_category: options?.filter_category,
            filter_technical_level: options?.filter_technical_level,
            filter_document_ids: options?.filter_document_ids
        });
        if (error) {
            logError('Error calling match_documents RPC', error);
            throw error;
        }
        if (!data) {
            return [];
        }
        // Map results, ensuring chunk_index is now included
        const results = data.map((item) => ({
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
        }));
        return results;
    }
    catch (error) {
        logError('Error during vectorSearch', error);
        // Re-throw or return empty depending on desired error handling
        throw error;
    }
}
// Create
