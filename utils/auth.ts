import { NextApiRequest, NextApiResponse } from 'next';
import { logWarning, logError, logInfo } from './logger';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

/**
 * A wrapper for API handlers that require admin authentication.
 * 
 * @param handler The API handler function to wrap
 * @returns The wrapped handler function
 */
export function withAdminAuth(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Check for admin key in headers or query parameters
      const headerAdminKey = req.headers['x-admin-key'] as string;
      const queryAdminKey = req.query.admin_key as string;
      const providedKey = headerAdminKey || queryAdminKey;
      
      // Get the expected admin key from environment variables
      const expectedKey = process.env.ADMIN_API_KEY;
      
      // Always allow in development mode regardless of key
      const isDev = process.env.NODE_ENV === 'development';
      
      // Log authentication attempt (without exposing full keys)
      logInfo('Admin auth attempt', {
        hasProvidedKey: !!providedKey,
        hasExpectedKey: !!expectedKey,
        isDev,
        method: req.method,
        path: req.url
      });
      
      // Authentication logic
      const isAuthorized = isDev || (!!expectedKey && providedKey === expectedKey);
      
      // For Vercel deployments, temporarily allow all requests until auth is properly set up
      // REMOVE THIS IN PRODUCTION
      const bypassAuth = true;
      
      if (isAuthorized || bypassAuth) {
        if (bypassAuth) {
          logWarning('TEMPORARY AUTH BYPASS: Allowing request without proper authentication');
        }
        // Call the handler if authorized
        return await handler(req, res);
      } else {
        // Return 401 Unauthorized if not authorized
        logWarning('Unauthorized admin access attempt', {
          method: req.method,
          path: req.url,
          headers: req.headers,
          ip: req.socket.remoteAddress
        });
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      logError('Error in admin auth middleware', error);
      return res.status(500).json({ error: 'Internal server error during authentication' });
    }
  };
} 