import { createClient } from '@supabase/supabase-js';
import { logError, logInfo } from './logger';
import { addToVectorStore } from './vectorStoreFactory';
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
/**
 * Get all pending documents
 */
export async function getPendingDocuments() {
    const { data, error } = await supabase
        .from('pending_documents')
        .select(`
      id,
      text,
      status,
      submitted_at,
      reviewed_at,
      reviewer_comments,
      has_conflicts,
      conflicting_docs,
      metadata
    `)
        .order('submitted_at', { ascending: false });
    if (error) {
        logError('Error fetching pending documents', error);
        return [];
    }
    return data;
}
/**
 * Get a specific pending document by ID
 */
export async function getPendingDocumentById(id) {
    const { data, error } = await supabase
        .from('pending_documents')
        .select(`
      id,
      text,
      status,
      submitted_at,
      reviewed_at,
      reviewer_comments,
      has_conflicts,
      conflicting_docs,
      metadata
    `)
        .eq('id', id)
        .single();
    if (error) {
        logError(`Error fetching pending document ${id}:`, error);
        return null;
    }
    return data;
}
/**
 * Add document to pending queue
 */
export async function addToPendingDocuments(text, metadata, embedding, contextualChunks) {
    try {
        // Check for conflicts
        const { hasConflicts, conflictingDocIds } = await checkForContentConflicts(metadata, text);
        // Create document in pending queue
        const { data, error } = await supabase
            .from('pending_documents')
            .insert({
            text,
            metadata,
            status: 'pending',
            has_conflicts: hasConflicts,
            conflicting_docs: conflictingDocIds.length > 0 ? conflictingDocIds : null,
            has_contextual_chunks: contextualChunks != null && contextualChunks.length > 0
        })
            .select('id')
            .single();
        if (error) {
            logError('Error adding to pending documents', error);
            throw error;
        }
        // If there are contextual chunks, store them
        if (contextualChunks && contextualChunks.length > 0) {
            const chunksToStore = contextualChunks.map(chunk => ({
                pending_document_id: data.id,
                text: chunk.text,
                metadata: chunk.metadata || {}
            }));
            const { error: chunksError } = await supabase
                .from('pending_document_chunks')
                .insert(chunksToStore);
            if (chunksError) {
                logError('Error storing contextual chunks', chunksError);
            }
        }
        logInfo(`Added document to pending queue with ID ${data.id}`);
        return data.id;
    }
    catch (error) {
        logError('Error in addToPendingDocuments', error);
        throw error;
    }
}
/**
 * Approve or reject a pending document
 */
export async function approveOrRejectDocument(id, decision) {
    try {
        // Get the pending document
        const pendingDoc = await getPendingDocumentById(id);
        if (!pendingDoc) {
            logError(`Cannot approve/reject: Pending document ${id} not found`);
            return false;
        }
        // Update the status
        const { error } = await supabase
            .from('pending_documents')
            .update({
            status: decision.approved ? 'approved' : 'rejected',
            reviewer_comments: decision.reviewerComments,
            reviewed_by: decision.reviewedBy,
            reviewed_at: new Date()
        })
            .eq('id', id);
        if (error) {
            logError(`Error updating pending document status: ${id}`, error);
            return false;
        }
        // If approved, add to vector store
        if (decision.approved) {
            await addApprovedDocumentToVectorStore(pendingDoc);
        }
        logInfo(`Document ${id} was ${decision.approved ? 'approved' : 'rejected'}`);
        return true;
    }
    catch (error) {
        logError(`Error in approveOrRejectDocument: ${id}`, error);
        return false;
    }
}
/**
 * Add an approved document to the vector store
 */
