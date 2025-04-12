/**
 * Purge Supabase Data Script
 * 
 * This script purges all data from Supabase tables before rebuilding
 * with the new Gemini embeddings.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Validate configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tables to purge
const TABLES = [
  'vector_items',      // Purge this first due to foreign key constraints
  'document_chunks',   // Purge this second due to foreign key constraints
  'visual_content',    // Purge this third due to foreign key constraints
  'documents',         // Purge this after its dependent tables
  'corpus_statistics', // Independent table
  'pending_documents'  // Independent table
];

/**
 * Purge data from a table
 */
async function purgeTable(table) {
  console.log(`Purging data from ${table}...`);
  
  try {
    // Use SQL execution via RPC for more reliable deletion
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_command: `DELETE FROM ${table}`
    });
    
    if (error) {
      console.error(`Error purging ${table}:`, error.message);
      return false;
    }
    
    console.log(`Successfully purged ${table}`);
    return true;
  } catch (error) {
    console.error(`Exception purging ${table}:`, error.message);
    return false;
  }
}

/**
 * Main function to purge all tables
 */
async function purgeAllTables() {
  console.log('========================================');
  console.log('  SUPABASE DATA PURGE');
  console.log('========================================');
  console.log('');
  console.log('This will delete ALL data from the following tables:');
  TABLES.forEach(table => console.log(`- ${table}`));
  console.log('');
  console.log('WARNING: This action cannot be undone. Make sure you have a backup if needed.');
  console.log('');
  
  // Confirm with the user
  const readline = (await import('readline')).default.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  await new Promise(resolve => {
    readline.question('Type "YES" to confirm and continue: ', answer => {
      readline.close();
      
      if (answer.trim().toUpperCase() !== 'YES') {
        console.log('Purge operation cancelled. No changes were made.');
        process.exit(0);
      }
      
      resolve();
    });
  });
  
  // Purge each table
  let success = true;
  
  for (const table of TABLES) {
    const purged = await purgeTable(table);
    if (!purged) {
      success = false;
    }
  }
  
  console.log('');
  if (success) {
    console.log('========================================');
    console.log('  PURGE COMPLETED SUCCESSFULLY');
    console.log('========================================');
    console.log('');
    console.log('All data has been purged from the Supabase tables.');
    console.log('You can now rebuild the vector store with new data and embeddings.');
  } else {
    console.log('========================================');
    console.log('  PURGE COMPLETED WITH ERRORS');
    console.log('========================================');
    console.log('');
    console.log('Some tables could not be purged. Check the error messages above.');
    console.log('You may need to manually delete the data from these tables.');
  }
}

// Run the main function
purgeAllTables().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 