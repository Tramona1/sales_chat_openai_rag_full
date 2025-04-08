import { NextApiRequest, NextApiResponse } from 'next';
import { approveOrRejectDocument, getPendingDocumentById } from '@/utils/adminWorkflow';
import { logError, logInfo } from '@/utils/errorHandling';

/**
 * API endpoint for approving pending documents
 * This endpoint moves documents from pending to the vector store with all AI-generated metadata
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get document IDs from request
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ message: 'Invalid or missing document IDs' });
    }

    logInfo('Approving documents', { count: documentIds.length });

    // Track results
    const results = {
      success: true,
      documentsProcessed: 0,
      failures: 0,
      message: ''
    };

    // Process each document
    const approvalPromises = documentIds.map(async (id) => {
      try {
        // Get the document first to confirm it exists
        const pendingDoc = await getPendingDocumentById(id);
        if (!pendingDoc) {
          logError(`Document ${id} not found in pending queue`, null);
          results.failures++;
          return false;
        }

        // Log the metadata that will be preserved
        logInfo(`Approving document ${id} with AI-generated metadata`, { 
          metadataFields: Object.keys(pendingDoc.metadata)
        });
        
        // Approve document - this preserves all AI-generated metadata
        const success = await approveOrRejectDocument(id, {
          approved: true,
          reviewerComments: 'Approved with all AI-generated tags preserved',
          reviewedBy: req.headers['x-user-email'] as string || 'admin'
        });

        if (success) {
          results.documentsProcessed++;
          return true;
        } else {
          results.failures++;
          return false;
        }
      } catch (error) {
        logError(`Failed to approve document ${id}`, error);
        results.failures++;
        return false;
      }
    });

    // Wait for all approvals to complete
    await Promise.all(approvalPromises);

    // Set result message
    if (results.failures === 0) {
      results.message = `Successfully approved ${results.documentsProcessed} document(s) with all AI-generated metadata preserved`;
    } else if (results.documentsProcessed > 0) {
      results.message = `Partially successful: Approved ${results.documentsProcessed} document(s), but failed to approve ${results.failures} document(s)`;
      results.success = false;
    } else {
      results.message = `Failed to approve any documents (${results.failures} failures)`;
      results.success = false;
    }

    // Return results
    return res.status(results.success ? 200 : 500).json({
      ...results,
      preservedAIMetadata: true
    });
  } catch (error) {
    logError('Error approving documents', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 