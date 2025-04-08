import { NextApiRequest, NextApiResponse } from 'next';
/**
 * API endpoint for approving pending documents
 * This will move documents from the pending queue to the vector store
 */
export default function handler(req: NextApiRequest, res: NextApiResponse): Promise<void>;
