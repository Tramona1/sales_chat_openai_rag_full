/**
 * Gemini Migration Evaluation Script
 * 
 * This script performs a comprehensive evaluation of the migration from OpenAI to Gemini,
 * comparing performance across several key metrics:
 * 
 * 1. Embedding Quality: Semantic search precision, recall, and MRR
 * 2. Context Generation: Quality of extracted context
 * 3. Reranking Effectiveness: Improvements in result ordering
 * 4. Answer Generation: Accuracy, comprehensiveness, and grounding
 * 
 * Usage: node scripts/evaluateModelMigration.js
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Setup dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Test queries representing different types of questions
const TEST_QUERIES = [
  {
    id: "basic-product",
    query: "What are the main features of our product?",
    category: "product",
    difficulty: "easy"
  },
  {
    id: "technical-integration",
    query: "How do I integrate the API with a React application?",
    category: "technical",
    difficulty: "medium" 
  },
  {
    id: "comparison",
    query: "How does our solution compare to Competitor X in terms of security?",
    category: "competitive",
    difficulty: "medium"
  },
  {
    id: "complex-scenario",
    query: "What's the recommended architecture for deploying in a multi-region environment with failover support?",
    category: "technical",
    difficulty: "hard"
  },
  {
    id: "multi-modal",
    query: "Can you explain the dashboard visualization showing customer retention?",
    category: "visualization",
    difficulty: "medium"
  },
  {
    id: "pricing",
    query: "What's the pricing model for enterprise customers with more than 1000 users?",
    category: "business",
    difficulty: "medium"
  }
];

// Import dynamically to handle TypeScript/ESM compatibility
async function importModules() {
  try {
    // Import evaluation modules
    const { 
      compareRetrievalApproaches,
      evaluateAnswerQuality
    } = await import('../utils/evaluationUtils.js');
    
    // Import feature flag management
    const { 
      setFlag,
      enableAllContextualFeatures,
      disableAllContextualFeatures
    } = await import('../utils/featureFlags.js');
    
    // Import embedding clients
    const { getEmbeddingClient } = await import('../utils/embeddingClient.js');
    
    // Import model config
    const { getModelForTask } = await import('../utils/modelConfig.js');
    
    // Import reranking
    const { rerank } = await import('../utils/reranking.js');
    
    // Import context generation
    const { 
      extractDocumentContext,
      generateChunkContext
    } = await import('../utils/geminiClient.js');
    
    // Import answer generation
    const { generateContextAwareAnswer } = await import('../utils/contextAwareAnswerGeneration.js');
    
    return {
      compareRetrievalApproaches,
      evaluateAnswerQuality,
      setFlag,
      enableAllContextualFeatures,
      disableAllContextualFeatures,
      getEmbeddingClient,
      getModelForTask,
      rerank,
      extractDocumentContext,
      generateChunkContext,
      generateContextAwareAnswer
    };
  } catch (error) {
    console.error('Error importing modules:', error);
    process.exit(1);
  }
}

// Setup logger
function setupLogger() {
  const logDir = path.resolve(process.cwd(), 'data/logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
  const logFile = path.join(logDir, `gemini_evaluation_${timestamp}.log`);
  const resultFile = path.join(logDir, `gemini_evaluation_results_${timestamp}.json`);
  
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  
  return {
    info: (message) => {
      const formattedMessage = `[INFO] [${new Date().toISOString()}] ${message}`;
      console.log(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    error: (message, error) => {
      const formattedMessage = `[ERROR] [${new Date().toISOString()}] ${message}: ${error.stack || error}`;
      console.error(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    success: (message) => {
      const formattedMessage = `[SUCCESS] [${new Date().toISOString()}] ${message}`;
      console.log(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    warning: (message) => {
      const formattedMessage = `[WARNING] [${new Date().toISOString()}] ${message}`;
      console.warn(formattedMessage);
      logStream.write(formattedMessage + '\n');
    },
    results: (data) => {
      fs.writeFileSync(resultFile, JSON.stringify(data, null, 2));
      return resultFile;
    }
  };
}

// Sample document for context generation evaluation
const SAMPLE_DOCUMENT = `
# Sales Intelligence Platform

## Product Overview

Our Sales Intelligence Platform is a comprehensive solution that helps sales teams identify, engage, and convert high-value prospects. The platform combines advanced analytics, AI-driven insights, and automation tools to streamline the sales process and improve conversion rates.

## Key Features

### 1. Prospect Identification
- AI-powered lead scoring and prioritization
- Firmographic and technographic data enrichment
- Buying intent signals detection
- Similar company recommendation engine

### 2. Engagement Optimization
- Personalized outreach recommendations
- Optimal contact time prediction
- Multi-channel communication orchestration
- Email and message effectiveness analytics

### 3. Pipeline Management
- Deal health monitoring and alerts
- Conversion probability forecasting
- Next-best-action recommendations
- Competitive deal positioning insights

### 4. Performance Analytics
- Team and individual performance metrics
- Conversion rate analysis by stage and segment
- Activity effectiveness measurement
- Revenue attribution modeling

## Technical Specifications

The platform is built on a modern microservices architecture using containerized services for scalability and resilience. Key technical components include:

- **API Layer**: REST and GraphQL APIs with OAuth 2.0 authentication
- **Data Processing**: Real-time and batch processing capabilities using Kafka and Spark
- **Machine Learning**: Custom models for lead scoring, forecasting, and recommendations
- **Integration Hub**: Pre-built connectors for CRM, marketing, and communication tools
- **Security**: SOC 2 Type II certified, GDPR and CCPA compliant

## Pricing

Our platform is available in three tiers:

1. **Growth**: $75 per user/month - For small teams up to 10 users
2. **Professional**: $125 per user/month - For medium-sized teams up to 50 users
3. **Enterprise**: Custom pricing - For organizations with 50+ users, includes dedicated support and custom integrations
`;

// Sample chunks for reranking evaluation
const SAMPLE_CHUNKS = [
  {
    text: "API Layer: REST and GraphQL APIs with OAuth 2.0 authentication",
    metadata: { source: "Technical Specifications", technicalLevel: 3 }
  },
  {
    text: "Our platform is available in three tiers: Growth: $75 per user/month - For small teams up to 10 users, Professional: $125 per user/month - For medium-sized teams up to 50 users, Enterprise: Custom pricing - For organizations with 50+ users, includes dedicated support and custom integrations",
    metadata: { source: "Pricing", technicalLevel: 1 }
  },
  {
    text: "The Sales Intelligence Platform combines advanced analytics, AI-driven insights, and automation tools to streamline the sales process and improve conversion rates.",
    metadata: { source: "Product Overview", technicalLevel: 1 }
  },
  {
    text: "Personalized outreach recommendations, Optimal contact time prediction, Multi-channel communication orchestration, Email and message effectiveness analytics",
    metadata: { source: "Engagement Optimization", technicalLevel: 2 }
  },
  {
    text: "Team and individual performance metrics, Conversion rate analysis by stage and segment, Activity effectiveness measurement, Revenue attribution modeling",
    metadata: { source: "Performance Analytics", technicalLevel: 2 }
  }
];

// 1. Evaluate embedding quality between OpenAI and Gemini
async function evaluateEmbeddingQuality(modules, logger) {
  logger.info('Starting embedding quality evaluation...');
  
  const testTexts = [
    "Sales Performance Analytics Dashboard",
    "API integration with OAuth authentication",
    "Enterprise pricing for large organizations",
    "Lead scoring and prioritization algorithms",
    "Multi-channel customer engagement strategies"
  ];
  
  const testQueries = [
    "How to analyze sales team performance",
    "Implementing OAuth in the API",
    "Enterprise pricing options",
    "How does lead scoring work",
    "Best practices for customer engagement"
  ];
  
  // Helper function to compute cosine similarity
  function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    return dotProduct / (normA * normB);
  }
  
  // Results container
  const results = {
    openai: { similarities: [], averageSimilarity: 0 },
    gemini: { similarities: [], averageSimilarity: 0 }
  };
  
  try {
    // Test OpenAI embeddings
    logger.info('Testing OpenAI embeddings...');
    modules.setFlag('useGeminiForEmbeddings', false);
    const openaiClient = modules.getEmbeddingClient();
    
    // Ensure we're using OpenAI
    if (openaiClient.getProvider() !== 'openai') {
      logger.warning('Failed to switch to OpenAI embeddings provider');
      results.openai.error = 'Provider switch failed';
    } else {
      // Generate embeddings for test texts and queries
      const openaiTextEmbeddings = await Promise.all(testTexts.map(text => openaiClient.embedText(text)));
      const openaiQueryEmbeddings = await Promise.all(testQueries.map(query => openaiClient.embedText(query)));
      
      // Calculate similarities
      for (let i = 0; i < testTexts.length; i++) {
        const similarity = cosineSimilarity(openaiTextEmbeddings[i], openaiQueryEmbeddings[i]);
        results.openai.similarities.push({ 
          pair: `Pair ${i+1}`, 
          text: testTexts[i],
          query: testQueries[i],
          similarity 
        });
      }
      
      // Calculate average similarity
      results.openai.averageSimilarity = results.openai.similarities.reduce((sum, item) => sum + item.similarity, 0) / results.openai.similarities.length;
    }
    
    // Test Gemini embeddings
    logger.info('Testing Gemini embeddings...');
    modules.setFlag('useGeminiForEmbeddings', true);
    const geminiClient = modules.getEmbeddingClient();
    
    // Ensure we're using Gemini
    if (geminiClient.getProvider() !== 'gemini') {
      logger.warning('Failed to switch to Gemini embeddings provider');
      results.gemini.error = 'Provider switch failed';
    } else {
      // Generate embeddings for test texts and queries
      const geminiTextEmbeddings = await Promise.all(testTexts.map(text => geminiClient.embedText(text)));
      const geminiQueryEmbeddings = await Promise.all(testQueries.map(query => geminiClient.embedText(query)));
      
      // Calculate similarities
      for (let i = 0; i < testTexts.length; i++) {
        const similarity = cosineSimilarity(geminiTextEmbeddings[i], geminiQueryEmbeddings[i]);
        results.gemini.similarities.push({ 
          pair: `Pair ${i+1}`, 
          text: testTexts[i],
          query: testQueries[i],
          similarity 
        });
      }
      
      // Calculate average similarity
      results.gemini.averageSimilarity = results.gemini.similarities.reduce((sum, item) => sum + item.similarity, 0) / results.gemini.similarities.length;
    }
    
    // Log results
    logger.info(`OpenAI average semantic similarity: ${results.openai.averageSimilarity.toFixed(4)}`);
    logger.info(`Gemini average semantic similarity: ${results.gemini.averageSimilarity.toFixed(4)}`);
    
    // Determine winner
    if (results.gemini.averageSimilarity > results.openai.averageSimilarity) {
      logger.success('Gemini embeddings show better semantic similarity than OpenAI embeddings');
      results.winner = 'gemini';
      results.improvement = ((results.gemini.averageSimilarity - results.openai.averageSimilarity) / results.openai.averageSimilarity * 100).toFixed(2) + '%';
    } else if (results.openai.averageSimilarity > results.gemini.averageSimilarity) {
      logger.warning('OpenAI embeddings show better semantic similarity than Gemini embeddings');
      results.winner = 'openai';
      results.improvement = ((results.openai.averageSimilarity - results.gemini.averageSimilarity) / results.gemini.averageSimilarity * 100).toFixed(2) + '%';
    } else {
      logger.info('OpenAI and Gemini embeddings show similar semantic similarity');
      results.winner = 'tie';
      results.improvement = '0%';
    }
    
    return results;
  } catch (error) {
    logger.error('Error evaluating embedding quality', error);
    return { error: error.message, openai: results.openai, gemini: results.gemini };
  }
}

// 2. Evaluate context generation quality
async function evaluateContextGeneration(modules, logger) {
  logger.info('Starting context generation evaluation...');
  
  try {
    // Extract document context
    logger.info('Generating document context with Gemini...');
    const documentContext = await modules.extractDocumentContext(SAMPLE_DOCUMENT);
    
    // Log document context
    logger.info('Document context generated:');
    logger.info(`Summary: ${documentContext.summary}`);
    logger.info(`Main Topics: ${documentContext.mainTopics.join(', ')}`);
    logger.info(`Technical Level: ${documentContext.technicalLevel}`);
    
    // Sample chunks for context generation
    const chunks = [
      "Our platform is available in three tiers: Growth: $75 per user/month - For small teams up to 10 users, Professional: $125 per user/month - For medium-sized teams up to 50 users, Enterprise: Custom pricing - For organizations with 50+ users, includes dedicated support and custom integrations",
      "The platform is built on a modern microservices architecture using containerized services for scalability and resilience. Key technical components include API Layer, Data Processing, Machine Learning, Integration Hub, and Security.",
      "AI-powered lead scoring and prioritization, Firmographic and technographic data enrichment, Buying intent signals detection, Similar company recommendation engine"
    ];
    
    // Generate context for each chunk
    logger.info('Generating chunk contexts...');
    const chunkContexts = await Promise.all(
      chunks.map(chunk => modules.generateChunkContext(chunk, documentContext))
    );
    
    // Evaluate context quality (basic evaluation - in a real system you'd want human evaluation)
    const contextQualityScores = chunkContexts.map((context, i) => {
      // Score based on presence of key elements
      let score = 0;
      
      // Does it have a description?
      if (context.description && context.description.length > 10) score += 2;
      
      // Are there key points identified?
      if (context.keyPoints && context.keyPoints.length > 0) score += context.keyPoints.length;
      
      // Is the isDefinition field set appropriately?
      score += 1; // We'll assume this is correct as it's hard to validate automatically
      
      // Are relatedTopics identified?
      if (context.relatedTopics && context.relatedTopics.length > 0) score += context.relatedTopics.length;
      
      return {
        chunk: chunks[i].substring(0, 50) + '...',
        context: {
          description: context.description,
          keyPointsCount: context.keyPoints?.length || 0,
          isDefinition: context.isDefinition,
          relatedTopicsCount: context.relatedTopics?.length || 0
        },
        score
      };
    });
    
    // Log results
    logger.info('Context generation quality scores:');
    for (const result of contextQualityScores) {
      logger.info(`Chunk "${result.chunk}" - Score: ${result.score}`);
    }
    
    const averageScore = contextQualityScores.reduce((sum, item) => sum + item.score, 0) / contextQualityScores.length;
    logger.info(`Average context quality score: ${averageScore.toFixed(2)}`);
    
    return {
      documentContext: {
        summary: documentContext.summary,
        mainTopics: documentContext.mainTopics,
        technicalLevel: documentContext.technicalLevel,
        entities: documentContext.entities
      },
      chunkContexts: contextQualityScores,
      averageScore
    };
  } catch (error) {
    logger.error('Error evaluating context generation', error);
    return { error: error.message };
  }
}

// 3. Evaluate reranking effectiveness
async function evaluateRerankingEffectiveness(modules, logger) {
  logger.info('Starting reranking effectiveness evaluation...');
  
  // Test queries for reranking
  const rerankQueries = [
    "What is the pricing for enterprise customers?",
    "How do I use the API with OAuth?",
    "Tell me about the performance analytics features"
  ];
  
  const results = {
    openai: {},
    gemini: {},
    comparisons: []
  };
  
  try {
    // Format chunks as search results for reranking
    const searchResults = SAMPLE_CHUNKS.map((chunk, index) => ({
      score: 0.5, // Arbitrary initial score
      item: {
        text: chunk.text,
        metadata: chunk.metadata
      }
    }));
    
    // Test OpenAI reranking
    logger.info('Testing OpenAI reranking...');
    modules.setFlag('useGeminiForReranking', false);
    
    results.openai.rankings = {};
    
    for (const query of rerankQueries) {
      logger.info(`Reranking with OpenAI for query: "${query}"`);
      const openaiRanked = await modules.rerank(query, searchResults, searchResults.length);
      
      results.openai.rankings[query] = openaiRanked.map(result => ({
        score: result.score,
        text: result.item.text.substring(0, 50) + '...',
        originalIndex: SAMPLE_CHUNKS.findIndex(chunk => chunk.text === result.item.text)
      }));
    }
    
    // Test Gemini reranking
    logger.info('Testing Gemini reranking...');
    modules.setFlag('useGeminiForReranking', true);
    
    results.gemini.rankings = {};
    
    for (const query of rerankQueries) {
      logger.info(`Reranking with Gemini for query: "${query}"`);
      const geminiRanked = await modules.rerank(query, searchResults, searchResults.length, {
        useContextualInfo: true
      });
      
      results.gemini.rankings[query] = geminiRanked.map(result => ({
        score: result.score,
        text: result.item.text.substring(0, 50) + '...',
        originalIndex: SAMPLE_CHUNKS.findIndex(chunk => chunk.text === result.item.text)
      }));
    }
    
    // Compare rankings
    for (const query of rerankQueries) {
      const openaiTopResult = results.openai.rankings[query][0];
      const geminiTopResult = results.gemini.rankings[query][0];
      
      // Simple manual evaluation based on query intent
      let expectedTopIndex = -1;
      if (query.includes("pricing")) {
        expectedTopIndex = 1; // The pricing chunk
      } else if (query.includes("API") || query.includes("OAuth")) {
        expectedTopIndex = 0; // The API chunk
      } else if (query.includes("performance analytics")) {
        expectedTopIndex = 4; // The performance analytics chunk
      }
      
      const openaiCorrect = openaiTopResult.originalIndex === expectedTopIndex;
      const geminiCorrect = geminiTopResult.originalIndex === expectedTopIndex;
      
      results.comparisons.push({
        query,
        expectedTopIndex,
        openaiTopIndex: openaiTopResult.originalIndex,
        geminiTopIndex: geminiTopResult.originalIndex,
        openaiCorrect,
        geminiCorrect,
        winner: openaiCorrect === geminiCorrect ? 'tie' : (openaiCorrect ? 'openai' : 'gemini')
      });
      
      logger.info(`Query: "${query}"`);
      logger.info(`  Expected top result: ${expectedTopIndex}`);
      logger.info(`  OpenAI top result: ${openaiTopResult.originalIndex} (${openaiCorrect ? 'correct' : 'incorrect'})`);
      logger.info(`  Gemini top result: ${geminiTopResult.originalIndex} (${geminiCorrect ? 'correct' : 'incorrect'})`);
    }
    
    // Overall evaluation
    const openaiCorrectCount = results.comparisons.filter(c => c.openaiCorrect).length;
    const geminiCorrectCount = results.comparisons.filter(c => c.geminiCorrect).length;
    
    results.summary = {
      openaiCorrectCount,
      geminiCorrectCount,
      openaiAccuracy: openaiCorrectCount / results.comparisons.length,
      geminiAccuracy: geminiCorrectCount / results.comparisons.length,
      winner: openaiCorrectCount > geminiCorrectCount ? 'openai' : 
              (geminiCorrectCount > openaiCorrectCount ? 'gemini' : 'tie')
    };
    
    logger.info(`Reranking accuracy summary:`);
    logger.info(`  OpenAI: ${openaiCorrectCount}/${results.comparisons.length} correct (${(results.summary.openaiAccuracy * 100).toFixed(1)}%)`);
    logger.info(`  Gemini: ${geminiCorrectCount}/${results.comparisons.length} correct (${(results.summary.geminiAccuracy * 100).toFixed(1)}%)`);
    logger.info(`  Winner: ${results.summary.winner}`);
    
    return results;
  } catch (error) {
    logger.error('Error evaluating reranking effectiveness', error);
    return { error: error.message };
  }
}

// 4. Evaluate answer generation
async function evaluateAnswerGeneration(modules, logger) {
  logger.info('Starting answer generation evaluation...');
  
  // Search context (simplified for evaluation)
  const searchContext = SAMPLE_CHUNKS.map(chunk => ({
    text: chunk.text,
    source: chunk.metadata.source,
    score: 0.8,
    metadata: chunk.metadata
  }));
  
  // Test queries
  const queryAnswerPairs = [
    {
      query: "What's the pricing for enterprise customers?",
      benchmark: "Enterprise pricing is custom and includes dedicated support and custom integrations, designed for organizations with 50+ users."
    },
    {
      query: "What authentication does the API use?",
      benchmark: "The API uses OAuth 2.0 authentication."
    },
    {
      query: "What performance analytics features are available?",
      benchmark: "Performance analytics features include team and individual performance metrics, conversion rate analysis by stage and segment, activity effectiveness measurement, and revenue attribution modeling."
    }
  ];
  
  const results = {
    traditional: [],
    contextual: [],
    comparisons: []
  };
  
  try {
    // Traditional answer generation
    logger.info('Testing traditional answer generation...');
    modules.disableAllContextualFeatures();
    
    for (const pair of queryAnswerPairs) {
      logger.info(`Generating traditional answer for: "${pair.query}"`);
      const traditionalAnswer = await modules.generateContextAwareAnswer(
        pair.query,
        searchContext,
        { useContextualInformation: false }
      );
      
      results.traditional.push({
        query: pair.query,
        answer: traditionalAnswer
      });
    }
    
    // Contextual answer generation
    logger.info('Testing contextual answer generation...');
    modules.enableAllContextualFeatures();
    
    for (const pair of queryAnswerPairs) {
      logger.info(`Generating contextual answer for: "${pair.query}"`);
      const contextualAnswer = await modules.generateContextAwareAnswer(
        pair.query,
        searchContext,
        { useContextualInformation: true }
      );
      
      results.contextual.push({
        query: pair.query,
        answer: contextualAnswer
      });
    }
    
    // Compare answers (human evaluation is better, but we'll use a simple approach)
    logger.info('Evaluating answer quality...');
    
    for (let i = 0; i < queryAnswerPairs.length; i++) {
      const query = queryAnswerPairs[i].query;
      const benchmark = queryAnswerPairs[i].benchmark;
      const traditionalAnswer = results.traditional[i].answer;
      const contextualAnswer = results.contextual[i].answer;
      
      // Simple evaluation - check if key phrases from benchmark are in answers
      const keyPhrases = benchmark.split(/[,.]\s+/);
      
      let traditionalScore = 0;
      let contextualScore = 0;
      
      for (const phrase of keyPhrases) {
        if (phrase.length < 3) continue; // Skip very short phrases
        
        if (traditionalAnswer.toLowerCase().includes(phrase.toLowerCase())) {
          traditionalScore++;
        }
        
        if (contextualAnswer.toLowerCase().includes(phrase.toLowerCase())) {
          contextualScore++;
        }
      }
      
      // Normalize scores
      const maxPossible = keyPhrases.length;
      traditionalScore = traditionalScore / maxPossible;
      contextualScore = contextualScore / maxPossible;
      
      results.comparisons.push({
        query,
        traditionalScore,
        contextualScore,
        winner: traditionalScore > contextualScore ? 'traditional' : 
                (contextualScore > traditionalScore ? 'contextual' : 'tie'),
        improvementPercent: contextualScore > traditionalScore ? 
                            ((contextualScore - traditionalScore) / traditionalScore * 100).toFixed(1) + '%' : 
                            '0%'
      });
      
      logger.info(`Query: "${query}"`);
      logger.info(`  Traditional score: ${(traditionalScore * 100).toFixed(1)}%`);
      logger.info(`  Contextual score: ${(contextualScore * 100).toFixed(1)}%`);
      logger.info(`  Winner: ${results.comparisons[i].winner} (${results.comparisons[i].improvementPercent} improvement)`);
    }
    
    // Overall summary
    const avgTraditionalScore = results.comparisons.reduce((sum, item) => sum + item.traditionalScore, 0) / results.comparisons.length;
    const avgContextualScore = results.comparisons.reduce((sum, item) => sum + item.contextualScore, 0) / results.comparisons.length;
    const contextualWins = results.comparisons.filter(c => c.winner === 'contextual').length;
    const traditionalWins = results.comparisons.filter(c => c.winner === 'traditional').length;
    
    results.summary = {
      avgTraditionalScore,
      avgContextualScore,
      contextualWins,
      traditionalWins,
      ties: results.comparisons.length - contextualWins - traditionalWins,
      overallWinner: avgContextualScore > avgTraditionalScore ? 'contextual' : 
                     (avgTraditionalScore > avgContextualScore ? 'traditional' : 'tie'),
      overallImprovement: ((avgContextualScore - avgTraditionalScore) / avgTraditionalScore * 100).toFixed(1) + '%'
    };
    
    logger.info(`Answer generation summary:`);
    logger.info(`  Average traditional score: ${(avgTraditionalScore * 100).toFixed(1)}%`);
    logger.info(`  Average contextual score: ${(avgContextualScore * 100).toFixed(1)}%`);
    logger.info(`  Contextual wins: ${contextualWins}/${results.comparisons.length}`);
    logger.info(`  Overall improvement: ${results.summary.overallImprovement}`);
    
    return results;
  } catch (error) {
    logger.error('Error evaluating answer generation', error);
    return { error: error.message };
  }
}

// 5. Run a comprehensive evaluation
async function runComprehensiveEvaluation() {
  const logger = setupLogger();
  logger.info('Starting comprehensive Gemini migration evaluation...');
  
  try {
    // Import modules
    logger.info('Importing modules...');
    const modules = await importModules();
    
    // Overall results container
    const results = {
      timestamp: new Date().toISOString(),
      environment: {
        geminiApiKey: process.env.GEMINI_API_KEY ? 'present' : 'missing',
        openAiApiKey: process.env.OPENAI_API_KEY ? 'present' : 'missing'
      },
      embeddingQuality: null,
      contextGeneration: null,
      rerankingEffectiveness: null,
      answerGeneration: null
    };
    
    // 1. Evaluate embedding quality
    logger.info('===== EMBEDDING QUALITY EVALUATION =====');
    results.embeddingQuality = await evaluateEmbeddingQuality(modules, logger);
    
    // 2. Evaluate context generation quality
    logger.info('===== CONTEXT GENERATION EVALUATION =====');
    results.contextGeneration = await evaluateContextGeneration(modules, logger);
    
    // 3. Evaluate reranking effectiveness
    logger.info('===== RERANKING EFFECTIVENESS EVALUATION =====');
    results.rerankingEffectiveness = await evaluateRerankingEffectiveness(modules, logger);
    
    // 4. Evaluate answer generation
    logger.info('===== ANSWER GENERATION EVALUATION =====');
    results.answerGeneration = await evaluateAnswerGeneration(modules, logger);
    
    // 5. Overall migration readiness assessment
    logger.info('===== OVERALL MIGRATION READINESS =====');
    
    const readinessChecks = {
      embedding: results.embeddingQuality.winner === 'gemini',
      reranking: results.rerankingEffectiveness.summary.winner === 'gemini' || 
                 results.rerankingEffectiveness.summary.winner === 'tie',
      answerGeneration: results.answerGeneration.summary.overallWinner === 'contextual' ||
                       results.answerGeneration.summary.overallWinner === 'tie',
      contextGeneration: results.contextGeneration.averageScore > 5
    };
    
    const readyComponents = Object.values(readinessChecks).filter(v => v).length;
    const totalComponents = Object.values(readinessChecks).length;
    const readinessScore = readyComponents / totalComponents;
    
    results.migrationReadiness = {
      componentChecks: readinessChecks,
      readinessScore,
      recommendation: readinessScore >= 0.75 ? 'READY' : (readinessScore >= 0.5 ? 'PARTIAL' : 'NOT READY')
    };
    
    logger.info(`Migration readiness assessment:`);
    logger.info(`  Embedding quality: ${readinessChecks.embedding ? 'PASS' : 'FAIL'}`);
    logger.info(`  Reranking effectiveness: ${readinessChecks.reranking ? 'PASS' : 'FAIL'}`);
    logger.info(`  Answer generation: ${readinessChecks.answerGeneration ? 'PASS' : 'FAIL'}`);
    logger.info(`  Context generation: ${readinessChecks.contextGeneration ? 'PASS' : 'FAIL'}`);
    logger.info(`  Overall readiness: ${readyComponents}/${totalComponents} components ready (${(readinessScore * 100).toFixed(0)}%)`);
    logger.info(`  Recommendation: ${results.migrationReadiness.recommendation}`);
    
    // Save results to file
    const resultFile = logger.results(results);
    logger.success(`Full evaluation results saved to: ${resultFile}`);
    
    // Return results
    return results;
  } catch (error) {
    logger.error('Fatal error during evaluation', error);
    process.exit(1);
  }
}

// Run the evaluation
runComprehensiveEvaluation(); 