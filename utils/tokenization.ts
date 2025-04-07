/**
 * Text tokenization utilities for BM25 implementation
 * Handles text normalization, stopword removal, and stemming
 */

// Common English stopwords to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 
  'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 
  'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with'
]);

/**
 * Simple Porter stemming algorithm implementation
 * Reduces words to their root form (e.g., "running" -> "run")
 */
export function porterStem(word: string): string {
  // This is a simplified stemmer - in production, use the 'natural' NPM package
  
  // Convert to lowercase
  word = word.toLowerCase();
  
  // Handle basic plurals and past tense
  if (word.endsWith('ies') && word.length > 3) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('es') && word.length > 3) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    return word.slice(0, -1);
  }
  if (word.endsWith('ed') && word.length > 3) {
    return word.slice(0, -2);
  }
  if (word.endsWith('ing') && word.length > 4) {
    return word.slice(0, -3);
  }
  
  return word;
}

/**
 * Tokenizes a text string into an array of terms
 * Performs basic text normalization:
 * - Convert to lowercase
 * - Remove punctuation
 * - Split on whitespace
 * - Remove stopwords
 * - Remove very short tokens
 * 
 * @param text The text to tokenize
 * @returns Array of tokenized terms
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Convert to lowercase
  const lowercased = text.toLowerCase();
  
  // Replace punctuation with spaces
  const noPunctuation = lowercased.replace(/[^\w\s]|_/g, ' ');
  
  // Split on whitespace
  const tokens = noPunctuation.split(/\s+/).filter(token => token.length > 0);
  
  // Filter out stopwords and very short tokens
  return tokens.filter(token => 
    token.length > 1 && !STOP_WORDS.has(token)
  );
}

/**
 * Count term frequency in a text
 * 
 * @param text The text to analyze
 * @returns Object mapping each term to its frequency
 */
export function countTermFrequency(text: string): Record<string, number> {
  const tokens = tokenize(text);
  const termFrequency: Record<string, number> = {};
  
  for (const token of tokens) {
    termFrequency[token] = (termFrequency[token] || 0) + 1;
  }
  
  return termFrequency;
}

/**
 * Get the total number of terms in a document (excluding stopwords)
 * 
 * @param text The text to analyze
 * @returns The number of terms in the document
 */
export function getDocumentLength(text: string): number {
  return tokenize(text).length;
}

/**
 * Count term frequencies in a text
 * Returns a map of terms to their frequency
 */
export function getTermFrequencies(text: string): Record<string, number> {
  const terms = tokenize(text);
  const frequencies: Record<string, number> = {};
  
  terms.forEach(term => {
    frequencies[term] = (frequencies[term] || 0) + 1;
  });
  
  return frequencies;
}

/**
 * Get unique terms from a text
 * Returns a Set of unique terms
 */
export function getUniqueTerms(text: string): Set<string> {
  return new Set(tokenize(text));
}

/**
 * Calculate the term frequency normalized by document length
 */
export function normalizedTermFrequency(term: string, text: string): number {
  const terms = tokenize(text);
  const termCount = terms.filter(t => t === term).length;
  return termCount / terms.length;
}

/**
 * Get word count for a given text
 * Used for document length calculations
 */
export function getWordCount(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
} 