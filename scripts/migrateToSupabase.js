/**
 * Data Migration Script: File-based storage to Supabase
 * 
 * This script migrates data from the file-based vector store to Supabase.
 * It performs the following steps:
 * 1. Backup the existing file-based data
 * 2. Read the existing data
 * 3. Upload documents and their chunks to Supabase
 * 4. Upload vector embeddings to Supabase
 * 5. Rebuild BM25 statistics
 * 6. Verify the migration
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFileVectorStore } from '../utils/fileVectorStore.js';
import { backupFileStore } from '../utils/backupUtils.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Set up paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '../backups', `migration_${Date.now()}`);

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local file');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
  try {
    console.log('Starting data migration to Supabase...');

    // Step 1: Backup existing data
    console.log('Backing up existing file-based data...');
    await backupFileStore(BACKUP_DIR);
    
    // Step 2: Read existing data
    console.log('Reading existing file-based data...');
    const fileVectorStore = createFileVectorStore();
    const documents = await fileVectorStore.getAllDocuments();
    
    console.log(`Found ${documents.length} documents to migrate`);
    
    // Step 3: Upload documents and their chunks to Supabase
    console.log('Uploading documents and chunks to Supabase...');
    let totalChunks = 0;
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`Processing document ${i+1}/${documents.length}: ${doc.title}`);
      
      // Insert document
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert({
          id: doc.id,
          title: doc.title,
          source: doc.source,
          category: doc.category,
          metadata: doc.metadata || {},
          created_at: new Date().toISOString()
        })
        .select();
      
      if (documentError) {
        console.error(`Error inserting document ${doc.id}:`, documentError);
        continue;
      }
      
      // Get chunks for this document
      const chunks = await fileVectorStore.getChunks(doc.id);
      totalChunks += chunks.length;
      
      // Insert chunks in batches
      const BATCH_SIZE = 50;
      for (let j = 0; j < chunks.length; j += BATCH_SIZE) {
        const batch = chunks.slice(j, j + BATCH_SIZE);
        
        const chunkRecords = batch.map(chunk => ({
          id: chunk.id,
          document_id: doc.id,
          text: chunk.text,
          metadata: chunk.metadata || {},
          created_at: new Date().toISOString()
        }));
        
        const { error: chunksError } = await supabase
          .from('document_chunks')
          .insert(chunkRecords);
        
        if (chunksError) {
          console.error(`Error inserting chunks for document ${doc.id}:`, chunksError);
          continue;
        }
      }
      
      // Get vector embeddings for this document
      const vectors = await fileVectorStore.getEmbeddings(doc.id);
      
      // Insert vector embeddings in batches
      for (let j = 0; j < vectors.length; j += BATCH_SIZE) {
        const batch = vectors.slice(j, j + BATCH_SIZE);
        
        const vectorRecords = batch.map(vector => ({
          id: vector.id,
          chunk_id: vector.chunk_id,
          embedding: vector.embedding,
          metadata: JSON.stringify(vector.metadata || {}),
          created_at: new Date().toISOString()
        }));
        
        const { error: vectorsError } = await supabase
          .from('vector_items')
          .insert(vectorRecords);
        
        if (vectorsError) {
          console.error(`Error inserting vectors for document ${doc.id}:`, vectorsError);
          continue;
        }
      }
    }
    
    console.log(`Successfully migrated ${documents.length} documents with ${totalChunks} chunks`);
    
    // Step 4: Rebuild BM25 statistics
    console.log('Rebuilding BM25 statistics...');
    const { data: bm25Data, error: bm25Error } = await supabase.rpc('rebuild_corpus_statistics');
    
    if (bm25Error) {
      console.error('Error rebuilding BM25 statistics:', bm25Error);
    } else {
      console.log('BM25 statistics rebuilt successfully');
    }
    
    // Step 5: Verify the migration
    console.log('Verifying migration...');
    
    const { count: docCount, error: docCountError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });
    
    if (docCountError) {
      console.error('Error verifying document count:', docCountError);
    } else {
      console.log(`Verified ${docCount} documents in Supabase`);
    }
    
    const { count: chunkCount, error: chunkCountError } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });
    
    if (chunkCountError) {
      console.error('Error verifying chunk count:', chunkCountError);
    } else {
      console.log(`Verified ${chunkCount} chunks in Supabase`);
    }
    
    console.log('\nMigration completed successfully!');
    console.log('Next steps:');
    console.log('1. Update the .env.local file to set USE_SUPABASE=true');
    console.log('2. Restart the application to use Supabase as the vector store');
    
  } catch (error) {
    console.error('Error during migration:', error);
    console.log('Migration failed. Consider restoring from backup.');
  }
}

if (require.main === module) {
  migrateData().catch(console.error);
}

export { migrateData }; 