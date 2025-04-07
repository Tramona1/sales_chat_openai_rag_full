/**
 * Full Reprocessing Script
 * 
 * This script performs a complete reprocessing of all knowledge data
 * with improved handling of structured information like company values,
 * investors, and leadership information.
 * 
 * It performs the following steps:
 * 1. Reset the vector store to start fresh
 * 2. Process core company information directly
 * 3. Process all web crawl data with priority for critical pages
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('═════════════════════════════════════════════');
console.log('🔄 FULL KNOWLEDGE BASE REPROCESSING');
console.log('═════════════════════════════════════════════');
console.log('This process will completely rebuild the knowledge base.');
console.log('It will take some time to complete. Please be patient.');
console.log();

// Ensure all scripts exist
const scripts = [
  'reset_vector_store.js',
  'add_core_info.js',
  'enhanced_process_web_crawl.js'
];

for (const script of scripts) {
  const scriptPath = path.join(__dirname, script);
  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: Required script "${script}" not found.`);
    process.exit(1);
  }
}

try {
  // Step 1: Reset vector store
  console.log('Step 1: Resetting vector store...');
  execSync('node scripts/reset_vector_store.js', { stdio: 'inherit' });
  console.log('✅ Vector store reset complete.');
  console.log();
  
  // Step 2: Add core company information
  console.log('Step 2: Adding core company information...');
  execSync('node scripts/add_core_info.js', { stdio: 'inherit' });
  console.log('✅ Core information processing complete.');
  console.log();
  
  // Step 3: Process web crawl data
  console.log('Step 3: Processing all web crawl data...');
  execSync('node scripts/enhanced_process_web_crawl.js', { stdio: 'inherit' });
  console.log('✅ Web crawl data processing complete.');
  console.log();
  
  console.log('═════════════════════════════════════════════');
  console.log('✅ FULL REPROCESSING COMPLETE');
  console.log('═════════════════════════════════════════════');
  console.log('The knowledge base has been completely rebuilt with improved handling of structured information.');
  console.log('Your Sales Knowledge Assistant should now correctly answer questions about:');
  console.log('- Company values');
  console.log('- Investors');
  console.log('- Leadership and team');
  console.log('- Mission and vision');
  console.log('- Other company information');
  
} catch (error) {
  console.error('Error during reprocessing:', error);
  process.exit(1);
} 