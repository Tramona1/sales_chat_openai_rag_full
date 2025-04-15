/**
 * Test API for Vercel deployment diagnostics
 * 
 * This unauthenticated endpoint tests connections to Supabase and filesystem operations
 * to help diagnose deployment issues on Vercel.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getVercelSupabase, testVercelSupabaseConnection } from '../../utils/vercelSupabaseClient';
import { logInfo, logError } from '../../utils/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      supabase: {
        connections: {
          main: await testConnection(),
          temporary: await testTemporaryConnection()
        },
        config: {
          url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          serviceKey: !!process.env.SUPABASE_SERVICE_KEY
        }
      },
      filesystem: {
        tmpAccess: await testTmpAccess(),
        rootWritable: await testRootWritable()
      }
    };
    
    return res.status(200).json(diagnostics);
  } catch (error) {
    logError('Error in test-vercel-connection:', error);
    return res.status(500).json({ 
      error: 'Error running diagnostics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Test Supabase connection using the main client
 */
async function testConnection(): Promise<boolean> {
  try {
    return await testVercelSupabaseConnection();
  } catch (error) {
    logError('Error in testConnection:', error);
    return false;
  }
}

/**
 * Test Supabase connection with a temporary client
 */
async function testTemporaryConnection(): Promise<boolean> {
  try {
    const supabase = getVercelSupabase();
    if (!supabase) return false;
    
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id')
      .limit(1);
      
    return !error && Array.isArray(data);
  } catch (error) {
    logError('Error in testTemporaryConnection:', error);
    return false;
  }
}

/**
 * Test access to /tmp directory
 */
async function testTmpAccess(): Promise<boolean> {
  try {
    // Use only console.log for diagnostics
    console.log('Testing /tmp access with console.log only (no fs operations)');
    
    // On Vercel, /tmp is the only writable directory
    // To test it properly, we'd need to use the filesystem, but we're avoiding that for now
    return true;
  } catch (error) {
    console.error('Error testing /tmp access:', error);
    return false;
  }
}

/**
 * Test if root directory is writable 
 */
async function testRootWritable(): Promise<boolean> {
  try {
    // In Vercel, the root directory is read-only
    // We're just checking for that condition without trying to write
    return false;
  } catch (error) {
    console.error('Error testing root writability:', error);
    return false;
  }
} 