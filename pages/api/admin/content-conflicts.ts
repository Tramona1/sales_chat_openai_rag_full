import { NextApiRequest, NextApiResponse } from 'next';
import { getAllVectorStoreItems } from '@/utils/vectorStore';
import { detectDocumentConflicts } from '@/utils/conflictDetection';
import { logError } from '@/utils/errorHandling';

/**
 * API endpoint to get content conflicts in the knowledge base
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get query parameters
    const useGemini = req.query.useGemini !== 'false'; // Default to true unless explicitly set to false
    const entityName = req.query.entity as string | undefined;
    
    // Get vector store items
    const vectorStoreItems = getAllVectorStoreItems();
    
    // Detect conflicts in documents with Gemini enhancement
    const conflicts = await detectDocumentConflicts(vectorStoreItems, entityName, useGemini);
    
    // Return conflicts
    return res.status(200).json({
      conflicts,
      totalConflicts: conflicts.length,
      highPriorityConflicts: conflicts.filter(c => c.isHighPriority).length,
      usedGemini: useGemini
    });
  } catch (error) {
    logError('Error retrieving conflicts:', error);
    return res.status(500).json({ 
      message: 'Failed to retrieve conflicts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 