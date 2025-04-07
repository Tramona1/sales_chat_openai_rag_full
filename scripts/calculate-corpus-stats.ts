/**
 * Script to calculate corpus statistics for BM25 scoring
 * This script processes the entire vector store to calculate:
 * - Total documents
 * - Average document length
 * - Document frequency for each term
 * - Document lengths
 * These statistics are used by the BM25 implementation
 */

import fs from 'fs/promises';
import path from 'path';
import { calculateCorpusStatistics, saveCorpusStatistics } from '../utils/bm25';
import { VectorStoreItem } from '../utils/vectorStore';

/**
 * Load the vector store
 */
async function loadVectorStore(): Promise<VectorStoreItem[]> {
  const filePath = path.join(process.cwd(), 'data', 'vectorStore.json');
  
  try {
    console.log(`Loading vector store from ${filePath}`);
    const fileData = await fs.readFile(filePath, 'utf8');
    const parsedData = JSON.parse(fileData);
    
    if (Array.isArray(parsedData)) {
      console.log(`Loaded ${parsedData.length} items from vector store`);
      return parsedData;
    } else if (parsedData.items && Array.isArray(parsedData.items)) {
      console.log(`Loaded ${parsedData.items.length} items from vector store`);
      return parsedData.items;
    } else {
      console.error('Vector store data is not in expected format');
      return [];
    }
  } catch (error) {
    console.error('Error loading vector store:', error);
    return [];
  }
}

/**
 * Calculate and save corpus statistics
 */
async function main() {
  try {
    // Load vector store
    const vectorStore = await loadVectorStore();
    
    if (vectorStore.length === 0) {
      console.error('Vector store is empty or could not be loaded');
      process.exit(1);
    }
    
    // Calculate corpus statistics
    const corpusStats = await calculateCorpusStatistics(vectorStore);
    
    // Save corpus statistics
    await saveCorpusStatistics(corpusStats);
    
    console.log('Corpus statistics calculation complete');
    console.log(`Total documents: ${corpusStats.totalDocuments}`);
    console.log(`Average document length: ${corpusStats.averageDocumentLength.toFixed(2)} words`);
    console.log(`Unique terms: ${Object.keys(corpusStats.documentFrequency).length}`);
    
    // Print most common terms
    if (corpusStats.mostCommonTerms && corpusStats.mostCommonTerms.length > 0) {
      console.log('\nMost common terms:');
      corpusStats.mostCommonTerms.forEach(({ term, count, percentage }) => {
        console.log(`- "${term}": appears in ${count} documents (${percentage.toFixed(2)}%)`);
      });
    }
    
  } catch (error) {
    console.error('Error calculating corpus statistics:', error);
    process.exit(1);
  }
}

// Run the script
main(); 