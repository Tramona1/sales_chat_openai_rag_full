// Test script for Supabase RPC functionality
// This script checks if the Supabase client can call RPC functions properly
// Run with: node scripts/test_supabase_rpc.js

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Setup dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

console.log('Initializing Supabase client...');
console.log(`URL: ${SUPABASE_URL}`);
console.log(`Key: ${SUPABASE_SERVICE_KEY.substring(0, 10)}...`);

// Create the client with different approaches to test
const supabaseRegular = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const supabaseWithOptions = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function testRPC() {
  try {
    console.log('\n--- Testing Regular Client ---');
    console.log('Client keys:', Object.keys(supabaseRegular));
    console.log('Client functions:', Object.keys(supabaseRegular.functions || {}));
    console.log('Is RPC a function?', typeof supabaseRegular.rpc === 'function');
    
    // Try calling a simple RPC function
    console.log('\nTrying to call a simple RPC function with regular client...');
    try {
      const { data: testRegular, error: errorRegular } = await supabaseRegular.rpc('process_search_query', { query_text: 'test' });
      console.log('Result:', testRegular, 'Error:', errorRegular);
    } catch (e) {
      console.error('Error calling RPC with regular client:', e.message);
    }
    
    console.log('\n--- Testing Client with Options ---');
    console.log('Client keys:', Object.keys(supabaseWithOptions));
    console.log('Client functions:', Object.keys(supabaseWithOptions.functions || {}));
    console.log('Is RPC a function?', typeof supabaseWithOptions.rpc === 'function');
    
    // Try calling with the options client
    console.log('\nTrying to call a simple RPC function with options client...');
    try {
      const { data: testWithOptions, error: errorWithOptions } = await supabaseWithOptions.rpc('process_search_query', { query_text: 'test' });
      console.log('Result:', testWithOptions, 'Error:', errorWithOptions);
    } catch (e) {
      console.error('Error calling RPC with options client:', e.message);
    }
    
    // Try using the functions interface instead
    console.log('\nTrying with functions.invoke() approach...');
    try {
      if (typeof supabaseRegular.functions?.invoke === 'function') {
        const { data: funcData, error: funcError } = await supabaseRegular.functions.invoke('process_search_query', {
          body: { query_text: 'test' }
        });
        console.log('Function Result:', funcData, 'Error:', funcError);
      } else {
        console.log('functions.invoke is not available');
      }
    } catch (e) {
      console.error('Error calling functions.invoke:', e.message);
    }
    
    // Check Supabase library version
    console.log('\nSupabase library information:');
    try {
      const version = require('@supabase/supabase-js/package.json').version;
      console.log('Using @supabase/supabase-js version:', version);
    } catch (e) {
      console.log('Could not determine Supabase library version:', e.message);
    }
    
    // Check if we can access the database directly
    console.log('\nTesting direct database access...');
    try {
      const { data: dbData, error: dbError } = await supabaseRegular.from('documents').select('id').limit(1);
      console.log('Database access result:', dbData, 'Error:', dbError);
    } catch (e) {
      console.error('Error accessing database:', e.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run tests
testRPC(); 