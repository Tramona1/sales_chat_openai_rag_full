import { NextApiRequest, NextApiResponse } from 'next';

/**
 * This is a debugging API endpoint that reports environment variables
 * It will help diagnose issues with Vercel environment configuration
 * IMPORTANT: This should be DELETED or properly secured before production use
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development or for admin users in other environments
  if (process.env.NODE_ENV !== 'development') {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.DEBUG_SECRET}`) {
      return res.status(403).json({ error: 'Not authorized to access this endpoint' });
    }
  }

  try {
    // Collect diagnostic information
    const diagnostics = {
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
        serviceKey: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET',
        altUrl: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
        altAnonKey: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
      },
      google: {
        apiKey: process.env.GOOGLE_AI_API_KEY ? 'SET' : 'NOT SET',
      },
      embedding: {
        model: process.env.EMBEDDING_MODEL || 'NOT SET',
      },
      // Add first few chars of each key for verification
      keyPrefixes: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) || '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) || '',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY?.substring(0, 10) || '',
      }
    };

    // Return diagnostic information
    return res.status(200).json(diagnostics);
  } catch (error) {
    console.error('Error in debug-env API:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 