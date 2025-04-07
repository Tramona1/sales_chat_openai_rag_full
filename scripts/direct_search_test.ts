/**
 * Direct Search Test
 * 
 * This script tests the hybrid search system directly without filters
 * to diagnose issues with search results.
 */

import {
  performHybridSearch,
  initializeHybridSearch
} from '../utils/hybridSearch';

// Test queries
const testQueries = [
  "What features does SalesBuddy offer?",
  "How much does the Professional plan cost?",
  "How do I authenticate API requests?",
  "What's included in the Enterprise plan?",
  "Tell me about SalesBuddy's CRM integration"
];

async function runDirectSearchTest() {
  try {
    console.log("Initializing hybrid search system...");
    await initializeHybridSearch();
    
    console.log("\n=== Testing Direct Hybrid Search ===\n");
    
    for (const query of testQueries) {
      console.log(`\n--- Query: "${query}" ---`);
      
      // Direct search without filters
      console.time('Search time');
      const results = await performHybridSearch(
        query, 
        10,     // Get up to 10 results
        0.5,    // Equal hybrid ratio
        undefined // No filters
      );
      console.timeEnd('Search time');
      
      console.log(`\nFound ${results.length} results`);
      
      if (results.length > 0) {
        // Display detailed results
        results.forEach((result, index) => {
          console.log(`\n[Result ${index + 1}]`);
          console.log(`Source: ${result.item.metadata?.source || 'unknown'}`);
          console.log(`Score: ${result.score.toFixed(4)}`);
          
          if (result.bm25Score !== undefined) {
            console.log(`BM25 Score: ${result.bm25Score.toFixed(4)}`);
          }
          
          if (result.vectorScore !== undefined) {
            console.log(`Vector Score: ${result.vectorScore.toFixed(4)}`);
          }
          
          // Log metadata details
          if (result.item.metadata) {
            console.log(`Metadata:`, JSON.stringify(result.item.metadata, null, 2));
          }
          
          // Display a snippet of the text
          const text = result.item.text;
          const snippet = text.length > 150 
            ? text.substring(0, 150) + '...' 
            : text;
          console.log(`Snippet: "${snippet}"`);
        });
      } else {
        console.log("No results found");
      }
      
      console.log("\n-------------------------------\n");
    }
    
    console.log("Testing completed!");
    
  } catch (error) {
    console.error("Error in direct search test:", error);
  }
}

// Run the test
if (require.main === module) {
  runDirectSearchTest()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { runDirectSearchTest }; 