/**
 * Vector Store Factory
 *
 * This factory module selects between file-based and Supabase vector store implementations
 * based on the USE_SUPABASE environment variable.
 */
import { logInfo, logError, logWarning } from './logger';
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
export async function addToVectorStore(items) {
    // REMOVED: if (useSupabase)
    // Import dynamically to avoid circular dependencies
    const { insertDocumentChunks } = await import('./supabaseClient');
    const itemsArray = Array.isArray(items) ? items : [items];
    try {
        // Convert to the format expected by insertDocumentChunks
        const chunks = itemsArray.map(item => ({
            document_id: item.document_id, // Could be undefined
            chunk_index: item.chunk_index, // Could be undefined
            // Use originalText as fallback for text if text is missing or empty
            text: item.text?.trim() ? item.text : (item.originalText || ''),
            embedding: item.embedding,
            metadata: item.metadata || {},
            context: item.context || {}
        }));
        // Filter out chunks with empty text OR missing required fields for insertion
        const validChunksToInsert = chunks.filter(chunk => {
            const hasRequiredFields = chunk.document_id !== undefined &&
                typeof chunk.chunk_index === 'number' &&
                chunk.text.trim() !== '';
            if (!hasRequiredFields) {
                logWarning(`VectorStoreFactory: Skipping chunk due to missing required fields (doc_id, chunk_idx, text) or empty text.`, {
                    document_id: chunk.document_id,
                    chunk_index: chunk.chunk_index
                });
            }
            return hasRequiredFields;
        }); // Assert type after filtering
        if (validChunksToInsert.length < chunks.length) {
            logWarning(`VectorStoreFactory: Skipped ${chunks.length - validChunksToInsert.length} chunks during conversion.`);
        }
        // Only proceed if there are valid chunks
        if (validChunksToInsert.length > 0) {
            // Now validChunksToInsert matches DocumentChunkInsertData[] type
            await insertDocumentChunks(validChunksToInsert);
        }
        else {
            logWarning('VectorStoreFactory: No valid chunks to insert after conversion.');
        }
    }
    catch (error) {
        logError('Error adding items to Supabase vector store', error);
        throw error;
    }
}
/**
 * Get similar items from the vector store
 * @param queryEmbedding Vector embedding to compare against
 * @param limit Maximum number of results to return
 * @param options Additional options for the search (e.g., match_threshold)
 */
export async function getSimilarItems(queryEmbedding, limit = 5, options) {
    // REMOVED: if (useSupabase)
    // Import dynamically to avoid circular dependencies
    // Import the specific vectorSearch function from supabaseClient
    const { vectorSearch } = await import('./supabaseClient');
    try {
        // Call the vectorSearch function from supabaseClient
        // Pass relevant options (like match_threshold)
        // Note: Filters beyond match_threshold aren't directly supported by this factory function signature
        // If more complex filtering is needed here, the factory signature must be updated.
        return await vectorSearch(queryEmbedding, limit, {
            match_threshold: options?.match_threshold
        });
        // REMOVED: Direct RPC call and mapping logic
        // const { getSupabaseAdmin } = await import('./supabaseClient');
        // const match_threshold = options?.match_threshold || 0.7;
        // const { data, error } = await getSupabaseAdmin().rpc('match_documents', {
        //   query_embedding: queryEmbedding,
        //   match_threshold: match_threshold,
        //   match_count: limit
        // });
        // 
        // if (error) {
        //   throw error;
        // }
        // 
        // // Format results to match the expected VectorStoreItem format
        // return (data || []).map((item: any) => ({
        //   id: item.id,
        //   document_id: item.document_id,
        //   chunk_index: item.chunk_index || 0, // Expect chunk_index from modified RPC
        //   text: item.text,
        //   originalText: item.original_text,
        //   embedding: [], // Embeddings are not returned by default
        //   metadata: item.metadata || {},
        //   score: item.similarity
        // }));
    }
    catch (error) {
        logError('Error getting similar items from Supabase via supabaseClient', error);
        throw error;
    }
}
/**
 * Get the size of the vector store
 */
export async function getVectorStoreSize() {
    // REMOVED: if (useSupabase)
    // Import dynamically to avoid circular dependencies
    const { getSupabaseAdmin } = await import('./supabaseClient');
    try {
        const { count, error } = await getSupabaseAdmin()
            .from('document_chunks')
            .select('*', { count: 'exact', head: true });
        if (error) {
            throw error;
        }
        return count || 0;
    }
    catch (error) {
        logError('Error getting vector store size from Supabase', error);
        throw error;
    }
}
/**
 * Get all items from the vector store
 */
export async function getAllVectorStoreItems() {
    // REMOVED: if (useSupabase)
    // Import dynamically to avoid circular dependencies
    const { getSupabaseAdmin } = await import('./supabaseClient');
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('document_chunks')
            .select('id, document_id, chunk_index, content, original_text, metadata');
        if (error) {
            throw error;
        }
        // Format results to match the expected VectorStoreItem format
        return (data || []).map((item) => ({
            id: item.id,
            document_id: item.document_id,
            chunk_index: item.chunk_index,
            text: item.content,
            originalText: item.original_text,
            embedding: [], // Embeddings are not returned by default
            metadata: item.metadata
        }));
    }
    catch (error) {
        logError('Error getting all vector store items from Supabase', error);
        throw error;
    }
}
/**
 * Clear the vector store
 */
export async function clearVectorStore() {
    // REMOVED: if (useSupabase)
    // Import dynamically to avoid circular dependencies
    const { getSupabaseAdmin } = await import('./supabaseClient');
    try {
        // Warning: This is a destructive operation!
        const { error: chunksError } = await getSupabaseAdmin()
            .from('document_chunks')
            .delete()
            .not('id', 'eq', '00000000-0000-0000-0000-000000000000'); // Delete all except placeholder
        if (chunksError) {
            throw chunksError;
        }
        logInfo('Successfully cleared document_chunks table');
    }
    catch (error) {
        logError('Error clearing vector store in Supabase', error);
        throw error;
    }
}
