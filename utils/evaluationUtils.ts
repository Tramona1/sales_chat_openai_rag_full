/**
 * Evaluation Utilities for RAG System
 * 
 * This module provides utilities for evaluating and comparing 
 * different retrieval approaches.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { performHybridSearch, hybridSearch } from './hybridSearch';
import { 
  rerankWithGemini, 
  MultiModalSearchResult, 
  RankedSearchResult, 
  MultiModalRerankOptions 
} from './reranking';
import { generateAnswer } from './answerGenerator';
import { analyzeQuery, analyzeVisualQuery, LocalQueryAnalysis } from './queryAnalysis';
import { logError, logInfo } from './logger';
import { openai } from './llmProviders';

// Constants
const EVALUATION_DIR = path.join(process.cwd(), 'data', 'evaluation_results');
const QUERIES_FILE = path.join(EVALUATION_DIR, 'evaluation_queries.json');

// Make sure evaluation directory exists
if (!fs.existsSync(EVALUATION_DIR)) {
  fs.mkdirSync(EVALUATION_DIR, { recursive: true });
}

// Types for evaluation
export interface EvaluationQuery {
  id: string;
  query: string;
  expectedTopics?: string[];
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

export interface RetrievalResult {
  chunks: Array<{
    text: string;
    source: string;
    score: number;
    metadata: any;
  }>;
  elapsedTimeMs: number;
}

export interface ComparisonResult {
  id: string;
  query: EvaluationQuery;
  timestamp: string;
  traditional: {
    retrievalResults: RetrievalResult;
    answer: string;
    metrics: {
      precisionAt3: number;
      precisionAt5: number;
      recallAt5: number;
      mrr: number;
      answerScore: number;
    };
  };
  contextual: {
    retrievalResults: RetrievalResult;
    answer: string;
    metrics: {
      precisionAt3: number;
      precisionAt5: number;
      recallAt5: number;
      mrr: number;
      answerScore: number;
    };
  };
  winner: 'traditional' | 'contextual' | 'tie';
  evaluationNotes: string;
}

/**
 * Create and save a set of evaluation queries
 */
export function saveEvaluationQueries(queries: EvaluationQuery[]): void {
  // Add IDs if missing
  const queriesWithIds = queries.map(q => ({
    ...q,
    id: q.id || uuidv4()
  }));

  fs.writeFileSync(QUERIES_FILE, JSON.stringify(queriesWithIds, null, 2));
  console.log(`Saved ${queriesWithIds.length} evaluation queries`);
}

/**
 * Load evaluation queries from file
 */
