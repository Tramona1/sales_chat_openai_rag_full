import { NextApiRequest, NextApiResponse } from 'next';
import { validateSupabaseConfig, getVercelSupabase, getVercelSupabaseAdmin } from '../../utils/vercelSupabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Step 1: Validate configuration
    const isConfigValid = validateSupabaseConfig();
    
    // Step 2: Try to create clients
    const serviceClient = getVercelSupabase();
    const adminClient = getVercelSupabaseAdmin();
    
    // Step 3: Test queries if clients exist
    let serviceQueryResult: any = null;
    let adminQueryResult: any = null;
    
    if (serviceClient) {
      try {
        const { data, error } = await serviceClient
          .from('document_chunks')
          .select('id')
          .limit(1);
          
        serviceQueryResult = {
          success: !error,
          hasData: Array.isArray(data) && data.length > 0,
          error: error ? error.message : null
        };
      } catch (queryError: any) {
        serviceQueryResult = {
          success: false,
          error: queryError.message
        };
      }
    }
    
    if (adminClient) {
      try {
        const { data, error } = await adminClient
          .from('document_chunks')
          .select('id')
          .limit(1);
          
        adminQueryResult = {
          success: !error,
          hasData: Array.isArray(data) && data.length > 0,
          error: error ? error.message : null
        };
      } catch (queryError: any) {
        adminQueryResult = {
          success: false,
          error: queryError.message
        };
      }
    }
    
    // Return test results
    res.status(200).json({
      timestamp: new Date().toISOString(),
      config: {
        isValid: isConfigValid,
        serviceUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        serviceKey: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET'
      },
      clients: {
        service: {
          created: !!serviceClient,
          queryResult: serviceQueryResult
        },
        admin: {
          created: !!adminClient,
          queryResult: adminQueryResult
        }
      },
      env: process.env.NODE_ENV
    });
  } catch (error: any) {
    console.error('Error in test-supabase:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 