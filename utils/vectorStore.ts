export interface VectorStoreItem {
  id?: string;
  embedding: number[];
  text: string;
  metadata?: {
    source?: string;
    page?: number;
    batch?: string;
    isStructured?: boolean;
    infoType?: string;
    priority?: string;
    category?: string;
    technicalLevel?: number;
    entities?: string;
    keywords?: string;
    summary?: string;
    lastUpdated?: string;
    timestamp?: string;
    createdAt?: string;
    approvedAt?: string; // Timestamp when the document was approved
    isAuthoritative?: string; // Marks this as the authoritative source for this information
    isDeprecated?: string; // Marks this document as outdated/deprecated
    deprecatedBy?: string; // ID of the document that supersedes this one
    deprecatedAt?: string; // Timestamp when this document was deprecated
  };
}

import fs from 'fs';
import path from 'path';

// Constants for batch processing
const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
const BATCH_INDEX_FILE = path.join(process.cwd(), 'data', 'batch_index.json');
const MAX_BATCH_SIZE = 1000; // Maximum items per batch file

// In-memory vector store (now loads from multiple files)
let vectorStore: VectorStoreItem[] = [];
let activeBatches: string[] = [];

// Initialize vector store directory
function initVectorStore() {
  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Ensure vector_batches directory exists
  if (!fs.existsSync(VECTOR_STORE_DIR)) {
    fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
  }
  
  // Create batch index if it doesn't exist
  if (!fs.existsSync(BATCH_INDEX_FILE)) {
    fs.writeFileSync(BATCH_INDEX_FILE, JSON.stringify({ 
      activeBatches: [],
      lastUpdated: Date.now() 
    }));
  }
}

// Load vector store index and all active batches
function loadVectorStore() {
  try {
    initVectorStore();
    console.log('Loading vector store batches...');
    
    // Read the batch index
    const indexData = JSON.parse(fs.readFileSync(BATCH_INDEX_FILE, 'utf-8'));
    activeBatches = indexData.activeBatches || [];
    
    // Load each active batch
    vectorStore = [];
    let totalLoaded = 0;
    
    for (const batchId of activeBatches) {
      const batchFile = path.join(VECTOR_STORE_DIR, `batch_${batchId}.json`);
      if (fs.existsSync(batchFile)) {
        try {
          const batchData = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
          vectorStore = [...vectorStore, ...batchData];
          totalLoaded += batchData.length;
          console.log(`Loaded batch ${batchId} with ${batchData.length} items`);
        } catch (error) {
          console.error(`Error loading batch ${batchId}:`, error);
        }
      }
    }
    
    // If no batches were loaded, try loading from single vectorStore.json file as fallback
    if (totalLoaded === 0) {
      const singleStoreFile = path.join(process.cwd(), 'data', 'vectorStore.json');
      if (fs.existsSync(singleStoreFile)) {
        try {
          const fileData = fs.readFileSync(singleStoreFile, 'utf8');
          const parsedData = JSON.parse(fileData);
          
          // Handle both formats: array of items or {items: [...]} structure
          if (Array.isArray(parsedData)) {
            vectorStore = parsedData;
            totalLoaded = parsedData.length;
          } else if (parsedData.items && Array.isArray(parsedData.items)) {
            vectorStore = parsedData.items;
            totalLoaded = parsedData.items.length;
          }
          
          console.log(`Loaded ${totalLoaded} items from single vectorStore.json file`);
        } catch (error) {
          console.error('Error loading from single vectorStore.json file:', error);
        }
      }
    }
    
    console.log(`Loaded ${totalLoaded} total items from ${activeBatches.length} batches and fallback sources`);
  } catch (error) {
    console.error('Error loading vector store:', error);
    vectorStore = [];
    activeBatches = [];
  }
}

