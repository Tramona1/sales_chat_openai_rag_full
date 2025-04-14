import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { logError } from '@/utils/logger';
import { withAdminAuth } from '@/utils/auth';
import { embed } from '@/utils/embeddings';
/**
 * API handler for document chunk operations
 * GET: Retrieve a single chunk by ID
 * PUT: Update a chunk's content and optionally regenerate its embedding
 * DELETE: Remove a chunk
 */
async function handler(req, res) {
    // Extract the chunk ID from the URL
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid chunk ID' });
    }
    try {
        // Handle different HTTP methods
        switch (req.method) {
            case 'GET':
                return getChunkById(id, req, res);
            case 'PUT':
                return updateChunk(id, req, res);
            case 'DELETE':
                return deleteChunk(id, req, res);
            default:
                res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
                return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        }
    }
    catch (error) {
        logError('Error in chunks/[id] API:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * GET /api/admin/chunks/[id]
 * Retrieve a single chunk by ID
 */
async function getChunkById(id, req, res) {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('document_chunks')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            logError('Error fetching chunk:', error);
            return res.status(500).json({ error: 'Failed to fetch chunk' });
        }
        if (!data) {
            return res.status(404).json({ error: 'Chunk not found' });
        }
        return res.status(200).json(data);
    }
    catch (error) {
        logError('Error in getChunkById:', error);
        return res.status(500).json({ error: 'Server error while fetching chunk' });
    }
}
/**
 * PUT /api/admin/chunks/[id]
 * Update a chunk's content and optionally regenerate its embedding
 */
async function updateChunk(id, req, res) {
    try {
        const { text, regenerateEmbedding = false } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text is required and must be a string' });
        }
        const supabase = getSupabaseAdmin();
        // First, fetch the current chunk
        const { data: existingChunk, error: fetchError } = await supabase
            .from('document_chunks')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError) {
            logError('Error fetching chunk for update:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch chunk for update' });
        }
        if (!existingChunk) {
            return res.status(404).json({ error: 'Chunk not found' });
        }
        // Prepare update data
        const updateData = { text };
        // Regenerate embedding if requested
        if (regenerateEmbedding) {
            try {
                const embedding = await embed(text);
                updateData.embedding = embedding;
            }
            catch (embeddingError) {
                logError('Error generating embedding:', embeddingError);
                return res.status(500).json({ error: 'Failed to generate embedding' });
            }
        }
        // Update the chunk
        const { data: updatedChunk, error: updateError } = await supabase
            .from('document_chunks')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (updateError) {
            logError('Error updating chunk:', updateError);
            return res.status(500).json({ error: 'Failed to update chunk' });
        }
        return res.status(200).json({
            message: 'Chunk updated successfully',
            regeneratedEmbedding: regenerateEmbedding,
            chunk: updatedChunk
        });
    }
    catch (error) {
        logError('Error in updateChunk:', error);
        return res.status(500).json({ error: 'Server error while updating chunk' });
    }
}
/**
 * DELETE /api/admin/chunks/[id]
 * Delete a chunk by ID
 */
async function deleteChunk(id, req, res) {
    try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('document_chunks')
            .delete()
            .eq('id', id);
        if (error) {
            logError('Error deleting chunk:', error);
            return res.status(500).json({ error: 'Failed to delete chunk' });
        }
        return res.status(200).json({ message: 'Chunk deleted successfully' });
    }
    catch (error) {
        logError('Error in deleteChunk:', error);
        return res.status(500).json({ error: 'Server error while deleting chunk' });
    }
}
export default withAdminAuth(handler);
