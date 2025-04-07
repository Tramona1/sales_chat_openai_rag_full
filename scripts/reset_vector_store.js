/**
 * This script completely resets the vector store
 * Use with caution as this will delete all embedded knowledge
 */
const fs = require('fs');
const path = require('path');

// Import utility functions
const { clearVectorStore } = require('./utils');

console.log('WARNING: This will delete all vector store data. All trained knowledge will be lost.');
console.log('You will need to reprocess all data after running this script.');
console.log('Proceed with caution...');
console.log('\nDeleting vector store data...');

// Clear the vector store
clearVectorStore();

console.log('Vector store has been reset successfully.');
console.log('Run the batch processing scripts to rebuild the knowledge base.'); 