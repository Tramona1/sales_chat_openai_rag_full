/**
 * Script to check if investor information exists in the vector store
 * This will help us understand if the issue is missing data or retrieval problems
 */

import fs from 'fs';
import path from 'path';
import { VectorStoreItem, getAllVectorStoreItems, cosineSimilarity } from '../utils/vectorStore';
import { embedText } from '../utils/openaiClient';

// Search terms to look for
const INVESTOR_RELATED_TERMS = [
  'investor', 'funding', 'investment', 'venture capital', 'vc', 'backed by',
  'series a', 'series b', 'funding round', 'invested', 'raised'
];

async function checkVectorStore() {
  console.log('Checking vector store for investor information...');

  try {
    // Get all items from vector store
    const items = await getAllVectorStoreItems();
    console.log(`Vector store contains ${items.length} items`);

    // 1. Text search - look for exact matches
    console.log('\n--- TEXT SEARCH RESULTS ---');
    let textMatches = 0;
    const matchingItems: VectorStoreItem[] = [];

    for (const item of items) {
      const text = item.text ?? '';
      for (const term of INVESTOR_RELATED_TERMS) {
        if (text.includes(term.toLowerCase())) {
          textMatches++;
          matchingItems.push(item);
          console.log(`Match found for "${term}" in item:`, {
            source: item.metadata?.source || 'Unknown',
            excerpt: text.substring(Math.max(0, text.indexOf(term) - 50), 
                                  Math.min(text.length, text.indexOf(term) + 100))
          });
          break; // Only count each item once
        }
      }
    }
    console.log(`Found ${textMatches} items with investor-related terms`);

    // 2. Vector search for "investors"
    console.log('\n--- VECTOR SEARCH RESULTS ---');
    const query = "Who are the investors of Workstream?";
    const queryEmbedding = await embedText(query);
    
    // Calculate similarity scores
    const results = items
      .filter(item => item.embedding && Array.isArray(item.embedding))
      .map(item => {
        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(queryEmbedding, item.embedding as number[]);
        return {
          item,
          similarity
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
    
    console.log(`Top 5 vector search results for "${query}":`);
    results.forEach((result, i) => {
      console.log(`${i+1}. Similarity: ${result.similarity.toFixed(4)}, Source: ${result.item.metadata?.source || 'Unknown'}`);
      if (result.item.text) {
        console.log(`   Excerpt: ${result.item.text.substring(0, 150)}...`);
      }
    });

    // 3. Check if we are missing relevant categories
    console.log('\n--- CATEGORY ANALYSIS ---');
    const categories = new Set<string>();
    items.forEach(item => {
      if (item.metadata?.category) {
        categories.add(item.metadata.category.toString());
      }
    });
    console.log('Available categories in vector store:', Array.from(categories));

    console.log('\nAnalysis complete.');
  } catch (error) {
    console.error('Error checking vector store:', error);
  }
}

// Helper function to calculate cosine similarity
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  
  return dotProduct / (mag1 * mag2);
}

async function checkSimilarities(items: VectorStoreItem[]) {
  console.log('\nChecking for high similarity between items...');
  let similarPairCount = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      // Ensure embeddings exist before calculating similarity
      if (items[i]?.embedding && items[j]?.embedding) { 
        const similarity = cosineSimilarity(items[i].embedding, items[j].embedding);
        if (similarity > 0.95) { // High threshold for potential duplicates
          console.warn(
            `High similarity (${similarity.toFixed(3)}) found between:` +
            `\n  - ${items[i].metadata?.source || 'Unknown'} (Index ${i})` +
            `\n  - ${items[j].metadata?.source || 'Unknown'} (Index ${j})`
          );
          if (items[i].text) {
             console.warn(`    Item ${i} Excerpt: ${items[i].text?.substring(0, 80)}...`);
          }
           if (items[j].text) {
            console.warn(`    Item ${j} Excerpt: ${items[j].text?.substring(0, 80)}...`);
           }
          similarPairCount++;
        }
      }
    }
  }
   if (similarPairCount === 0) {
    console.log('No highly similar item pairs found.');
  } else {
    console.log(`Found ${similarPairCount} pairs with similarity > 0.95.`);
  }
}

async function testSearch(query: string, items: VectorStoreItem[]) {
  console.log(`\nTesting search for query: "${query}"`);
  try {
    const { getSimilarItems } = require('./vectorStore'); // Use require for dynamic import in script
    const queryEmbedding = await embedText(query);
    const results = await getSimilarItems(queryEmbedding, 5);
    console.log(`Found ${results.length} results:`);
    results.forEach((result: VectorStoreItem & { score: number }, index: number) => {
      console.log(`  ${index + 1}. Score: ${result.score.toFixed(3)}`);
      console.log(`     Source: ${result.metadata?.source || 'Unknown'}`);
      if (result.text) { // Use result.text directly
          console.log(`     Excerpt: ${result.text.substring(0, 150)}...`);
      }
    });
  } catch (error) {
    console.error('Error during search test:', error);
  }
}

async function checkTextQuality(items: VectorStoreItem[]) {
  console.log('\nChecking for potential text quality issues...');
  const issues: string[] = [];
  items.forEach((item, index) => {
    const text = item.text ?? '';
    if (text.length < 50) {
      issues.push(`Item ${index} (${item.metadata?.source || 'Unknown'}) has very short text (${text.length} chars)`);
    }
  });
  if (issues.length > 0) {
    console.warn('Potential text quality issues found:');
    issues.forEach(issue => console.warn(issue));
  } else {
    console.log('No potential text quality issues found.');
  }
}

// Run the script
checkVectorStore().catch(console.error); 