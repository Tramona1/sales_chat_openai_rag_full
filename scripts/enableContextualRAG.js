/**
 * Enable Contextual RAG System
 * 
 * This script executes all necessary steps to enable the full contextual RAG
 * system, including:
 * 1. Enabling all contextual features
 * 2. Running the migration to add contextual information to existing documents
 * 3. Setting up monitoring and logging
 * 
 * Run with: node scripts/enableContextualRAG.js
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { 
  enableAllContextualFeatures, 
  setFlag 
} from '../utils/featureFlags.js';
import { migrateToContextualEmbeddings } from '../scripts/migrateToContextualEmbeddings.js';
import { setupAutomaticMetricSaving } from '../utils/performanceMonitoring.js';
import { logInfo, logError } from '../utils/errorHandling.js';

// Set up directory paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Main function to enable contextual RAG
 */
async function enableContextualRAG() {
  // Header
  console.log('\n=======================================================');
  console.log('       ENABLING CONTEXTUAL RAG SYSTEM');
  console.log('=======================================================\n');
  
  // Check for required API keys
  console.log('Checking API key configuration...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OpenAI API key is missing in .env.local file');
    console.log('Please add OPENAI_API_KEY to your .env.local file and try again.');
    process.exit(1);
  } else {
    console.log('✅ OpenAI API key found');
  }
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Gemini API key is missing in .env.local file');
    console.log('Please add GEMINI_API_KEY to your .env.local file and try again.');
    process.exit(1);
  } else {
    console.log('✅ Gemini API key found');
  }
  
  // Step 1: Enable all contextual features
  console.log('\n📝 Step 1: Enabling all contextual features...');
  try {
    enableAllContextualFeatures();
    
    // Enable specific reranking settings
    setFlag('useGeminiForReranking', true);
    setFlag('useGeminiForContextGeneration', true);
    console.log('✅ All contextual features enabled');
  } catch (error) {
    console.error('❌ Error enabling contextual features:', error);
    process.exit(1);
  }
  
  // Step 2: Run migration script
  console.log('\n📦 Step 2: Migrating existing documents to include contextual information...');
  try {
    console.log('Starting migration process, this may take some time...');
    await migrateToContextualEmbeddings();
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    console.log('Continuing with setup despite migration error');
  }
  
  // Step 3: Set up monitoring
  console.log('\n📊 Step 3: Setting up performance monitoring...');
  try {
    setupAutomaticMetricSaving(30 * 60 * 1000); // 30 minutes
    console.log('✅ Performance monitoring enabled');
  } catch (error) {
    console.error('❌ Error setting up monitoring:', error);
  }
  
  // Step 4: Create system configuration summary
  console.log('\n📄 Step 4: Creating configuration summary...');
  try {
    const summaryPath = path.join(process.cwd(), 'data', 'contextual_rag_config.json');
    
    const summaryData = {
      enabledOn: new Date().toISOString(),
      features: {
        contextualEmbeddings: true,
        contextualChunking: true,
        contextualReranking: true,
        enhancedQueryAnalysis: true,
        useGeminiForContextGeneration: true,
        useGeminiForReranking: true
      },
      environment: {
        node: process.version,
        openaiKey: process.env.OPENAI_API_KEY ? 'present' : 'missing',
        geminiKey: process.env.GEMINI_API_KEY ? 'present' : 'missing',
      }
    };
    
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
    console.log(`✅ Configuration summary saved to ${summaryPath}`);
  } catch (error) {
    console.error('❌ Error creating configuration summary:', error);
  }
  
  // Completion
  console.log('\n=======================================================');
  console.log('       CONTEXTUAL RAG SYSTEM ENABLED SUCCESSFULLY');
  console.log('=======================================================\n');
  
  console.log('🔍 The system now supports:');
  console.log('  - Contextual document understanding');
  console.log('  - Enhanced chunk metadata with definitions, key points, examples');
  console.log('  - Improved reranking using Gemini');
  console.log('  - Comprehensive performance monitoring');
  
  console.log('\n📋 Next steps:');
  console.log('  1. Verify functionality by testing a few queries');
  console.log('  2. Monitor performance metrics in data/performance_metrics directory');
  console.log('  3. Review contextual document information in your vector store');
  
  console.log('\n🚀 Happy contextual retrieving!\n');
}

// Run the main function
enableContextualRAG()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error during contextual RAG setup:', error);
    process.exit(1);
  }); 