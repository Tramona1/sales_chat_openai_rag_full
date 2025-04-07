/**
 * Test Reranking Module
 * 
 * This script tests the reranking module to improve search result ordering.
 */

import { rerank, RerankResult } from '../utils/reranking';
import { HybridSearchResult } from '../utils/hybridSearch';

// Sample test results
const mockSearchResults: HybridSearchResult[] = [
  // Create mock results here
];

// Test the reranking functionality
async function testReranking() {
  try {
    console.log('Testing reranking...');
    
    // Generate some mock search results
    const mockResults = generateMockResults();
    
    console.log(`Original results: ${mockResults.length}`);
    mockResults.slice(0, 3).forEach((result, i) => {
      console.log(`[${i+1}] ${result.item.metadata?.source || 'Unknown'} - Score: ${result.score.toFixed(4)}`);
    });
    
    // Test basic reranking
    console.log('\nTesting basic reranking...');
    const rerankedResults = await rerank(
      'What are the pricing options?',  // Test query
      mockResults,                      // Results to rerank
      5,                               // Top K results to return
      {
        model: 'gpt-3.5-turbo',        // Model to use
        timeoutMs: 5000,               // 5 second timeout
        includeExplanations: false      // Don't include explanations
      }
    );
    
    console.log(`Reranked results: ${rerankedResults.length}`);
    rerankedResults.slice(0, 3).forEach((result: HybridSearchResult, i: number) => {
      console.log(`[${i+1}] ${result.item.metadata?.source || 'Unknown'} - Score: ${result.score.toFixed(4)}`);
    });
    
    // Check if ranking changed
    const originalSources = mockResults.map(r => r.item.metadata?.source).slice(0, 3);
    const rerankedSources = rerankedResults.map((r: HybridSearchResult) => r.item.metadata?.source);
    
    console.log('\nRanking changes:');
    const movedUp = rerankedSources.filter((source: string | undefined, idx: number) => {
      const originalIdx = originalSources.indexOf(source);
      return originalIdx > idx;
    });
    
    console.log(`${movedUp.length} results moved up in ranking`);
    
    return true;
  } catch (error) {
    console.error('Error testing reranking:', error);
    return false;
  }
}

// Generate mock search results for testing
function generateMockResults(): HybridSearchResult[] {
  return [
    {
      item: {
        id: 'doc-1',
        text: 'Our pricing plans start at $10/month for the basic tier and go up to $50/month for premium.',
        embedding: new Array(10).fill(0),
        metadata: {
          source: 'pricing_page.md',
          category: 'pricing',
          technicalLevel: 1
        }
      },
      score: 0.85,
      bm25Score: 0.9,
      vectorScore: 0.8,
      metadata: {
        matchesCategory: true,
        categoryBoost: 1.2,
        technicalLevelMatch: 1.0
      }
    },
    {
      item: {
        id: 'doc-2',
        text: 'Product features include real-time analytics, user management, and API access.',
        embedding: new Array(10).fill(0),
        metadata: {
          source: 'features.md',
          category: 'features',
          technicalLevel: 2
        }
      },
      score: 0.78,
      bm25Score: 0.7,
      vectorScore: 0.85,
      metadata: {
        matchesCategory: false,
        categoryBoost: 1.0,
        technicalLevelMatch: 0.8
      }
    },
    {
      item: {
        id: 'doc-3',
        text: 'Enterprise plans offer customized pricing based on your organization\'s needs. Contact sales for details.',
        embedding: new Array(10).fill(0),
        metadata: {
          source: 'enterprise.md',
          category: 'pricing',
          technicalLevel: 2
        }
      },
      score: 0.72,
      bm25Score: 0.75,
      vectorScore: 0.70,
      metadata: {
        matchesCategory: true,
        categoryBoost: 1.2,
        technicalLevelMatch: 0.9
      }
    },
    {
      item: {
        id: 'doc-4',
        text: 'Our support team is available 24/7 to help with any questions.',
        embedding: new Array(10).fill(0),
        metadata: {
          source: 'support.md',
          category: 'support',
          technicalLevel: 1
        }
      },
      score: 0.65,
      bm25Score: 0.6,
      vectorScore: 0.70,
      metadata: {
        matchesCategory: false,
        categoryBoost: 1.0,
        technicalLevelMatch: 1.0
      }
    },
    {
      item: {
        id: 'doc-5',
        text: 'Compare pricing plans side by side to see which one fits your needs.',
        embedding: new Array(10).fill(0),
        metadata: {
          source: 'pricing_comparison.md',
          category: 'pricing',
          technicalLevel: 1
        }
      },
      score: 0.60,
      bm25Score: 0.65,
      vectorScore: 0.55,
      metadata: {
        matchesCategory: true,
        categoryBoost: 1.2,
        technicalLevelMatch: 1.0
      }
    }
  ];
}

// Run the test if this script is executed directly
if (require.main === module) {
  testReranking()
    .then(success => {
      if (success) {
        console.log('\nReranking test completed successfully!');
      } else {
        console.error('\nReranking test failed.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
} 