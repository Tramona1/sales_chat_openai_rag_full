/**
 * Text tokenization utilities for BM25 implementation
 * Handles text normalization, stopword removal, and stemming
 */
/**
 * Simple Porter stemming algorithm implementation
 * Reduces words to their root form (e.g., "running" -> "run")
 */
export declare function porterStem(word: string): string;
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
export declare function tokenize(text: string): string[];
/**
 * Count term frequency in a text
 *
 * @param text The text to analyze
 * @returns Object mapping each term to its frequency
 */
export declare function countTermFrequency(text: string): Record<string, number>;
/**
 * Get the total number of terms in a document (excluding stopwords)
 *
 * @param text The text to analyze
 * @returns The number of terms in the document
 */
export declare function getDocumentLength(text: string): number;
/**
 * Count term frequencies in a text
 * Returns a map of terms to their frequency
 */
export declare function getTermFrequencies(text: string): Record<string, number>;
/**
 * Get unique terms from a text
 * Returns a Set of unique terms
 */
export declare function getUniqueTerms(text: string): Set<string>;
/**
 * Calculate the term frequency normalized by document length
 */
export declare function normalizedTermFrequency(term: string, text: string): number;
/**
 * Get word count for a given text
 * Used for document length calculations
 */
export declare function getWordCount(text: string): number;
