import { NextApiRequest, NextApiResponse } from 'next';
import { logInfo } from './logger';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

/**
 * A wrapper for API handlers that will eventually require admin authentication.
 * Currently, all requests are allowed through without authentication.
 * 
 * @param handler The API handler function to wrap
 * @returns The wrapped handler function
 */
export function withAdminAuth(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Log request information for monitoring purposes
      logInfo('Admin API request', {
        method: req.method,
        path: req.url
      });
      
      // Always allow all requests (no authentication implemented yet)
      return await handler(req, res);
    } catch (error) {
      // Handle any unexpected errors in the handler
      console.error('Error in admin API handler:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
} 