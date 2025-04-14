// rebuild_corpus_stats_batched.js - Script to rebuild BM25 corpus statistics in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Validate Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

// Initialize Supabase client with increased timeout
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: {
    schema: 'public',
  },
  global: {
    // Increase timeout to 5 minutes
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(300000), // 5 minutes
      });
    },
  },
});

// Setup simple logging
function setupLogger() {
  // Create logs directory if it doesn't exist
  const logsDir = path.resolve(process.cwd(), 'data/logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logPath = path.resolve(process.cwd(), 'data/logs/corpus_stats_rebuild.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  
  return {
    info: (message) => {
      const formattedMessage = `[INFO] [${new Date().toISOString()}] ${message}`;
      console.log(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    error: (message, error) => {
      let errorDetails = '';
      if (error) {
        try {
          errorDetails = JSON.stringify(error, null, 2);
        } catch (e) {
          errorDetails = String(error);
        }
      }
      
      const formattedMessage = `[ERROR] [${new Date().toISOString()}] ${message}${error ? ':\n' + errorDetails : ''}`;
      console.error(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    success: (message) => {
      const formattedMessage = `[SUCCESS] [${new Date().toISOString()}] ${message}`;
      console.log(formattedMessage);
      logStream.write(formattedMessage + '\n');
    }
  };
}

// Manual implementation of corpus statistics rebuilding
async function rebuildBM25StatisticsManually() {
  const logger = setupLogger();
  logger.info('Starting manual BM25 statistics rebuild in Supabase...');
  
  try {
    // Step 1: Get document count and prepare statistics table
    logger.info('Setting up initial statistics...');
    
    // First, let's check if the text_search_vector column exists
    const { data: columnCheckData, error: columnCheckError } = await supabase.rpc(
      'column_exists',
      { table_name: 'document_chunks', column_name: 'text_search_vector' }
    );
    
    if (columnCheckError) {
      logger.error('Error checking for text_search_vector column', columnCheckError);
      // Create our own RPC function if it doesn't exist
      logger.info('Attempting to create text_search_vector column...');
      
      // SQL to add the column if it doesn't exist
      const { error: alterError } = await supabase.rpc('execute_sql', {
        sql_string: `
          ALTER TABLE document_chunks 
          ADD COLUMN IF NOT EXISTS text_search_vector tsvector
          GENERATED ALWAYS AS (to_tsvector('english', original_text)) STORED;
          
          CREATE INDEX IF NOT EXISTS idx_document_chunks_text_search_vector 
          ON document_chunks USING gin(text_search_vector);
        `
      });
      
      if (alterError) {
        logger.error('Error adding text_search_vector column', alterError);
        return false;
      }
      
      logger.success('Added text_search_vector column successfully');
    } else if (!columnCheckData) {
      logger.info('text_search_vector column needs to be created');
      
      // SQL to add the column
      const { error: alterError } = await supabase.rpc('execute_sql', {
        sql_string: `
          ALTER TABLE document_chunks 
          ADD COLUMN text_search_vector tsvector
          GENERATED ALWAYS AS (to_tsvector('english', original_text)) STORED;
          
          CREATE INDEX IF NOT EXISTS idx_document_chunks_text_search_vector 
          ON document_chunks USING gin(text_search_vector);
        `
      });
      
      if (alterError) {
        logger.error('Error adding text_search_vector column', alterError);
        return false;
      }
      
      logger.success('Added text_search_vector column successfully');
    } else {
      logger.info('text_search_vector column already exists');
    }
    
    // Check document_chunks count
    const { count, error: countError } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      logger.error('Error getting document_chunks count', countError);
      return false;
    }
    
    logger.info(`Found ${count} document chunks to process`);
    
    // Step 2: Update the document chunks to populate text_search_vector column
    // This is now handled by the GENERATED ALWAYS AS clause
    
    logger.success('tsvector column and index are now set up');
    logger.info('You can now use the full-text search capabilities through Supabase'); 
    
    return true;
  } catch (error) {
    logger.error('Error in manual BM25 statistics rebuild', error);
    return false;
  }
}

// Run the rebuild process
rebuildBM25StatisticsManually()
  .then(success => {
    if (success) {
      console.log('Process completed successfully.');
    } else {
      console.log('Process completed with errors.');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 