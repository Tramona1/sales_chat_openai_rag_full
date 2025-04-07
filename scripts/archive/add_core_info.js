// Script to add core company information to the vector store
const fs = require('fs');
const path = require('path');
const { embedText } = require('./utils/openaiClient');
const { addToVectorStore } = require('./utils/vectorStore');
const { splitIntoChunks } = require('./utils/documentProcessing');

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
        console.log('Chunk metadata:', chunk.metadata || 'No metadata');
        console.log('Chunk text preview:', chunk.text.substring(0, 100) + '...');
        
        const embedding = await embedText(chunk.text);
        addToVectorStore({
          embedding, 
          text: chunk.text,
          metadata: {
            source,
            // Include the additional metadata from the chunking process
            ...(chunk.metadata || {})
          }
        });
        processedCount++;
      }
    }

    console.log(`✅ Successfully processed text and created ${processedCount} chunks.`);
    console.log('The Workstream company values and core information have been added to the knowledge base.');
  } catch (error) {
    console.error('Error processing text:', error);
  }
}

// Run the function
addCoreInfoToVectorStore(); 