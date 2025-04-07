import { NextApiRequest, NextApiResponse } from 'next';
export declare const config: {
    api: {
        bodyParser: boolean;
    };
};
export default function handler(req: NextApiRequest, res: NextApiResponse): Promise<void>;
