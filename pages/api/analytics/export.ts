import { NextApiRequest, NextApiResponse } from 'next';
import { createServiceClient } from '@/utils/supabaseClient';
import { format, subDays, parseISO } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Parse query parameters
    const { format: exportFormat = 'json', start, end, range = '7days' } = req.query;
    
    // Validate format
    if (exportFormat !== 'json' && exportFormat !== 'csv') {
      return res.status(400).json({ error: 'Invalid format. Only "json" and "csv" are supported.' });
    }

    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();
    
    if (start && end) {
      startDate = parseISO(start as string);
      const endDateParsed = parseISO(end as string);
      if (!isNaN(endDateParsed.getTime())) {
        endDate.setTime(endDateParsed.getTime());
      }
    } else {
      // Use range parameter
      switch (range) {
        case '7days':
          startDate = subDays(endDate, 7);
          break;
        case '30days':
          startDate = subDays(endDate, 30);
          break;
        case '90days':
          startDate = subDays(endDate, 90);
          break;
        default:
          startDate = subDays(endDate, 7);
      }
    }

    // Format dates for SQL
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Create Supabase client
    const supabase = createServiceClient();

    // Fetch data from multiple tables
    const [searchMetricsResult, topSearchesResult] = await Promise.all([
      supabase
        .from('search_metrics')
        .select('*')
        .gte('timestamp', startDateStr)
        .lte('timestamp', endDateStr),
      supabase
        .from('search_queries_aggregated')
        .select('*')
    ]);

    // Check for errors
    if (searchMetricsResult.error || topSearchesResult.error) {
      console.error('Error fetching data for export:', searchMetricsResult.error || topSearchesResult.error);
      return res.status(500).json({ error: 'Failed to fetch data for export' });
    }

    // Prepare data for export
    const exportData = {
      metadata: {
        generated: new Date().toISOString(),
        date_range: {
          start: startDateStr,
          end: endDateStr
        }
      },
      search_metrics: searchMetricsResult.data || [],
      top_searches: topSearchesResult.data || []
    };

    // Export based on format
    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=analytics_export_${startDateStr}_to_${endDateStr}.json`);
      return res.status(200).json(exportData);
    } else if (exportFormat === 'csv') {
      // Simple CSV export for search metrics
      const csvHeader = 'query_text,search_type,result_count,execution_time_ms,timestamp\n';
      const csvRows = (searchMetricsResult.data || []).map(row => 
        `"${row.query_text?.replace(/"/g, '""') || ''}","${row.search_type || ''}",${row.result_count || 0},${row.execution_time_ms || 0},"${row.timestamp || ''}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=search_metrics_${startDateStr}_to_${endDateStr}.csv`);
      return res.status(200).send(csvContent);
    }
  } catch (error) {
    console.error('Error in export API:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 