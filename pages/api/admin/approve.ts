import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';
import { 
  approveOrRejectDocument, 
  checkForContentConflicts,
  getPendingDocumentById
} from '../../../utils/adminWorkflow';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: { 
        message: 'Method Not Allowed',
        code: 'method_not_allowed'
      } 
    });
  }

  try {
    const { docId, decision, reason } = req.body;
    
    // Validate required fields
    if (!docId) {
      return res.status(400).json({
        error: {
          message: 'Document ID is required',
          code: 'missing_document_id'
        }
      });
    }
    
    if (!decision || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        error: {
          message: 'Valid decision (approve/reject) is required',
          code: 'invalid_decision'
        }
      });
    }
    
    // If rejecting, require a reason
    if (decision === 'reject' && !reason) {
      return res.status(400).json({
        error: {
          message: 'Reason is required when rejecting a document',
          code: 'missing_rejection_reason'
        }
      });
    }
    
    // First get the document to check for conflicts
    const pendingDoc = await getPendingDocumentById(docId);
    if (!pendingDoc && decision === 'approve') {
      return res.status(404).json({
        error: {
          message: 'Document not found',
          code: 'document_not_found'
        }
      });
    }

    // Then check for conflicts with the document's metadata and text
    if (decision === 'approve' && pendingDoc) {
      const conflicts = await checkForContentConflicts(
        pendingDoc.metadata,
        pendingDoc.text
      );
      
      if (conflicts.hasConflicts && conflicts.conflictingDocIds.length > 0) {
        return res.status(409).json({
          error: {
            message: 'Content conflicts detected',
            code: 'content_conflicts',
            conflicts
          }
        });
      }
    }
    
    // Process the approval or rejection with correct interface structure
    const result = await approveOrRejectDocument(docId, {
      approved: decision === 'approve',
      reviewerComments: reason || '',
      reviewedBy: req.body.reviewerId || 'system'
    });
    
    return res.status(200).json({
      success: true,
      message: `Document ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
      documentId: docId,
      result
    });
    
  } catch (error) {
    console.error('Error processing document approval/rejection:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
}