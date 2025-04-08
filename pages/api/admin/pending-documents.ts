import { NextApiRequest, NextApiResponse } from 'next';
import { getPendingDocuments } from '@/utils/adminWorkflow';
import { logError } from '@/utils/errorHandling';

/**
 * API endpoint for retrieving pending documents that require admin approval
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get pending documents
    const pendingDocs = await getPendingDocuments();
    
    // Transform the stored pending documents into the format expected by the UI
    const documents = pendingDocs.map(doc => ({
      id: doc.id,
      source: doc.metadata.source || doc.id,
      contentPreview: doc.text.substring(0, 200) + (doc.text.length > 200 ? '...' : ''),
      content: doc.text,
      status: doc.metadata.reviewStatus || 'pending',
      createdAt: doc.metadata.submittedAt || doc.submittedAt,
      metadata: {
        primaryCategory: doc.metadata.primaryCategory,
        technicalLevel: doc.metadata.technicalLevel,
        categories: Array.isArray(doc.metadata.secondaryCategories) 
          ? doc.metadata.secondaryCategories 
          : [],
        keywords: Array.isArray(doc.metadata.keywords) 
          ? doc.metadata.keywords 
          : [],
        summary: doc.metadata.summary || ''
      }
    }));
    
    // Return the documents
    return res.status(200).json({
      documents,
      total: documents.length
    });
  } catch (error) {
    // Log and return error
    logError('Error retrieving pending documents', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 