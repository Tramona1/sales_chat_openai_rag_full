import { NextApiRequest, NextApiResponse } from 'next';
import { createServiceClient } from '@/utils/supabaseClient';
import { parseISO } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Parse query parameters
    const { start, end, type } = req.query;
    
    // Validate required parameters
    if (!start || !end) {
      return res.status(400).json({ error: 'Missing required query parameters: start and end' });
    }

    // Create Supabase client
    const supabase = createServiceClient();

    // Construct the query using the v_search_performance_by_type view
    let query = supabase
      .from('v_search_performance_by_type')
      .select('*');

    // Add search type filter if specified
    if (type && type !== 'all') {
      query = query.eq('search_type', type);
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching search metrics:', error);
      return res.status(500).json({ error: 'Failed to fetch search metrics' });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Error in search-metrics API:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 