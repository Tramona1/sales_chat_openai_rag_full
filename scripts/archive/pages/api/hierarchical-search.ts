import { NextApiRequest, NextApiResponse } from 'next';

/**
 * API endpoint for hierarchical search with categories and facets
 * This endpoint has been deprecated and now redirects to the main search API.
 * The hierarchical search capabilities have been integrated into the main hybrid search system.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add deprecation notice header
  res.setHeader('X-Deprecated-API', 'This API endpoint is deprecated. Please use the main search API.');
  
  // Redirect to main search API
  res.redirect(307, `/api/chat/search?${new URLSearchParams(req.query as Record<string, string>).toString()}`);
} 