export function loadEvaluationQueries(): EvaluationQuery[] {
  if (!fs.existsSync(QUERIES_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(QUERIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logError('Error loading evaluation queries', error);
    return [];
  }
}

/**
 * Add a single evaluation query
 */
export function addEvaluationQuery(query: EvaluationQuery): void {
  const queries = loadEvaluationQueries();
  
  // Add ID if missing
  if (!query.id) {
    query.id = uuidv4();
  }
  
  // Check for duplicates
  const existingIndex = queries.findIndex(q => q.id === query.id);
  if (existingIndex >= 0) {
    queries[existingIndex] = query;
  } else {
    queries.push(query);
  }
  
  saveEvaluationQueries(queries);
}

/**
 * Create a standard set of evaluation queries
 */
export function createStandardEvaluationSet(): EvaluationQuery[] {
  const standardQueries: EvaluationQuery[] = [
    {
      id: 'factual-pricing',
      query: 'What are the pricing tiers for your product?',
      expectedTopics: ['pricing', 'tiers', 'plans'],
      category: 'PRICING',
      difficulty: 'easy',
      tags: ['factual', 'pricing']
    },
    {
      id: 'factual-features',
      query: 'What features does your product offer for hiring?',
      expectedTopics: ['features', 'hiring', 'product'],
      category: 'FEATURES',
      difficulty: 'easy',
      tags: ['factual', 'features']
    },
    {
      id: 'comparative-competitors',
      query: 'How does your product compare to competitors?',
      expectedTopics: ['competition', 'comparison', 'advantages'],
      category: 'COMPARISON',
      difficulty: 'medium',
      tags: ['comparative']
    },
    {
      id: 'technical-integration',
      query: 'How can I integrate your API with my existing systems?',
      expectedTopics: ['api', 'integration', 'technical'],
      category: 'TECHNICAL',
      difficulty: 'hard',
      tags: ['technical', 'integration']
    },
    {
      id: 'procedural-setup',
      query: 'What are the steps to set up a new hiring campaign?',
      expectedTopics: ['setup', 'campaign', 'hiring', 'steps'],
      category: 'PRODUCT',
      difficulty: 'medium',
      tags: ['procedural']
    }
  ];
  
  saveEvaluationQueries(standardQueries);
  return standardQueries;
}

/**
 * Run traditional retrieval (simulating non-contextual reranking)
 */
async function runTraditionalRetrieval(query: string, limit: number = 10): Promise<RetrievalResult> {
  const startTime = Date.now();
  
  // Analyze query (needed for hybrid search potentially)
  const queryAnalysis = await analyzeQuery(query);
  
  // Run hybrid search (using the main hybridSearch function)
  const searchResponse = await hybridSearch(query, { 
    limit: limit * 2, // Get more candidates
    // Use defaults or potentially force balanced weights for traditional?
    vectorWeight: 0.5, 
    keywordWeight: 0.5 
    // Add basic filtering based on analysis if desired for traditional
    // filter: { primaryCategory: queryAnalysis.primaryCategory as any }
  });
  const searchResults = searchResponse.results || [];

  // Prepare results for reranker input
  const resultsForReranker: MultiModalSearchResult[] = searchResults.map((result: any, index: number) => ({
    item: {
      id: result.id || `trad-result-${index}`,
      text: result.text || result.originalText || '',
      metadata: result.metadata || {},
      visualContent: result.visualContent || result.metadata?.visualContent
    },
    score: result.score || 0
  }));
  
  // Rerank *without* using visual/contextual info
  const rerankOptions: MultiModalRerankOptions = {
    limit: limit, 
    includeScores: true,
    useVisualContext: false, // Explicitly disable visual context
    visualFocus: false, // Explicitly disable visual focus
    timeoutMs: 5000
  };

  const rerankedResults = await rerankWithGemini(
    query, 
    resultsForReranker, 
    rerankOptions
  );
  
  const endTime = Date.now();
  
  // Format results
  return {
    chunks: rerankedResults.map(result => ({
      text: result.item?.text || '',
      source: result.item?.metadata?.source || 'Unknown',
      score: result.score || 0,
      metadata: result.item?.metadata || {}
    })),
    elapsedTimeMs: endTime - startTime
  };
}

/**
 * Run contextual retrieval
 */
async function runContextualRetrieval(query: string, limit: number = 10): Promise<RetrievalResult> {
  const startTime = Date.now();
  
  // Analyze query (needed for hybrid search potentially)
  const queryAnalysis = await analyzeQuery(query);
  
  // Run hybrid search with more candidates for reranking (using the main hybridSearch function)
  const searchResponse = await hybridSearch(query, { 
    limit: limit * 2, // Get more candidates
    // Use parameters derived from query analysis?
    // vectorWeight: retrievalParams.hybridRatio, 
    // keywordWeight: 1.0 - retrievalParams.hybridRatio,
    // filter: ... derived filter ...
    // For now, use defaults similar to traditional for fair comparison?
    vectorWeight: 0.5, 
    keywordWeight: 0.5 
  });
  const searchResults = searchResponse.results || [];

  // Prepare results for reranker input
  const resultsForReranker: MultiModalSearchResult[] = searchResults.map((result: any, index: number) => ({
    item: {
      id: result.id || `ctx-result-${index}`,
      text: result.text || result.originalText || '',
      metadata: result.metadata || {},
      visualContent: result.visualContent || result.metadata?.visualContent
    },
    score: result.score || 0
  }));
  
  // Rerank *with* contextual info
  const visualAnalysis = analyzeVisualQuery(query);
  const rerankOptions: MultiModalRerankOptions = {
    limit: limit, 
    includeScores: true,
    useVisualContext: true, // Enable visual context
    visualFocus: visualAnalysis.isVisualQuery,
    visualTypes: visualAnalysis.visualTypes,
    timeoutMs: 5000
  };

  const rerankedResults = await rerankWithGemini(
    query, 
    resultsForReranker, 
    rerankOptions
  );
  
  const endTime = Date.now();
  
  // Format results
  return {
    chunks: rerankedResults.map(result => ({
      text: result.item?.text || '',
      source: result.item?.metadata?.source || 'Unknown',
      score: result.score || 0,
      metadata: result.item?.metadata || {}
    })),
    elapsedTimeMs: endTime - startTime
  };
}

/**
 * Generate answer from retrieval results
 */
async function generateAnswerFromResults(query: string, retrievalResults: RetrievalResult, useContextual: boolean): Promise<string> {
  // Format the results for the answer generator
  const formattedResults = retrievalResults.chunks.map(chunk => {
    // Handle contextual information if available
    const contextMetadata = chunk.metadata?.context || {};
    const documentContext = {
      summary: chunk.metadata?.documentSummary || '',
      topics: chunk.metadata?.primaryTopics || '',
      documentType: chunk.metadata?.documentType || '',
      technicalLevel: chunk.metadata?.technicalLevel
    };
    
    return {
      text: chunk.text,
      source: chunk.source || 'Unknown',
      metadata: chunk.metadata,
      relevanceScore: chunk.score,
      context: useContextual ? {
        description: contextMetadata.description || '',
        keyPoints: contextMetadata.keyPoints || [],
        isDefinition: contextMetadata.isDefinition || false,
        containsExample: contextMetadata.containsExample || false,
        documentContext: documentContext
      } : undefined
    };
  });

  // Generate the answer with appropriate options
  // Note: Since 'useContextualInformation' isn't in the type, we'll add system prompt instead
  const options: any = {  // Use any to bypass type checking temporarily
    includeSourceCitations: true,
    maxSourcesInAnswer: 3,
    conversationHistory: "",
  };
  
  // If contextual is enabled, add a system prompt that instructs to use contextual info
  if (useContextual) {
    options.systemPrompt = `You are an AI assistant for the sales team. 
Use the contextual information including document summaries, key points, and relationships 
between chunks to provide a more accurate and coherent answer.
Pay attention to whether a chunk is a definition or contains examples, and use that information
to structure your response appropriately.`;
  }
  
  const answer = await generateAnswer(query, formattedResults, options);
  
  return answer;
}

/**
 * Evaluate retrieval quality metrics
 */
function evaluateRetrievalMetrics(results: RetrievalResult, expectedTopics: string[] = []): {
  precisionAt3: number;
  precisionAt5: number;
  recallAt5: number;
  mrr: number;
} {
  // Default metrics
  const metrics = {
    precisionAt3: 0,
    precisionAt5: 0,
    recallAt5: 0,
    mrr: 0  // Mean Reciprocal Rank
  };
  
  // If no expected topics, can't calculate precision/recall
  if (!expectedTopics || expectedTopics.length === 0) {
    return metrics;
  }
  
  // Count relevant chunks
  const relevantAt3 = results.chunks
    .slice(0, 3)
    .filter(chunk => 
      expectedTopics.some(topic => 
        chunk.text.toLowerCase().includes(topic.toLowerCase())
      )
    ).length;
    
  const relevantAt5 = results.chunks
    .slice(0, 5)
    .filter(chunk => 
      expectedTopics.some(topic => 
        chunk.text.toLowerCase().includes(topic.toLowerCase())
      )
    ).length;
  
  // Calculate metrics
  metrics.precisionAt3 = relevantAt3 / 3;
  metrics.precisionAt5 = relevantAt5 / 5;
  
  // Calculate recall (if we have expected topics)
  if (expectedTopics.length > 0) {
    const topicsFoundAt5 = new Set<string>();
    
    // Check which topics are found in the top 5 results
    for (const chunk of results.chunks.slice(0, 5)) {
      for (const topic of expectedTopics) {
        if (chunk.text.toLowerCase().includes(topic.toLowerCase())) {
          topicsFoundAt5.add(topic);
        }
      }
    }
    
    metrics.recallAt5 = topicsFoundAt5.size / expectedTopics.length;
  }
  
  // Calculate MRR
  let rankOfFirstRelevant = -1;
  for (let i = 0; i < results.chunks.length; i++) {
    if (expectedTopics.some(topic => 
      results.chunks[i].text.toLowerCase().includes(topic.toLowerCase())
    )) {
      rankOfFirstRelevant = i + 1;
      break;
    }
  }
  
  if (rankOfFirstRelevant > 0) {
    metrics.mrr = 1 / rankOfFirstRelevant;
  }
  
  return metrics;
}

/**
 * Evaluate answer quality using GPT-4
 */
async function evaluateAnswerQuality(
  query: string, 
  answer: string, 
  expectedTopics: string[] = []
): Promise<number> {
  try {
    // Create prompt for evaluating answer quality
    const prompt = `
You are an objective evaluator assessing the quality of an answer to a query.

QUERY: "${query}"

ANSWER: 
${answer}

${expectedTopics.length > 0 ? `The answer should ideally cover these topics: ${expectedTopics.join(', ')}` : ''}

Rate the answer on a scale of 0-10 based on the following criteria:
1. Relevance: How directly does it address the query?
2. Completeness: Does it provide all necessary information?
3. Accuracy: Is the information correct and up-to-date?
4. Clarity: Is the answer easy to understand?
5. Conciseness: Is it appropriately detailed without unnecessary information?

Provide ONLY a single number as your final score (0-10).
`;

    // Use more capable model for evaluation
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 10
    });
    
    // Extract score (just parse the first number found)
    const content = response.choices[0]?.message?.content || "";
    const scoreMatch = content.match(/\d+(\.\d+)?/);
    
    if (scoreMatch) {
      // Convert to number and ensure it's in the 0-10 range
      const score = Math.min(Math.max(parseFloat(scoreMatch[0]), 0), 10);
      return score;
    }
    
    return 5; // Default to neutral if parsing fails
  } catch (error) {
    logError('Error evaluating answer quality', error);
    return 5; // Default to neutral on error
  }
}

