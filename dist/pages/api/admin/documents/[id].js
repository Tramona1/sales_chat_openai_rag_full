import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { logInfo, logError } from '@/utils/logger';
export default async function handler(req, res) {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Document ID is required' });
    }
    const supabase = getSupabaseAdmin();
    // Handle different HTTP methods
    switch (req.method) {
        case 'GET':
            await getDocumentById(id, supabase, res);
            break;
        case 'PUT':
            await updateDocument(id, req.body, supabase, res);
            break;
        case 'DELETE':
            await deleteDocument(id, supabase, res);
            break;
        default:
            res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
            res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}
/**
 * Get a document by ID, including its chunks
 */
async function getDocumentById(id, supabase, res) {
    try {
        logInfo(`Fetching document with ID: ${id}`);
        // Get the document
        const { data: document, error } = await supabase
            .from('documents')
            .select(`
        id,
        title,
        source,
        created_at,
        updated_at,
        approved,
        metadata
      `)
            .eq('id', id)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Document not found' });
            }
            throw error;
        }
        // Get the document chunks
        const { data: chunks, error: chunksError } = await supabase
            .from('document_chunks')
            .select('id, chunk_index, text, metadata')
            .eq('document_id', id)
            .order('chunk_index', { ascending: true });
        if (chunksError) {
            throw chunksError;
        }
        // Return document with chunks
        return res.status(200).json({
            ...document,
            chunks: chunks || [],
            chunkCount: chunks?.length || 0
        });
    }
    catch (error) {
        logError(`Error fetching document with ID ${id}:`, error);
        return res.status(500).json({
            error: 'Failed to fetch document',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
/**
 * Update a document by ID
 */
async function updateDocument(id, updateData, supabase, res) {
    try {
        logInfo(`Updating document with ID: ${id}`);
        if (!updateData) {
            return res.status(400).json({ error: 'Update data is required' });
        }
        // Prepare update payload, ensuring timestamp is updated
        const payload = {
            updated_at: new Date().toISOString()
        };
        // Add any provided fields to payload
        if (updateData.title !== undefined)
            payload.title = updateData.title;
        if (updateData.source !== undefined)
            payload.source = updateData.source;
        if (updateData.approved !== undefined)
            payload.approved = updateData.approved;
        // Handle metadata as a special case - if provided, merge with existing metadata
        if (updateData.metadata) {
            // First get current document to get existing metadata
            const { data: existingDoc, error: fetchError } = await supabase
                .from('documents')
                .select('metadata')
                .eq('id', id)
                .single();
            if (fetchError) {
                if (fetchError.code === 'PGRST116') {
                    return res.status(404).json({ error: 'Document not found' });
                }
                throw fetchError;
            }
            // Merge existing metadata with new metadata
            payload.metadata = {
                ...(existingDoc?.metadata || {}),
                ...updateData.metadata
            };
        }
        // Update the document
        const { data, error } = await supabase
            .from('documents')
            .update(payload)
            .eq('id', id)
            .select();
        if (error) {
            throw error;
        }
        return res.status(200).json({
            success: true,
            message: 'Document updated successfully',
            document: data?.[0] || null
        });
    }
    catch (error) {
        logError(`Error updating document with ID ${id}:`, error);
        return res.status(500).json({
            error: 'Failed to update document',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
/**
 * Delete a document by ID and its chunks
 */
async function deleteDocument(id, supabase, res) {
    try {
        logInfo(`Deleting document with ID: ${id}`);
        // Delete document chunks first (this should cascade, but we're being explicit)
        const { error: chunksError } = await supabase
            .from('document_chunks')
            .delete()
            .eq('document_id', id);
        if (chunksError) {
            throw chunksError;
        }
        // Delete the document
        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', id);
        if (error) {
            throw error;
        }
        return res.status(200).json({
            success: true,
            message: 'Document and associated chunks deleted successfully'
        });
    }
    catch (error) {
        logError(`Error deleting document with ID ${id}:`, error);
        return res.status(500).json({
            error: 'Failed to delete document',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
