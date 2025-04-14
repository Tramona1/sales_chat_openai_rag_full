import { logInfo, logError } from '@/utils/logger';
import { getSupabaseAdmin } from '@/utils/supabaseClient';
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const { documentIds, reviewerComments } = req.body;
        if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
            return res.status(400).json({ error: 'Document IDs are required' });
        }
        if (!reviewerComments) {
            return res.status(400).json({ error: 'Reviewer comments are required for rejection' });
        }
        logInfo(`Rejecting documents`, { count: documentIds.length });
        const supabase = getSupabaseAdmin();
        const deletePromises = documentIds.map(docId => supabase
            .from('documents')
            .delete()
            .eq('id', docId));
        const results = await Promise.allSettled(deletePromises);
        const successes = [];
        const failures = [];
        results.forEach((result, index) => {
            const docId = documentIds[index];
            if (result.status === 'fulfilled') {
                if (result.value.error) {
                    logError(`Failed to delete rejected document ${docId} from Supabase`, result.value.error);
                    failures.push({ id: docId, error: result.value.error.message });
                }
                else {
                    successes.push(docId);
                }
            }
            else {
                logError(`Failed to execute delete for rejected document ${docId}`, result.reason);
                failures.push({ id: docId, error: result.reason?.message || 'Unknown execution error' });
            }
        });
        const allSucceeded = failures.length === 0;
        if (allSucceeded) {
            return res.status(200).json({
                success: true,
                message: `Successfully rejected and deleted ${successes.length} document(s)`
            });
        }
        else {
            const succeededCount = successes.length;
            const failedCount = failures.length;
            return res.status(207).json({
                partialSuccess: true,
                message: `Rejected ${succeededCount} document(s), failed to reject/delete ${failedCount} document(s)`,
                failures
            });
        }
    }
    catch (error) {
        logError('Error in document rejection endpoint', error);
        return res.status(500).json({
            error: 'Failed to process rejection request',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
