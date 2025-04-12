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
   */
  embedText(text: string): Promise<number[]>;
  
  /**
   * Generate embeddings for multiple texts in one batch
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
  
  async embedText(text: string): Promise<number[]> {
    try {
      // Clean and prepare text
      const cleanedText = text.trim().replace(/\n+/g, ' ');
      
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
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      // Clean all texts
      const cleanedTexts = texts.map(text => text.trim().replace(/\n+/g, ' '));
      
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
 * Gemini implementation of the EmbeddingClient
 */
class GeminiEmbeddingClient implements EmbeddingClient {
  private readonly dimensions = 768; // Gemini embedding dimensions
  private readonly embeddingModel = 'text-embedding-004';
  
  async embedText(text: string): Promise<number[]> {
    try {
      // Clean and prepare text
      const cleanedText = text.trim().replace(/\n+/g, ' ');
      
      // Get the embedding model
      const embeddingModel = genAI.getGenerativeModel({ model: this.embeddingModel });
      
      // Generate embedding
      const result = await embeddingModel.embedContent(cleanedText);
      
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
    // Google's API doesn't support batching natively, so we do it sequentially
    try {
      // Get the embedding model once
      const embeddingModel = genAI.getGenerativeModel({
        model: this.embeddingModel
      });
      
      // Process texts in batches to avoid overwhelming the API
      const batchSize = 10;
      const results: number[][] = [];
      
      // Process in smaller batches
      for (let i = 0; i < texts.length; i += batchSize) {
        const batchTexts = texts.slice(i, i + batchSize);
        
        // Process the batch with Promise.all for parallel execution
        const batchResults = await Promise.all(
          batchTexts.map(async (text) => {
            const cleanedText = text.trim().replace(/\n+/g, ' ');
            
            try {
              // Use the same API call as embedText
              const result = await embeddingModel.embedContent(cleanedText);
              
              return result.embedding.values;
            } catch (error) {
              logError(`Error embedding text at index ${i}`, error);
              return Array(this.dimensions).fill(0);
            }
          })
        );
        
        results.push(...batchResults);
      }
      
      return results;
    } catch (error) {
      logError('Error in Gemini batch embedding', error);
      console.error('Error in Gemini batch embedding:', error);
      return texts.map(() => Array(this.dimensions).fill(0));
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
export async function embedText(text: string): Promise<number[]> {
  const client = getEmbeddingClient();
  return client.embedText(text);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use the client interface instead
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = getEmbeddingClient();
  return client.embedBatch(texts);
} 