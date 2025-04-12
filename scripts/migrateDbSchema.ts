/**
 * Database Schema Migration for Gemini Embeddings
 * 
 * This script migrates the database schema from 1536-dimension OpenAI embeddings 
 * to 768-dimension Gemini embeddings. It includes:
 * - Altering vector columns
 * - Dropping old indices
 * - Creating new optimized indices
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
// Use Supabase generated types if available, otherwise use a fallback
// Assuming types are generated to '../types/supabase-types.ts' or similar
// If not generated, create a basic fallback type
type Database = any; // Replace with correct import if types exist
// import { Database } from '../types/supabase-types'; // Example path

// Load environment variables
dotenv.config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

// Check for required environment variables
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be set in environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Migration SQL statements
const migrationSteps = [
  {
    description: 'Drop existing vector indices',
    sql: `
      DROP INDEX IF EXISTS document_chunks_embedding_idx;
      DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx;
      DROP INDEX IF EXISTS document_content_embedding_idx;
    `
  },
  {
    description: 'Alter document_chunks table embedding column',
    sql: `
      ALTER TABLE document_chunks 
      ALTER COLUMN embedding TYPE vector(768);
    `
  },
  {
    description: 'Alter document_content table embedding column (if exists)',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'document_content' AND column_name = 'embedding'
        ) THEN
          ALTER TABLE document_content 
          ALTER COLUMN embedding TYPE vector(768);
        END IF;
      END $$;
    `
  },
  {
    description: 'Create IVFFlat index for document_chunks',
    sql: `
      CREATE INDEX document_chunks_embedding_idx 
      ON document_chunks 
      USING ivfflat (embedding vector_l2_ops)
      WITH (lists = 100);
    `
  },
  {
    description: 'Create HNSW index for document_chunks (better quality, slower builds)',
    sql: `
      CREATE INDEX document_chunks_embedding_hnsw_idx 
      ON document_chunks 
      USING hnsw (embedding vector_l2_ops)
      WITH (m = 16, ef_construction = 64);
    `
  },
  {
    description: 'Create index for document_content if it exists',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'document_content' AND column_name = 'embedding'
        ) THEN
          CREATE INDEX document_content_embedding_idx 
          ON document_content 
          USING ivfflat (embedding vector_l2_ops)
          WITH (lists = 100);
        END IF;
      END $$;
    `
  },
  {
    description: 'Update metadata to reflect new embedding model',
    sql: `
      UPDATE system_metadata
      SET value = 'models/text-embedding-004'
      WHERE key = 'embedding_model';
      
      UPDATE system_metadata
      SET value = '768'
      WHERE key = 'embedding_dimensions';
      
      INSERT INTO system_metadata (key, value, updated_at)
      VALUES 
        ('embedding_model', 'models/text-embedding-004', NOW()),
        ('embedding_dimensions', '768', NOW()),
        ('migration_history', 'Migrated from OpenAI to Gemini embeddings on ' || NOW()::text, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW();
    `
  }
];

/**
 * Execute a SQL statement with error handling
 */
async function executeSQL(sql: string, description: string): Promise<boolean> {
  console.log(`${colors.blue}[INFO]${colors.reset} Executing: ${description}`);
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error(`${colors.red}[ERROR]${colors.reset} ${description} failed: ${error.message}`);
      return false;
    }
    
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${description} completed`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${colors.red}[ERROR]${colors.reset} ${description} failed: ${errorMessage}`);
    return false;
  }
}

/**
 * Check if the database has the exec_sql function
 */
async function checkExecSQLFunction(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('pg_proc')
      .select('*')
      .eq('proname', 'exec_sql')
      .single();
    
    if (error) {
      return false;
    }
    
    return !!data;
  } catch (error) {
    return false;
  }
}

/**
 * Create the exec_sql function if it doesn't exist
 */
