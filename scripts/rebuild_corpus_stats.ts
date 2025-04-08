/**
 * Rebuild Corpus Statistics Script
 * 
 * This script rebuilds the corpus statistics for the BM25 search algorithm
 * with an emphasis on better handling company-specific information queries.
 */

import fs from 'fs';
import path from 'path';
import { getAllVectorStoreItems } from '../utils/vectorStore';

// Constants
const CORPUS_STATS_PATH = path.join(process.cwd(), 'data', 'corpus_stats');
const TERM_FREQ_PATH = path.join(CORPUS_STATS_PATH, 'term_frequencies.json');
const DOC_FREQ_PATH = path.join(CORPUS_STATS_PATH, 'doc_frequencies.json');
const DOC_COUNT_PATH = path.join(CORPUS_STATS_PATH, 'doc_count.json');

// Simple tokenization function
function tokenizeText(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(token => token.length > 1); // Remove single-character tokens
}

/**
 * Rebuild corpus statistics from vector store items
 */
async function rebuildCorpusStats(): Promise<void> {
  console.log('Rebuilding corpus statistics for BM25 search...');
  
  try {
    // Create corpus stats directory if it doesn't exist
    if (!fs.existsSync(CORPUS_STATS_PATH)) {
      fs.mkdirSync(CORPUS_STATS_PATH, { recursive: true });
      console.log(`Created corpus stats directory at ${CORPUS_STATS_PATH}`);
    }
    
    // Get all items from vector store
    console.log('Loading vector store items...');
    const items = await getAllVectorStoreItems();
    console.log(`Loaded ${items.length} items from vector store`);
    
    if (items.length === 0) {
      console.error('No items found in vector store');
      return;
    }
    
    // Process items to build corpus statistics
    console.log('Processing items...');
    
    // Initialize statistics
    const termFrequencies: Record<string, number> = {};
    const documentFrequencies: Record<string, number> = {};
    const documentCount = items.length;
    
    // Process each item
    items.forEach((item, index) => {
      if (index % 100 === 0) {
        console.log(`Processing item ${index + 1}/${documentCount}...`);
      }
      
      // Ensure item has text
      const text = item.text || '';
      if (!text) return;
      
      // Tokenize document
      const tokens = tokenizeText(text);
      
      // Record unique tokens in this document for document frequency
      const uniqueTokens = new Set(tokens);
      
      // Update term frequencies
      tokens.forEach((token: string) => {
        termFrequencies[token] = (termFrequencies[token] || 0) + 1;
      });
      
      // Update document frequencies
      uniqueTokens.forEach((token: string) => {
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
      console.log(`${i+1}. "${term}": ${freq} occurrences (in ${documentFrequencies[term] || 0} documents)`);
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
      } else {
        // Boost existing company terms to ensure they're well-represented
        termFrequencies[term] = Math.min(9999, termFrequencies[term] * 2);
        documentFrequencies[term] = Math.min(documentCount, documentFrequencies[term] * 1.5);
        console.log(`Boosted existing company term: ${term}`);
      }
    });
    
    // Write statistics to files
    console.log('\nWriting corpus statistics...');
    
    // Write term frequencies
    fs.writeFileSync(TERM_FREQ_PATH, JSON.stringify(termFrequencies, null, 2));
    console.log(`Wrote term frequencies to ${TERM_FREQ_PATH}`);
    
    // Write document frequencies
    fs.writeFileSync(DOC_FREQ_PATH, JSON.stringify(documentFrequencies, null, 2));
    console.log(`Wrote document frequencies to ${DOC_FREQ_PATH}`);
    
    // Write document count
    fs.writeFileSync(DOC_COUNT_PATH, JSON.stringify({ count: documentCount }, null, 2));
    console.log(`Wrote document count to ${DOC_COUNT_PATH}`);
    
    // Summary
    console.log('\nCorpus statistics rebuild complete!');
    console.log(`Total documents: ${documentCount}`);
    console.log(`Unique terms: ${Object.keys(termFrequencies).length}`);
  } catch (error) {
    console.error('Error rebuilding corpus statistics:', error);
  }
}

// Run the script
console.log('Starting corpus statistics rebuild...');
rebuildCorpusStats()
  .then(() => console.log('Corpus statistics rebuild completed successfully!'))
  .catch(err => console.error('Failed to rebuild corpus statistics:', err)); 