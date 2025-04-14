/**
 * Embedding Client Factory
 * 
 * This module provides a unified interface for generating embeddings
 * from different providers (OpenAI and Gemini).
 */

import { OpenAI } from 'openai';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { AI_SETTINGS } from './modelConfig';
import { logError, logInfo, logDebug, logWarning, logApiCall } from './logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Gemini client
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(geminiApiKey || '');

/**
 * Interface for embedding clients
 */
export interface EmbeddingClient {
  /**
   * Generate embeddings for a single text
   * @param text Text to embed
   * @param taskType (For Gemini) Type of task the embedding will be used for:
   *                'RETRIEVAL_QUERY' - For search queries
   *                'RETRIEVAL_DOCUMENT' - For documents to be retrieved
   *                'SEMANTIC_SIMILARITY' - For general similarity comparisons
   *                'CLASSIFICATION' - For classification tasks
   *                'CLUSTERING' - For clustering tasks
   */
  embedText(text: string, taskType?: string): Promise<number[]>;
  
  /**
   * Generate embeddings for multiple texts in one batch
   * @param texts Array of texts to embed
   * @param taskType (For Gemini) Type of task the embeddings will be used for:
   *                'RETRIEVAL_DOCUMENT' - Default for documents to be retrieved
   *                'RETRIEVAL_QUERY' - For search queries
   *                'SEMANTIC_SIMILARITY' - For general similarity comparisons
   *                'CLASSIFICATION' - For classification tasks
   *                'CLUSTERING' - For clustering tasks
   */
  embedBatch(texts: string[], taskType?: string): Promise<number[][]>;
  
  /**
   * Get the provider name
   */
  getProvider(): string;
  
  /**
   * Get the expected dimensions of the embeddings
   */
  getDimensions(): number;
}

/**
 * OpenAI implementation of the EmbeddingClient
 */
class OpenAIEmbeddingClient implements EmbeddingClient {
  private readonly dimensions = 1536; // Ada-002 embedding dimensions
  
  async embedText(text: string, taskType?: string): Promise<number[]> {
    try {
      // Clean and prepare text
      const cleanedText = text.replace(/\\s+/g, ' ').trim();
      
      // Get embedding from OpenAI
      const response = await openai.embeddings.create({
        model: AI_SETTINGS.embeddingModel,
        input: cleanedText,
      });
      
      // Return the embedding vector
      return response.data[0].embedding;
    } catch (error) {
      logError('Error generating OpenAI embedding', error);
      
      // In case of error, return a zero vector as fallback
      console.error('Error generating OpenAI embedding:', error);
      return Array(this.dimensions).fill(0);
    }
  }
  
  async embedBatch(texts: string[], taskType?: string): Promise<number[][]> {
    try {
      // Clean all texts
      const cleanedTexts = texts.map(text => text.replace(/\\s+/g, ' ').trim());
      
      // Get embeddings from OpenAI
      const response = await openai.embeddings.create({
        model: AI_SETTINGS.embeddingModel,
        input: cleanedTexts,
      });
      
      // Return the embedding vectors
      return response.data.map(item => item.embedding);
    } catch (error) {
      logError('Error generating batch OpenAI embeddings', error);
      
      // In case of error, return zero vectors as fallback
      console.error('Error generating batch OpenAI embeddings:', error);
      return texts.map(() => Array(this.dimensions).fill(0));
    }
  }
  
  getProvider(): string {
    return 'openai';
  }
  
  getDimensions(): number {
    return this.dimensions;
  }
}

/**
 * Convert string task type to Gemini TaskType enum
 * @param taskType String representation of task type
 * @returns TaskType enum value
 */
function getTaskTypeEnum(taskType: string): TaskType {
  switch (taskType) {
    case 'RETRIEVAL_DOCUMENT':
      return TaskType.RETRIEVAL_DOCUMENT;
    case 'RETRIEVAL_QUERY':
      return TaskType.RETRIEVAL_QUERY;
    case 'SEMANTIC_SIMILARITY':
      return TaskType.SEMANTIC_SIMILARITY;
    case 'CLASSIFICATION':
      return TaskType.CLASSIFICATION;
    case 'CLUSTERING':
      return TaskType.CLUSTERING;
    default:
      // Default based on common use case
      return taskType.includes('QUERY') 
        ? TaskType.RETRIEVAL_QUERY 
        : TaskType.RETRIEVAL_DOCUMENT;
  }
}

/**
 * Gemini implementation of the EmbeddingClient
 */
class GeminiEmbeddingClient implements EmbeddingClient {
  private modelName: string;
  private client: GoogleGenerativeAI;
  private batchSize: number = 100; // Gemini batch limit
  private dimensions: number;

  constructor(apiKey: string, modelName: string = AI_SETTINGS.embeddingModel, dimensions: number = AI_SETTINGS.embeddingDimension) {
    if (!apiKey) throw new Error('Gemini API key is required for GeminiEmbeddingClient');
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.dimensions = dimensions;
    logInfo(`[EmbeddingClient] Gemini client initialized with model: ${this.modelName}, dimensions: ${this.dimensions}`);
  }

  getProvider(): string { return 'gemini'; }
  getDimensions(): number { return this.dimensions; }

