import { detectDocumentConflicts } from '@/utils/conflictDetection';
import { logError, logInfo } from '@/utils/logger';
import { getSupabaseAdmin } from '@/utils/supabaseClient';
/**
 * API endpoint to get content conflicts in the knowledge base
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    try {
        // Get query parameters
        const useGemini = req.query.useGemini === 'true';
        const entityName = req.query.entity;
        // Fetch document chunks from Supabase
        logInfo('Fetching document chunks from Supabase for conflict detection');
        const supabase = getSupabaseAdmin();
        const { data: documentChunks, error } = await supabase
            .from('document_chunks')
            .select('id, document_id, content, metadata, embedding')
            .order('document_id', { ascending: true });
        if (error) {
            throw new Error(`Failed to fetch document chunks: ${error.message}`);
        }
        // Convert to VectorStoreItem format for the conflict detection
        const vectorStoreItems = documentChunks.map(chunk => ({
            id: chunk.id,
            document_id: chunk.document_id,
            text: chunk.content,
            embedding: chunk.embedding,
            metadata: chunk.metadata || {}
        }));
        logInfo(`Retrieved ${vectorStoreItems.length} document chunks for conflict detection`);
        // Detect conflicts in documents with Gemini enhancement
        const conflictsResult = detectDocumentConflicts(vectorStoreItems, entityName, useGemini);
        // Await if the result is a promise (Gemini case)
        const resolvedConflicts = Array.isArray(conflictsResult)
            ? conflictsResult
            : await conflictsResult;
        // Return conflicts
        return res.status(200).json({
            conflicts: resolvedConflicts,
            totalConflicts: resolvedConflicts.length,
            highPriorityConflicts: resolvedConflicts.filter(c => c.isHighPriority).length,
            usedGemini: useGemini
        });
    }
    catch (error) {
        logError('Error retrieving conflicts:', error);
        return res.status(500).json({
            message: 'Failed to retrieve conflicts',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
