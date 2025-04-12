/**
 * Supabase client utilities for connecting to and interacting with Supabase.
 * This file provides functions to create Supabase clients for different purposes.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logError, logInfo, logDebug } from './logger';

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
    if (!url) missingVars.push('SUPABASE_URL');
    if (!anonKey) missingVars.push('SUPABASE_ANON_KEY');
    if (!serviceKey) missingVars.push('SUPABASE_SERVICE_KEY');
    
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
export function createPublicClient(): SupabaseClient {
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
export function createServiceClient(): SupabaseClient {
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
export function createAuthenticatedClient(token: string): SupabaseClient {
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
export function isSupabaseConfigured(): boolean {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  return Boolean(url && anonKey && serviceKey);
}

/**
 * Initializes connection to Supabase and tests that it's working
 * 
 * @returns Promise resolving to true if connection successful, false otherwise
 */
export async function testSupabaseConnection(): Promise<boolean> {
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
  } catch (err) {
    logError('Error testing Supabase connection:', err);
    return false;
  }
}

// Create lazy-loaded service clients
// These will be initialized on first use
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

// Getter for service client
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createServiceClient();
  }
  return _supabase;
}

// Getter for admin client
export function getSupabaseAdmin(): SupabaseClient {
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
              } else {
                logError('Failed to connect to Supabase');
              }
            });
        }, 0);
      }
      
    } catch (err) {
      const error = err as Error;
      logError('Error creating Supabase admin client', error);
      throw new Error(`Failed to initialize Supabase admin client: ${error.message}`);
    }
  }
  return _supabaseAdmin;
}

// For backward compatibility
export const supabase = { get: getSupabase };
export const supabaseAdmin = { get: getSupabaseAdmin };

// Proxy to maintain interface compatibility
export const supabase2 = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    const client = getSupabase();
    return (client as any)[prop];
  }
});

// Proxy to maintain interface compatibility
export const supabaseAdmin2 = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    const client = getSupabaseAdmin();
    return (client as any)[prop];
  }
});

/**
 * Performs a hybrid search using both vector similarity and BM25 text search
 * @param query The search query text
 * @param limit Maximum number of results to return
 * @param threshold Minimum similarity score threshold
 * @returns Array of document chunks matching the query
 */
export async function hybridSearch(query: string, limit = 5, threshold = 0.5) {
  try {
    // Get vector embedding for the query using the embedText function from appropriate client
    let embedding;
    try {
      // We'll import the embedText function dynamically to avoid circular dependencies
      const { embedText } = await import('./openaiClient');
      embedding = await embedText(query);
    } catch (error) {
      logError('Error generating embedding for search query', error);
      throw new Error('Failed to generate embedding for search query');
    }

    // Call the hybrid_search function we defined in our Supabase schema
    // with the correct parameter names based on the stored procedure
    const { data, error } = await getSupabaseAdmin().rpc('hybrid_search', {
      query_text: query,
      query_embedding: embedding,
      match_count: limit,
      match_threshold: threshold,
      vector_weight: 0.7,
      keyword_weight: 0.3,
      filter: {} // Empty filter to ensure we use the right overload
    });

    if (error) {
      logError('Supabase hybrid search error', error);
      throw error;
    }

    logDebug(`Hybrid search found ${data?.length || 0} results for query: "${query}"`);
    return data || [];
  } catch (error) {
    logError('Error in hybrid search', error);
    throw error;
  }
}

/**
 * Insert a document into the documents table
 * @param document Document object to insert
 * @returns The inserted document
 */
export async function insertDocument(document: any) {
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
  } catch (error) {
    logError('Document insertion failed', error);
    throw error;
  }
}

/**
 * Insert document chunks into the document_chunks table
 * @param chunks Array of document chunk objects to insert
 * @returns The inserted chunks
 */
export async function insertDocumentChunks(chunks: any[]) {
  try {
    if (!chunks || chunks.length === 0) {
      return [];
    }

    const { data, error } = await getSupabaseAdmin()
      .from('document_chunks')
      .insert(chunks)
      .select();

    if (error) {
      logError('Error inserting document chunks', error);
      throw error;
    }

    return data;
  } catch (error) {
    logError('Document chunks insertion failed', error);
    throw error;
  }
}

/**
 * Check if a document with the given content hash already exists
 * @param contentHash The hash of the document content
 * @returns Boolean indicating if document exists
 */
export async function documentExists(contentHash: string) {
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
  } catch (error) {
    logError('Error checking if document exists', error);
    throw error;
  }
}

/**
 * Get a document by its ID
 * @param id The document ID
 * @returns The document object
 */
export async function getDocumentById(id: string) {
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
  } catch (error) {
    logError(`Failed to get document with ID ${id}`, error);
    throw error;
  }
}

/**
 * Get document chunks by document ID
 * @param documentId The document ID
 * @returns Array of document chunks
 */
export async function getChunksByDocumentId(documentId: string) {
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
  } catch (error) {
    logError(`Failed to get chunks for document ID ${documentId}`, error);
    throw error;
  }
}

/**
 * Delete a document and its associated chunks
 * @param documentId The document ID
 * @returns Boolean indicating success
 */
export async function deleteDocument(documentId: string) {
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
  } catch (error) {
    logError(`Failed to delete document with ID ${documentId}`, error);
    throw error;
  }
}

// Create