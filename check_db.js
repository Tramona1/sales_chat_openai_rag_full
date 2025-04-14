import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get Supabase config from environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase configuration. Check your .env.local file.');
  process.exit(1);
}

async function checkDatabase() {
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
    
    console.log('\n--- Checking Documents Table ---');
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .limit(5);
    
    if (docsError) {
      console.error('Error querying documents table:', docsError.message);
    } else {
      console.log(`Found ${docs.length} documents (showing first 5)`);
      docs.forEach(doc => console.log(`- Document ID: ${doc.id}`));
      
      // Count total documents
      const { count: docsCount, error: countError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
        
      if (!countError) {
        console.log(`Total documents in the table: ${docsCount}`);
      }
    }
    
    console.log('\n--- Checking Document Chunks Table ---');
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('id, document_id')
      .limit(5);
    
    if (chunksError) {
      console.error('Error querying document_chunks table:', chunksError.message);
    } else {
      console.log(`Found ${chunks.length} chunks (showing first 5)`);
      chunks.forEach(chunk => console.log(`- Chunk ID: ${chunk.id}, Document ID: ${chunk.document_id}`));
      
      // Count total chunks
      const { count: chunksCount, error: chunksCountError } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true });
        
      if (!chunksCountError) {
        console.log(`Total chunks in the table: ${chunksCount}`);
      }
    }
    
    // Check if pgvector extension is enabled - this might fail if the function doesn't exist
    console.log('\n--- Checking pgvector Extension ---');
    try {
      const { data: pgvector, error: pgvectorError } = await supabase
        .rpc('check_pgvector');
        
      if (pgvectorError) {
        console.error('Error checking pgvector extension:', pgvectorError.message);
      } else {
        console.log('pgvector extension status:', pgvector);
      }
    } catch (e) {
      console.error('Exception checking pgvector:', e.message);
      console.log('Note: You may need to create this RPC function in Supabase');
    }
    
    // Test a simple vector search
    console.log('\n--- Testing Vector Search Function ---');
    try {
      // This assumes you have a match_documents RPC function
      const { data: searchResults, error: searchError } = await supabase
        .rpc('match_documents', {
          query_embedding: Array(768).fill(0.1), // 768-dimension embedding
          match_threshold: 0.5,
          match_count: 5
        });
        
      if (searchError) {
        console.error('Error testing vector search:', searchError.message);
      } else {
        console.log(`Vector search returned ${searchResults?.length || 0} results`);
      }
    } catch (e) {
      console.error('Exception testing vector search:', e.message);
    }
    
    // Check hybrid search RPC function
    console.log('\n--- Testing Hybrid Search Function ---');
    try {
      const { data: hybridResults, error: hybridError } = await supabase
        .rpc('hybrid_search', {
          query_text: "hello",
          query_embedding: Array(768).fill(0.1), // 768-dimension embedding
          match_count: 5,
          match_threshold: 0.5,
          vector_weight: 0.7, 
          keyword_weight: 0.3
        });
        
      if (hybridError) {
        console.error('Error testing hybrid search:', hybridError.message);
      } else {
        console.log(`Hybrid search returned ${hybridResults?.length || 0} results`);
      }
    } catch (e) {
      console.error('Exception testing hybrid search:', e.message);
    }
    
  } catch (err) {
    console.error('Error connecting to Supabase:', err);
  }
}

checkDatabase().catch(console.error); 