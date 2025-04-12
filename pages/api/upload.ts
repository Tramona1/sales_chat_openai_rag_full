import { NextApiRequest, NextApiResponse } from 'next';
// Fix imports to avoid esModuleInterop issues
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
import { embedText, embedBatch } from '../../utils/embeddingClient';
// Import Supabase client instead of direct vector store
import { insertDocument, insertDocumentChunks } from '../../utils/supabaseClient';
import { VectorStoreItem } from '../../utils/vectorStore';
import { extractText, splitIntoChunks, splitIntoChunksWithContext, prepareTextForEmbedding } from '../../utils/documentProcessing';
import { extractDocumentContext } from '../../utils/geminiClient';
import { getModelForTask } from '../../utils/modelConfig';
import { DocumentContext, ContextualChunk } from '../../types/documentProcessing';
import { ImageAnalyzer } from '../../utils/imageAnalysis/imageAnalyzer';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../utils/logger';

// Add type declarations for formidable
declare namespace formidable {
  interface Fields {
    [key: string]: string | string[];
  }
  
  interface File {
    filepath: string;
    originalFilename?: string;
    mimetype?: string;
    size?: number;
  }

  interface Files {
    [key: string]: File | File[];
  }
}

// Disable the default body parser
export const config = { api: { bodyParser: false } };

// Helper function to check if a file is an image
function isImageFile(mimetype: string): boolean {
  return mimetype.startsWith('image/');
}

