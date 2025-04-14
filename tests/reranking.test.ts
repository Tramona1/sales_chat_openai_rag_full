import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  rerankWithGemini, 
  MultiModalRerankOptions, 
  MultiModalSearchResult,
  RankedSearchResult,
  VisualContent
} from '../utils/reranking';
import { analyzeVisualQuery } from '../utils/queryAnalysis';

// Mock dependencies
vi.mock('../utils/queryAnalysis', () => ({
  analyzeVisualQuery: vi.fn().mockImplementation((query: string) => {
    if (query.toLowerCase().includes('image') || query.toLowerCase().includes('chart') || query.toLowerCase().includes('diagram')) {
      return {
        isVisualQuery: true,
        visualTypes: ['image', 'chart'].filter(type => query.toLowerCase().includes(type)),
        confidence: 0.9,
        explicitVisualRequest: true
      };
    }
    return {
      isVisualQuery: false,
      visualTypes: [],
      confidence: 0.1,
      explicitVisualRequest: false
    };
  })
}));

vi.mock('../utils/geminiClient', () => ({
  generateStructuredGeminiResponse: vi.fn().mockResolvedValue([
    { id: 0, score: 9.5, reason: "Highly relevant with visual content" },
    { id: 1, score: 8.2, reason: "Good match with relevant information" },
    { id: 2, score: 6.7, reason: "Somewhat relevant but lacking details" }
  ])
}));

describe('Multi-Modal Reranking System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rerankWithGemini function', () => {
    it('should rerank results for text-based queries', async () => {
      const query = "How does our product compare to competitors?";
      const results: MultiModalSearchResult[] = [
        {
          item: { 
            id: '1', 
            text: 'Our product is superior to competitors in terms of AI capabilities', 
            metadata: {}
          },
          score: 0.8
        },
        {
          item: { 
            id: '2', 
            text: 'Comparison of features shows we excel in performance', 
            metadata: {}
          },
          score: 0.7
        }
      ];
      
      const rerankedResults = await rerankWithGemini(query, results);
      
      expect(rerankedResults).toBeDefined();
      expect(rerankedResults.length).toBe(2);
      expect(rerankedResults[0].item.metadata.rerankScore).toBeDefined();
    });

    it('should handle visual queries differently', async () => {
      const query = "Show me a chart of our sales performance";
      const results: MultiModalSearchResult[] = [
        {
          item: { 
            id: '1', 
            text: 'Sales performance data for Q1-Q4', 
            metadata: {},
            visualContent: {
              type: 'chart',
              description: 'Bar chart showing quarterly sales performance'
            }
          },
          score: 0.65
        },
        {
          item: { 
            id: '2', 
            text: 'Overall company performance metrics', 
            metadata: {}
          },
          score: 0.8
        }
      ];
      
      const options: MultiModalRerankOptions = {
        useVisualContext: true,
        visualFocus: true,
        visualTypes: ['chart']
      };
      
      const rerankedResults = await rerankWithGemini(query, results, options);
      
      // Visual query analysis should be detected
      expect(analyzeVisualQuery).toHaveBeenCalledWith(query);
      
      // Visual content should be preferred in rankings
      expect(rerankedResults[0].item.id).toBe('1');
      expect(rerankedResults[0].item.metadata.rerankScore).toBeGreaterThan(
        rerankedResults[1].item.metadata.rerankScore || 0
      );
    });

    it('should fall back to heuristic reranking on timeout', async () => {
      // Override the mock to simulate a timeout
      vi.mocked(generateStructuredGeminiResponse).mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(null), 2000);
        });
      });
      
      const query = "Show me images of product demos";
      const results: MultiModalSearchResult[] = [
        {
          item: { 
            id: '1', 
            text: 'Product demo screenshots', 
            metadata: {},
            visualContent: {
              type: 'image',
              description: 'Screenshots of the product in action'
            }
          },
          score: 0.7
        },
        {
          item: { 
            id: '2', 
            text: 'Product specifications and details', 
            metadata: {}
          },
          score: 0.8
        }
      ];
      
      const options: MultiModalRerankOptions = {
        useVisualContext: true,
        timeoutMs: 100 // Very short timeout to trigger fallback
      };
      
      const rerankedResults = await rerankWithGemini(query, results, options);
      
      // Should still get results despite timeout
      expect(rerankedResults).toBeDefined();
      expect(rerankedResults.length).toBe(2);
      
      // Image content should be boosted due to fallback heuristics
      expect(rerankedResults[0].item.id).toBe('1');
    });
    
    it('should correctly extract visual context from different formats', async () => {
      const query = "Show me diagrams of system architecture";
      
      // Test multiple visual content formats
      const results: MultiModalSearchResult[] = [
        {
          item: { 
            id: '1', 
            text: 'Architecture overview', 
            metadata: {},
            visualContent: [
              {
                type: 'diagram',
                description: 'System architecture diagram',
                extractedText: 'Component A -> Component B -> Component C'
              },
              {
                type: 'diagram',
                description: 'Detailed component view'
              }
            ]
          },
          score: 0.7
        },
        {
          item: { 
            id: '2', 
            text: 'Architecture documentation', 
            metadata: {
              isVisualElement: true,
              visualElementType: 'diagram'
            }
          },
          score: 0.6
        },
        {
          item: { 
            id: '3', 
            text: 'Plain text without visuals', 
            metadata: {}
          },
          score: 0.9
        }
      ];
      
      const rerankedResults = await rerankWithGemini(query, results);
      
      // Diagrams should be prioritized
      expect(rerankedResults[0].item.id).toBe('1');
      expect(rerankedResults[1].item.id).toBe('2');
      expect(rerankedResults[2].item.id).toBe('3');
      
      // All results should have rerank scores
      rerankedResults.forEach(result => {
        expect(result.item.metadata.rerankScore).toBeDefined();
      });
    });
  });
}); 