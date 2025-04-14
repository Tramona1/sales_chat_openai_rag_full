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
// Replace extractDocumentContext with our new analyzeDocument function
import { analyzeDocument } from '../../utils/documentAnalysis';
import { getModelForTask } from '../../utils/modelConfig';
import { DocumentContext, ContextualChunk } from '../../types/documentProcessing';
import { ImageAnalyzer } from '../../utils/imageAnalysis/imageAnalyzer';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError, logWarning } from '../../utils/logger';
import { getSupabaseAdmin } from '../../utils/supabaseClient';

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
          
          // Use ImageAnalyzer static method to process the image
          const analysisResult = await ImageAnalyzer.analyzeImage(uploadedFile.filepath);
          
          if (analysisResult.success) {
            // Generate document context from image analysis
            const imageContext = ImageAnalyzer.generateDocumentContext(analysisResult);
            
            // Create a document in Supabase
            const contentHash = generateContentHash(analysisResult.description + ' ' + analysisResult.detectedText);
            let document;
            try {
                // Insert the document
                document = await insertDocument({
                  title: source,
                  source: source,
                  file_path: uploadedFile.filepath,
                  content_hash: contentHash,
                  approved: false, // Set approved to false by default
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
            } catch (insertError: any) {
              if (insertError.code === '23505' && insertError.message.includes('documents_content_hash_key')) {
                logWarning(`Duplicate content detected for image file: ${source} (Content Hash: ${contentHash})`);
                result = {
                  source,
                  status: 'duplicate',
                  error: 'This image file has already been uploaded.',
                  type: 'error'
                };
                results.push(result);
                continue; // Move to the next file
              } else {
                throw insertError; // Re-throw other insertion errors
              }
            }
            
            // Prepare text for embedding with enhanced contextual information
            const textForEmbedding = ImageAnalyzer.prepareTextForEmbedding(analysisResult);
            
            // Generate embedding
            const embedding = await embedText(textForEmbedding);
            
            // Create a chunk for the image
            const chunk = {
              document_id: document.id,
              chunk_index: 0,
              text: textForEmbedding,
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
              status: 'pending_approval', // Add status
              message: 'Image uploaded successfully, pending admin approval.', // Add message
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
          const contentHash = generateContentHash(rawText);
          
          try {
            // Check for duplicate first
            const { data: existingDoc, error: checkError } = await getSupabaseAdmin()
              .from('documents')
              .select('id')
              .eq('content_hash', contentHash)
              .maybeSingle(); 

            if (checkError && checkError.code !== 'PGRST116') { // Ignore "No rows found" error
              throw checkError;
            }

            if (existingDoc) {
              logWarning(`Duplicate content detected for file: ${source} (Content Hash: ${contentHash})`);
              result = {
                source,
                status: 'duplicate',
                error: 'This file has already been uploaded.',
                type: 'error'
              };
              results.push(result);
              continue; // Move to the next file
            }

            // --- Run Analysis BEFORE Inserting --- 
            logInfo('Analyzing document before insertion:', source);
            const documentAnalysis = await analyzeDocument(rawText, source);
            logInfo('Document analysis completed successfully');

            // Prepare the full metadata object
            const initialMetadata = {
                source_url: uploadedFile.originalFilename, // Example: Store original filename
                file_path: uploadedFile.filepath,
                mime_type: mimetype,
                // --- Add AI Analysis Results --- 
                documentSummary: documentAnalysis.documentContext.summary,
                documentType: documentAnalysis.documentContext.documentType,
                primaryTopics: documentAnalysis.documentContext.mainTopics,
                technicalLevel: documentAnalysis.documentContext.technicalLevel,
                audienceType: documentAnalysis.documentContext.audienceType,
                primaryCategory: documentAnalysis.primaryCategory,
                secondaryCategories: documentAnalysis.secondaryCategories,
                keyTopics: documentAnalysis.keyTopics,
                keywords: documentAnalysis.keywords,
                confidenceScore: documentAnalysis.confidenceScore,
                qualityFlags: documentAnalysis.qualityFlags,
                entities: documentAnalysis.entities
            };

            // --- Create the document record with FULL metadata --- 
            const { data: document, error: insertError } = await insertDocument({
                title: source,
                source: source,
                file_path: uploadedFile.filepath,
                content_hash: contentHash,
                approved: false, 
                metadata: initialMetadata // Pass the complete metadata here
            });

            if (insertError) throw insertError;
            if (!document) throw new Error('Document insertion returned no data.');
            logInfo(`Created document in Supabase with ID: ${document.id}`);

            // --- Chunking and Embedding (using documentAnalysis context) --- 
            let chunks;
            let documentContext = documentAnalysis.documentContext;

            if (useContextualChunking) {
                logInfo('Using contextual chunking for document:', source);
                chunks = await splitIntoChunksWithContext(
                    rawText, 
                    500, 
                    source, 
                    true, 
                    documentContext 
                );
            } else {
                logInfo('Using standard chunking for document:', source);
                chunks = splitIntoChunks(rawText, 500, source);
                documentContext = {} as DocumentContext;
            }

            // Prepare chunk objects for batch insertion
            const chunkObjects = [];
            processedCount = 0; // Reset count
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (chunk.text.trim()) {
                    const preparedText = prepareTextForEmbedding(chunk);
                    const embedding = await embedText(preparedText);
                    chunkObjects.push({
                        document_id: document.id,
                        chunk_index: i,
                        text: preparedText,
                        embedding: embedding,
                        metadata: {
                            originalText: chunk.text,
                            source: source,
                            ...(chunk.metadata || {}),
                            isContextualChunk: useContextualChunking,
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
                status: 'pending_approval', 
                message: 'File uploaded successfully, pending admin approval.',
                processedCount,
                summary: documentContext?.summary,
                documentId: document.id
            };

          } catch (error) {
            // Generic error handling for the try block
            logError(`Error processing document ${source}:`, error);
            result = {
                source,
                error: error instanceof Error ? error.message : 'Unknown processing error',
                type: 'error'
            };
            // We push the error result later
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