import { NextApiRequest, NextApiResponse } from 'next';
import { standardizeApiErrorResponse } from '../../../utils/errorHandling';
import { 
  getPendingDocuments, 
  getPendingDocumentsStats 
} from '../../../utils/adminWorkflow';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: { 
        message: 'Method Not Allowed',
        code: 'method_not_allowed'
      } 
    });
  }

  try {
    // Handle different request types
    const { type } = req.query;
    
    if (type === 'stats') {
      // Return stats about pending documents
      const stats = await getPendingDocumentsStats();
      return res.status(200).json(stats);
    } else {
      // Return all pending documents
      const pendingDocs = await getPendingDocuments();
      
      // Basic filtering options
      const { status, category } = req.query;
      
      let filteredDocs = pendingDocs;
      
      // Filter by status if specified
      if (status) {
        filteredDocs = filteredDocs.filter(doc => 
          doc.metadata.reviewStatus === status
        );
      }
      
      // Filter by category if specified
      if (category) {
        filteredDocs = filteredDocs.filter(doc => 
          doc.metadata.primaryCategory === category
        );
      }
      
      // Get limit and pagination
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      
      // Calculate pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      
      // Return paginated results
      const paginatedDocs = filteredDocs.slice(startIndex, endIndex);
      
      return res.status(200).json({
        documents: paginatedDocs,
        total: filteredDocs.length,
        page,
        limit,
        totalPages: Math.ceil(filteredDocs.length / limit)
      });
    }
  } catch (error) {
    console.error('Error handling pending documents request:', error);
    const errorResponse = standardizeApiErrorResponse(error);
    return res.status(500).json(errorResponse);
  }
} 