  async embedText(text: string, taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT): Promise<number[]> {
    // Ensure only minimal text cleaning is applied right before embedding
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    if (!cleanedText) return [];

    const model = this.client.getGenerativeModel({ model: this.modelName });
    logDebug(`[EmbeddingClient] Requesting Gemini embedding for text (Task: ${taskType})`);
    const startTime = Date.now();
    try {
      const result = await model.embedContent({ content: { parts: [{ text: cleanedText }], role: "user" }, taskType });
      const duration = Date.now() - startTime;
      const embedding = result.embedding?.values || [];
      if (embedding.length === 0) {
        logWarning('[EmbeddingClient] Gemini embedding returned empty array for text.');
        // Log as error since empty embedding is usually problematic
        logApiCall('gemini', 'embedding', 'error', duration, 'Empty embedding returned', { model: this.modelName, taskType: TaskType[taskType] });
      } else {
        logInfo('[API Embedding] Gemini Embedding Success (Single Text)'); // Keep original log
        logApiCall('gemini', 'embedding', 'success', duration, undefined, { model: this.modelName, taskType: TaskType[taskType], inputLength: cleanedText.length });
      }
      return embedding;
    } catch (error) {
      const duration = Date.now() - startTime;
      logError('[API Embedding] Gemini Embedding Error (Single Text)', { error: error instanceof Error ? error.message : String(error) }); // Keep original log
      logApiCall('gemini', 'embedding', 'error', duration, error instanceof Error ? error.message : String(error), { model: this.modelName, taskType: TaskType[taskType] });
      throw new Error(`Gemini embedding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async embedBatch(texts: string[], taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT): Promise<number[][]> {
    // Ensure only minimal text cleaning is applied right before embedding
    const cleanedTexts = texts.map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (cleanedTexts.length === 0) return [];

    const model = this.client.getGenerativeModel({ model: this.modelName });
    const embeddings: number[][] = [];
    logDebug(`[EmbeddingClient] Requesting Gemini embedding for batch of ${cleanedTexts.length} texts (Task: ${taskType})`);

    for (let i = 0; i < cleanedTexts.length; i += this.batchSize) {
      const batchTexts = cleanedTexts.slice(i, i + this.batchSize);
      const requests = batchTexts.map(text => ({ content: { parts: [{ text }], role: "user" }, taskType }));
      const startTime = Date.now();
      try {
        const result = await model.batchEmbedContents({ requests });
        const duration = Date.now() - startTime;
        const batchEmbeddings = result.embeddings?.map(e => e.values || []) || [];
        embeddings.push(...batchEmbeddings);
        logInfo(`[API Embedding] Gemini Embedding Success (Batch Index ${i / this.batchSize})`); // Keep original log
        logApiCall('gemini', 'embedding', 'success', duration, undefined, { model: this.modelName, taskType: TaskType[taskType], batchSize: batchTexts.length });
      } catch (batchError) {
        const duration = Date.now() - startTime;
        logWarning(`[EmbeddingClient] Gemini batch embedding failed at index ${i}. Trying sequential fallback...`, { error: batchError });
        logError('[API Embedding] Gemini Embedding Error (Batch)', { error: batchError instanceof Error ? batchError.message : String(batchError) }); // Keep original log
        // Log the BATCH error first
        logApiCall('gemini', 'embedding', 'error', duration, batchError instanceof Error ? batchError.message : String(batchError), { model: this.modelName, taskType: TaskType[taskType], batchSize: batchTexts.length, note: 'Batch API call failed' });

        // Fallback to sequential embedding for the failed batch
        try {
          for (const text of batchTexts) {
            // Reuse embedText logic which includes its own logging (success or error)
            const singleEmbedding = await this.embedText(text, taskType);
            embeddings.push(singleEmbedding);
          }
          logInfo('[EmbeddingClient] Sequential embedding fallback successful for batch.')
        } catch (sequentialError) {
          logError('[EmbeddingClient] Sequential embedding fallback ALSO failed.', { error: sequentialError });
           logError('[API Embedding] Gemini Embedding Error (Sequential Fallback)', { error: sequentialError instanceof Error ? sequentialError.message : String(sequentialError) }); // Keep original log
           // Log the SEQUENTIAL error - embedText already logs its own attempt, so maybe just log the context here
           logError('[EmbeddingClient] Error during sequential fallback attempt', { note: 'Individual errors logged by embedText' });
          // Decide how to handle total failure - skip batch? throw error?
          // For now, log and continue (results might be incomplete)
        }
      }
    }
    return embeddings;
  }
}

/**
 * Factory function to get the appropriate embedding client
 * Always returns the Gemini embedding client after migration
 */
export function getEmbeddingClient(): EmbeddingClient {
  // After migration, we exclusively use Gemini embeddings
  console.log('Using Gemini for embeddings (text-embedding-004)');
  return new GeminiEmbeddingClient(geminiApiKey || '', AI_SETTINGS.embeddingModel, AI_SETTINGS.embeddingDimension);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
export async function embedText(text: string, taskType: string = 'RETRIEVAL_QUERY'): Promise<number[]> {
  const client = getEmbeddingClient();
  return client.embedText(text, getTaskTypeEnum(taskType));
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
export async function embedBatch(texts: string[], taskType: string = 'RETRIEVAL_DOCUMENT'): Promise<number[][]> {
  const client = getEmbeddingClient();
  return client.embedBatch(texts, getTaskTypeEnum(taskType));
} 