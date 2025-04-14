import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { embedText } from '@/utils/embeddingClient';
import { VectorStoreItem } from '@/utils/vectorStore';
import { splitIntoChunks } from '@/utils/documentProcessing';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { logError, logInfo, logWarning } from '@/utils/logger';

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
    const form = formidable({
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
    
    // Generate a unique document ID for this image using crypto
    const documentId = crypto.randomUUID();
    
    // ---- Start: Add document record to the 'documents' table ----
    try {
      const client = getSupabaseAdmin(); // Use the admin client
      const { data: docData, error: docError } = await client
        .from('documents')
        .insert({
          id: documentId,
          source: source, // Use the filename as the source
          metadata: { 
            uploaded_by: 'system', // Placeholder - replace with user info if available
            original_filename: uploadedFile.originalFilename,
            file_type: uploadedFile.mimetype,
            file_size: uploadedFile.size
          }
          // status: 'processing' // Removed - Column does not exist
        })
        .select() // Select the inserted row to confirm
        .single(); // Expect a single row

      if (docError) {
        console.error('Error adding document record to Supabase:', docError);
        throw new Error(`Failed to create document record: ${docError.message}`);
      }
      console.log('Successfully created document record:', docData);
    } catch (error) {
      console.error('Supabase operation failed while adding document record:', error);
      // Return an error response if document creation fails
      return res.status(500).json({
        message: `Error creating document record: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    // ---- End: Add document record ----
    
    // Process chunks: Insert into Supabase instead of using addToVectorStore
    let processedCount = 0;
    const chunksToInsert: any[] = []; // Prepare chunks for batch insert

    for (const [index, chunk] of chunks.entries()) {
      if (chunk.text.trim()) {
        try {
          const embedding = await embedText(chunk.text);
          chunksToInsert.push({
            document_id: documentId, // From the document created earlier
            chunk_index: index,
            content: chunk.text, // Assuming target column is 'content'
            embedding: embedding,
            metadata: {
              source, // From original filename
              ...(chunk.metadata || {}) // Any metadata from chunking process
            }
          });
          processedCount++;
        } catch (embeddingError) {
          logError('Failed to generate embedding for chunk', { documentId, chunkIndex: index, error: embeddingError });
          // Decide if we should skip this chunk or fail the request
          // For now, we skip it
        }
      }
    }
    
    // Batch insert chunks into Supabase
    if (chunksToInsert.length > 0) {
      logInfo(`Inserting ${chunksToInsert.length} chunks into document_chunks for document ${documentId}`);
      const { error: insertChunksError } = await getSupabaseAdmin() // Use client from earlier
        .from('document_chunks')
        .insert(chunksToInsert);
        
      if (insertChunksError) {
        logError('Error inserting document chunks into Supabase', { documentId, error: insertChunksError });
        // Even if chunk insertion fails, the document record exists. 
        // Consider how to handle partial failures. Return error? 
        return res.status(500).json({
          message: `Error inserting chunks into database: ${insertChunksError.message}`
        });
      } else {
        logInfo(`Successfully inserted ${chunksToInsert.length} chunks for document ${documentId}`);
      }
    } else {
      logWarning('No valid chunks generated from image text', { documentId, source });
      // Consider if the document record should be deleted if no chunks are added.
    }

    return res.status(200).json({ 
      message: `Successfully processed image and added ${processedCount} text chunks to the database for document ${documentId}. You can now ask questions about this document!` 
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return res.status(500).json({
      message: `Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
} 