/**
 * Test script for retrieving company-specific information
 * This script tests if our RAG system can answer basic company questions
 */

import { performHybridSearch } from '../utils/hybridSearch';
import { generateAnswer, SearchResultItem } from '../utils/answerGenerator';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Sample test queries that cover different aspects
const COMPANY_QUESTIONS = [
  "What is the name of our company?",
  "What are our product pricing tiers?",
  "What is Workstream?",
  "What are the main features of our product?",
  "Who are our clients?",
  "What kind of results do our customers typically report?"
];

/**
 * Run tests for all company-specific queries
 */
async function runTests() {
  console.log('Testing company-specific question answering...');
  console.log('===========================================\n');

  try {
    // Process each test query
    for (const query of COMPANY_QUESTIONS) {
      console.log(`\n==== TESTING COMPANY QUERY: "${query}" ====\n`);
      
      // 1. Run hybrid search with a strong emphasis on BM25 term matching (0.3)
      // Using a lower hybrid ratio emphasizes keyword matching over vector similarity
      console.log('Running hybrid search with BM25 emphasis...');
      const searchResults = await performHybridSearch(query, 5, 0.3);
      
      console.log(`Found ${searchResults.length} results for hybrid search`);
      
      if (searchResults.length > 0) {
        console.log('\nTop retrieved document:');
        console.log(`Source: ${searchResults[0].item.metadata?.source || 'Unknown'}`);
        console.log(`Excerpt: ${searchResults[0].item.text.substring(0, 150)}...\n`);
      } else {
        console.log('No search results found!\n');
      }
      
      // 2. Generate an answer
      console.log('Generating answer...');
      
      const formattedResults: SearchResultItem[] = searchResults.map(result => ({
        text: result.item.text,
        source: result.item.metadata?.source || 'Unknown',
        metadata: result.item.metadata,
        relevanceScore: result.score
      }));
      
      const answer = await generateAnswer(query, formattedResults, {
        includeSourceCitations: true,
        maxSourcesInAnswer: 3
      });
      
      console.log('\nAnswer:');
      console.log(answer);
      
      console.log('\n---------------------------------------');
    }
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests().catch(console.error); 