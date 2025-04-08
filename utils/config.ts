/**
 * Configuration utility
 * 
 * Provides access to application configuration from various sources.
 * Browser-compatible version that uses environment variables.
 */

// No direct file system imports in browser environment
import { defaultsDeep } from 'lodash';

// Config interface
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
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    logToFile?: boolean;
    logPath?: string;
  };
}

// Default configuration
const defaultConfig: Config = {
  openai: {
    defaultModel: 'gpt-3.5-turbo',
  },
  gemini: {
    defaultModel: 'gemini-1.5-pro',
  },
  vectorStore: {
    path: '/data/vectorStore.json',
    backupPath: '/data/backups',
  },
  logging: {
    level: 'info',
    logToFile: false, // No file logging in browser
    logPath: '/logs',
  }
};

// Cache for config to avoid repeated processing
let configCache: Config | null = null;

/**
 * Get the application configuration
 * 
 * @returns The application configuration
 */
export function getConfig(): Config {
  // Return cached config if available
  if (configCache) {
    return configCache;
  }
  
  try {
    // In browser environment, we only use environment variables
    // and default values since we can't access the file system
    const config: Config = {
      ...defaultConfig,
      openai: {
        ...defaultConfig.openai,
        // Access environment variables from Next.js public runtime config
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || defaultConfig.openai?.apiKey,
      },
      gemini: {
        ...defaultConfig.gemini,
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || defaultConfig.gemini?.apiKey,
      },
    };
    
    // Cache the config
    configCache = config;
    
    return config;
  } catch (error) {
    console.error('Error loading configuration:', error);
    return defaultConfig;
  }
}

/**
 * Reload the configuration (clears cache)
 */
export function reloadConfig(): Config {
  configCache = null;
  return getConfig();
} 