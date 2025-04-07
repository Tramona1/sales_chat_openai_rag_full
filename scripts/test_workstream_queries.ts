/**
 * Workstream Real Queries Test
 * 
 * This script tests the hybrid search system with real Workstream-specific questions
 * rather than generic mock data. These questions are designed to test the system's
 * ability to retrieve relevant information from the processed Workstream data.
 */

import { routeQuery } from '../utils/queryRouter';
import { initializeHybridSearch } from '../utils/hybridSearch';

// Real Workstream-specific queries
const workstreamQueries = [
  "What features does Workstream offer for hourly hiring?",
  "How does Workstream help with employee onboarding?",
  "What are the benefits of using Workstream for restaurant hiring?",
  "Can Workstream integrate with other HR systems?",
  "How does Workstream's text-to-apply feature work?",
  "What makes Workstream different from other HR platforms?",
  "How does Workstream help franchise owners?",
  "What industries does Workstream primarily serve?",
  "Does Workstream offer payroll services?",
  "How can Workstream reduce my time-to-hire?"
];

async function testWorkstreamQueries() {
  try {
    console.log("Initializing hybrid search system...");
    await initializeHybridSearch();
    
    console.log("\n=== Testing Real Workstream Queries ===\n");
    
    for (const query of workstreamQueries) {
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
      
      // Display the top 3 results with scores and snippets
      const topResults = result.results.slice(0, 3);
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
        const snippet = text.length > 250 
          ? text.substring(0, 250) + '...' 
          : text;
        console.log(`Snippet: "${snippet}"`);
      });
      
      console.log("\n-----------------------------------\n");
    }
    
    console.log("Testing completed!");
    
  } catch (error) {
    console.error("Error testing Workstream queries:", error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testWorkstreamQueries()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testWorkstreamQueries }; 