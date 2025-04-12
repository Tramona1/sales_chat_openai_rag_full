"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vectorStore_1 = require("../utils/vectorStore");
// Constants
const CORPUS_STATS_PATH = path_1.default.join(process.cwd(), 'data', 'corpus_stats');
const TERM_FREQ_PATH = path_1.default.join(CORPUS_STATS_PATH, 'term_frequencies.json');
const DOC_FREQ_PATH = path_1.default.join(CORPUS_STATS_PATH, 'doc_frequencies.json');
const DOC_COUNT_PATH = path_1.default.join(CORPUS_STATS_PATH, 'doc_count.json');
// Simple tokenization function
function tokenizeText(text) {
    if (!text)
        return [];
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .split(/\s+/)
        .filter(token => token.length > 1); // Remove single-character tokens
}
/**
 * Rebuild corpus statistics from vector store items
 */
async function rebuildCorpusStats() {
    console.log('Rebuilding corpus statistics for BM25 search...');
    console.log('Using the prepared text field with contextual information (same as what was embedded)');
    console.log('This ensures consistency between vector search and BM25 search, with both operating over the same enhanced representation.');
    try {
        // Create corpus stats directory if it doesn't exist
        if (!fs_1.default.existsSync(CORPUS_STATS_PATH)) {
            fs_1.default.mkdirSync(CORPUS_STATS_PATH, { recursive: true });
            console.log(`Created corpus stats directory at ${CORPUS_STATS_PATH}`);
        }
        // Get all items from vector store
        console.log('Loading vector store items...');
        const items = await (0, vectorStore_1.getAllVectorStoreItems)();
        console.log(`Loaded ${items.length} items from vector store`);
        if (items.length === 0) {
            console.error('No items found in vector store');
            return;
        }
        // Process items to build corpus statistics
        console.log('Processing items...');
        // Initialize statistics
        const termFrequencies = {};
        const documentFrequencies = {};
        const documentCount = items.length;
        // Process each item
        items.forEach((item, index) => {
            if (index % 100 === 0) {
                console.log(`Processing item ${index + 1}/${documentCount}...`);
            }
            // CRITICAL: Use the 'text' field that was prepared with context (same as what was embedded)
            // This is the key to consistency between vector search and BM25 search
            const text = item.text || '';
            if (!text) {
                console.warn(`Item at index ${index} has no text field. Skipping.`);
                return;
            }
            // Tokenize document
            const tokens = tokenizeText(text);
            // Record unique tokens in this document for document frequency
            const uniqueTokens = new Set(tokens);
            // Update term frequencies
            tokens.forEach((token) => {
                termFrequencies[token] = (termFrequencies[token] || 0) + 1;
            });
            // Update document frequencies
            uniqueTokens.forEach((token) => {
                documentFrequencies[token] = (documentFrequencies[token] || 0) + 1;
            });
            // Extract and add metadata terms (categories, entities, etc.)
            if (item.metadata) {
                // Add category as a term
                if (item.metadata.category) {
                    const categoryToken = item.metadata.category.toString().toLowerCase();
                    termFrequencies[categoryToken] = (termFrequencies[categoryToken] || 0) + 5;
                    documentFrequencies[categoryToken] = (documentFrequencies[categoryToken] || 0) + 1;
                }
                // Add document type as a term if available
                if (item.metadata.documentType) {
                    const docTypeToken = item.metadata.documentType.toString().toLowerCase();
                    termFrequencies[docTypeToken] = (termFrequencies[docTypeToken] || 0) + 4;
                    documentFrequencies[docTypeToken] = (documentFrequencies[docTypeToken] || 0) + 1;
                }
                // Add primary topics as terms if available
                if (item.metadata.primaryTopics) {
                    const topics = item.metadata.primaryTopics.toString().toLowerCase().split(/,\s*/);
                    topics.forEach(topic => {
                        if (topic.length > 0) {
                            termFrequencies[topic] = (termFrequencies[topic] || 0) + 3;
                            documentFrequencies[topic] = (documentFrequencies[topic] || 0) + 1;
                        }
                    });
                }
                // Add source domain as terms
                if (item.metadata.source) {
                    const source = item.metadata.source.toString();
                    const domain = source.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
                    if (domain) {
                        termFrequencies[domain] = (termFrequencies[domain] || 0) + 3;
                        documentFrequencies[domain] = (documentFrequencies[domain] || 0) + 1;
                    }
                    // Add path segments as terms
                    const pathSegments = source.split('/').slice(3).filter(s => s.length > 0);
                    pathSegments.forEach(segment => {
                        const pathToken = segment.toLowerCase();
                        termFrequencies[pathToken] = (termFrequencies[pathToken] || 0) + 2;
                        documentFrequencies[pathToken] = (documentFrequencies[pathToken] || 0) + 1;
                    });
                }
            }
        });
        // Calculate top terms by frequency for logging
        const topTerms = Object.entries(termFrequencies)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
        console.log('\nTop 20 terms by frequency:');
        topTerms.forEach(([term, freq], i) => {
            console.log(`${i + 1}. "${term}": ${freq} occurrences (in ${documentFrequencies[term] || 0} documents)`);
        });
        // Enhance the statistics for company-related terms
        console.log('\nEnhancing statistics for company-related terms...');
        // Generic enhancement for common company-related terms
        const companyTermsToBoost = [
            // Company identification
            'workstream', 'company', 'business', 'organization', 'enterprise',
            // Products & Services
            'product', 'service', 'feature', 'solution', 'platform', 'app', 'application',
            'software', 'tool', 'system',
            // Pricing & Plans
            'pricing', 'price', 'cost', 'fee', 'plan', 'subscription', 'tier',
            'basic', 'premium', 'professional', 'enterprise', 'starter',
            // People & Organization
            'team', 'employee', 'staff', 'founder', 'ceo', 'leadership', 'manager',
            'investor', 'partner', 'client', 'customer', 'user',
            // Common possessive terms
            'our', 'we', 'us', 'their', 'your',
            // Question words (to help match information-seeking queries)
            'what', 'who', 'how', 'when', 'where', 'why', 'which'
        ];
        companyTermsToBoost.forEach(term => {
            if (!termFrequencies[term]) {
                termFrequencies[term] = 10; // Add if missing
                documentFrequencies[term] = 5;
                console.log(`Added missing company term: ${term}`);
            }
            else {
                // Boost existing company terms to ensure they're well-represented
                termFrequencies[term] = Math.min(9999, termFrequencies[term] * 2);
                documentFrequencies[term] = Math.min(documentCount, documentFrequencies[term] * 1.5);
                console.log(`Boosted existing company term: ${term}`);
            }
        });
        // Write statistics to files
        console.log('\nWriting corpus statistics...');
        // Write term frequencies
        fs_1.default.writeFileSync(TERM_FREQ_PATH, JSON.stringify(termFrequencies, null, 2));
        console.log(`Wrote term frequencies to ${TERM_FREQ_PATH}`);
        // Write document frequencies
        fs_1.default.writeFileSync(DOC_FREQ_PATH, JSON.stringify(documentFrequencies, null, 2));
        console.log(`Wrote document frequencies to ${DOC_FREQ_PATH}`);
        // Write document count
        fs_1.default.writeFileSync(DOC_COUNT_PATH, JSON.stringify({ count: documentCount }, null, 2));
        console.log(`Wrote document count to ${DOC_COUNT_PATH}`);
        // Summary
        console.log('\nCorpus statistics rebuild complete!');
        console.log(`Total documents: ${documentCount}`);
        console.log(`Unique terms: ${Object.keys(termFrequencies).length}`);
    }
    catch (error) {
        console.error('Error rebuilding corpus statistics:', error);
    }
}
// Run the script
console.log('Starting corpus statistics rebuild...');
rebuildCorpusStats()
    .then(() => console.log('Corpus statistics rebuild completed successfully!'))
    .catch(err => console.error('Failed to rebuild corpus statistics:', err));
