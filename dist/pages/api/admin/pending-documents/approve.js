"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const adminWorkflow_1 = require("@/utils/adminWorkflow");
const errorHandling_1 = require("@/utils/errorHandling");
/**
 * API endpoint for approving pending documents
 * This will move documents from the pending queue to the vector store
 */
async function handler(req, res) {
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
                const success = await (0, adminWorkflow_1.approveOrRejectDocument)(documentId, {
                    approved: true,
                    reviewerComments: reviewerComments || '',
                    reviewedBy: reviewedBy || 'admin'
                });
                if (success) {
                    results.successful.push(documentId);
                    (0, errorHandling_1.logInfo)(`Document ${documentId} approved successfully`);
                }
                else {
                    results.failed.push(documentId);
                    (0, errorHandling_1.logInfo)(`Failed to approve document ${documentId}`);
                }
            }
            catch (error) {
                results.failed.push(documentId);
                (0, errorHandling_1.logError)(`Error approving document ${documentId}`, error);
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
        (0, errorHandling_1.logError)('Error approving documents', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to approve documents',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
