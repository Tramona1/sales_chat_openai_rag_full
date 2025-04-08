"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const adminWorkflow_1 = require("@/utils/adminWorkflow");
const errorHandling_1 = require("@/utils/errorHandling");
/**
 * API endpoint for rejecting pending documents
 * This will remove documents from the pending queue without adding them to the vector store
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
                // Reject the document
                const success = await (0, adminWorkflow_1.approveOrRejectDocument)(documentId, {
                    approved: false,
                    reviewerComments: reviewerComments || 'Rejected by admin',
                    reviewedBy: reviewedBy || 'admin'
                });
                if (success) {
                    results.successful.push(documentId);
                    (0, errorHandling_1.logInfo)(`Document ${documentId} rejected successfully`);
                }
                else {
                    results.failed.push(documentId);
                    (0, errorHandling_1.logInfo)(`Failed to reject document ${documentId}`);
                }
            }
            catch (error) {
                results.failed.push(documentId);
                (0, errorHandling_1.logError)(`Error rejecting document ${documentId}`, error);
            }
        }
        // Return results
        return res.status(200).json({
            success: true,
            message: `Rejected ${results.successful.length} documents, failed to reject ${results.failed.length} documents`,
            results
        });
    }
    catch (error) {
        // Log and return error
        (0, errorHandling_1.logError)('Error rejecting documents', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reject documents',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
