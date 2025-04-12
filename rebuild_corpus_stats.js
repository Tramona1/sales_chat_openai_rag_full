// rebuild_corpus_stats.js - Script to rebuild BM25 corpus statistics in Supabase
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

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Rebuild BM25 statistics in Supabase
async function rebuildBM25Statistics() {
  const logger = setupLogger();
  logger.info('Rebuilding BM25 statistics in Supabase...');
  
  try {
    // Call the Supabase stored function to rebuild statistics
    logger.info('Calling rebuild_corpus_statistics function...');
    
    try {
      const { data, error } = await supabase.rpc('rebuild_corpus_statistics');
      
      if (error) {
        logger.error('Error rebuilding BM25 statistics', error);
        return false;
      }
      
      logger.success('BM25 statistics rebuilt successfully');
      logger.info(`Function returned: ${JSON.stringify(data, null, 2)}`);
      return true;
    } catch (rpcError) {
      logger.error('Error calling rebuild_corpus_statistics function', rpcError);
      logger.error('Skipping BM25 statistics rebuild');
      return false;
    }
  } catch (error) {
    logger.error('Error rebuilding BM25 statistics', error);
    return false;
  }
}

// Run the rebuild process
rebuildBM25Statistics()
  .then(() => {
    console.log('Process completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 