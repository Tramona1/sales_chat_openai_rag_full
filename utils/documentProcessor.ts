/**
 * Document Processing Orchestration
 * 
 * This module provides a unified approach to document processing,
 * ensuring consistent handling regardless of source (upload, admin ingest, rebuild).
 */

import { logInfo, logError, logWarning } from './logger';
import { analyzeDocument } from './documentAnalysis';
import { splitIntoChunksWithContext } from './documentProcessing';
import { embedBatch } from './embeddingClient';
import { addToVectorStore } from './vectorStoreFactory';
import { VectorStoreItem } from './vectorStore';
import { EnhancedMetadata } from '../types/metadata';
import { extractText, ChunkContext } from './documentProcessing';
import { generateContentHash } from './hashUtils';
import { ImageAnalyzer } from './imageAnalyzer';
import { visualStorageStrategy } from './storageStrategies';
import { isImageFile } from './fileUtils';
import path from 'path';

/**
 * Processing options for document ingestion
 */
export interface DocumentProcessingOptions {
  /** Generate unique ID instead of using hash */
  generateUniqueId?: boolean;
  /** Custom document ID to use */
  documentId?: string;
  /** Skip duplicate check */
  skipDuplicateCheck?: boolean;
  /** Custom chunk size */
  chunkSize?: number;
  /** Process images in document */
  processImages?: boolean;
  /** Model to use for document analysis */
  analysisModel?: string;
  /** Whether to use caching for document analysis */
  useCaching?: boolean;
}

/**
 * Result of document processing
 */
export interface DocumentProcessingResult {
  /** Document ID */
  documentId: string;
  /** Number of chunks created */
  chunkCount: number;
  /** Whether processing was successful */
  success: boolean;
  /** Any errors encountered */
  error?: string;
  /** Document metadata */
  metadata?: EnhancedMetadata;
  /** Processing stats */
  stats?: {
    analysisTimeMs: number;
    chunkingTimeMs: number;
    embeddingTimeMs: number;
    storageTimeMs: number;
    totalTimeMs: number;
  };
}

/**
 * Process a document through the entire pipeline
 * 
 * This function orchestrates the complete processing of a document:
 * 1. Text/visual extraction
 * 2. Document analysis (metadata + context)
 * 3. Chunking with context
 * 4. Embedding generation
 * 5. Vector store storage
 * 
 * @param input Either file path or raw text
 * @param source Source identifier for the document
 * @param mimeType MIME type (required if input is a file path)
 * @param options Processing options
 * @returns Processing result
 */
export async function processDocument(
  input: string,
  source: string,
  mimeType?: string,
  options: DocumentProcessingOptions = {}
): Promise<DocumentProcessingResult> {
  const startTime = Date.now();
  const chunkSize = options.chunkSize || 500;
  let documentText: string;
  let visualContent: Array<{
    type: string;
    description: string;
    extractedText?: string;
    detectedText?: string;
    storageUrl?: string;
    visualId?: string;
  }> = [];

  try {
    // 1. Extract text and process images if needed
    if (mimeType) {
      // Input is a file path
      documentText = await extractText(input, mimeType);
      
      // Process images if enabled and file is an image or PDF
      if (options.processImages) {
        if (isImageFile(mimeType)) {
          // Single image file
          const analysisResult = await ImageAnalyzer.analyze(input);
          if (analysisResult.success) {
            // Upload the image to storage
            const filename = path.basename(input);
            const visualId = await visualStorageStrategy.uploadImage(input, filename);
            
            visualContent.push({
              type: analysisResult.type || 'image',
              description: analysisResult.description || '',
              extractedText: analysisResult.extractedText || '',
              detectedText: analysisResult.detectedText || '',
              storageUrl: await visualStorageStrategy.getPublicUrl(visualId),
              visualId
            });
          }
        } else if (mimeType === 'application/pdf') {
          // TODO: Extract and process images from PDF
          // This would need to use a PDF image extraction utility
          logInfo('PDF image extraction not yet implemented');
        }
      }
    } else {
      // Input is raw text
      documentText = input;
    }

    // Generate ID for the document
    const documentId = options.documentId || 
                      (options.generateUniqueId ? 
                        `doc_${Date.now()}_${Math.random().toString(36).substring(2, 10)}` : 
                        generateContentHash(documentText));

    // 2. Analyze document to extract metadata and context
    const analysisStartTime = Date.now();
    const documentAnalysis = await analyzeDocument(documentText, source, {
      useCaching: options.useCaching,
      model: options.analysisModel
    });
    const analysisTimeMs = Date.now() - analysisStartTime;

    // 3. Split into contextual chunks
    const chunkingStartTime = Date.now();
    const chunks = await splitIntoChunksWithContext(
      documentText,
      chunkSize,
      source,
      true, // Generate context for chunks
      documentAnalysis.documentContext
    );
    
    // Add visual content to chunks if available
    const chunksWithVisuals = chunks.map(chunk => {
      if (visualContent.length > 0) {
        return {
          ...chunk,
          visualContent,
          metadata: {
            ...chunk.metadata,
            hasVisualContent: true
          }
        };
      }
      return chunk;
    });
    
    const chunkingTimeMs = Date.now() - chunkingStartTime;

    // 4. Generate embeddings for chunks
    const embeddingStartTime = Date.now();
    const textsToEmbed = chunksWithVisuals.map(chunk => {
      return chunk.text;
    });

    // Generate embeddings for all chunks
    const embeddings = await embedBatch(textsToEmbed, 'RETRIEVAL_DOCUMENT');
    const embeddingTimeMs = Date.now() - embeddingStartTime;

    // 5. Store in vector store
    const storageStartTime = Date.now();
    const vectorItems: VectorStoreItem[] = chunksWithVisuals.map((chunk, index) => {
      // Check if chunk has visualContent using type narrowing
      const hasVisualContent = 'visualContent' in chunk && 
                              Array.isArray(chunk.visualContent) && 
                              chunk.visualContent.length > 0;

      return {
        id: `${documentId}_${index}`,
        documentId,
        chunkIndex: index,
        text: chunk.text,
        embedding: embeddings[index],
        metadata: {
          ...chunk.metadata,
          hasVisualContent
        }
      };
    });

    // Add to vector store
    await addToVectorStore(vectorItems);
    const storageTimeMs = Date.now() - storageStartTime;
    const totalTimeMs = Date.now() - startTime;

    logInfo(`Successfully processed document: ${documentId} with ${vectorItems.length} chunks`);

    return {
      documentId,
      chunkCount: vectorItems.length,
      success: true,
      metadata: documentAnalysis,
      stats: {
        analysisTimeMs,
        chunkingTimeMs,
        embeddingTimeMs,
        storageTimeMs,
        totalTimeMs
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error processing document:', error);
    
    return {
      documentId: 'failed',
      chunkCount: 0,
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Process multiple documents in batch
 * 
 * @param documents Array of documents to process
 * @param options Processing options
 * @param concurrency Max number of documents to process concurrently
 * @returns Array of processing results
 */
export async function batchProcessDocuments(
  documents: Array<{
    input: string;
    source: string;
    mimeType?: string;
  }>,
  options: DocumentProcessingOptions = {},
  concurrency: number = 3
): Promise<DocumentProcessingResult[]> {
  const results: DocumentProcessingResult[] = [];
  const queue = [...documents];
  
  // Process in batches based on concurrency
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const batchPromises = batch.map(doc => 
      processDocument(doc.input, doc.source, doc.mimeType, options)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    logInfo(`Processed batch of ${batch.length} documents. Remaining: ${queue.length}`);
  }
  
  return results;
} 