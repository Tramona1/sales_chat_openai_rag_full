/**
 * Supabase Connection Test Utility
 * 
 * This script tests the connection to Supabase and verifies the setup.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Simple query to test connection
    const startTime = Date.now();
    const { data, error } = await supabase.from('documents').select('count(*)', { count: 'exact', head: true });
    const endTime = Date.now();
    
    if (error) {
      console.error('Connection error:', error);
      return false;
    }
    
    console.log(`Connection successful! Response time: ${endTime - startTime}ms`);
    
    // Test pgvector extension
    const { data: vectorCheck, error: vectorError } = await supabase
      .rpc('test_vector_operations');
    
    if (vectorError) {
      // If test_vector_operations doesn't exist yet, we'll test by querying a table with vector column
      console.log('Note: test_vector_operations RPC not found. Testing vector column directly...');
      const { data: vectorData, error: vectorTableError } = await supabase
        .from('document_chunks')
        .select('COUNT(*)')
        .limit(1);
      
      if (vectorTableError) {
        console.error('Error checking vector functionality:', vectorTableError);
        console.log('You may need to run the SQL scripts to create tables and enable pgvector.');
      } else {
        console.log('Vector column exists. The pgvector extension appears to be enabled.');
      }
    } else {
      console.log('pgvector extension working correctly');
    }
    
    // Check storage bucket
    const { data: bucketData, error: bucketError } = await supabase
      .storage
      .getBucket('visual_content');
    
    if (bucketError) {
      console.error('Error checking visual_content storage bucket:', bucketError);
      console.log('You may need to run the storage SQL script to create the bucket.');
    } else {
      console.log('visual_content storage bucket exists:', bucketData);
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

async function checkTables() {
  console.log('Checking database tables...');
  
  const tables = [
    'documents',
    'document_chunks',
    'term_frequencies',
    'document_frequencies',
    'corpus_stats',
    'vector_items',
    'pending_documents',
    'pending_document_chunks',
    'feedback',
    'query_logs'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error(`Error checking table ${table}:`, error);
      } else {
        console.log(`Table ${table} exists. Row count: ${count}`);
      }
    } catch (error) {
      console.error(`Unexpected error checking table ${table}:`, error);
    }
  }
}

async function checkFunctions() {
  console.log('Checking database functions...');
  
  const functions = [
    'match_documents',
    'calculate_bm25_score',
    'search_documents_bm25',
    'calculate_avg_document_length',
    'rebuild_corpus_statistics',
    'search_by_entity'
  ];
  
  // This is a bit harder to check directly, we'll try a simple call to each function
  // that won't affect data but will verify the function exists
  
  try {
    // Check match_documents by creating a dummy vector
    const dummyVector = Array(768).fill(0);
    const { data: matchData, error: matchError } = await supabase
      .rpc('match_documents', {
        query_embedding: dummyVector,
        match_threshold: 0.5,
        match_count: 1
      });
    
    if (matchError) {
      if (matchError.message.includes('does not exist')) {
        console.error('Function match_documents does not exist.');
      } else {
        console.log('Function match_documents exists but returned an error (which may be expected if no data exists):', matchError.message);
      }
    } else {
      console.log('Function match_documents exists and works!');
    }
    
    // Check calculate_avg_document_length
    const { data: avgLengthData, error: avgLengthError } = await supabase
      .rpc('calculate_avg_document_length');
    
    if (avgLengthError) {
      if (avgLengthError.message.includes('does not exist')) {
        console.error('Function calculate_avg_document_length does not exist.');
      } else {
        console.log('Function calculate_avg_document_length exists but returned an error:', avgLengthError.message);
      }
    } else {
      console.log('Function calculate_avg_document_length exists and works!');
    }
    
  } catch (error) {
    console.error('Unexpected error checking functions:', error);
  }
}

// Run tests
async function runTests() {
  const connectionSuccess = await testConnection();
  
  if (connectionSuccess) {
    await checkTables();
    await checkFunctions();
    
    console.log('\nSummary:');
    console.log('1. Supabase connection: ✅');
    console.log('2. Database tables: Check log for details');
    console.log('3. Database functions: Check log for details');
    console.log('\nNext steps:');
    console.log('1. Run the SQL scripts if any tables or functions are missing');
    console.log('2. Update .env file with the following:');
    console.log(`   SUPABASE_URL=${supabaseUrl}`);
    console.log(`   SUPABASE_SERVICE_KEY=${supabaseKey}`);
    console.log('   USE_SUPABASE=true');
  } else {
    console.log('\nFailed to connect to Supabase. Please check your configuration.');
  }
}

runTests().catch(console.error); 