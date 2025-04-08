import { NextApiRequest, NextApiResponse } from 'next';
/**
 * API endpoint for approving pending documents
 * This endpoint moves documents from pending to the vector store with all AI-generated metadata
 */
export default function handler(req: NextApiRequest, res: NextApiResponse): Promise<void>;
