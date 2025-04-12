/**
 * Vector Store Purge Utility
 * 
 * This script provides a safe way to purge vector store data before migration.
 * It includes backup capabilities and confirmation prompts for safety.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { clearVectorStore } from '../utils/vectorStore';

// Configuration
const VECTOR_DATA_DIR = path.join(process.cwd(), 'data', 'vector_batches');
const CORPUS_STATS_FILE = path.join(process.cwd(), 'data', 'corpus_stats.json');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Simple logger
const logger = {
  info: (message: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
  warning: (message: string) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
  success: (message: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  error: (error: Error | string) => {
    const message = error instanceof Error ? error.message : error;
    console.error(`${colors.red}[ERROR]${colors.reset} ${message}`);
    if (error instanceof Error && error.stack) {
      console.error(`${colors.dim}${error.stack.split('\n').slice(1).join('\n')}${colors.reset}`);
    }
  }
};

/**
 * Create a readline interface for user input
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Get user confirmation
 */
async function confirm(question: string): Promise<boolean> {
  const rl = createInterface();
  
  return new Promise(resolve => {
    rl.question(`${colors.yellow}${question} (y/N)${colors.reset} `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Backup vector store data
 */
async function backupVectorStore(): Promise<string> {
  logger.info('Creating backup of vector store data...');
  
  // Check if vector data exists
  if (!fs.existsSync(VECTOR_DATA_DIR)) {
    logger.warning('No vector data directory found. Nothing to backup.');
    return '';
  }
  
  // Create backup directory with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `vector_backup_${timestamp}`);
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  fs.mkdirSync(backupPath, { recursive: true });
  
  // Copy vector batch files
  const files = fs.readdirSync(VECTOR_DATA_DIR);
  let filesCopied = 0;
  
  for (const file of files) {
    if (file !== '.gitkeep') {
      const srcPath = path.join(VECTOR_DATA_DIR, file);
      const destPath = path.join(backupPath, file);
      fs.copyFileSync(srcPath, destPath);
      filesCopied++;
    }
  }
  
  // Copy corpus stats if exists
  if (fs.existsSync(CORPUS_STATS_FILE)) {
    const corpusStatsBackupPath = path.join(backupPath, 'corpus_stats.json');
    fs.copyFileSync(CORPUS_STATS_FILE, corpusStatsBackupPath);
    filesCopied++;
  }
  
  // Create metadata file
  const metadataPath = path.join(backupPath, 'backup_info.json');
  const metadata = {
    timestamp,
    filesCopied,
    createdAt: new Date().toISOString(),
    description: 'Vector store backup created before purge operation'
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  logger.success(`Backup created at: ${backupPath}`);
  logger.info(`Backed up ${filesCopied} files`);
  
  return backupPath;
}

/**
 * Purge vector store data
 */
async function purgeVectorStore(): Promise<void> {
  logger.info('Preparing to purge vector store data...');
  
  // Check if vector data exists
  if (!fs.existsSync(VECTOR_DATA_DIR)) {
    logger.info('No vector store data found. Creating directory...');
    fs.mkdirSync(VECTOR_DATA_DIR, { recursive: true });
    return;
  }
  
  // Count files to be deleted
  const files = fs.readdirSync(VECTOR_DATA_DIR);
  const filesToDelete = files.filter(file => file !== '.gitkeep');
  
  logger.info(`Found ${filesToDelete.length} vector store files to purge`);
  
  // Check for corpus stats
  const hasCorpusStats = fs.existsSync(CORPUS_STATS_FILE);
  if (hasCorpusStats) {
    logger.info('Found corpus statistics file');
  }
  
  // Prompt for confirmation
  const confirmed = await confirm(`Are you sure you want to purge ${filesToDelete.length} vector store files${hasCorpusStats ? ' and corpus statistics' : ''}?`);
  
  if (!confirmed) {
    logger.warning('Purge operation cancelled by user');
    return;
  }
  
  logger.info('Purging vector store data...');
  
  // Delete vector store files
  let deletedCount = 0;
  for (const file of filesToDelete) {
    const filePath = path.join(VECTOR_DATA_DIR, file);
    fs.unlinkSync(filePath);
    deletedCount++;
  }
  
  // Delete corpus stats
  if (hasCorpusStats) {
    fs.unlinkSync(CORPUS_STATS_FILE);
    logger.info('Corpus statistics file deleted');
  }
  
  // Also clear in-memory vector store using the API
  try {
    clearVectorStore();
    logger.info('In-memory vector store cleared');
  } catch (error) {
    logger.warning('Could not clear in-memory vector store. It may not be loaded.');
  }
  
  logger.success(`Vector store purged successfully. Deleted ${deletedCount} files.`);
}

/**
 * Main function
 */
async function main() {
  console.log('\n');
  console.log(`${colors.bright}${colors.magenta}VECTOR STORE PURGE UTILITY${colors.reset}`);
  console.log(`${colors.dim}This utility will purge all vector store data for migration to Gemini embeddings${colors.reset}`);
  console.log('\n');
  
  try {
    // Display warning message
    console.log(`${colors.bright}${colors.red}WARNING:${colors.reset} This will delete ALL vector store data.`);
    console.log(`${colors.yellow}This operation is intended for use during the Gemini migration process.${colors.reset}`);
    console.log('\n');
    
    // Offer to create backup
    const backupConfirmed = await confirm('Would you like to create a backup before purging?');
    
    let backupPath = '';
    if (backupConfirmed) {
      backupPath = await backupVectorStore();
    } else {
      logger.warning('Proceeding without backup');
    }
    
    // Final confirmation
    const finalConfirmation = await confirm(`${colors.bright}${colors.red}FINAL WARNING:${colors.reset} Are you absolutely sure you want to purge all vector store data?`);
    
    if (finalConfirmation) {
      await purgeVectorStore();
      
      // Display restoration instructions if backup was created
      if (backupPath) {
        console.log('\n');
        console.log(`${colors.bright}${colors.green}RESTORE INSTRUCTIONS:${colors.reset}`);
        console.log(`To restore from backup, copy files from: ${backupPath}`);
        console.log(`to: ${VECTOR_DATA_DIR}`);
        console.log('\n');
      }
    } else {
      logger.warning('Purge operation cancelled by user');
    }
    
  } catch (error) {
    logger.error(error as Error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    logger.error(error);
    process.exit(1);
  });
}

export { purgeVectorStore, backupVectorStore }; 