/**
 * Compare traditional and contextual retrieval approaches
 */
export async function compareRetrievalApproaches(
  queryOrId: string | EvaluationQuery,
  saveResults: boolean = true
): Promise<ComparisonResult> {
  // Resolve query
  let query: EvaluationQuery;
  if (typeof queryOrId === 'string') {
    // Check if it's an ID or a query string
    const queries = loadEvaluationQueries();
    const foundQuery = queries.find(q => q.id === queryOrId);
    
    if (foundQuery) {
      query = foundQuery;
    } else {
      // Treat as a query string
      query = {
        id: uuidv4(),
        query: queryOrId
      };
    }
  } else {
    query = queryOrId;
  }
  
  console.log(`Comparing retrieval approaches for query: "${query.query}"`);
  
  // Create comparison result object
  const comparison: ComparisonResult = {
    id: uuidv4(),
    query,
    timestamp: new Date().toISOString(),
    traditional: {
      retrievalResults: { chunks: [], elapsedTimeMs: 0 },
      answer: '',
      metrics: {
        precisionAt3: 0,
        precisionAt5: 0,
        recallAt5: 0,
        mrr: 0,
        answerScore: 0
      }
    },
    contextual: {
      retrievalResults: { chunks: [], elapsedTimeMs: 0 },
      answer: '',
      metrics: {
        precisionAt3: 0,
        precisionAt5: 0,
        recallAt5: 0,
        mrr: 0,
        answerScore: 0
      }
    },
    winner: 'tie',
    evaluationNotes: ''
  };
  
  try {
    // Run traditional retrieval
    console.log('Running traditional retrieval...');
    comparison.traditional.retrievalResults = await runTraditionalRetrieval(query.query);
    
    // Run contextual retrieval
    console.log('Running contextual retrieval...');
    comparison.contextual.retrievalResults = await runContextualRetrieval(query.query);
    
    // Generate answers
    console.log('Generating traditional answer...');
    comparison.traditional.answer = await generateAnswerFromResults(
      query.query, 
      comparison.traditional.retrievalResults,
      false
    );
    
    console.log('Generating contextual answer...');
    comparison.contextual.answer = await generateAnswerFromResults(
      query.query,
      comparison.contextual.retrievalResults,
      true
    );
    
    // Evaluate retrieval metrics
    comparison.traditional.metrics = {
      ...evaluateRetrievalMetrics(comparison.traditional.retrievalResults, query.expectedTopics),
      answerScore: 0 // Will be calculated later
    };
    
    comparison.contextual.metrics = {
      ...evaluateRetrievalMetrics(comparison.contextual.retrievalResults, query.expectedTopics),
      answerScore: 0 // Will be calculated later
    };
    
    // Evaluate answer quality
    console.log('Evaluating answer quality...');
    comparison.traditional.metrics.answerScore = await evaluateAnswerQuality(
      query.query,
      comparison.traditional.answer,
      query.expectedTopics
    );
    
    comparison.contextual.metrics.answerScore = await evaluateAnswerQuality(
      query.query,
      comparison.contextual.answer,
      query.expectedTopics
    );
    
    // Determine overall winner
    const traditionalScore = (
      comparison.traditional.metrics.precisionAt5 * 0.2 +
      comparison.traditional.metrics.recallAt5 * 0.2 +
      comparison.traditional.metrics.mrr * 0.1 +
      comparison.traditional.metrics.answerScore / 10 * 0.5  // Convert to 0-1 scale and weight more heavily
    );
    
    const contextualScore = (
      comparison.contextual.metrics.precisionAt5 * 0.2 +
      comparison.contextual.metrics.recallAt5 * 0.2 +
      comparison.contextual.metrics.mrr * 0.1 +
      comparison.contextual.metrics.answerScore / 10 * 0.5  // Convert to 0-1 scale and weight more heavily
    );
    
    // Determine winner with a minimum threshold difference
    const THRESHOLD = 0.05; // 5% difference to declare a winner
    if (contextualScore > traditionalScore + THRESHOLD) {
      comparison.winner = 'contextual';
    } else if (traditionalScore > contextualScore + THRESHOLD) {
      comparison.winner = 'traditional';
    } else {
      comparison.winner = 'tie';
    }
    
    // Add evaluation notes
    comparison.evaluationNotes = `
Traditional approach: Score ${(traditionalScore * 100).toFixed(1)}%
- Precision@5: ${(comparison.traditional.metrics.precisionAt5 * 100).toFixed(1)}%
- Recall@5: ${(comparison.traditional.metrics.recallAt5 * 100).toFixed(1)}%
- MRR: ${comparison.traditional.metrics.mrr.toFixed(2)}
- Answer quality: ${comparison.traditional.metrics.answerScore.toFixed(1)}/10

Contextual approach: Score ${(contextualScore * 100).toFixed(1)}%
- Precision@5: ${(comparison.contextual.metrics.precisionAt5 * 100).toFixed(1)}%
- Recall@5: ${(comparison.contextual.metrics.recallAt5 * 100).toFixed(1)}%
- MRR: ${comparison.contextual.metrics.mrr.toFixed(2)}
- Answer quality: ${comparison.contextual.metrics.answerScore.toFixed(1)}/10

Overall winner: ${comparison.winner}
`.trim();

    console.log(comparison.evaluationNotes);
    
    // Save results if requested
    if (saveResults) {
      const resultsFile = path.join(
        EVALUATION_DIR, 
        `comparison_${comparison.id}_${new Date().toISOString().replace(/:/g, '-')}.json`
      );
      
      fs.writeFileSync(resultsFile, JSON.stringify(comparison, null, 2));
      console.log(`Results saved to ${resultsFile}`);
    }
    
    return comparison;
  } catch (error) {
    logError('Error comparing retrieval approaches', error);
    throw error;
  }
}

