// Quick script to check Supabase database content
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Get credentials from env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

// Create client
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log("Checking document_chunks table...");
    
    // Count total chunks
    const { count: totalCount, error: countError } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      throw new Error(`Error counting chunks: ${countError.message}`);
    }
    
    console.log(`Total document chunks: ${totalCount}`);
    
    // Sample some chunks to see what's in there
    const { data: sampleChunks, error: sampleError } = await supabase
      .from('document_chunks')
      .select('id, document_id, text, metadata')
      .limit(2);
      
    if (sampleError) {
      throw new Error(`Error fetching sample chunks: ${sampleError.message}`);
    }
    
    console.log("Sample chunks metadata:");
    sampleChunks.forEach(chunk => {
      console.log(`ID: ${chunk.id}`);
      console.log(`Document ID: ${chunk.document_id}`);
      console.log(`Metadata:`, chunk.metadata);
      console.log(`Text (first 100 chars): ${chunk.text.substring(0, 100)}...`);
      console.log("-----------------------------------------");
    });
    
    // Check for chunks containing "workstream" in text
    console.log("\nChecking for chunks containing 'workstream' in text field...");
    const { data: textChunks, error: textChunksError } = await supabase
      .from('document_chunks')
      .select('id, document_id, text')
      .ilike('text', '%workstream%')
      .limit(5);
      
    if (textChunksError) {
      throw new Error(`Error searching text: ${textChunksError.message}`);
    }
    
    console.log(`Found ${textChunks?.length || 0} chunks containing 'workstream' in text`);
    if (textChunks?.length > 0) {
      console.log("First matching chunk ID:", textChunks[0].id);
    }
    
    // Check keyword search directly
    console.log("\nTesting keyword search for 'workstream'...");
    const { data: keywordResults, error: keywordError } = await supabase
      .rpc('keyword_search', {
        query_text: 'workstream',
        match_count: 5
      });
      
    if (keywordError) {
      throw new Error(`Error in keyword search: ${keywordError.message}`);
    }
    
    console.log(`Keyword search found ${keywordResults?.length || 0} results`);
    if (keywordResults?.length > 0) {
      console.log("First keyword result:");
      console.log(`ID: ${keywordResults[0].id}`);
      console.log(`Document ID: ${keywordResults[0].document_id}`);
      console.log(`Score: ${keywordResults[0].rank || 'N/A'}`);
    }
    
    // Test with empty embedding vector (all zeros)
    console.log("\nTesting hybrid_search with dummy embedding...");
    const zeroVector = Array(768).fill(0);
    const hybridSearchParams = {
      query_text: 'workstream',
      query_embedding: zeroVector,
      match_count: 5,
      match_threshold: 0.1,
      vector_weight: 0.1,
      keyword_weight: 0.9,
      filter: {}
    };
    
    console.log("Hybrid search params:", JSON.stringify(hybridSearchParams, null, 2));
    
    // Create a test call with minimal filter
    const { data: hybridResults, error: hybridError } = await supabase
      .rpc('hybrid_search', hybridSearchParams);
      
    if (hybridError) {
      console.error("Error in hybrid_search:", hybridError);
      console.log("This confirms the issue is with the RPC function. Let's check if the function exists...");
      
      // List all functions to confirm hybrid_search exists
      const { data: functions, error: functionsError } = await supabase
        .from('pg_proc')
        .select('proname')
        .contains('pronamespace', {'nspname': 'public'});
        
      if (functionsError) {
        console.log("Could not list PostgreSQL functions:", functionsError.message);
      } else {
        console.log("Available functions:", functions?.map(f => f.proname).join(', '));
      }
    } else {
      console.log(`Hybrid search found ${hybridResults?.length || 0} results`);
      if (hybridResults?.length > 0) {
        console.log("First hybrid result:");
        console.log(`ID: ${hybridResults[0].id}`);
        console.log(`Document ID: ${hybridResults[0].document_id}`);
        console.log(`Score: ${hybridResults[0].combined_score || 'N/A'}`);
        console.log("Sample response (first result):", JSON.stringify(hybridResults[0], null, 2).substring(0, 500) + "...");
      }
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main(); 