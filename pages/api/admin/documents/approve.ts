import { NextApiRequest, NextApiResponse } from 'next';
import { logInfo, logError } from '@/utils/logger';
import { getSupabaseAdmin } from '@/utils/supabaseClient';

/**
 * API endpoint for approving pending documents
 * This endpoint marks documents as approved in the Supabase 'documents' table.
 * Actual processing/embedding likely happened during upload or should be triggered here/elsewhere.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { documentIds, reviewerComments } = req.body;
    
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Document IDs are required' });
    }
    
    logInfo(`Approving documents`, { count: documentIds.length });
    
    const supabase = getSupabaseAdmin();
    const updatePromises = documentIds.map(docId =>
      supabase
        .from('documents')
        .update({ approved: true, updated_at: new Date().toISOString() })
        .eq('id', docId)
    );

    const results = await Promise.allSettled(updatePromises);

    // Process results
    const successes: string[] = [];
    const failures: { id: string; error: string }[] = [];

    results.forEach((result, index) => {
      const docId = documentIds[index];
      if (result.status === 'fulfilled') {
        if (result.value.error) {
          logError(`Failed to approve document ${docId} in Supabase`, result.value.error);
          failures.push({ id: docId, error: result.value.error.message });
        } else {
          successes.push(docId);
        }
      } else {
        logError(`Failed to execute approval update for document ${docId}`, result.reason);
        failures.push({ id: docId, error: result.reason?.message || 'Unknown execution error' });
      }
    });

    const allSucceeded = failures.length === 0;
    
    if (allSucceeded) {
      return res.status(200).json({ 
        success: true, 
        message: `Successfully approved ${successes.length} document(s)` 
      });
    } else {
      const succeededCount = successes.length;
      const failedCount = failures.length;
      
      return res.status(207).json({ 
        partialSuccess: true, 
        message: `Approved ${succeededCount} document(s), failed to approve ${failedCount} document(s)`,
        failures
      });
    }
  } catch (error) {
    logError('Error in document approval endpoint', error);
    return res.status(500).json({ 
      error: 'Failed to process approval request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 