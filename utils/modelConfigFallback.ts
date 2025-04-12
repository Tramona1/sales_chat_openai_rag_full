/**
 * Fallback implementations for modelConfig
 * This provides backup implementations if the main imports fail
 */

// Default model settings
export const AI_SETTINGS = {
  defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
  fallbackModel: process.env.FALLBACK_LLM_MODEL || 'gpt-3.5-turbo-1106',
  embeddingModel: 'text-embedding-004',
  embeddingDimension: 768,
  maxTokens: 1000,
  temperature: 0.7,
  systemPrompt: 'You are a helpful assistant that answers based only on provided context.',
  contextGenerationModel: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    temperature: 0.2,
    maxTokens: 1024
  },
  rerankerModel: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    temperature: 0.1
  }
};

// Fallback implementation for getModelForTask
export function getModelForTask(config = AI_SETTINGS, task = 'chat') {
  switch (task) {
    case 'chat':
      return {
        provider: 'gemini',
        model: config.defaultModel,
        settings: {
          temperature: config.temperature,
          maxTokens: config.maxTokens
        }
      };
    case 'embedding':
      return {
        provider: 'gemini',
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
      return {
        provider: 'gemini',
        model: config.defaultModel,
        settings: {
          temperature: config.temperature,
          maxTokens: config.maxTokens
        }
      };
  }
}

// Simple implementation for getSystemPromptForQuery
export function getSystemPromptForQuery(query: string): string {
  // Simple implementation that always returns the standard prompt
  return AI_SETTINGS.systemPrompt;
}

// Create a default export with all the named exports
const modelConfigFallback = {
  AI_SETTINGS,
  getModelForTask,
  getSystemPromptForQuery
};

// Export as default
export default modelConfigFallback; 