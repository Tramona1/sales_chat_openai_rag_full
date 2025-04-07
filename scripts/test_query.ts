/**
 * Test Query Script
 * 
 * This script tests the enhanced query system with sample queries to demonstrate
 * the reranking and query routing functionality.
 */

import { routeQuery } from '../utils/queryRouter';
import { initializeHybridSearch } from '../utils/hybridSearch';

const testQueries = [
  "What features does SalesBuddy offer?",
  "How much does the Professional plan cost?",
  "How do I authenticate API requests?",
  "What's included in the Enterprise plan?",
  "Tell me about SalesBuddy's CRM integration"
];

async function testQuerySystem() {
  try {
    console.log("Initializing hybrid search system...");
    await initializeHybridSearch();
    
    console.log("\n=== Testing Enhanced Query System ===\n");
    
    for (const query of testQueries) {
      console.log(`\n--- Query: "${query}" ---`);
      
      console.time('Query processing time');
      const result = await routeQuery(query, {
        useQueryExpansion: true,
        useReranking: true,
        debug: true
      });
      console.timeEnd('Query processing time');
      
      console.log(`\nQuery analysis:`, {
        primaryCategory: result.queryAnalysis.primaryCategory,
        queryType: result.queryAnalysis.queryType,
        technicalLevel: result.queryAnalysis.technicalLevel
      });
      
      console.log(`\nProcessing times:`, {
        analysis: `${result.processingTime.analysis}ms`,
        expansion: result.processingTime.expansion ? `${result.processingTime.expansion}ms` : 'n/a',
        search: `${result.processingTime.search}ms`,
        reranking: result.processingTime.reranking ? `${result.processingTime.reranking}ms` : 'n/a',
        total: `${result.processingTime.total}ms`
      });
      
      console.log(`\nFound ${result.results.length} results:`);
      
      // Display the top 2 results with scores and snippets
      const topResults = result.results.slice(0, 2);
      topResults.forEach((result, index) => {
        console.log(`\n[Result ${index + 1}]`);
        console.log(`Source: ${result.item.metadata?.source || 'unknown'}`);
        console.log(`Score: ${result.score.toFixed(4)}`);
        if (result.vectorScore !== undefined) {
          console.log(`Vector Score: ${result.vectorScore.toFixed(4)}`);
        }
        if (result.bm25Score !== undefined) {
          console.log(`BM25 Score: ${result.bm25Score.toFixed(4)}`);
        }
        
        // Display a snippet of the text
        const text = result.item.text;
        const snippet = text.length > 200 
          ? text.substring(0, 200) + '...' 
          : text;
        console.log(`Snippet: "${snippet}"`);
      });
      
      console.log("\n-----------------------------------\n");
    }
    
    console.log("Testing completed!");
    
  } catch (error) {
    console.error("Error testing query system:", error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testQuerySystem()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testQuerySystem }; 