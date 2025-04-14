/**
 * Database Migration Script
 * 
 * This script runs the SQL migrations in the db_migrations folder to set up new tables
 * and functions in the Supabase database.
 */

import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../utils/supabaseClient';
import { logInfo, logError, logSuccess } from '../utils/logger';

// Directory containing migration files
const MIGRATIONS_DIR = path.resolve(__dirname, '../db_migrations');

/**
 * Runs a single SQL migration file against the Supabase database
 */
async function runMigration(filename: string): Promise<void> {
  logInfo(`Running migration: ${filename}`);
  
  try {
    // Read the SQL file content
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Get Supabase admin client
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase admin client');
    }
    
    // Run the SQL directly
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      throw new Error(`Migration error: ${error.message}`);
    }
    
    logSuccess(`Successfully ran migration: ${filename}`);
  } catch (err) {
    logError(`Failed to run migration ${filename}:`, err);
    throw err;
  }
}

/**
 * Main function to run all migrations
 */
async function runAllMigrations(): Promise<void> {
  logInfo('Starting database migrations...');
  
  try {
    // Check if migrations directory exists
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    }
    
    // Get list of SQL files in the migrations directory
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in alphabetical order
    
    if (files.length === 0) {
      logInfo('No migration files found.');
      return;
    }
    
    logInfo(`Found ${files.length} migration files`);
    
    // Run each migration in sequence
    for (const file of files) {
      await runMigration(file);
    }
    
    logSuccess('All migrations completed successfully.');
  } catch (err) {
    logError('Migration process failed:', err);
    process.exit(1);
  }
}

// Run the migrations if this script is executed directly
if (require.main === module) {
  runAllMigrations().then(() => {
    logInfo('Migration script completed.');
    process.exit(0);
  }).catch(err => {
    logError('Migration script failed:', err);
    process.exit(1);
  });
}

export { runAllMigrations }; 