import { approveOrRejectDocument } from '@/utils/adminWorkflow';
import { logError, logInfo } from '@/utils/logger';
/**
 * API endpoint for approving pending documents
 * This will move documents from the pending queue to the vector store
 */
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    try {
        // Extract document IDs from request
        const { documentIds, reviewerComments, reviewedBy } = req.body;
        if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing or invalid documentIds. Expected an array of document IDs.'
            });
        }
        // Track successful and failed operations
        const results = {
            successful: [],
            failed: []
        };
        // Process each document
        for (const documentId of documentIds) {
            try {
                // Approve the document
                const success = await approveOrRejectDocument(documentId, {
                    approved: true,
                    reviewerComments: reviewerComments || '',
                    reviewedBy: reviewedBy || 'admin'
                });
                if (success) {
                    results.successful.push(documentId);
                    logInfo(`Document ${documentId} approved successfully`);
                }
                else {
                    results.failed.push(documentId);
                    logInfo(`Failed to approve document ${documentId}`);
                }
            }
            catch (error) {
                results.failed.push(documentId);
                logError(`Error approving document ${documentId}`, error);
            }
        }
        // Return results
        return res.status(200).json({
            success: true,
            message: `Approved ${results.successful.length} documents, failed to approve ${results.failed.length} documents`,
            results
        });
    }
    catch (error) {
        // Log and return error
        logError('Error approving documents', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to approve documents',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
