// Script to add core company information to the vector store
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Import utility functions
const { splitIntoChunks, addToVectorStore } = require('./utils');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Function to generate embeddings for text
async function embedText(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' ')
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

async function addCoreInfoToVectorStore() {
  try {
    // Read the core info file
    const filePath = path.join(process.cwd(), 'workstream_core_info.txt');
    const text = fs.readFileSync(filePath, 'utf8');
    
    if (!text || text.trim() === '') {
      console.error('Error: Text file is empty');
      return;
    }

    console.log('Processing Workstream core information...');
    
    // Set the source for context-aware chunking
    const source = 'Workstream Core Information';
    
    // Process the text with source information
    const chunks = splitIntoChunks(text, 500, source);
    
    console.log(`Created ${chunks.length} chunks with context-aware chunking`);
    
    // Process chunks
    let processedCount = 0;
    for (const chunk of chunks) {
      if (chunk.text.trim()) {
        console.log(`Processing chunk ${processedCount + 1}/${chunks.length}`);
        
        // Debug metadata
        console.log('Chunk metadata:', chunk.metadata || 'No metadata');
        
        // Only show a preview of the text to keep output readable
        const textPreview = chunk.text.length > 100 ? 
          chunk.text.substring(0, 100) + '...' : 
          chunk.text;
        console.log('Chunk text preview:', textPreview);
        
        // Generate embedding
        const embedding = await embedText(chunk.text);
        
        // Add to vector store with high priority boost
        // We mark this with a special source to give it priority
        addToVectorStore({
          embedding, 
          text: chunk.text,
          metadata: {
            source,
            priority: 'high',
            // Include the additional metadata from the chunking process
            ...(chunk.metadata || {})
          }
        });
        
        processedCount++;
        
        // Slight delay to avoid rate limits
        if (processedCount < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    console.log(`✅ Successfully processed core information and created ${processedCount} chunks.`);
    console.log('The Workstream company values and core information have been added to the knowledge base.');
  } catch (error) {
    console.error('Error processing text:', error);
  }
}

// Run the function
console.log('Starting core information processing...');
addCoreInfoToVectorStore().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 