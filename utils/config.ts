/**
 * Configuration utility
 * 
 * Provides access to application configuration from various sources.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
    path: path.join(process.cwd(), 'data', 'vectorStore.json'),
    backupPath: path.join(process.cwd(), 'data', 'backups'),
  },
  logging: {
    level: 'info',
    logToFile: true,
    logPath: path.join(process.cwd(), 'logs'),
  }
};

// Cache for config to avoid repeated disk access
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
    // Load config from file if it exists
    const configPath = path.join(process.cwd(), 'config.json');
    let fileConfig: Config = {};
    
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      fileConfig = JSON.parse(configContent);
    }
    
    // Merge configs with environment variables taking precedence
    const config: Config = {
      ...defaultConfig,
      ...fileConfig,
      openai: {
        ...defaultConfig.openai,
        ...fileConfig.openai,
        apiKey: process.env.OPENAI_API_KEY || fileConfig.openai?.apiKey,
      },
      gemini: {
        ...defaultConfig.gemini,
        ...fileConfig.gemini,
        apiKey: process.env.GEMINI_API_KEY || fileConfig.gemini?.apiKey,
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