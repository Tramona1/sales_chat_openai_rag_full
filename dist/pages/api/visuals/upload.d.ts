import type { NextApiRequest, NextApiResponse } from 'next';
export declare const config: {
    api: {
        bodyParser: boolean;
    };
};
/**
 * API endpoint for uploading visual content
 * Supports batch uploads and automatic analysis
 */
export default function handler(req: NextApiRequest, res: NextApiResponse): Promise<void>;
