import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables - prioritize .env.local over .env
dotenv.config({ path: '.env.local' });

// Get Supabase config from environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase configuration. Check your .env.local file.');
  process.exit(1);
}

async function testBasicSearch(searchTerm) {
  try {
    console.log('Connecting to Supabase...');
    console.log(`URL: ${url}`);
    console.log(`Service Key: ${serviceKey ? '[SET]' : '[NOT SET]'}`);
    
    // Create Supabase client
    const supabase = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    // Test a simple text search first
    console.log(`\n--- Simple Text Search for: "${searchTerm}" ---`);
    const { data: textSearchResults, error: textSearchError } = await supabase
      .from('document_chunks')
      .select('id, document_id, text')
      .textSearch('text', searchTerm, { type: 'plain', config: 'english' })
      .limit(5);
    
    if (textSearchError) {
      console.error('Error with text search:', textSearchError.message);
    } else {
      console.log(`Found ${textSearchResults?.length || 0} results with text search`);
      if (textSearchResults && textSearchResults.length > 0) {
        textSearchResults.forEach((result, i) => {
          console.log(`\nResult ${i+1}:`);
          console.log(`- ID: ${result.id}`);
          console.log(`- Document ID: ${result.document_id}`);
          console.log(`- Text preview: "${result.text.substring(0, 200)}..."`);
        });
      }
    }
    
    // Test a simple ILIKE search
    console.log(`\n--- Simple ILIKE Search for: "%${searchTerm}%" ---`);
    const { data: ilikeResults, error: ilikeError } = await supabase
      .from('document_chunks')
      .select('id, document_id, text')
      .ilike('text', `%${searchTerm}%`)
      .limit(5);
    
    if (ilikeError) {
      console.error('Error with ILIKE search:', ilikeError.message);
    } else {
      console.log(`Found ${ilikeResults?.length || 0} results with ILIKE search`);
      if (ilikeResults && ilikeResults.length > 0) {
        ilikeResults.forEach((result, i) => {
          console.log(`\nResult ${i+1}:`);
          console.log(`- ID: ${result.id}`);
          console.log(`- Document ID: ${result.document_id}`);
          console.log(`- Text preview: "${result.text.substring(0, 200)}..."`);
        });
      }
    }
    
    // List available tables in Supabase
    console.log('\n--- Checking Available Tables ---');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');
      
    if (tablesError) {
      console.error('Error listing tables:', tablesError.message);
      console.log('Note: This may be expected if the get_tables RPC function is not defined');
      
      // Alternative approach: try querying a few known table names
      console.log('\nTrying to query known tables:');
      
      const knownTables = ['documents', 'document_chunks', 'api_call_logs', 'search_traces'];
      
      for (const table of knownTables) {
        try {
          const { count, error: countError } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
            
          if (countError) {
            console.log(`- Table "${table}": Error - ${countError.message}`);
          } else {
            console.log(`- Table "${table}": ${count || 0} rows`);
          }
        } catch (e) {
          console.log(`- Table "${table}": Error - ${e.message}`);
        }
      }
    } else {
      console.log('Available tables:');
      tables.forEach(table => console.log(`- ${table.table_name}`));
    }
    
    // Check if hybrid_search RPC function exists
    console.log('\n--- Checking Hybrid Search RPC Function ---');
    try {
      const { data: rpcInfo, error: rpcError } = await supabase
        .rpc('get_function_info', { function_name: 'hybrid_search' });
        
      if (rpcError) {
        console.error('Error checking hybrid_search function:', rpcError.message);
        console.log('Note: This may be expected if the get_function_info RPC is not defined');
      } else {
        console.log('Hybrid search function info:', rpcInfo);
      }
    } catch (e) {
      console.log('Error checking hybrid_search function:', e.message);
      console.log('Testing hybrid_search directly...');
      
      try {
        // Create a mock embedding for testing
        const mockEmbedding = Array(768).fill(0.1);
        
        // Test the hybrid_search function
        const { data: hybridResults, error: hybridError } = await supabase.rpc('hybrid_search', {
          query_text: searchTerm,
          query_embedding: mockEmbedding,
          match_count: 5,
          match_threshold: 0.1, // Use a very low threshold for testing
          vector_weight: 0.3,
          keyword_weight: 0.7,
          filter: null
        });
        
        if (hybridError) {
          console.error('Error testing hybrid_search:', hybridError.message);
          console.error('Details:', hybridError.details);
        } else {
          console.log(`Hybrid search test returned ${hybridResults?.length || 0} results`);
          if (hybridResults && hybridResults.length > 0) {
            console.log('First result:', JSON.stringify(hybridResults[0], null, 2));
          }
        }
      } catch (hybridError) {
        console.error('Exception testing hybrid_search:', hybridError.message);
      }
    }
  } catch (err) {
    console.error('Error connecting to Supabase:', err);
  }
}

// Get search term from command line or use default
const searchTerm = process.argv[2] || 'workstream';
testBasicSearch(searchTerm); 