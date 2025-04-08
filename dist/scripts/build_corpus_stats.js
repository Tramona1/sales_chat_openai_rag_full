"use strict";
/**
 * Build Corpus Statistics Script
 *
 * This script builds corpus statistics for the BM25 search algorithm,
 * which are used in the hybrid search to improve keyword matching.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Constants
const VECTOR_STORE_PATH = path_1.default.join(process.cwd(), 'data', 'vectorStore.json');
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
 * Build corpus statistics for BM25 search
 */
async function buildCorpusStats() {
    console.log('Building corpus statistics for BM25 search...');
    try {
        // Create corpus stats directory if it doesn't exist
        if (!fs_1.default.existsSync(CORPUS_STATS_PATH)) {
            fs_1.default.mkdirSync(CORPUS_STATS_PATH, { recursive: true });
            console.log(`Created corpus stats directory at ${CORPUS_STATS_PATH}`);
        }
        // Check if vector store exists
        if (!fs_1.default.existsSync(VECTOR_STORE_PATH)) {
            console.error(`Vector store not found at ${VECTOR_STORE_PATH}`);
            return;
        }
        // Read and parse vector store
        console.log('Reading vector store...');
        const data = fs_1.default.readFileSync(VECTOR_STORE_PATH, 'utf8');
        const parsedData = JSON.parse(data);
        // Extract documents based on vector store format
        let documents = [];
        if (Array.isArray(parsedData)) {
            documents = parsedData;
            console.log(`Found ${documents.length} documents in array format`);
        }
        else if (parsedData && typeof parsedData === 'object') {
            if (Array.isArray(parsedData.items)) {
                documents = parsedData.items;
                console.log(`Found ${documents.length} documents in object.items format`);
            }
            else if (parsedData.batches && Array.isArray(parsedData.batches)) {
                for (const batch of parsedData.batches) {
                    if (batch.items && Array.isArray(batch.items)) {
                        documents = documents.concat(batch.items);
                    }
                }
                console.log(`Found ${documents.length} documents in batches format`);
            }
        }
        if (documents.length === 0) {
            console.error('No documents found in vector store');
            return;
        }
        // Process documents to build corpus statistics
        console.log('Processing documents...');
        // Initialize statistics
        const termFrequencies = {};
        const documentFrequencies = {};
        const documentCount = documents.length;
        // Process each document
        documents.forEach((doc, index) => {
            if (index % 100 === 0) {
                console.log(`Processing document ${index + 1}/${documentCount}...`);
            }
            // Ensure document has text
            const text = doc.text || '';
            if (!text)
                return;
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
        });
        // Ensure important company terms are in the stats even if not in any documents
        const companyTerms = [
            'workstream', 'company', 'pricing', 'features', 'product', 'service',
            'enterprise', 'professional', 'starter', 'investor', 'investors',
            'funding', 'investment', 'backed', 'venture', 'capital', 'series',
            'series a', 'series b', 'round', 'raised', 'fund', 'funds',
            'our', 'we', 'us', 'team', 'staff', 'employees', 'workers',
            'hourly', 'deskless', 'hire', 'hiring'
        ];
        companyTerms.forEach(term => {
            if (!termFrequencies[term]) {
                termFrequencies[term] = 5; // Increased from 1 for better weighting
                documentFrequencies[term] = 5; // Increased from 1
                console.log(`Added missing company term: ${term}`);
            }
            else {
                // Boost existing company terms to ensure they're well-represented
                termFrequencies[term] *= 2;
                documentFrequencies[term] = Math.min(documentCount, documentFrequencies[term] * 2);
                console.log(`Boosted existing company term: ${term}`);
            }
        });
        // Write statistics to files
        console.log('Writing corpus statistics...');
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
        console.log('\nCorpus statistics summary:');
        console.log(`Total documents: ${documentCount}`);
        console.log(`Unique terms: ${Object.keys(termFrequencies).length}`);
        // Print some of the most frequent terms
        const sortedTerms = Object.entries(termFrequencies)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
        console.log('\nTop 20 most frequent terms:');
        sortedTerms.forEach(([term, freq], index) => {
            console.log(`${index + 1}. "${term}": ${freq} occurrences (in ${documentFrequencies[term] || 0} documents)`);
        });
        console.log('\nCorpus statistics built successfully!');
    }
    catch (error) {
        console.error('Error building corpus statistics:', error);
    }
}
// Run the script
buildCorpusStats().catch(console.error);
