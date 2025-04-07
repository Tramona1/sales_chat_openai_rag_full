import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { embedText } from '@/utils/openaiClient';
import { addToVectorStore, VectorStoreItem } from '@/utils/vectorStore';
import { splitIntoChunks } from '@/utils/documentProcessing';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Ensure data directory exists for vector store persistence
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    const { text, title } = req.body;
    
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ message: 'Text content is required' });
    }

    // Set the source for context-aware chunking
    const source = title || 'Direct Text Input';
    
    // Process the text with source information
    const chunks = splitIntoChunks(text, 500, source);
    
    // Process chunks
    let processedCount = 0;
    for (const chunk of chunks) {
      if (chunk.text.trim()) {
        const embedding = await embedText(chunk.text);
        const item: VectorStoreItem = {
          embedding, 
          text: chunk.text,
          metadata: {
            source,
            // Include the additional metadata from the chunking process
            ...(chunk.metadata || {})
          }
        };
        addToVectorStore(item);
        processedCount++;
      }
    }

    return res.status(200).json({ 
      message: `Successfully processed text and created ${processedCount} chunks. You can now ask questions about this content!` 
    });
  } catch (error) {
    console.error('Error processing text:', error);
    return res.status(500).json({
      message: `Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
} 