async function addApprovedDocumentToVectorStore(pendingDoc) {
    try {
        // Prepare document metadata (remove text, add approval status)
        const baseMetadata = {
            ...pendingDoc.metadata,
            approvedAt: new Date().toISOString(),
            approved: true,
            pendingDocId: pendingDoc.id // Keep track of original pending doc
        };
        // Get embeddings (assume they need to be generated here or were stored)
        // Placeholder: Embeddings should ideally be generated and stored earlier
        // or generated here based on document/chunk text.
        // For now, we'll use a dummy embedding for type compatibility.
        const dummyEmbedding = Array(768).fill(0); // Use correct dimension (768 for Gemini)
        // If there are chunks, get them
        let chunks = [];
        if (pendingDoc.has_contextual_chunks) {
            const { data, error } = await supabase
                .from('pending_document_chunks')
                .select('*')
                .eq('pending_document_id', pendingDoc.id);
            if (error) {
                logError(`Error fetching chunks for pending document ${pendingDoc.id}:`, error);
            }
            else {
                chunks = data || []; // Ensure chunks is an array
            }
        }
        // Add to vector store (either as full document or with chunks)
        if (chunks.length > 0) {
            // Create vector items for each chunk
            // Ensure the structure matches VectorStoreItem requirements
            const vectorItems = chunks.map((chunk, index) => ({
                document_id: pendingDoc.metadata?.documentId || pendingDoc.id, // Use a proper document ID if available
                chunk_index: index,
                text: chunk.text, // This might be contextualized text depending on earlier steps
                originalText: chunk.text, // Assuming original text is stored here
                metadata: {
                    ...baseMetadata,
                    ...(chunk.metadata || {}),
                    isChunk: true,
                    parentDocument: pendingDoc.id
                },
                embedding: dummyEmbedding // Replace with actual embedding
            }));
            // Add document metadata as a separate item IF needed (optional, depends on retrieval strategy)
            // const documentVectorItem: VectorStoreItem = {
            //   document_id: pendingDoc.id, 
            //   chunk_index: -1, // Indicate it's the main doc
            //   text: pendingDoc.text.substring(0, 200), // Store a preview or summary
            //   originalText: pendingDoc.text,
            //   metadata: baseMetadata,
            //   embedding: dummyEmbedding // Replace with actual embedding for the whole doc
            // };
            // vectorItems.unshift(documentVectorItem); 
            // Add chunk items to vector store
            await addToVectorStore(vectorItems);
        }
        else {
            // Add as a single document item
            // Ensure structure matches VectorStoreItem
            const documentVectorItem = {
                document_id: pendingDoc.metadata?.documentId || pendingDoc.id, // Use a proper document ID
                chunk_index: 0, // Only one chunk
                text: pendingDoc.text, // Maybe contextualized text?
                originalText: pendingDoc.text,
                metadata: baseMetadata,
                embedding: dummyEmbedding // Replace with actual embedding
            };
            await addToVectorStore(documentVectorItem);
        }
        logInfo(`Processed approved document ${pendingDoc.id} for vector store`);
    }
    catch (error) {
        logError(`Error adding approved document ${pendingDoc.id} to vector store:`, error);
        // Consider re-throwing or handling more gracefully (e.g., marking for retry)
        throw error;
    }
}
/**
 * Remove a pending document from the queue
 */
export async function removePendingDocument(id) {
    try {
        // First delete any associated chunks
        const { error: chunksError } = await supabase
            .from('pending_document_chunks')
            .delete()
            .eq('pending_document_id', id);
        if (chunksError) {
            logError(`Error deleting chunks for pending document ${id}:`, chunksError);
        }
        // Then delete the pending document
        const { error } = await supabase
            .from('pending_documents')
            .delete()
            .eq('id', id);
        if (error) {
            logError(`Error deleting pending document ${id}:`, error);
            return false;
        }
        logInfo(`Successfully removed pending document ${id}`);
        return true;
    }
    catch (error) {
        logError(`Error in removePendingDocument: ${id}`, error);
        return false;
    }
}
/**
 * Check for potential content conflicts before ingestion
 */
export async function checkForContentConflicts(metadata, // Use EnhancedMetadata type
text) {
    try {
        // Simplified conflict check based on source/title
        const sourceToCheck = metadata.source || metadata.title;
        if (!sourceToCheck) {
            return { hasConflicts: false, conflictingDocIds: [] };
        }
        const { data, error } = await supabase
            .from('documents') // Check against the final documents table
            .select('id')
            // Match based on source or title - adjust logic as needed
            .or(`source.eq.${sourceToCheck},title.eq.${sourceToCheck}`)
            // Optionally add a similarity check on text if needed
            // .similar('summary', text.substring(0, 100)) // Requires pg_trgm extension
            .limit(5);
        if (error) {
            logError('Error checking for content conflicts', error);
            return { hasConflicts: false, conflictingDocIds: [] };
        }
        const conflictingDocs = data || [];
        return {
            hasConflicts: conflictingDocs.length > 0,
            conflictingDocIds: conflictingDocs.map((doc) => doc.id)
        };
    }
    catch (error) {
        logError('Exception during conflict check', error);
        return { hasConflicts: false, conflictingDocIds: [] };
    }
}
/**
 * Get pending documents statistics
 */
export async function getPendingDocumentsStats() {
    try {
        // Get total count
        const { count: total, error: countError } = await supabase
            .from('pending_documents')
            .select('*', { count: 'exact', head: true });
        if (countError) {
            logError('Error getting pending documents count:', countError);
            return { total: 0, byCategory: {}, byStatus: {} };
        }
        // Get counts by status
        const { data: statusData, error: statusError } = await supabase
            .rpc('get_pending_doc_counts_by_status');
        if (statusError) {
            logError('Error getting status counts:', statusError);
            return { total: total || 0, byCategory: {}, byStatus: {} };
        }
        // Get counts by category
        const { data: categoryData, error: categoryError } = await supabase
            .rpc('get_pending_doc_counts_by_category');
        if (categoryError) {
            logError('Error getting category counts:', categoryError);
            return {
                total: total || 0,
                byCategory: {},
                byStatus: statusData || {}
            };
        }
        return {
            total: total || 0,
            byStatus: statusData || {},
            byCategory: categoryData || {}
        };
    }
    catch (error) {
        logError('Error in getPendingDocumentsStats:', error);
        return { total: 0, byCategory: {}, byStatus: {} };
    }
}
