/**
 * Test script for BM25 implementation
 * This demonstrates the BM25 scoring functionality on sample queries
 */

import { loadCorpusStatistics, calculateBM25Score } from '../utils/bm25';
import { tokenize } from '../utils/tokenization';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { VectorStoreItem } from '../utils/vectorStore';

// Load environment variables
dotenv.config();

/**
 * Load the vector store content
 */
async function loadVectorStore(): Promise<VectorStoreItem[]> {
  try {
    // Try loading from single vectorStore.json file
    const singleStoreFile = path.join(process.cwd(), 'data', 'vectorStore.json');
    const fileExists = await fs.access(singleStoreFile).then(() => true).catch(() => false);
    
    if (fileExists) {
      const fileData = await fs.readFile(singleStoreFile, 'utf8');
      const parsedData = JSON.parse(fileData);
      
      if (Array.isArray(parsedData)) {
        return parsedData;
      } else if (parsedData.items && Array.isArray(parsedData.items)) {
        return parsedData.items;
      }
    }
    
    console.log('No vector store file found or empty store');
    return [];
  } catch (error) {
    console.error('Error loading vector store:', error);
    return [];
  }
}

/**
 * Run a search query using BM25
 */
async function searchBM25(query: string, limit: number = 5): Promise<Array<{item: VectorStoreItem, score: number}>> {
  try {
    // Load corpus statistics
    const corpusStats = await loadCorpusStatistics();
    
    // Load vector store
    const vectorStore = await loadVectorStore();
    
    console.log(`Loaded ${vectorStore.length} documents and corpus statistics with ${Object.keys(corpusStats.documentFrequency).length} terms`);
    
    // Calculate BM25 scores for each item
    console.log(`Calculating BM25 scores for query: "${query}"`);
    console.log(`Tokenized query: [${tokenize(query).join(', ')}]`);
    
    const scoredItems = vectorStore.map(item => ({
      item,
      score: calculateBM25Score(query, { id: item.metadata?.source || 'unknown', text: item.text }, corpusStats)
    }));
    
    // Sort by score (descending)
    const sortedItems = scoredItems.sort((a, b) => b.score - a.score);
    
    // Take top results
    return sortedItems.slice(0, limit);
  } catch (error) {
    console.error('Error searching with BM25:', error);
    return [];
  }
}

/**
 * Main function to test BM25 search
 */
async function testBM25() {
  console.log('Testing BM25 scoring...');
  
  // Define some test queries
  const queries = [
    'What is the pricing for enterprise customers?',
    'How does your platform handle security?',
    'What makes your product better than competitors?',
    'Do you offer discounts for non-profits?',
    'Tell me about your customer support options'
  ];
  
  // Run each query
  for (const query of queries) {
    console.log('\n===============================================');
    console.log(`QUERY: ${query}`);
    console.log('===============================================');
    
    const results = await searchBM25(query, 3);
    
    // Display results
    if (results.length === 0) {
      console.log('No results found');
    } else {
      results.forEach((result, index) => {
        console.log(`\nRESULT ${index + 1} - Score: ${result.score.toFixed(4)}`);
        console.log(`Source: ${result.item.metadata?.source || 'unknown'}`);
        console.log(`Text: ${result.item.text.substring(0, 300)}${result.item.text.length > 300 ? '...' : ''}`);
      });
    }
  }
}

// Run the test
testBM25().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 