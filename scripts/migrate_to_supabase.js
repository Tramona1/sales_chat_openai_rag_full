#!/usr/bin/env node

/**
 * Migration Script: Local Storage to Supabase
 * 
 * This script migrates existing data from local JSON files to Supabase tables.
 * It handles documents, vector items, and visual content.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServiceClient } from '../config/supabase.js';
import { TABLES } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { loadVectorStore } from '../utils/vectorStore.ts';
import { getPendingDocumentQueue } from '../utils/adminWorkflow.ts';
import { logger } from '../utils/logger.ts';

// Load environment variables
dotenv.config();

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const VECTOR_STORE_FILE = path.join(DATA_DIR, 'vector_store.json');
const PENDING_INDEX_FILE = path.join(DATA_DIR, 'pending_index.json');
const APPROVED_DOCUMENTS_DIR = path.join(DATA_DIR, 'approved_documents');
const BM25_STATS_FILE = path.join(DATA_DIR, 'bm25_corpus_stats.json');
const VISUAL_CONTENT_DIR = path.join(DATA_DIR, 'processed_images');

// Initialize Supabase client
const supabase = createServiceClient();

/**
 * Main migration function
 */
async function migrateToSupabase() {
  try {
    logger.info('Starting migration to Supabase...');
    
    // Verify Supabase connection
    const { data, error } = await supabase.from(TABLES.DOCUMENTS).select('count').limit(1);
    if (error) {
      throw new Error(`Supabase connection error: ${error.message}`);
    }
    logger.info('Successfully connected to Supabase');
    
    // Step 1: Migrate vector store items
    await migrateVectorStore();
    
    // Step 2: Migrate pending documents
    await migratePendingDocuments();
    
    // Step 3: Migrate corpus statistics
    await migrateCorpusStatistics();
    
    // Step 4: Migrate visual content
    await migrateVisualContent();
    
    logger.info('Migration completed successfully!');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Migrate vector store items to Supabase
 */
async function migrateVectorStore() {
  logger.info('Migrating vector store items...');
  
  // Load existing vector store
  const vectorStore = await loadVectorStore();
  if (!vectorStore || !vectorStore.items || vectorStore.items.length === 0) {
    logger.warn('No vector store items found to migrate');
    return;
  }
  
  const documentMap = new Map(); // Map to track document IDs
  const chunkMap = new Map();    // Map to track chunk IDs
  
  logger.info(`Found ${vectorStore.items.length} vector store items to migrate`);
  
  // Process in batches to prevent overwhelming the database
  const batchSize = 50;
  const batches = Math.ceil(vectorStore.items.length / batchSize);
  
  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, vectorStore.items.length);
    const batch = vectorStore.items.slice(start, end);
    
    logger.info(`Processing batch ${i+1}/${batches} (${start}-${end})`);
    
    // Process each item in the batch
    for (const item of batch) {
      const metadata = typeof item.metadata === 'string' 
        ? JSON.parse(item.metadata) 
        : item.metadata;
      
      const documentId = metadata.document_id || uuidv4();
      
      // Check if we've already processed this document
      if (!documentMap.has(documentId)) {
        // Insert document if it doesn't exist yet
        const documentData = {
          id: documentId,
          title: metadata.title || 'Untitled Document',
          source_url: metadata.source_url || metadata.url || null,
          file_path: metadata.file_path || null,
          mime_type: metadata.mime_type || 'text/plain',
          content_hash: metadata.content_hash || null,
          metadata: metadata
        };
        
        const { error: docError } = await supabase
          .from(TABLES.DOCUMENTS)
          .upsert([documentData]);
          
        if (docError) {
          logger.error(`Error inserting document: ${docError.message}`);
          continue;
        }
        
        documentMap.set(documentId, true);
      }
      
      // Generate chunk ID and check if it exists
      const chunkId = metadata.chunk_id || uuidv4();
      
      if (!chunkMap.has(chunkId)) {
        // Insert chunk
        const chunkData = {
          id: chunkId,
          document_id: documentId,
          chunk_index: metadata.chunk_index || 0,
          content: item.text || '',
          metadata: metadata
        };
        
        const { error: chunkError } = await supabase
          .from(TABLES.DOCUMENT_CHUNKS)
          .upsert([chunkData]);
          
        if (chunkError) {
          logger.error(`Error inserting chunk: ${chunkError.message}`);
          continue;
        }
        
        chunkMap.set(chunkId, true);
      }
      
      // Insert vector item
      const vectorData = {
        id: uuidv4(),
        chunk_id: chunkId,
        embedding: item.embedding,
        content: item.text || '',
        metadata: metadata
      };
      
      const { error: vectorError } = await supabase
        .from(TABLES.VECTOR_ITEMS)
        .upsert([vectorData]);
        
      if (vectorError) {
        logger.error(`Error inserting vector item: ${vectorError.message}`);
      }
    }
  }
  
  logger.info(`Migrated ${vectorStore.items.length} vector store items`);
}

