import { NextApiRequest, NextApiResponse } from 'next';
/**
 * API endpoint for ingesting documents with Gemini processing
 * This endpoint processes documents, analyzes them with Gemini, and adds them to the pending queue
 */
export default function handler(req: NextApiRequest, res: NextApiResponse): Promise<void>;
