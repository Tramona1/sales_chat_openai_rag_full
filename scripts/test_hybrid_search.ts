/**
 * Test script for the hybrid BM25 + vector search implementation
 * This script runs some sample queries through the enhanced retrieval system
 * and compares the results to a regular vector search.
 */

import { EnhancedRetrieval } from '../utils/enhancedRetrieval';
import { getSimilarItems } from '../utils/vectorStore';
import { embedText } from '../utils/openaiClient';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Sample test queries that cover different aspects
const TEST_QUERIES = [
  "What is the pricing for enterprise customers?",
  "How does your platform handle security concerns?",
  "What makes your product better than competitors?",
  "Do you offer any discounts for non-profits?",
  "Tell me about your customer support options",
  "What are the main features of your product?"
];

// Initialize the enhanced retrieval system
const enhancedRetrieval = new EnhancedRetrieval({
  bm25Weight: 0.3,
  minBM25Score: 0.01,
  minVectorScore: 0.6,
  normalizeScores: true,
  maxResults: 5,
  debug: true
});

/**
 * Run tests for all queries
 */
async function runTests() {
  console.log('Starting hybrid search tests...');
  console.log('===============================\n');

  try {
    // Initialize the enhanced retrieval system
    await enhancedRetrieval.initialize();
    console.log('Enhanced retrieval system initialized\n');

    // Process each test query
    for (const query of TEST_QUERIES) {
      console.log(`\n==== TESTING QUERY: "${query}" ====\n`);

      // 1. Get embedding for the query
      console.log('Generating embedding...');
      const embedding = await embedText(query);
      
      // 2. Run pure vector search as baseline
      console.log('\nRunning vector-only search...');
      const vectorResults = getSimilarItems(embedding, 5, query);
      
      console.log(`Found ${vectorResults.length} results with vector search`);
      console.log('Top 3 vector search results:');
      vectorResults.slice(0, 3).forEach((result, i) => {
        console.log(`\n[${i+1}] Score: ${result.score.toFixed(4)} | Source: ${result.metadata?.source || 'Unknown'}`);
        console.log(`  ${result.text.substring(0, 150)}...`);
      });
      
      // 3. Run hybrid search
      console.log('\nRunning hybrid BM25 + vector search...');
      const hybridResults = await enhancedRetrieval.findSimilarDocuments(query, {
        debug: true,
        maxResults: 5
      });
      
      console.log(`Found ${hybridResults.length} results with hybrid search`);
      console.log('Top 3 hybrid search results:');
      hybridResults.slice(0, 3).forEach((result, i) => {
        console.log(`\n[${i+1}] Combined Score: ${result.combinedScore.toFixed(4)} | BM25: ${result.bm25Score.toFixed(4)} | Vector: ${result.vectorScore.toFixed(4)}`);
        console.log(`  Source: ${result.item.metadata?.source || 'Unknown'}`);
        console.log(`  ${result.item.text.substring(0, 150)}...`);
      });
      
      // 4. Compare results
      console.log('\nComparison of top results:');
      
      // Check if top result sources are the same
      const topVectorSource = vectorResults[0]?.metadata?.source;
      const topHybridSource = hybridResults[0]?.item.metadata?.source;
      
      if (topVectorSource === topHybridSource) {
        console.log(`✓ SAME top result source: ${topVectorSource}`);
      } else {
        console.log(`✗ DIFFERENT top result sources:`);
        console.log(`  - Vector: ${topVectorSource}`);
        console.log(`  - Hybrid: ${topHybridSource}`);
      }
      
      // Calculate overlap in top 3 results
      const vectorSources = vectorResults.slice(0, 3).map(r => r.metadata?.source).filter(Boolean);
      const hybridSources = hybridResults.slice(0, 3).map(r => r.item.metadata?.source).filter(Boolean);
      
      const common = vectorSources.filter(s => hybridSources.includes(s));
      console.log(`Overlap in top 3 results: ${common.length}/3 (${((common.length / 3) * 100).toFixed(1)}%)`);
      
      console.log('\n---------------------------------------');
    }
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests().catch(console.error); 