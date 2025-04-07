# RAG System Evaluation Framework

This document provides information about the evaluation framework for assessing the performance of our RAG (Retrieval-Augmented Generation) system.

## Overview

The evaluation framework measures the performance of the RAG system across multiple dimensions:

1. **Retrieval Performance**: How effectively the system retrieves relevant context
2. **Answer Quality**: How accurately the system answers queries based on retrieved context
3. **System Efficiency**: How quickly the system processes queries and generates responses

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- TypeScript installed (`npm install -g typescript`)
- ts-node installed (`npm install -g ts-node`)
- OpenAI API key (set in `.env` file)
- Google AI API key for Gemini Flash evaluations (optional)

### Configuration

Create a `.env` file with the following variables:

```
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here (optional)
```

## Running Evaluations

### Baseline Evaluation

To establish baseline performance metrics for the current system:

```bash
npx ts-node scripts/run_baseline_evaluation.ts
```

This will:
1. Execute 50+ test queries against the system
2. Measure retrieval precision, recall, and latency
3. Evaluate answer quality using LLMs (GPT-4 and Gemini Flash)
4. Save results to the `evaluation_results` directory with a timestamp

### Interpreting Results

The evaluation produces several key metrics:

- **Average Precision**: Percentage of retrieved documents that are relevant
- **Average Recall**: Percentage of relevant documents that were retrieved
- **Average Latency**: Time taken to retrieve documents (in milliseconds)
- **Answer Quality Metrics**:
  - Relevance: How directly the answer addresses the query (0-10)
  - Completeness: How thoroughly the answer covers all aspects of the query (0-10)
  - Accuracy: How factually correct the answer is compared to expectations (0-10)
  - Overall: Holistic assessment of answer quality (0-10)
  - Model Agreement: How well different LLMs agree on quality scores (0-10)

### Results Location

Evaluation results are saved as JSON files in the `evaluation_results` directory with timestamp-based filenames:

```
evaluation_results/baseline_evaluation_2023-06-15T12-30-45.json
```

## Test Cases

Test cases are defined in `utils/test_queries.ts` and categorized by:

- Query category (pricing, features, competitors, technical, general)
- Complexity level (1-3, where 3 is most complex)
- Expected information (keywords, chunk IDs, source documents)

You can modify this file to add new test cases or update existing ones.

## Extending the Framework

### Adding New Test Cases

To add new test cases, edit `utils/test_queries.ts`:

```typescript
export const TEST_QUERIES: TestCase[] = [
  // Existing queries...
  
  // Add new queries
  {
    query: "What is the pricing for enterprise customers?",
    expectedKeywords: ["enterprise", "pricing", "subscription"],
    category: "pricing",
    complexity: 2
  }
];
```

### Customizing Evaluation Metrics

To modify how metrics are calculated, edit the relevant functions in `utils/evaluation.ts`.

## Completed Implementation Steps

1. ✅ Created 50+ representative test queries
2. ✅ Implemented precision/recall evaluation functions
3. ✅ Added dual-LLM evaluator with GPT-4 and Gemini Flash
4. ✅ Set up benchmarking pipeline with metrics tracking
5. ✅ Established baseline metrics for the current system

## Next Steps

The evaluation framework will be used to measure improvements as we implement:

1. Improved BM25 Implementation
2. Hybrid Search
3. Re-ranking
4. Query Expansion
5. Enhanced Chunking (if needed)
6. Conflict Detection 