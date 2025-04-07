/**
 * This script outlines the steps to set up a Supabase vector store
 * for scaling beyond the file-based approach when needed.
 * 
 * Prerequisites:
 * 1. Create a Supabase account: https://supabase.com/
 * 2. Install Supabase client: npm install @supabase/supabase-js
 * 3. Create .env file with Supabase credentials
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector_batches');
const BATCH_PATTERN = /^batch_(.+)\.json$/;
const ITEMS_PER_BATCH = 100; // Number of records to insert at once

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('Error: Supabase configuration not found in environment variables');
  console.error('Please add SUPABASE_URL and SUPABASE_KEY to your .env file');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Creates the vector_store table in Supabase with pgvector extension
 */
async function createVectorStoreTable() {
  console.log('Setting up vector_store table in Supabase...');
  
  // First check if the pgvector extension is enabled
  const { data: extensionData, error: extensionError } = await supabase.rpc('enable_pgvector');
  
  if (extensionError) {
    // If RPC doesn't exist, you need to manually enable pgvector in Supabase
    console.warn('Could not automatically enable pgvector extension.');
    console.warn('You may need to run this SQL in the Supabase SQL editor:');
    console.warn('CREATE EXTENSION IF NOT EXISTS vector;');
    // Continue anyway, as the extension might already be enabled
  } else {
    console.log('pgvector extension enabled successfully');
  }
  
  // Create the vector_store table
  const { error: tableError } = await supabase.from('vector_store').select('id').limit(1).maybeSingle();
  
  if (tableError && tableError.code === '42P01') { // Table doesn't exist
    console.log('Creating vector_store table...');
    
    // SQL to create the table
    const { error: createError } = await supabase.rpc('create_vector_store_table');
    
    if (createError) {
      // If RPC fails, show manual SQL instructions
      console.error('Failed to create table:', createError.message);
      console.error('Please run this SQL in the Supabase SQL editor:');
      console.error(`
        CREATE TABLE vector_store (
          id SERIAL PRIMARY KEY,
          embedding VECTOR(1536),
          text TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX ON vector_store USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      `);
      process.exit(1);
    } else {
      console.log('Vector store table created successfully');
    }
  } else {
    console.log('Vector store table already exists');
  }
}

/**
 * Migrates data from the file-based store to Supabase
 */
async function migrateToSupabase() {
  console.log('Starting migration to Supabase...');
  
  // First check if the vector batches directory exists
  if (!fs.existsSync(VECTOR_STORE_DIR)) {
    console.error(`Vector batches directory not found: ${VECTOR_STORE_DIR}`);
    console.error('No data to migrate.');
    return;
  }
  
  // Get all batch files
  const files = fs.readdirSync(VECTOR_STORE_DIR)
    .filter(file => BATCH_PATTERN.test(file))
    .sort();
  
  if (files.length === 0) {
    console.log('No batch files found to migrate.');
    return;
  }
  
  console.log(`Found ${files.length} batch files to migrate.`);
  let totalMigratedItems = 0;
  
  // Process each batch file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i+1}/${files.length}] Migrating ${file}...`);
    
    try {
      // Read the batch file
      const batchItems = JSON.parse(fs.readFileSync(path.join(VECTOR_STORE_DIR, file), 'utf-8'));
      
      if (!Array.isArray(batchItems) || batchItems.length === 0) {
        console.log(`  Skipping ${file}: No valid items`);
        continue;
      }
      
      console.log(`  Found ${batchItems.length} items in ${file}`);
      
      // Process items in smaller batches for efficient API usage
      for (let j = 0; j < batchItems.length; j += ITEMS_PER_BATCH) {
        const insertBatch = batchItems.slice(j, j + ITEMS_PER_BATCH).map(item => ({
          embedding: item.embedding,
          text: item.text,
          metadata: item.metadata || {}
        }));
        
        console.log(`  Inserting batch ${Math.floor(j/ITEMS_PER_BATCH) + 1}/${Math.ceil(batchItems.length/ITEMS_PER_BATCH)}...`);
        
        const { error } = await supabase.from('vector_store').insert(insertBatch);
        
        if (error) {
          console.error(`  Error inserting batch: ${error.message}`);
        } else {
          totalMigratedItems += insertBatch.length;
          console.log(`  Inserted ${insertBatch.length} items`);
        }
        
        // Slight delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Rename file to mark as migrated
      fs.renameSync(
        path.join(VECTOR_STORE_DIR, file),
        path.join(VECTOR_STORE_DIR, `migrated_${file}`)
      );
      
    } catch (error) {
      console.error(`Error processing batch file ${file}:`, error);
    }
  }
  
  console.log(`\nMigration complete!`);
  console.log(`Migrated ${totalMigratedItems} items to Supabase`);
}

/**
 * Tests similarity search against the Supabase vector store
 */
async function testSupabaseVectorStore() {
  console.log('\nTesting similarity search against Supabase...');
  
  const testQuery = 'What are the main features of your product?';
  console.log(`Test query: "${testQuery}"`);
  
  // This would normally use the OpenAI API to generate the embedding
  // For this example, we'll use a mock embedding (all zeros)
  const mockEmbedding = Array(1536).fill(0);
  
  console.log('Running similarity search...');
  
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: mockEmbedding,
    match_threshold: 0.5,
    match_count: 5
  });
  
  if (error) {
    console.error('Error during similarity search:', error.message);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No results found. This is expected if you just created the table.');
  } else {
    console.log(`Found ${data.length} similar documents:`);
    data.forEach((item, i) => {
      console.log(`\n${i+1}. Score: ${item.similarity.toFixed(4)}`);
      console.log(`   Text: ${item.text.substring(0, 100)}...`);
      console.log(`   Source: ${item.metadata.source || 'Unknown'}`);
    });
  }
}

/**
 * Main function
 */
async function setupSupabaseStore() {
  try {
    // Create vector store table
    await createVectorStoreTable();
    
    // Ask user if they want to migrate data
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('\nDo you want to migrate existing data to Supabase? (y/n) ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        await migrateToSupabase();
        await testSupabaseVectorStore();
      } else {
        console.log('Skipping data migration.');
        await testSupabaseVectorStore();
      }
      
      readline.close();
      
      console.log('\nSetup complete! Here are the next steps:');
      console.log('1. Update utils/vectorStore.ts to use Supabase (see commented code)');
      console.log('2. Update your query functions to use Supabase for similarity search');
      console.log('3. Add appropriate indexes to optimize query performance');
    });
    
  } catch (error) {
    console.error('Fatal error during setup:', error);
  }
}

// Run the main function
setupSupabaseStore(); 