import { NextApiRequest, NextApiResponse } from 'next';
/**
 * Handle user query and generate response
 */
export declare function handleQuery(query: string): Promise<{
    answer: string;
    sources: string[];
    statusCode: number;
    error?: string;
}>;
/**
 * API handler for chat answers
 */
export default function handler(req: NextApiRequest, res: NextApiResponse): Promise<void>;
