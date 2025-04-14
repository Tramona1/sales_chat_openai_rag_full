/**
 * Embedding Client Factory
 * 
 * This module provides a unified interface for generating embeddings
 * from different providers (OpenAI and Gemini).
 */

import { OpenAI } from 'openai';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { AI_SETTINGS } from './modelConfig';
import { logError } from './logger';
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
  private readonly dimensions = 768; // Gemini embedding dimensions
  private readonly embeddingModel = 'text-embedding-004';
  
  async embedText(text: string, taskType: string = 'RETRIEVAL_QUERY'): Promise<number[]> {
    try {
      // Clean and prepare text
      const cleanedText = text.replace(/\\s+/g, ' ').trim();
      
      // Get the embedding model
      const embeddingModel = genAI.getGenerativeModel({ model: this.embeddingModel });
      
      // Convert taskType string to TaskType enum
      const taskTypeEnum = getTaskTypeEnum(taskType);
      
      // Generate embedding with proper taskType
      const result = await embeddingModel.embedContent({
        content: { parts: [{ text: cleanedText }], role: "user" },
        taskType: taskTypeEnum
      });
      
      // Return the embedding vector
      return result.embedding.values;
    } catch (error) {
      logError('Error generating Gemini embedding', error);
      
      // In case of error, return a zero vector as fallback
      console.error('Error generating Gemini embedding:', error);
      return Array(this.dimensions).fill(0);
    }
  }
  
  async embedBatch(texts: string[], taskType: string = 'RETRIEVAL_DOCUMENT'): Promise<number[][]> {
    try {
      // Get the embedding model
      const embeddingModel = genAI.getGenerativeModel({
        model: this.embeddingModel
      });
      
      // Clean and prepare texts
      const cleanedTexts = texts.map(text => text.replace(/\\s+/g, ' ').trim());
      
      // Convert taskType string to TaskType enum
      const taskTypeEnum = getTaskTypeEnum(taskType);
      
      // Create batch requests
      const batchRequests = cleanedTexts.map(text => ({
        content: { parts: [{ text }], role: "user" },
        taskType: taskTypeEnum
      }));
      
      // Use the proper batch API
      const batchResults = await embeddingModel.batchEmbedContents({
        requests: batchRequests
      });
      
      // Extract embedding values
      return batchResults.embeddings.map(embedding => embedding.values);
    } catch (error) {
      logError('Error in Gemini batch embedding', error);
      
      // If batch API fails, fall back to sequential processing
      try {
        console.warn('Batch embedding failed, falling back to sequential processing');
        const embeddingModel = genAI.getGenerativeModel({
          model: this.embeddingModel
        });
        
        const results = await Promise.all(
          texts.map(async (text) => {
            try {
              const cleanedText = text.replace(/\\s+/g, ' ').trim();
              const result = await embeddingModel.embedContent({
                content: { parts: [{ text: cleanedText }], role: "user" },
                taskType: taskType === 'RETRIEVAL_QUERY' ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT
              });
              return result.embedding.values;
            } catch (err) {
              console.error('Error in fallback embedding:', err);
              return Array(this.dimensions).fill(0);
            }
          })
        );
        
        return results;
      } catch (fallbackError) {
        console.error('Error in fallback embedding process:', fallbackError);
        return texts.map(() => Array(this.dimensions).fill(0));
      }
    }
  }
  
  getProvider(): string {
    return 'gemini';
  }
  
  getDimensions(): number {
    return this.dimensions;
  }
}

/**
 * Factory function to get the appropriate embedding client
 * Always returns the Gemini embedding client after migration
 */
export function getEmbeddingClient(): EmbeddingClient {
  // After migration, we exclusively use Gemini embeddings
  console.log('Using Gemini for embeddings (text-embedding-004)');
  return new GeminiEmbeddingClient();
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
export async function embedText(text: string, taskType: string = 'RETRIEVAL_QUERY'): Promise<number[]> {
  const client = getEmbeddingClient();
  return client.embedText(text, taskType);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
export async function embedBatch(texts: string[], taskType: string = 'RETRIEVAL_DOCUMENT'): Promise<number[][]> {
  const client = getEmbeddingClient();
  return client.embedBatch(texts, taskType);
} 