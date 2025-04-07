"use strict";
/**
 * Script to calculate initial corpus statistics from existing vector store items
 * This creates the foundation for the BM25 scoring system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bm25_1 = require("../utils/bm25");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Access to the vectorStore items
let vectorStore = [];
/**
 * Load the vector store content - adapted from vectorStore.ts implementation
 */
async function loadVectorStore() {
    try {
        // Try loading from single vectorStore.json file as this is what our system currently uses
        const singleStoreFile = path_1.default.join(process.cwd(), 'data', 'vectorStore.json');
        const fileExists = await promises_1.default.access(singleStoreFile).then(() => true).catch(() => false);
        if (fileExists) {
            const fileData = await promises_1.default.readFile(singleStoreFile, 'utf8');
            const parsedData = JSON.parse(fileData);
            // Handle both formats: array of items or {items: [...]} structure
            if (Array.isArray(parsedData)) {
                return parsedData;
            }
            else if (parsedData.items && Array.isArray(parsedData.items)) {
                return parsedData.items;
            }
        }
        console.log('No vector store file found or empty store');
        return [];
    }
    catch (error) {
        console.error('Error loading vector store:', error);
        return [];
    }
}
async function calculateCorpusStats() {
    try {
        console.log('Loading vector store...');
        vectorStore = await loadVectorStore();
        if (vectorStore.length === 0) {
            console.log('No items found in vector store. Please add documents first.');
            return;
        }
        console.log(`Found ${vectorStore.length} items in vector store.`);
        console.log('Calculating corpus statistics...');
        const stats = await (0, bm25_1.calculateCorpusStatistics)(vectorStore);
        console.log('\nCorpus statistics:');
        console.log(`Total documents: ${stats.totalDocuments}`);
        console.log(`Average document length: ${stats.averageDocumentLength.toFixed(2)} tokens`);
        console.log(`Total unique terms: ${Object.keys(stats.documentFrequency).length}`);
        // Term frequency statistics with proper typing
        const termCounts = Object.values(stats.documentFrequency);
        const maxCount = Math.max(...termCounts);
        const minCount = Math.min(...termCounts);
        const avgCount = termCounts.reduce((sum, count) => sum + count, 0) / termCounts.length;
        console.log('\nTerm frequency statistics:');
        console.log(`Maximum term frequency: ${maxCount}`);
        console.log(`Minimum term frequency: ${minCount}`);
        console.log(`Average term frequency: ${avgCount.toFixed(2)}`);
        // Show most common terms
        console.log('\nMost common terms:');
        const sortedTerms = Object.entries(stats.documentFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        sortedTerms.forEach(([term, count], index) => {
            console.log(`  ${index + 1}. "${term}" - appears in ${count} documents (${(count / stats.totalDocuments * 100).toFixed(2)}%)`);
        });
        console.log('\nSaving corpus statistics...');
        await (0, bm25_1.saveCorpusStatistics)(stats);
        console.log('Corpus statistics saved successfully.');
    }
    catch (error) {
        console.error('Error calculating corpus statistics:', error);
    }
}
// Execute the main function
calculateCorpusStats();