/**
 * Run evaluation on all standard queries
 */
export async function runStandardEvaluation(): Promise<ComparisonResult[]> {
  // Load or create standard queries
  let queries = loadEvaluationQueries();
  if (queries.length === 0) {
    queries = createStandardEvaluationSet();
  }
  
  const results: ComparisonResult[] = [];
  
  for (const query of queries) {
    console.log(`\n===== Evaluating Query: ${query.id} =====`);
    try {
      const result = await compareRetrievalApproaches(query);
      results.push(result);
      console.log(`Completed evaluation for query: ${query.id}`);
    } catch (error) {
      logError(`Error evaluating query ${query.id}`, error);
    }
  }
  
  // Generate summary report
  const contextualWins = results.filter(r => r.winner === 'contextual').length;
  const traditionalWins = results.filter(r => r.winner === 'traditional').length;
  const ties = results.filter(r => r.winner === 'tie').length;
  
  const summaryReport = {
    timestamp: new Date().toISOString(),
    totalQueries: results.length,
    results: {
      contextualWins,
      traditionalWins,
      ties
    },
    winners: {
      contextualWinPercentage: results.length > 0 ? (contextualWins / results.length * 100) : 0,
      traditionalWinPercentage: results.length > 0 ? (traditionalWins / results.length * 100) : 0,
      tiePercentage: results.length > 0 ? (ties / results.length * 100) : 0
    },
    averageMetrics: {
      contextual: {
        precisionAt5: results.reduce((sum, r) => sum + r.contextual.metrics.precisionAt5, 0) / results.length,
        recallAt5: results.reduce((sum, r) => sum + r.contextual.metrics.recallAt5, 0) / results.length,
        answerScore: results.reduce((sum, r) => sum + r.contextual.metrics.answerScore, 0) / results.length
      },
      traditional: {
        precisionAt5: results.reduce((sum, r) => sum + r.traditional.metrics.precisionAt5, 0) / results.length,
        recallAt5: results.reduce((sum, r) => sum + r.traditional.metrics.recallAt5, 0) / results.length,
        answerScore: results.reduce((sum, r) => sum + r.traditional.metrics.answerScore, 0) / results.length
      }
    }
  };
  
  // Save summary report
  const summaryFile = path.join(
    EVALUATION_DIR, 
    `evaluation_summary_${new Date().toISOString().replace(/:/g, '-')}.json`
  );
  
  fs.writeFileSync(summaryFile, JSON.stringify(summaryReport, null, 2));
  
  console.log('\n===== EVALUATION SUMMARY =====');
  console.log(`Total Queries: ${summaryReport.totalQueries}`);
  console.log(`Contextual Wins: ${contextualWins} (${summaryReport.winners.contextualWinPercentage.toFixed(1)}%)`);
  console.log(`Traditional Wins: ${traditionalWins} (${summaryReport.winners.traditionalWinPercentage.toFixed(1)}%)`);
  console.log(`Ties: ${ties} (${summaryReport.winners.tiePercentage.toFixed(1)}%)`);
  console.log('\nAverage Metrics:');
  console.log(`Contextual - Precision@5: ${(summaryReport.averageMetrics.contextual.precisionAt5 * 100).toFixed(1)}%, ` +
    `Recall@5: ${(summaryReport.averageMetrics.contextual.recallAt5 * 100).toFixed(1)}%, ` +
    `Answer Quality: ${summaryReport.averageMetrics.contextual.answerScore.toFixed(1)}/10`);
  console.log(`Traditional - Precision@5: ${(summaryReport.averageMetrics.traditional.precisionAt5 * 100).toFixed(1)}%, ` +
    `Recall@5: ${(summaryReport.averageMetrics.traditional.recallAt5 * 100).toFixed(1)}%, ` +
    `Answer Quality: ${summaryReport.averageMetrics.traditional.answerScore.toFixed(1)}/10`);
  console.log(`\nSummary saved to: ${summaryFile}`);
  
  return results;
}

// If this file is run directly, run the standard evaluation
if (require.main === module) {
  runStandardEvaluation()
    .then(() => {
      console.log('Standard evaluation completed');
    })
    .catch(error => {
      console.error('Error running standard evaluation:', error);
    });
} 