/**
 * Migrate pending documents to Supabase
 */
async function migratePendingDocuments() {
  logger.info('Migrating pending documents...');
  
  try {
    // Load pending documents
    const pendingQueue = getPendingDocumentQueue();
    if (!pendingQueue || pendingQueue.length === 0) {
      logger.warn('No pending documents found to migrate');
      return;
    }
    
    logger.info(`Found ${pendingQueue.length} pending documents to migrate`);
    
    // Process each pending document
    for (const doc of pendingQueue) {
      const pendingData = {
        id: doc.id || uuidv4(),
        title: doc.title || 'Untitled Document',
        source_url: doc.source_url || doc.url || null,
        file_path: doc.file_path || null,
        mime_type: doc.mime_type || 'text/plain',
        content_hash: doc.content_hash || null,
        status: doc.status || 'pending',
        reviewer: doc.reviewer || null,
        review_notes: doc.review_notes || null,
        metadata: doc.metadata || {}
      };
      
      const { error } = await supabase
        .from(TABLES.PENDING_DOCUMENTS)
        .upsert([pendingData]);
        
      if (error) {
        logger.error(`Error inserting pending document: ${error.message}`);
      }
    }
    
    logger.info(`Migrated ${pendingQueue.length} pending documents`);
  } catch (error) {
    logger.error('Error migrating pending documents:', error);
  }
}

/**
 * Migrate corpus statistics to Supabase
 */
async function migrateCorpusStatistics() {
  logger.info('Migrating corpus statistics...');
  
  try {
    // Check if BM25 stats file exists
    if (!fs.existsSync(BM25_STATS_FILE)) {
      logger.warn('No BM25 corpus statistics found to migrate');
      return;
    }
    
    // Read corpus statistics
    const corpusStatsRaw = fs.readFileSync(BM25_STATS_FILE, 'utf8');
    const corpusStats = JSON.parse(corpusStatsRaw);
    
    // Insert corpus statistics
    const statsData = {
      id: uuidv4(),
      document_count: corpusStats.totalDocs || 0,
      term_frequencies: corpusStats.tokenFrequencies || {}
    };
    
    const { error } = await supabase
      .from(TABLES.CORPUS_STATISTICS)
      .upsert([statsData]);
      
    if (error) {
      logger.error(`Error inserting corpus statistics: ${error.message}`);
      return;
    }
    
    logger.info('Migrated corpus statistics successfully');
  } catch (error) {
    logger.error('Error migrating corpus statistics:', error);
  }
}

/**
 * Migrate visual content to Supabase
 */
async function migrateVisualContent() {
  logger.info('Migrating visual content...');
  
  try {
    // Check if visual content directory exists
    if (!fs.existsSync(VISUAL_CONTENT_DIR)) {
      logger.warn('No visual content directory found to migrate');
      return;
    }
    
    // Get all files in the processed images directory
    const files = fs.readdirSync(VISUAL_CONTENT_DIR);
    const imageFiles = files.filter(file => 
      file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
    );
    
    if (imageFiles.length === 0) {
      logger.warn('No visual content found to migrate');
      return;
    }
    
    logger.info(`Found ${imageFiles.length} visual content files to migrate`);
    
    // Process each image file
    for (const file of imageFiles) {
      const filePath = path.join(VISUAL_CONTENT_DIR, file);
      const fileContent = fs.readFileSync(filePath);
      
      // Parse metadata from filename (assuming format: documentId_chunkId_type.ext)
      const parts = path.basename(file, path.extname(file)).split('_');
      const documentId = parts[0] || uuidv4();
      const chunkId = parts[1] || uuidv4();
      const contentType = parts[2] || 'IMAGE';
      
      // Upload file to Supabase Storage
      const storagePath = `visual-content/${file}`;
      const { error: storageError } = await supabase
        .storage.from('documents')
        .upload(storagePath, fileContent, {
          contentType: `image/${path.extname(file).substring(1)}`,
          upsert: true
        });
        
      if (storageError) {
        logger.error(`Error uploading file to storage: ${storageError.message}`);
        continue;
      }
      
      // Insert visual content record
      const visualData = {
        id: uuidv4(),
        document_id: documentId,
        chunk_id: chunkId,
        content_type: contentType,
        file_path: filePath,
        storage_path: storagePath,
        metadata: {
          filename: file,
          size: fileContent.length,
          type: contentType
        }
      };
      
      const { error } = await supabase
        .from(TABLES.VISUAL_CONTENT)
        .upsert([visualData]);
        
      if (error) {
        logger.error(`Error inserting visual content: ${error.message}`);
      }
    }
    
    logger.info(`Migrated ${imageFiles.length} visual content files`);
  } catch (error) {
    logger.error('Error migrating visual content:', error);
  }
}

// Run the migration
migrateToSupabase(); 