import { NextApiRequest, NextApiResponse } from 'next';
/**
 * API endpoint for rejecting pending documents
 * This will remove documents from the pending queue without adding them to the vector store
 */
export default function handler(req: NextApiRequest, res: NextApiResponse): Promise<void>;
