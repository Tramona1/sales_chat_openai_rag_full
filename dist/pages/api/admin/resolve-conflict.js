import { logError, logInfo, logWarning } from '../../../utils/logger';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';
import { getSupabaseAdmin } from '../../../utils/supabaseClient';
/**
 * API endpoint to resolve content conflicts by updating metadata
 * in the document_chunks table using the Supabase JS client.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    try {
        const { conflictTopic, entityName, preferredDocId, deprecatedDocIds } = req.body;
        // --- Input Validation --- 
        if (!preferredDocId) {
            return res.status(400).json({ message: 'Missing required field: preferredDocId' });
        }
        if (!Array.isArray(deprecatedDocIds)) {
            return res.status(400).json({ message: 'deprecatedDocIds must be an array' });
        }
        // Ensure deprecated IDs don't include the preferred ID
        const finalDeprecatedIds = deprecatedDocIds.filter(id => id !== preferredDocId);
        logInfo('Resolving content conflict using JS client', { preferredDocId, deprecatedDocIds: finalDeprecatedIds, conflictTopic, entityName });
        const supabase = getSupabaseAdmin();
        const now = new Date().toISOString();
        const results = {
            preferred: { status: 'pending', error: null, updatedChunkCount: 0 },
            deprecated: { status: 'pending', error: null, updatedChunkCount: 0, ids: finalDeprecatedIds }
        };
        // --- 1. Update Preferred Document Chunks --- 
        try {
            logInfo(`Fetching chunks for preferred document: ${preferredDocId}`);
            const { data: preferredChunks, error: fetchPreferredError } = await supabase
                .from('document_chunks')
                .select('id, metadata') // Select ID and existing metadata
                .eq('document_id', preferredDocId);
            if (fetchPreferredError)
                throw fetchPreferredError;
            if (!preferredChunks || preferredChunks.length === 0) {
                results.preferred.status = 'not_found';
                logWarning('Preferred document chunks not found', { preferredDocId });
            }
            else {
                const updates = preferredChunks.map(chunk => {
                    const currentMeta = chunk.metadata || {};
                    const updatedMeta = {
                        ...currentMeta,
                        isAuthoritative: true,
                        isDeprecated: false, // Explicitly ensure not deprecated
                        lastUpdated: now,
                        // Remove deprecated fields if they exist
                        deprecatedBy: undefined,
                        deprecatedAt: undefined
                    };
                    // Filter out undefined values before update
                    Object.keys(updatedMeta).forEach(key => updatedMeta[key] === undefined && delete updatedMeta[key]);
                    return supabase
                        .from('document_chunks')
                        .update({ metadata: updatedMeta })
                        .eq('id', chunk.id);
                });
                logInfo(`Attempting to update ${updates.length} chunks for preferred doc: ${preferredDocId}`);
                const updateResponses = await Promise.allSettled(updates);
                let successfulUpdates = 0;
                updateResponses.forEach((response, index) => {
                    if (response.status === 'rejected') {
                        logError('Failed to update preferred chunk', { chunkId: preferredChunks[index].id, error: response.reason });
                        // Capture the first error message
                        if (!results.preferred.error) {
                            results.preferred.error = response.reason?.message || 'Unknown update error';
                        }
                    }
                    else if (response.value.error) {
                        logError('Failed to update preferred chunk (Supabase error)', { chunkId: preferredChunks[index].id, error: response.value.error });
                        if (!results.preferred.error) {
                            results.preferred.error = response.value.error.message || 'Supabase update error';
                        }
                    }
                    else {
                        successfulUpdates++;
                    }
                });
                results.preferred.updatedChunkCount = successfulUpdates;
                if (results.preferred.error) {
                    results.preferred.status = 'failed';
                }
                else {
                    results.preferred.status = 'updated';
                    logInfo(`Successfully updated ${successfulUpdates} chunks for preferred doc: ${preferredDocId}`);
                }
            }
        }
        catch (error) {
            logError('Error processing preferred document update', { preferredDocId, error });
            results.preferred.status = 'failed';
            results.preferred.error = error.message || 'Failed to fetch or update preferred chunks';
        }
        // --- 2. Update Deprecated Document Chunks --- 
        if (finalDeprecatedIds.length > 0) {
            try {
                logInfo(`Fetching chunks for ${finalDeprecatedIds.length} deprecated documents`);
                const { data: deprecatedChunks, error: fetchDeprecatedError } = await supabase
                    .from('document_chunks')
                    .select('id, metadata') // Select ID and existing metadata
                    .in('document_id', finalDeprecatedIds);
                if (fetchDeprecatedError)
                    throw fetchDeprecatedError;
                if (!deprecatedChunks || deprecatedChunks.length === 0) {
                    results.deprecated.status = 'not_found';
                    logWarning('Deprecated document chunks not found', { deprecatedDocIds: finalDeprecatedIds });
                }
                else {
                    const updates = deprecatedChunks.map(chunk => {
                        const currentMeta = chunk.metadata || {};
                        const updatedMeta = {
                            ...currentMeta,
                            isDeprecated: true,
                            isAuthoritative: false, // Explicitly ensure not authoritative
                            deprecatedBy: preferredDocId,
                            deprecatedAt: now,
                            lastUpdated: now
                        };
                        return supabase
                            .from('document_chunks')
                            .update({ metadata: updatedMeta })
                            .eq('id', chunk.id);
                    });
                    logInfo(`Attempting to update ${updates.length} chunks for ${finalDeprecatedIds.length} deprecated docs`);
                    const updateResponses = await Promise.allSettled(updates);
                    let successfulUpdates = 0;
                    updateResponses.forEach((response, index) => {
                        if (response.status === 'rejected') {
                            logError('Failed to update deprecated chunk', { chunkId: deprecatedChunks[index].id, error: response.reason });
                            if (!results.deprecated.error) {
                                results.deprecated.error = response.reason?.message || 'Unknown update error';
                            }
                        }
                        else if (response.value.error) {
                            logError('Failed to update deprecated chunk (Supabase error)', { chunkId: deprecatedChunks[index].id, error: response.value.error });
                            if (!results.deprecated.error) {
                                results.deprecated.error = response.value.error.message || 'Supabase update error';
                            }
                        }
                        else {
                            successfulUpdates++;
                        }
                    });
                    results.deprecated.updatedChunkCount = successfulUpdates;
                    if (results.deprecated.error) {
                        results.deprecated.status = 'failed';
                    }
                    else {
                        results.deprecated.status = 'updated';
                        logInfo(`Successfully updated ${successfulUpdates} chunks for deprecated docs`);
                    }
                }
            }
            catch (error) {
                logError('Error processing deprecated documents update', { deprecatedDocIds: finalDeprecatedIds, error });
                results.deprecated.status = 'failed';
                results.deprecated.error = error.message || 'Failed to fetch or update deprecated chunks';
            }
        }
        else {
            // No deprecated IDs specified
            results.deprecated.status = 'skipped';
            logInfo('No deprecated documents specified, skipping update.');
        }
        // --- 3. Determine Final Status & Respond --- 
        const overallSuccess = results.preferred.status !== 'failed' && results.deprecated.status !== 'failed';
        logInfo('Conflict resolution processing finished.', { overallSuccess, preferredStatus: results.preferred.status, deprecatedStatus: results.deprecated.status });
        // Return detailed results
        return res.status(200).json({
            success: overallSuccess,
            message: `Conflict resolution processed. Preferred: ${results.preferred.status}. Deprecated: ${results.deprecated.status} (${results.deprecated.updatedChunkCount} chunks updated for ${finalDeprecatedIds.length} IDs).`,
            topic: conflictTopic,
            entityName,
            preferredDocument: {
                id: preferredDocId,
                status: results.preferred.status,
                updatedChunkCount: results.preferred.updatedChunkCount,
                error: results.preferred.error
            },
            deprecatedDocuments: {
                ids: finalDeprecatedIds,
                status: results.deprecated.status,
                updatedChunkCount: results.deprecated.updatedChunkCount,
                error: results.deprecated.error
            }
        });
    }
    catch (error) {
        logError('Critical error resolving conflict:', error);
        const errorResponse = standardizeApiErrorResponse(error);
        return res.status(500).json({
            ...errorResponse,
            success: false,
            message: error instanceof Error ? error.message : 'An unexpected error occurred during conflict resolution.',
            code: 'conflict_resolution_failed'
        });
    }
}
// Remove obsolete helper function
// function saveVectorStore() { ... } 
