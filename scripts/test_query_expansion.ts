/**
 * Test script for query expansion
 * 
 * This script demonstrates and evaluates the query expansion functionality,
 * showing how different query types are expanded using both semantic and
 * keyword-based techniques.
 */

import { expandQuery, QueryExpansionOptions } from '../utils/queryExpansion';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test queries covering different domains and complexity
const TEST_QUERIES = [
  "What is the pricing for enterprise customers?",
  "How does the security system work?",
  "Compare your product to competitors",
  "Do you offer educational discounts?",
  "What technical integrations are available?",
  "Tell me about your customer support",
  "How can I upgrade my subscription?",
  "What features are included in the basic plan?"
];

// Configuration options for testing
const testConfig: Partial<QueryExpansionOptions> = {
  maxExpandedTerms: 5,
  useSemanticExpansion: true,
  useKeywordExpansion: true,
  includeMetadata: true,
  debug: true
};

/**
 * Run expansion tests for all queries
 */
async function runExpansionTests() {
  console.log('Starting query expansion tests...');
  console.log('='.repeat(80));
  
  for (const query of TEST_QUERIES) {
    console.log(`\nTesting query: "${query}"`);
    console.log('-'.repeat(40));
    
    try {
      // Test with both semantic and keyword expansion
      console.log('With both semantic and keyword expansion:');
      const hybridResult = await expandQuery(query, {
        ...testConfig,
        useSemanticExpansion: true,
        useKeywordExpansion: true
      });
      
      console.log(`Original: "${hybridResult.originalQuery}"`);
      console.log(`Expanded: "${hybridResult.expandedQuery}"`);
      console.log(`Added terms: ${hybridResult.addedTerms.join(', ')}`);
      console.log(`Expansion type: ${hybridResult.expansionType}`);
      if (hybridResult.technicalLevel) {
        console.log(`Technical level: ${hybridResult.technicalLevel}/5`);
      }
      if (hybridResult.domainContext) {
        console.log(`Domain context: ${hybridResult.domainContext}`);
      }
      
      // Test with only semantic expansion
      console.log('\nWith only semantic expansion:');
      const semanticResult = await expandQuery(query, {
        ...testConfig,
        useSemanticExpansion: true,
        useKeywordExpansion: false
      });
      console.log(`Added terms: ${semanticResult.addedTerms.join(', ')}`);
      
      // Test with only keyword expansion
      console.log('\nWith only keyword expansion:');
      const keywordResult = await expandQuery(query, {
        ...testConfig,
        useSemanticExpansion: false,
        useKeywordExpansion: true
      });
      console.log(`Added terms: ${keywordResult.addedTerms.join(', ')}`);
      
    } catch (error) {
      console.error(`Error expanding query "${query}":`, error);
    }
    
    console.log('='.repeat(80));
  }
  
  console.log('\nAll expansion tests completed.');
}

/**
 * Test performance impact of query expansion
 */
async function testPerformanceImpact() {
  console.log('\nTesting performance impact...');
  console.log('-'.repeat(40));
  
  const testQuery = "What is the pricing for enterprise customers?";
  
  // Measure time for semantic expansion
  console.log(`Testing query: "${testQuery}"`);
  
  const startSemantic = Date.now();
  await expandQuery(testQuery, {
    useSemanticExpansion: true,
    useKeywordExpansion: false,
    includeMetadata: false
  });
  const semanticTime = Date.now() - startSemantic;
  
  // Measure time for keyword expansion
  const startKeyword = Date.now();
  await expandQuery(testQuery, {
    useSemanticExpansion: false,
    useKeywordExpansion: true,
    includeMetadata: false
  });
  const keywordTime = Date.now() - startKeyword;
  
  // Measure time for hybrid expansion
  const startHybrid = Date.now();
  await expandQuery(testQuery, {
    useSemanticExpansion: true,
    useKeywordExpansion: true,
    includeMetadata: true
  });
  const hybridTime = Date.now() - startHybrid;
  
  console.log('Performance results:');
  console.log(`- Semantic expansion: ${semanticTime}ms`);
  console.log(`- Keyword expansion: ${keywordTime}ms`);
  console.log(`- Hybrid expansion: ${hybridTime}ms`);
}

/**
 * Main function to run all tests
 */
async function main() {
  try {
    // Run expansion tests
    await runExpansionTests();
    
    // Run performance tests
    await testPerformanceImpact();
    
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 