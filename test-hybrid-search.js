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

async function testHybridSearch(searchTerm) {
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
    
    // Create a mock embedding for testing
    const mockEmbedding = Array(768).fill(0.1);
    
    console.log(`\n--- Testing hybrid_search RPC with query: "${searchTerm}" ---`);
    console.log('Using mock embedding with 768 dimensions');
    
    try {
      const { data: hybridResults, error: hybridError } = await supabase.rpc('hybrid_search', {
        query_text: searchTerm,
        query_embedding: mockEmbedding,
        match_count: 5,
        match_threshold: 0.1, // Very low threshold for testing
        vector_weight: 0.3,
        keyword_weight: 0.7,
        filter: null // No filter for now
      });
      
      if (hybridError) {
        console.error('Error with hybrid_search RPC:', hybridError.message);
        if (hybridError.details) {
          console.error('Error details:', hybridError.details);
        }
        console.error('Error code:', hybridError.code);
        
        // Try checking if the function exists at all
        console.log('\nChecking if function exists...');
        const { data: funcList, error: funcError } = await supabase
          .from('pg_proc')
          .select('proname')
          .eq('proname', 'hybrid_search')
          .limit(1);
          
        if (funcError) {
          console.log('Error checking function existence:', funcError.message);
        } else {
          console.log('Function existence check result:', funcList);
        }
      } else {
        console.log(`Hybrid search returned ${hybridResults?.length || 0} results`);
        
        if (hybridResults && hybridResults.length > 0) {
          console.log('\nSample results:');
          hybridResults.forEach((result, i) => {
            if (i < 3) { // Show first 3 results
              console.log(`\nResult ${i+1}:`);
              console.log(`- ID: ${result.id}`);
              console.log(`- Document ID: ${result.document_id}`);
              console.log(`- Combined Score: ${result.combined_score || result.similarity || 'N/A'}`);
              console.log(`- Vector Score: ${result.vector_score || 'N/A'}`);
              console.log(`- Keyword Score: ${result.keyword_score || 'N/A'}`);
              if (result.text) {
                console.log(`- Text preview: "${result.text.substring(0, 100)}..."`);
              }
            }
          });
        }
      }
    } catch (hybridError) {
      console.error('Exception calling hybrid_search:', hybridError.message);
      if (hybridError.stack) {
        console.error('Stack trace:', hybridError.stack);
      }
    }
    
    // Try the match_documents function as a fallback
    console.log('\n--- Testing match_documents RPC (vector search only) ---');
    try {
      const { data: matchResults, error: matchError } = await supabase.rpc('match_documents', {
        query_embedding: mockEmbedding,
        match_threshold: 0.1, // Very low threshold for testing
        match_count: 5
      });
      
      if (matchError) {
        console.error('Error with match_documents RPC:', matchError.message);
        if (matchError.details) {
          console.error('Error details:', matchError.details);
        }
      } else {
        console.log(`Vector search returned ${matchResults?.length || 0} results`);
        
        if (matchResults && matchResults.length > 0) {
          console.log('\nSample results:');
          matchResults.forEach((result, i) => {
            if (i < 3) { // Show first 3 results
              console.log(`\nResult ${i+1}:`);
              console.log(`- ID: ${result.id}`);
              console.log(`- Document ID: ${result.document_id}`);
              console.log(`- Similarity: ${result.similarity || 'N/A'}`);
              if (result.text) {
                console.log(`- Text preview: "${result.text.substring(0, 100)}..."`);
              }
            }
          });
        }
      }
    } catch (matchError) {
      console.error('Exception calling match_documents:', matchError.message);
    }
    
  } catch (err) {
    console.error('Error connecting to Supabase:', err);
  }
}

// Get search term from command line or use default
const searchTerm = process.argv[2] || 'workstream';
testHybridSearch(searchTerm); 