async function createExecSQLFunction(): Promise<boolean> {
  const sql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_query;
    END;
    $$;
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If the function doesn't exist, this will fail
      // We need to use a direct connection to create it
      console.error(`${colors.red}[ERROR]${colors.reset} exec_sql function does not exist and cannot be created through RPC`);
      console.error(`${colors.yellow}[WARNING]${colors.reset} Please create the exec_sql function manually with SQL:`, sql);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Failed to create exec_sql function`);
    return false;
  }
}

/**
 * Execute all migration steps
 */
async function runMigration() {
  console.log(`\n${colors.bright}${colors.magenta}DATABASE SCHEMA MIGRATION${colors.reset}`);
  console.log(`${colors.cyan}Migrating from 1536-dimension OpenAI embeddings to 768-dimension Gemini embeddings${colors.reset}`);
  console.log();
  
  // Check for exec_sql function
  const hasExecSQLFunction = await checkExecSQLFunction();
  if (!hasExecSQLFunction) {
    const created = await createExecSQLFunction();
    if (!created) {
      console.error(`${colors.red}[ERROR]${colors.reset} Cannot proceed without exec_sql function`);
      return false;
    }
  }
  
  // Execute each migration step
  let success = true;
  
  for (const step of migrationSteps) {
    const stepSuccess = await executeSQL(step.sql, step.description);
    if (!stepSuccess) {
      success = false;
      console.error(`${colors.yellow}[WARNING]${colors.reset} Migration step failed: ${step.description}`);
      
      // Ask user if they want to continue
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const continuePromise = new Promise<boolean>(resolve => {
        readline.question(`${colors.yellow}Continue with migration despite errors? (y/N)${colors.reset} `, (answer: string) => {
          readline.close();
          resolve(answer.toLowerCase() === 'y');
        });
      });
      
      const shouldContinue = await continuePromise;
      if (!shouldContinue) {
        console.log(`${colors.red}[ABORT]${colors.reset} Migration aborted by user`);
        return false;
      }
    }
  }
  
  if (success) {
    console.log(`\n${colors.bright}${colors.green}MIGRATION SUCCESSFUL${colors.reset}`);
    console.log(`${colors.cyan}Database schema has been updated to support 768-dimension Gemini embeddings${colors.reset}`);
  } else {
    console.log(`\n${colors.bright}${colors.yellow}MIGRATION COMPLETED WITH WARNINGS${colors.reset}`);
    console.log(`${colors.cyan}Some steps failed but the migration was allowed to continue${colors.reset}`);
  }
  
  return success;
}

/**
 * Check if database is empty (no documents)
 */
async function isDatabaseEmpty(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`${colors.red}[ERROR]${colors.reset} Failed to check if database is empty: ${error.message}`);
      return false;
    }
    
    return count === 0;
  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Failed to check if database is empty`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check if database is empty
    const empty = await isDatabaseEmpty();
    
    if (!empty) {
      console.warn(`${colors.bright}${colors.yellow}WARNING:${colors.reset} Database contains documents with embeddings.`);
      console.warn(`${colors.yellow}It is recommended to purge all documents before schema migration.${colors.reset}`);
      console.warn(`${colors.yellow}Otherwise, existing embeddings will be invalid.${colors.reset}`);
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const continuePromise = new Promise<boolean>(resolve => {
        readline.question(`${colors.yellow}Continue with migration anyway? (y/N)${colors.reset} `, (answer: string) => {
          readline.close();
          resolve(answer.toLowerCase() === 'y');
        });
      });
      
      const shouldContinue = await continuePromise;
      if (!shouldContinue) {
        console.log(`${colors.red}[ABORT]${colors.reset} Migration aborted by user`);
        return;
      }
    }
    
    // Run migration
    const success = await runMigration();
    
    if (success) {
      console.log('\nNext steps:');
      console.log('1. Rebuild vector store with Gemini embeddings');
      console.log('2. Verify search functionality');
    }
  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Migration failed:`, error);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}[ERROR]${colors.reset} Unhandled error:`, error);
    process.exit(1);
  });
}

export { runMigration }; 