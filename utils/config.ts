/**
 * Configuration Module
 * 
 * This module provides access to the application configuration settings.
 */

// Define the configuration interface
export interface Config {
  openai?: {
    apiKey?: string;
    defaultModel?: string;
  };
  gemini?: {
    apiKey?: string;
    defaultModel?: string;
  };
  vectorStore?: {
    path?: string;
    backupPath?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

// Default configuration
const defaultConfig: Config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
  },
  gemini: {
    apiKey: process.env.GOOGLE_AI_API_KEY,
    defaultModel: 'gemini-pro',
  },
  vectorStore: {
    path: process.env.VECTOR_STORE_DIR || 'data/vector_batches',
    backupPath: 'data/backups',
  },
  logging: {
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    file: 'data/logs/app.log',
  },
};

// Singleton to hold the config
let configInstance: Config = { ...defaultConfig };

/**
 * Get the current configuration
 */
export function getConfig(): Config {
  return configInstance;
}

/**
 * Reload the configuration from environment variables
 */
export function reloadConfig(): Config {
  configInstance = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
    },
    gemini: {
      apiKey: process.env.GOOGLE_AI_API_KEY,
      defaultModel: 'gemini-pro',
    },
    vectorStore: {
      path: process.env.VECTOR_STORE_DIR || 'data/vector_batches',
      backupPath: 'data/backups',
    },
    logging: {
      level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      file: 'data/logs/app.log',
    },
  };
  
  return configInstance;
}

export default getConfig(); 