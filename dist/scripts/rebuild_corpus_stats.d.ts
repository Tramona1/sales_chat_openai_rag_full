/**
 * Rebuild Corpus Statistics Script
 *
 * This script rebuilds the corpus statistics for the BM25 search algorithm
 * with an emphasis on better handling company-specific information queries.
 *
 * IMPORTANT: This script uses the prepared text field (with contextual information)
 * rather than the originalText field to ensure consistency between vector search
 * and BM25 search. This ensures that keyword search and vector search operate
 * over the same contextually-enhanced representation.
 */
export {};
