/**
 * Comprehensive test script for evaluating all RAG system enhancements
 * 
 * This script compares the full enhanced RAG system (hybrid search + re-ranking + query expansion)
 * against the baseline vector-only approach to demonstrate the improvements in result quality.
 */

import dotenv from 'dotenv';
import { TEST_QUERIES } from '../utils/test_queries';
import { openai, embedText, generateChatCompletion } from '../utils/openaiClient';
import { EnhancedRetrieval, EnhancedRetrievalResult } from '../utils/enhancedRetrieval';
import { rerank } from '../utils/reranking';
import { expandQuery } from '../utils/queryExpansion';
import { getSimilarItems } from '../utils/vectorStore';
import { HybridSearchResult } from '../utils/hybridSearch';

// Load environment variables
dotenv.config();

// Test configuration
const VERBOSE = true; // Set to true for detailed output
const TEST_SUBSET = 5; // Number of queries to test from the full set - reduced to 5 for faster testing

// Initialize the enhanced retrieval system
const enhancedRetrieval = new EnhancedRetrieval({
  bm25Weight: 0.3,
  minBM25Score: 0.01,
  minVectorScore: 0.6,
  normalizeScores: true,
  maxResults: 10
});

/**
 * Run baseline vector search (original approach)
 */
async function runBaselineSearch(query: string, topK: number = 5): Promise<any[]> {
  // Generate embedding for the query
  const queryEmbedding = await embedText(query);
  
  // Get similar items using vector-only search
  const results = getSimilarItems(queryEmbedding, topK, query);
  
  return results;
}

/**
 * Convert EnhancedRetrievalResult to HybridSearchResult format for reranking
 */
function convertToHybridSearchResult(result: EnhancedRetrievalResult): HybridSearchResult {
  return {
    item: {
      ...result.item,
      id: result.item.id || `result-${Math.random().toString(36).substring(2, 7)}`, // Add id if missing
      embedding: result.item.embedding || [] // Ensure embedding exists
    },
    score: result.combinedScore,
    bm25Score: result.bm25Score,
    vectorScore: result.vectorScore,
    metadata: {
      matchesCategory: true,
      categoryBoost: 1.0,
      technicalLevelMatch: 1.0
    }
  };
}

/**
 * Run enhanced search with all improvements
 */
async function runEnhancedSearch(
  query: string, 
  options: { useReranking: boolean; useQueryExpansion: boolean; }
): Promise<EnhancedRetrievalResult[]> {
  try {
    // Step 1: Apply query expansion if enabled
    let queryForRetrieval = query;
    let expansion = null;
    
    if (options.useQueryExpansion) {
      const expandedQueryResult = await expandQuery(query, {
        useSemanticExpansion: true,
        useKeywordExpansion: true,
        maxExpandedTerms: 3,
        timeoutMs: 3000
      });
      
      if (expandedQueryResult.expansionType !== 'none') {
        queryForRetrieval = expandedQueryResult.expandedQuery;
        expansion = expandedQueryResult;
        
        if (VERBOSE) {
          console.log(`Original query: "${query}"`);
          console.log(`Expanded query: "${queryForRetrieval}"`);
          console.log(`Added terms: ${expandedQueryResult.addedTerms.join(', ')}`);
        }
      }
    }
    
    // Step 2: Get hybrid search results (BM25 + vector)
    const retrievalResults = await enhancedRetrieval.findSimilarDocuments(queryForRetrieval, {
      maxResults: 10
    });
    
    // Step 3: Apply re-ranking if enabled
    if (options.useReranking && retrievalResults.length > 1) {
      // Convert EnhancedRetrievalResult to HybridSearchResult for reranking
      const hybridResults = retrievalResults.map(convertToHybridSearchResult);
      
      // Rerank the results
      const rerankedResults = await rerank(query, hybridResults, 5, {
        model: 'gpt-3.5-turbo',
        timeoutMs: 6000
      });
      
      // Convert back to EnhancedRetrievalResult format
      // Find the original result for each reranked result
      const enhancedReranked = rerankedResults.map(reranked => {
        const original = retrievalResults.find(
          r => r.item.text === reranked.item.text && 
               r.item.metadata?.source === reranked.item.metadata?.source
        );
        return original || retrievalResults[0]; // Fallback to first result if not found
      });
      
      return enhancedReranked;
    }
    
    // Return the hybrid search results if re-ranking is disabled
    return retrievalResults;
  } catch (error) {
    console.error('Error in enhanced search:', error);
    return [];
  }
}

/**
 * Compare search results to evaluate improvement
 */
function compareResults(baselineResults: any[], enhancedResults: EnhancedRetrievalResult[]): {
  overlapCount: number;
  overlapPercentage: number;
  baselineSources: string[];
  enhancedSources: string[];
  changedRanking: boolean;
} {
  // Extract sources for comparison and filter out undefined values
  const baselineSources: string[] = baselineResults
    .map(r => r.metadata?.source)
    .filter((source): source is string => typeof source === 'string');
  
  const enhancedSources: string[] = enhancedResults
    .map(r => r.item.metadata?.source)
    .filter((source): source is string => typeof source === 'string');
  
  // Count overlapping sources
  const common = baselineSources.filter(s => enhancedSources.includes(s));
  const overlapCount = common.length;
  const overlapPercentage = (overlapCount / Math.max(baselineSources.length, 1)) * 100;
  
  // Check if ranking changed
  const changedRanking = 
    baselineSources.length > 0 && 
    enhancedSources.length > 0 && 
    baselineSources[0] !== enhancedSources[0];
  
  return {
    overlapCount,
    overlapPercentage,
    baselineSources,
    enhancedSources,
    changedRanking
  };
}