// Create a new batch and add it to the index
function createNewBatch(): string {
  const batchId = Date.now().toString();
  activeBatches.push(batchId);
  
  // Update the batch index
  fs.writeFileSync(BATCH_INDEX_FILE, JSON.stringify({
    activeBatches,
    lastUpdated: Date.now()
  }, null, 2));
  
  console.log(`Created new batch: ${batchId}`);
  return batchId;
}

// Save a specific batch to disk
function saveBatch(batchId: string, items: VectorStoreItem[]) {
  const batchFile = path.join(VECTOR_STORE_DIR, `batch_${batchId}.json`);
  fs.writeFileSync(batchFile, JSON.stringify(items, null, 2));
  console.log(`Saved batch ${batchId} with ${items.length} items`);
}

// Save the current state of all batches
function saveVectorStore() {
  try {
    if (activeBatches.length === 0 && vectorStore.length > 0) {
      // First-time save - create initial batch
      const initialBatchId = createNewBatch();
      
      // Add batch metadata to all items
      vectorStore = vectorStore.map(item => ({
        ...item,
        metadata: {
          ...item.metadata,
          batch: initialBatchId
        }
      }));
      
      // Save as first batch
      saveBatch(initialBatchId, vectorStore);
    } else {
      // Group items by batch
      const batchMap: Record<string, VectorStoreItem[]> = {};
      
      // Find items without batch ID (newly added)
      const unbatchedItems = vectorStore.filter(item => !item.metadata?.batch);
      
      if (unbatchedItems.length > 0) {
        // Get current batch or create new one
        let currentBatchId = activeBatches[activeBatches.length - 1];
        
        if (currentBatchId) {
          // Count items in the current batch
          const currentBatchCount = vectorStore.filter(
            item => item.metadata?.batch === currentBatchId
          ).length;
          
          // Create a new batch if current one is too full
          if (currentBatchCount + unbatchedItems.length > MAX_BATCH_SIZE) {
            currentBatchId = createNewBatch();
          }
        } else {
          // No batches exist yet, create the first one
          currentBatchId = createNewBatch();
        }
        
        // Assign batch ID to unbatched items
        unbatchedItems.forEach(item => {
          if (!item.metadata) item.metadata = {};
          item.metadata.batch = currentBatchId;
        });
      }
      
      // Group all items by batch
      vectorStore.forEach(item => {
        const batchId = item.metadata?.batch;
        if (batchId) {
          if (!batchMap[batchId]) batchMap[batchId] = [];
          batchMap[batchId].push(item);
        }
      });
      
      // Save each batch
      Object.entries(batchMap).forEach(([batchId, items]) => {
        if (items.length > 0) {
          saveBatch(batchId, items);
        }
      });
    }
    
    // Update index file
    fs.writeFileSync(BATCH_INDEX_FILE, JSON.stringify({
      activeBatches,
      lastUpdated: Date.now()
    }, null, 2));
    
    // Also save to the single vectorStore.json file as a backup
    const singleStoreFile = path.join(process.cwd(), 'data', 'vectorStore.json');
    fs.writeFileSync(singleStoreFile, JSON.stringify({ 
      items: vectorStore,
      lastUpdated: Date.now()
    }, null, 2));
    
    console.log(`Saved vector store with ${activeBatches.length} batches and ${vectorStore.length} total items`);
  } catch (error) {
    console.error('Error saving vector store:', error);
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param vecA First vector
 * @param vecB Second vector
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}

/**
 * Add an item or multiple items to the vector store
 * @param items Single item or array of items to add
 */
export function addToVectorStore(items: VectorStoreItem | VectorStoreItem[]): void {
  // Convert single item to array
  const itemsArray = Array.isArray(items) ? items : [items];
  if (itemsArray.length === 0) return;
  
  // Add to in-memory store
  vectorStore = [...vectorStore, ...itemsArray];
  
  // Save changes to disk
  saveVectorStore();
}

// Enhanced version of getSimilarItems with stronger emphasis on structured data
export function getSimilarItems(
  queryEmbedding: number[],
  limit: number = 5,
  queryText?: string,
  priorityInfoType?: string
): (VectorStoreItem & { score: number })[] {
  // Check if the vector store is initialized
  if (!vectorStore || vectorStore.length === 0) {
    loadVectorStore();
  }
  
  if (!vectorStore || vectorStore.length === 0) {
    console.warn('Vector store is empty. No results to return.');
    return [];
  }
  
  console.log('Searching for similar items...');
  
  // Look for certain types of inquiries to boost specific content
  let shouldBoostStructuredInfo = false;
  let shouldBoostCompanyValues = false;
  let shouldBoostInvestors = false;
  let shouldBoostLeadership = false;
  let shouldBoostPricing = false;
  let shouldBoostProductFeatures = false;
  let shouldBoostSalesInfo = false;
  
  if (queryText) {
    const queryLower = queryText.toLowerCase();
    
    // Check for company values inquiries
    shouldBoostCompanyValues = queryLower.includes('value') || 
                               queryLower.includes('culture') || 
                               queryLower.includes('principle') ||
                               queryLower.includes('mission') ||
                               queryLower.includes('vision');
    
    // Check for investor inquiries
    shouldBoostInvestors = queryLower.includes('investor') || 
                           queryLower.includes('funding') || 
                           queryLower.includes('backed by') ||
                           queryLower.includes('invested');
    
    // Check for leadership inquiries
    shouldBoostLeadership = queryLower.includes('founder') || 
                            queryLower.includes('ceo') || 
                            queryLower.includes('leader') ||
                            queryLower.includes('executive');
                            
    // Check for pricing inquiries
    shouldBoostPricing = queryLower.includes('pricing') ||
                         queryLower.includes('price') ||
                         queryLower.includes('cost') ||
                         queryLower.includes('subscription') ||
                         queryLower.includes('plan') ||
                         queryLower.includes('tier');
                         
    // Check for product feature inquiries  
    shouldBoostProductFeatures = queryLower.includes('feature') ||
                                queryLower.includes('function') ||
                                queryLower.includes('capability') ||
                                queryLower.includes('how does it work') ||
                                queryLower.includes('what does it do');
                                
    // Check for sales information inquiries
    shouldBoostSalesInfo = queryLower.includes('sell') ||
                          queryLower.includes('pitch') ||
                          queryLower.includes('competitor') ||
                          queryLower.includes('comparison');
    
    // Set the overall structured info flag if any specific type should be boosted
    shouldBoostStructuredInfo = shouldBoostCompanyValues || 
                                shouldBoostInvestors || 
                                shouldBoostLeadership ||
                                shouldBoostPricing ||
                                shouldBoostProductFeatures ||
                                shouldBoostSalesInfo;
  }
  
  // Calculate similarity scores
  const itemsWithScores = vectorStore.map(item => {
    // Compute base score using cosine similarity
    let score = cosineSimilarity(queryEmbedding, item.embedding);
    
    // Apply boosting for structured information when relevant
    if (shouldBoostStructuredInfo && item.metadata?.isStructured) {
      // Specific boosts for different types of structured information
      const infoType = item.metadata?.infoType;
      
      // Handle the case when a specific info type is prioritized
      if (priorityInfoType && infoType === priorityInfoType) {
        score *= 1.5; // Strong boost for exact info type match
      }
      // Otherwise, apply standard boosts
      else if (shouldBoostCompanyValues && infoType === 'company_values') {
        score *= 1.3;
      } else if (shouldBoostInvestors && infoType === 'investors') {
        score *= 1.3;
      } else if (shouldBoostLeadership && infoType === 'leadership') {
        score *= 1.3;
      } else if (shouldBoostPricing && infoType === 'pricing') {
        score *= 1.3;
      } else if (shouldBoostProductFeatures && infoType === 'product_features') {
        score *= 1.3;
      } else if (shouldBoostSalesInfo && infoType === 'sales_info') {
        score *= 1.3;
      } else if (item.metadata?.isStructured) {
        // General boost for any structured info
        score *= 1.1;
      }
    }
    
    return { ...item, score };
  });
  
  // Sort by similarity score
  const sortedResults = itemsWithScores.sort((a, b) => b.score - a.score);
  
  // Get the top results, but ensure priority structured info is included if relevant
  let result = sortedResults.slice(0, limit);
  
  // Check if we need to guarantee inclusion of specific structured info
  if (shouldBoostStructuredInfo) {
    // Check if we already have a relevant piece of structured information
    let hasRelevantStructuredInfo = false;
    
    // Use the priorityInfoType if available, otherwise check all relevant types
    if (priorityInfoType) {
      hasRelevantStructuredInfo = result.some(
        item => item.metadata?.infoType === priorityInfoType
      );
    } else {
      hasRelevantStructuredInfo = result.some(item => {
        const infoType = item.metadata?.infoType;
        return (shouldBoostCompanyValues && infoType === 'company_values') ||
               (shouldBoostInvestors && infoType === 'investors') ||
               (shouldBoostLeadership && infoType === 'leadership') ||
               (shouldBoostPricing && infoType === 'pricing') ||
               (shouldBoostProductFeatures && infoType === 'product_features') ||
               (shouldBoostSalesInfo && infoType === 'sales_info');
      });
    }
    
    // If we don't have the relevant info in our top results, find and include it
    if (!hasRelevantStructuredInfo) {
      let structuredInfoToInclude;
      
      if (priorityInfoType) {
        // Look for the specific priority info type
        structuredInfoToInclude = sortedResults.find(
          item => item.metadata?.infoType === priorityInfoType && !result.includes(item)
        );
      } else {
        // Look for any relevant structured info type
        structuredInfoToInclude = sortedResults.find(item => {
          const infoType = item.metadata?.infoType;
          return ((shouldBoostCompanyValues && infoType === 'company_values') ||
                 (shouldBoostInvestors && infoType === 'investors') ||
                 (shouldBoostLeadership && infoType === 'leadership') ||
                 (shouldBoostPricing && infoType === 'pricing') ||
                 (shouldBoostProductFeatures && infoType === 'product_features') ||
                 (shouldBoostSalesInfo && infoType === 'sales_info')) &&
                 !result.includes(item);
        });
      }
      
      // If we found a relevant item, add it and remove the lowest scored item
      if (structuredInfoToInclude) {
        result.pop(); // Remove the lowest scored item
        result.push(structuredInfoToInclude);
        // Re-sort to maintain score order
        result = result.sort((a, b) => b.score - a.score);
      }
    }
  }
  
  return result;
}

/**
 * Clear the vector store
 */
export function clearVectorStore(): void {
  // Clear in-memory data
  vectorStore = [];
  
  // Delete all batch files
  try {
    if (fs.existsSync(VECTOR_STORE_DIR)) {
      const files = fs.readdirSync(VECTOR_STORE_DIR);
      files.forEach(file => {
        if (file.startsWith('batch_')) {
          fs.unlinkSync(path.join(VECTOR_STORE_DIR, file));
        }
      });
    }
    
    // Reset batch index
    activeBatches = [];
    fs.writeFileSync(BATCH_INDEX_FILE, JSON.stringify({
      activeBatches: [],
      lastUpdated: Date.now()
    }, null, 2));
    
    console.log('Vector store cleared successfully');
  } catch (error) {
    console.error('Error clearing vector store:', error);
  }
}

/**
 * Get the current size of the vector store
 * @returns Number of items in the vector store
 */
export function getVectorStoreSize(): number {
  return vectorStore.length;
}

// Initialize vector store on module load
try {
  loadVectorStore();
} catch (error) {
  console.error('Failed to initialize vector store:', error);
  vectorStore = [];
  activeBatches = [];
}

/**
 * Get all items from the vector store
 * @returns Array of all vector store items
 */
export function getAllVectorStoreItems(): VectorStoreItem[] {
  return [...vectorStore];
}

export { vectorStore }; 