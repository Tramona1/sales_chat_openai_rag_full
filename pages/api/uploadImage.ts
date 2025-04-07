import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { embedText } from '@/utils/openaiClient';
import { addToVectorStore, VectorStoreItem } from '@/utils/vectorStore';
import { splitIntoChunks } from '@/utils/documentProcessing';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Ensure data directory exists for vector store persistence
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    const form = new formidable.IncomingForm({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });
    
    // Parse the form
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Get the uploaded file
    const fileArray = files.file;
    if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadedFile = fileArray[0];

    // Process the image with Tesseract OCR
    const worker = await createWorker();
    const { data } = await worker.recognize(uploadedFile.filepath);
    await worker.terminate();

    if (!data.text || data.text.trim() === '') {
      return res.status(400).json({ message: 'Could not extract text from image' });
    }

    // Set source information for context-aware chunking
    const source = uploadedFile.originalFilename 
      ? `${uploadedFile.originalFilename} (Image)` 
      : 'Image Upload';
    
    // Process the extracted text with source information
    const chunks = splitIntoChunks(data.text, 500, source);
    
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
      message: `Successfully processed image and extracted ${processedCount} text chunks. You can now ask questions about this document!` 
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return res.status(500).json({
      message: `Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
} 