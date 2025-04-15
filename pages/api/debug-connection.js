import { getSupabaseAdmin } from '../../utils/supabaseClient';

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('test_connection');
    
    if (error) throw error;
    
    return res.status(200).json({
      status: 'success',
      connection: true,
      data,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      // Don't include actual keys in response
      serviceKeySet: !!process.env.SUPABASE_SERVICE_KEY,
      anonKeySet: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
  } catch (error) {
    console.error('[Connection Test Error]', error);
    return res.status(500).json({ 
      status: 'error',
      message: error.message,
      connection: false
    });
  }
} 