// Generate content hash for document deduplication
function generateContentHash(content: string): string {
  return require('crypto').createHash('md5').update(content).digest('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Check for feature flags
  const useContextualChunking = req.query.contextual === 'true';
  const useVisualProcessing = req.query.visualProcessing === 'true';

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
      maxFileSize: 20 * 1024 * 1024, // 20MB limit
      multiples: true, // Support multiple files
    });

    // Parse the form
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err: any, fields: formidable.Fields, files: formidable.Files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Get the uploaded files
    const fileArray = Array.isArray(files.file) ? files.file : [files.file];
    if (!fileArray || fileArray.length === 0 || !fileArray[0]) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const results = [];
    
    // Process each file
    for (const uploadedFile of fileArray) {
      // Skip if uploadedFile is undefined
      if (!uploadedFile) {
        results.push({
          source: 'unknown',
          error: 'Invalid file data'
        });
        continue;
      }
      
      const mimetype = uploadedFile.mimetype || '';
      const source = uploadedFile.originalFilename || 'unknown';
      let processedCount = 0;
      let result: any = { source };
      
      try {
        // Process image files differently if visual processing is enabled
        if (isImageFile(mimetype) && useVisualProcessing) {
          // Ensure filepath exists
          if (!uploadedFile.filepath) {
            throw new Error('Missing file path');
          }
          
          // Use ImageAnalyzer to process the image
          const analysisResult = await ImageAnalyzer.analyze(uploadedFile.filepath);
          
          if (analysisResult.success) {
            // Generate document context from image analysis
            const imageContext = ImageAnalyzer.generateDocumentContext(analysisResult);
            
            // Create a document in Supabase
            const contentHash = generateContentHash(analysisResult.description + ' ' + analysisResult.detectedText);
            
            // Insert the document
            const document = await insertDocument({
              title: source,
              source_url: null,
              file_path: uploadedFile.filepath,
              mime_type: mimetype,
              content_hash: contentHash,
              is_approved: true,
              metadata: {
                isVisualContent: true,
                visualType: analysisResult.type,
                documentType: imageContext.documentType,
                documentSummary: imageContext.summary,
                primaryTopics: imageContext.mainTopics,
                technicalLevel: imageContext.technicalLevel,
                audienceType: imageContext.audienceType,
                imageMetadata: {
                  analysisTime: analysisResult.metadata?.analysisTime,
                  model: analysisResult.metadata?.model,
                  analysisId: analysisResult.metadata?.analysisId
                }
              }
            });
            
            // Prepare text for embedding with enhanced contextual information
            const textForEmbedding = ImageAnalyzer.prepareTextForEmbedding(analysisResult);
            
            // Generate embedding
            const embedding = await embedText(textForEmbedding);
            
            // Create a chunk for the image
            const chunk = {
              document_id: document.id,
              chunk_index: 0,
              content: textForEmbedding,
              embedding: embedding,
              metadata: {
                isVisualContent: true,
                visualType: analysisResult.type,
                context: ImageAnalyzer.generateChunkContext(analysisResult),
                originalText: analysisResult.description + ' ' + analysisResult.detectedText
              }
            };
            
            // Insert the chunk
            await insertDocumentChunks([chunk]);
            processedCount = 1;
            
            result = {
              source,
              type: 'image',
              imageType: analysisResult.type,
              processedCount,
              summary: imageContext.summary,
              documentId: document.id
            };
          } else {
            throw new Error(`Image analysis failed: ${analysisResult.error}`);
          }
        } else {
          // Process standard document files
          // Ensure filepath exists
          if (!uploadedFile.filepath) {
            throw new Error('Missing file path');
          }
          
          const rawText = await extractText(uploadedFile.filepath, mimetype);
          let documentContext: DocumentContext | null = null;
          
          // Generate content hash for deduplication
          const contentHash = generateContentHash(rawText);
          
          // Create a document in Supabase
          const document = await insertDocument({
            title: source,
            source_url: null,
            file_path: uploadedFile.filepath,
            mime_type: mimetype,
            content_hash: contentHash,
            is_approved: true,
            metadata: {}
          });
          
          logInfo(`Created document in Supabase with ID: ${document.id}`);
          
          // Use contextual chunking if enabled
          if (useContextualChunking) {
            logInfo('Using contextual chunking for document:', source);
            
            try {
              // Extract document-level context using Gemini
              documentContext = await extractDocumentContext(rawText);
              logInfo('Document context extracted successfully');
              
              // Update document metadata with context
              await insertDocument({
                ...document,
                metadata: {
                  ...document.metadata,
                  documentSummary: documentContext?.summary,
                  documentType: documentContext?.documentType,
                  primaryTopics: documentContext?.mainTopics,
                  technicalLevel: documentContext?.technicalLevel,
                  audienceType: documentContext?.audienceType
                }
              });
              
              // Create chunks with context
              const chunks = await splitIntoChunksWithContext(
                rawText, 
                500, 
                source, 
                true, 
                documentContext
              );
              
              // Prepare chunk objects for batch insertion
              const chunkObjects = [];
              
              // Prepare texts for embedding with enhanced context
              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (chunk.text.trim()) {
                  // Prepare the text with enhanced contextual information
                  const preparedText = prepareTextForEmbedding(chunk);
                  
                  // Generate embedding for the prepared text
                  const embedding = await embedText(preparedText);
                  
                  // Create chunk object for Supabase
                  chunkObjects.push({
                    document_id: document.id,
                    chunk_index: i,
                    content: preparedText,
                    embedding: embedding,
                    metadata: {
                      originalText: chunk.text,
                      source: source,
                      ...(chunk.metadata || {}),
                      isContextualChunk: true,
                    }
                  });
                  
                  processedCount++;
                }
              }
              
              // Batch insert all chunks
              if (chunkObjects.length > 0) {
                await insertDocumentChunks(chunkObjects);
                logInfo(`Inserted ${chunkObjects.length} chunks for document ${document.id}`);
              }
              
              result = {
                source,
                type: 'document',
                documentType: documentContext?.documentType || 'unknown',
                processedCount,
                summary: documentContext?.summary,
                documentId: document.id
              };
              
            } catch (contextError) {
              logError('Error in contextual processing, falling back to standard chunking:', contextError);
              // Fall back to standard chunking
              const chunks = splitIntoChunks(rawText, 500, source);
              
              // Prepare chunk objects for batch insertion
              const chunkObjects = [];
              
              // Process chunks with standard text preparation
              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (chunk.text.trim()) {
                  // Even for standard chunks, prepare the text for consistency
                  const preparedText = prepareTextForEmbedding(chunk);
                  
                  // Generate embedding for the prepared text
                  const embedding = await embedText(preparedText);
                  
                  // Create chunk object for Supabase
                  chunkObjects.push({
                    document_id: document.id,
                    chunk_index: i,
                    content: preparedText,
                    embedding: embedding,
                    metadata: {
                      originalText: chunk.text,
                      source: source,
                      ...(chunk.metadata || {})
                    }
                  });
                  
                  processedCount++;
                }
              }
              
              // Batch insert all chunks
              if (chunkObjects.length > 0) {
                await insertDocumentChunks(chunkObjects);
                logInfo(`Inserted ${chunkObjects.length} standard chunks for document ${document.id}`);
              }
              
              result = {
                source,
                type: 'document',
                processedCount,
                standardProcessing: true,
                documentId: document.id,
                error: contextError.message
              };
            }
          } else {
            // Use standard chunking when contextual is not enabled
            const chunks = splitIntoChunks(rawText, 500, source);
            
            // Prepare chunk objects for batch insertion
            const chunkObjects = [];
            
            // Process chunks with standard text preparation
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              if (chunk.text.trim()) {
                // Even for standard chunks, prepare the text for consistency
                const preparedText = prepareTextForEmbedding(chunk);
                
                // Generate embedding for the prepared text
                const embedding = await embedText(preparedText);
                
                // Create chunk object for Supabase
                chunkObjects.push({
                  document_id: document.id,
                  chunk_index: i,
                  content: preparedText,
                  embedding: embedding,
                  metadata: {
                    originalText: chunk.text,
                    source: source,
                    ...(chunk.metadata || {})
                  }
                });
                
                processedCount++;
              }
            }
            
            // Batch insert all chunks
            if (chunkObjects.length > 0) {
              await insertDocumentChunks(chunkObjects);
              logInfo(`Inserted ${chunkObjects.length} standard chunks for document ${document.id}`);
            }
            
            result = {
              source,
              type: 'document',
              processedCount,
              standardProcessing: true,
              documentId: document.id
            };
          }
        }
      } catch (error) {
        logError('Error processing file:', error);
        result = {
          source,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'error'
        };
      }
      
      results.push(result);
    }
    
    return res.status(200).json({ 
      message: `Successfully processed ${results.length} file(s)`,
      results 
    });
  } catch (error) {
    logError('Upload error:', error);
    return res.status(500).json({ 
      message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
} 