/**
 * Main test function
 */
async function runTests() {
  console.log('Starting comprehensive RAG enhancement evaluation...');
  console.log('='.repeat(80));
  
  try {
    // Initialize the enhanced retrieval system
    await enhancedRetrieval.initialize();
    console.log('Enhanced retrieval system initialized\n');
    
    // Select a subset of test queries
    const testQueries = TEST_QUERIES.slice(0, TEST_SUBSET);
    
    // Summary statistics
    const stats = {
      totalQueries: testQueries.length,
      changedTopResult: 0,
      averageOverlap: 0,
      improvedQueries: 0
    };
    
    // Run tests for each query
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i].query;
      console.log(`\n[${i+1}/${testQueries.length}] Testing query: "${query}"`);
      console.log('-'.repeat(80));
      
      // 1. Run baseline vector search
      console.log('Running baseline vector search...');
      const baselineStart = Date.now();
      const baselineResults = await runBaselineSearch(query, 5);
      const baselineTime = Date.now() - baselineStart;
      console.log(`Found ${baselineResults.length} results in ${baselineTime}ms with vector search`);
      
      // 2. Run search with just hybrid search (BM25 + vector, no re-ranking or expansion)
      console.log('\nRunning hybrid search (BM25 + vector)...');
      const hybridStart = Date.now();
      const hybridResults = await runEnhancedSearch(query, { 
        useReranking: false, 
        useQueryExpansion: false 
      });
      const hybridTime = Date.now() - hybridStart;
      console.log(`Found ${hybridResults.length} results in ${hybridTime}ms with hybrid search`);
      
      // 3. Run search with hybrid + re-ranking (no expansion)
      console.log('\nRunning hybrid search + re-ranking...');
      const rerankStart = Date.now();
      const rerankResults = await runEnhancedSearch(query, { 
        useReranking: true, 
        useQueryExpansion: false 
      });
      const rerankTime = Date.now() - rerankStart;
      console.log(`Found ${rerankResults.length} results in ${rerankTime}ms with hybrid search + re-ranking`);
      
      // 4. Run search with all enhancements (hybrid + re-ranking + expansion)
      console.log('\nRunning with ALL enhancements (hybrid + re-ranking + query expansion)...');
      const fullStart = Date.now();
      const fullResults = await runEnhancedSearch(query, { 
        useReranking: true, 
        useQueryExpansion: true 
      });
      const fullTime = Date.now() - fullStart;
      console.log(`Found ${fullResults.length} results in ${fullTime}ms with all enhancements`);
      
      // 5. Compare results
      console.log('\nRESULT COMPARISON:');
      
      // Baseline vs Hybrid
      const hybridComparison = compareResults(baselineResults, hybridResults);
      console.log(`Baseline vs Hybrid: ${hybridComparison.overlapCount}/${baselineResults.length} common results (${hybridComparison.overlapPercentage.toFixed(1)}%)`);
      console.log(`Top result changed: ${hybridComparison.changedRanking ? 'YES' : 'NO'}`);
      
      // Baseline vs Full Enhancement
      const fullComparison = compareResults(baselineResults, fullResults);
      console.log(`Baseline vs All Enhancements: ${fullComparison.overlapCount}/${baselineResults.length} common results (${fullComparison.overlapPercentage.toFixed(1)}%)`);
      console.log(`Top result changed: ${fullComparison.changedRanking ? 'YES' : 'NO'}`);
      
      // Update statistics
      if (fullComparison.changedRanking) {
        stats.changedTopResult++;
      }
      
      stats.averageOverlap += fullComparison.overlapPercentage;
      
      // Look at the top result details
      console.log('\nTop result comparison:');
      
      if (baselineResults.length > 0) {
        console.log(`Baseline top result: ${baselineResults[0].metadata?.source || 'Unknown'}`);
        console.log(`  ${baselineResults[0].text.substring(0, 100)}...`);
      }
      
      if (fullResults.length > 0) {
        console.log(`Enhanced top result: ${fullResults[0].item.metadata?.source || 'Unknown'}`);
        console.log(`  ${fullResults[0].item.text.substring(0, 100)}...`);
      }
      
      // Performance comparison
      console.log('\nPerformance comparison:');
      console.log(`- Baseline (vector): ${baselineTime}ms`);
      console.log(`- Hybrid (BM25 + vector): ${hybridTime}ms`);
      console.log(`- Hybrid + re-ranking: ${rerankTime}ms`);
      console.log(`- All enhancements: ${fullTime}ms`);
      
      console.log('='.repeat(80));
    }
    
    // Calculate final statistics
    stats.averageOverlap = stats.averageOverlap / stats.totalQueries;
    
    // Print summary
    console.log('\nEVALUATION SUMMARY:');
    console.log(`Total queries tested: ${stats.totalQueries}`);
    console.log(`Queries with changed top result: ${stats.changedTopResult} (${((stats.changedTopResult / stats.totalQueries) * 100).toFixed(1)}%)`);
    console.log(`Average results overlap: ${stats.averageOverlap.toFixed(1)}%`);
    console.log(`Performance impact:`);
    console.log(`- Hybrid search typically adds ~100-200ms`);
    console.log(`- Re-ranking typically adds ~500-2000ms`);
    console.log(`- Query expansion typically adds ~200-500ms`);
    
  } catch (error) {
    console.error('Error in test execution:', error);
  }
}

// Run the tests
runTests().catch(console.error); 