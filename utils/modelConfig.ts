/**
 * AI model configuration settings for the RAG system
 * This provides centralized configuration for all AI model settings
 */

/**
 * Interface for model settings
 */
export interface ModelSettings {
  defaultModel: string;      // Default model to use for most operations
  fallbackModel: string;     // Fallback model if the default is unavailable
  embeddingModel: string;    // Model to use for text embeddings
  embeddingDimension: number; // Dimension of embedding vectors
  maxTokens: number;         // Maximum tokens to generate in responses
  temperature: number;       // Default temperature for generation
  systemPrompt: string;      // Default system prompt for RAG queries
  
  // New fields for Gemini integration
  contextGenerationModel: {
    provider: 'gemini' | 'openai';
    model: string;
    temperature: number;
    maxTokens: number;
  };
  rerankerModel: {
    provider: 'gemini' | 'openai';
    model: string;
    temperature: number;
  };
}

/**
 * Application AI settings
 */
export const AI_SETTINGS: ModelSettings = {
  // Default model for standard operations
  defaultModel: process.env.DEFAULT_LLM_MODEL || 'gemini-2.0-flash',
  
  // Fallback model when primary is unavailable or for less critical operations
  fallbackModel: process.env.FALLBACK_LLM_MODEL || 'gpt-3.5-turbo-1106',
  
  // Embedding model for vector operations - MIGRATED TO GEMINI
  embeddingModel: 'text-embedding-004',
  
  // Embedding dimension - 768 for Gemini text-embedding-004
  embeddingDimension: 768,
  
  // Default max tokens for generation
  maxTokens: 1000,
  
  // Default temperature for most operations
  temperature: 0.7,
  
  // Default system prompt for RAG queries
  systemPrompt: `You are an AI assistant for the sales team for Workstream. Workstream is a leading HR, payroll, and hiring platform designed specifically for managing the hourly workforce, offering a suite of tools that automate hiring, onboarding, scheduling, and payroll processes to streamline operations for businesses across various industries. By integrating these functions into a mobile-first platform, Workstream helps companies reduce labor costs, improve compliance, and enhance employee engagement.
Answer the question based ONLY on the context provided. 
If the answer cannot be determined from the context, say "I don't have enough information to answer this question, please add more training information to help me learn."
Do not make up or infer information that is not in the context.
Provide concise, accurate responses with all relevant details from the context.`,

  // Updated contextual generation model settings for multi-modal RAG
  contextGenerationModel: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    temperature: 0.2,
    maxTokens: 1024
  },
  
  // Updated reranker model settings for visual content awareness
  rerankerModel: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    temperature: 0.1
  }
};

/**
 * Different preset system prompts for various use cases
 */
export const SYSTEM_PROMPTS = {
  standard: AI_SETTINGS.systemPrompt,
  
  technical: `You are an AI assistant for the sales team specializing in technical questions.
Answer the question based ONLY on the context provided.
Use technical language and be precise in your explanations.
If the answer cannot be determined from the context, say "I don't have enough information to answer this question, please add more training information to help me learn."
Do not make up or infer information that is not in the context.`,
  
  sales: `You are an AI assistant for the sales team specializing in sales queries.
Answer the question based ONLY on the context provided.
Focus on value propositions, competitive advantages, and addressing customer pain points.
If the answer cannot be determined from the context, say "I don't have enough information to answer this question, please add more training information to help me learn."
Do not make up or infer information that is not in the context.`,
  
  pricing: `You are an AI assistant for the sales team specializing in pricing questions.
Answer the question based ONLY on the context provided.
Be very precise about pricing details, plans, and subscription options.
If the answer cannot be determined from the context, say "I don't have enough information to answer this question, please add more training information to help me learn."
Do not make up or infer information that is not in the context.`
};

/**
 * Get system prompt based on query type
 */
export function getSystemPromptForQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('price') || 
      lowerQuery.includes('cost') || 
      lowerQuery.includes('subscription') ||
      lowerQuery.includes('plan')) {
    return SYSTEM_PROMPTS.pricing;
  }
  
  if (lowerQuery.includes('technical') || 
      lowerQuery.includes('architecture') || 
      lowerQuery.includes('infrastructure') ||
      lowerQuery.includes('integration')) {
    return SYSTEM_PROMPTS.technical;
  }
  
  if (lowerQuery.includes('competitor') || 
      lowerQuery.includes('comparison') || 
      lowerQuery.includes('vs') ||
      lowerQuery.includes('pitch') ||
      lowerQuery.includes('sell')) {
    return SYSTEM_PROMPTS.sales;
  }
  
  return SYSTEM_PROMPTS.standard;
}

/**
 * Get model configuration for a specific task
 * @param config Model settings
 * @param task The task to get the model for
 * @returns Model provider, name and settings
 */
export function getModelForTask(
  config: ModelSettings = AI_SETTINGS,
  task: 'chat' | 'embedding' | 'context' | 'reranking'
): { provider: string; model: string; settings: any } {
  switch (task) {
    case 'chat':
      // Check the model name to determine the correct provider
      const modelName = config.defaultModel.toLowerCase();
      if (modelName.includes('gemini')) {
        return {
          provider: 'gemini',
          model: config.defaultModel,
          settings: {
            temperature: config.temperature,
            maxTokens: config.maxTokens
          }
        };
      } else {
        // Assume OpenAI for models like gpt-x
        return {
          provider: 'openai',
          model: config.defaultModel,
          settings: {
            temperature: config.temperature,
            maxTokens: config.maxTokens
          }
        };
      }
    case 'embedding':
      return {
        provider: 'gemini', // UPDATED: Always use Gemini for embeddings
        model: config.embeddingModel,
        settings: {
          dimensions: config.embeddingDimension || 768
        }
      };
    case 'context':
      return {
        provider: config.contextGenerationModel.provider,
        model: config.contextGenerationModel.model,
        settings: {
          temperature: config.contextGenerationModel.temperature,
          maxTokens: config.contextGenerationModel.maxTokens
        }
      };
    case 'reranking':
      return {
        provider: config.rerankerModel.provider,
        model: config.rerankerModel.model,
        settings: {
          temperature: config.rerankerModel.temperature
        }
      };
    default:
      // Default case also checks model name
      const defaultModelName = config.defaultModel.toLowerCase();
      if (defaultModelName.includes('gemini')) {
        return {
          provider: 'gemini',
          model: config.defaultModel,
          settings: {
            temperature: config.temperature,
            maxTokens: config.maxTokens
          }
        };
      } else {
        return {
          provider: 'openai',
          model: config.defaultModel,
          settings: {
            temperature: config.temperature,
            maxTokens: config.maxTokens
          }
        };
      }
  }
}

// Create a default export object with all the named exports as properties
const modelConfig = {
  AI_SETTINGS,
  SYSTEM_PROMPTS,
  getSystemPromptForQuery,
  getModelForTask
};

// Export as default
export default modelConfig; 