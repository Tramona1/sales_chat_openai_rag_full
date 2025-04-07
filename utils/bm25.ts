/**
 * BM25 Implementation for improved document retrieval
 * 
 * This file contains the core BM25 implementation for improved document
 * retrieval beyond vector-based similarity search. BM25 is a widely used
 * ranking function that scores documents based on term frequency and
 * inverse document frequency.
 */

import fs from 'fs/promises';
import path from 'path';
import { tokenize, countTermFrequency, getDocumentLength } from './tokenization';
import { VectorStoreItem } from './vectorStore';

// Interface for a document
export interface Document {
  id: string;
  text: string;
}

// BM25 parameters (can be tuned)
export const BM25_K1 = 1.2;  // Term frequency saturation parameter
export const BM25_B = 0.75;  // Document length normalization parameter

// Corpus statistics for BM25 calculation
export interface CorpusStatistics {
  totalDocuments: number;
  averageDocumentLength: number;
  documentFrequency: Record<string, number>;
  documentLengths: Record<string, number>;
  termFrequency?: Record<string, number>;
  mostCommonTerms?: Array<{ term: string, count: number, percentage: number }>;
}

/**
 * Load corpus statistics from disk
 * These statistics are calculated by the calculate-corpus-stats script
 */
export async function loadCorpusStatistics(): Promise<CorpusStatistics> {
  try {
    const statsDir = path.join(process.cwd(), 'data', 'corpus_stats');
    const statsPath = path.join(statsDir, 'corpus_statistics.json');
    const dfPath = path.join(statsDir, 'document_frequency.json');
    const docLengthsPath = path.join(statsDir, 'document_lengths.json');
    
    // Load main statistics
    const statsData = await fs.readFile(statsPath, 'utf8');
    const stats = JSON.parse(statsData) as CorpusStatistics;
    
    // Load document frequency
    const dfData = await fs.readFile(dfPath, 'utf8');
    stats.documentFrequency = JSON.parse(dfData);
    
    // Load document lengths
    const docLengthsData = await fs.readFile(docLengthsPath, 'utf8');
    stats.documentLengths = JSON.parse(docLengthsData);
    
    return stats;
  } catch (error) {
    console.error('Error loading corpus statistics:', error);
    throw new Error('Failed to load corpus statistics');
  }
}

/**
 * Calculate corpus statistics from vector store
 * Used by the calculate-corpus-stats script
 */
export async function calculateCorpusStatistics(documents: VectorStoreItem[]): Promise<CorpusStatistics> {
  // Initialize statistics
  const stats: CorpusStatistics = {
    totalDocuments: documents.length,
    averageDocumentLength: 0,
    documentFrequency: {},
    documentLengths: {},
    termFrequency: {},
    mostCommonTerms: []
  };
  
  // Process in batches to avoid memory issues
  const batchSize = 100;
  let totalLength = 0;
  
  console.log(`Processing ${documents.length} documents in increments of ${batchSize}...`);
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    console.log(`Processing documents ${i + 1} to ${Math.min(i + batchSize, documents.length)}...`);
    
    for (const doc of batch) {
      const docId = doc.metadata?.source || `doc_${i}`;
      const text = doc.text || '';
      
      // Calculate document length (number of terms)
      const docLength = getDocumentLength(text);
      stats.documentLengths[docId] = docLength;
      totalLength += docLength;
      
      // Calculate term frequencies for the document
      const terms = tokenize(text);
      const uniqueTerms = new Set(terms);
      
      // Update document frequency (number of documents containing each term)
      uniqueTerms.forEach(term => {
        stats.documentFrequency[term] = (stats.documentFrequency[term] || 0) + 1;
        stats.termFrequency![term] = (stats.termFrequency![term] || 0) + terms.filter(t => t === term).length;
      });
    }
  }
  
  // Calculate average document length
  stats.averageDocumentLength = totalLength / documents.length;
  
  // Calculate most common terms
  const termEntries = Object.entries(stats.documentFrequency)
    .map(([term, count]) => ({ term, count, percentage: (count / documents.length) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20 terms
  
  stats.mostCommonTerms = termEntries;
  
  return stats;
}

/**
 * Save corpus statistics to disk
 * Used by the calculate-corpus-stats script
 */
export async function saveCorpusStatistics(stats: CorpusStatistics): Promise<void> {
  try {
    const statsDir = path.join(process.cwd(), 'data', 'corpus_stats');
    
    // Ensure directory exists
    await fs.mkdir(statsDir, { recursive: true });
    
    // Save main statistics
    const mainStats = {
      totalDocuments: stats.totalDocuments,
      averageDocumentLength: stats.averageDocumentLength,
      uniqueTerms: Object.keys(stats.documentFrequency).length,
      termFrequencyStats: calculateTermFrequencyStats(stats.termFrequency || {}),
      mostCommonTerms: stats.mostCommonTerms
    };
    
    await fs.writeFile(
      path.join(statsDir, 'corpus_statistics.json'),
      JSON.stringify(mainStats, null, 2)
    );
    
    // Save document frequency
    await fs.writeFile(
      path.join(statsDir, 'document_frequency.json'),
      JSON.stringify(stats.documentFrequency, null, 2)
    );
    
    // Save document lengths
    await fs.writeFile(
      path.join(statsDir, 'document_lengths.json'),
      JSON.stringify(stats.documentLengths, null, 2)
    );
    
    console.log('Corpus statistics saved to', statsDir);
  } catch (error) {
    console.error('Error saving corpus statistics:', error);
    throw new Error('Failed to save corpus statistics');
  }
}

/**
 * Calculate statistics about term frequency
 */
function calculateTermFrequencyStats(termFrequency: Record<string, number>): { min: number, max: number, avg: number } {
  const values = Object.values(termFrequency);
  
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  return { min, max, avg };
}

/**
 * Calculate BM25 score for a document given a query
 */
export function calculateBM25Score(query: string, document: Document, corpusStats: CorpusStatistics): number {
  const queryTerms = tokenize(query);
  const docLength = getDocumentLength(document.text);
  const docId = document.id;
  
  let score = 0;
  
  // If query or document is empty, return 0
  if (queryTerms.length === 0 || docLength === 0) {
    return 0;
  }
  
  // Calculate score for each query term
  for (const term of queryTerms) {
    // Skip if term not in corpus
    if (!corpusStats.documentFrequency[term]) {
      continue;
    }
    
    // Calculate term frequency in the document
    const tf = countTermFrequency(document.text)[term] || 0;
    
    // Skip if term not in document
    if (tf === 0) {
      continue;
    }
    
    // Calculate inverse document frequency
    const idf = Math.log(
      (corpusStats.totalDocuments - corpusStats.documentFrequency[term] + 0.5) /
      (corpusStats.documentFrequency[term] + 0.5)
    );
    
    // Prevent negative IDF which can happen in certain edge cases
    const safeIdf = Math.max(0, idf);
    
    // Calculate normalized term frequency
    const normalizedTf = 
      (tf * (BM25_K1 + 1)) / 
      (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / corpusStats.averageDocumentLength)));
    
    // Add this term's contribution to the total score
    score += normalizedTf * safeIdf;
  }
  
  return score;
}

/**
 * Hybrid search combining BM25 and vector similarity
 * @param bm25Score The BM25 score (0-1)
 * @param vectorScore The vector similarity score (0-1)
 * @param alpha Weight for BM25 (between 0 and 1)
 * @returns Combined score
 */
export function combineScores(bm25Score: number, vectorScore: number, alpha: number = 0.5): number {
  return alpha * bm25Score + (1 - alpha) * vectorScore;
} 