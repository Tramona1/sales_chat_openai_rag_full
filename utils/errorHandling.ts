import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { getConfig } from './config';

// Get the config
const config = getConfig();

// Log directory
const logDir = config.logging?.logPath || path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Current log level
const LOG_LEVEL = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = LOG_LEVEL[config.logging?.level || 'info'];

// Custom error classes for better error identification
export class DocumentProcessingError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'DocumentProcessingError';
  }
}

export class AIModelError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'AIModelError';
  }
}

export class VectorStoreError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'VectorStoreError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class QueryProcessingError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'QueryProcessingError';
  }
}

// Error handler for OpenAI API errors
export function handleOpenAIError(error: unknown): AIModelError {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 400) {
      return new AIModelError(`Invalid request to OpenAI: ${error.message}`, error);
    } else if (error.status === 401) {
      return new AIModelError('Authentication error with OpenAI API. Check your API key.', error);
    } else if (error.status === 429) {
      return new AIModelError('Rate limit exceeded with OpenAI API. Please try again later.', error);
    } else if (error.status >= 500) {
      return new AIModelError('OpenAI service is currently unavailable. Please try again later.', error);
    }
  }
  
  return new AIModelError(`Unexpected error with OpenAI: ${error instanceof Error ? error.message : String(error)}`, 
    error instanceof Error ? error : undefined);
}

// General purpose error handler
export function handleError(error: unknown, context: string): Error {
  // Log the error for debugging
  console.error(`Error in ${context}:`, error);
  
  // Specific handling based on error type
  if (error instanceof OpenAI.APIError) {
    return handleOpenAIError(error);
  }
  
  if (error instanceof DocumentProcessingError || 
      error instanceof AIModelError || 
      error instanceof VectorStoreError ||
      error instanceof NetworkError ||
      error instanceof QueryProcessingError) {
    return error; // Already a custom error, return as is
  }
  
  // Generic error handling
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Error in ${context}: ${message}`);
}

// Helper for fallback response creation
export function createFallbackResponse<T>(defaultValue: T): T {
  return defaultValue;
}

// Type-safe try/catch wrapper for async functions
export async function safeExecute<T>(
  operation: () => Promise<T>,
  context: string,
  fallback: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
}

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: {
    message: string;
    code: string;
    details?: any;
  };
}

/**
 * Standardize error responses for API endpoints
 * This ensures consistent error formatting across the application
 */
export function standardizeApiErrorResponse(error: any): ApiErrorResponse {
  console.error('Error details:', error);
  
  // Handle OpenAI API errors
  if (error.name === 'OpenAIError' || (error.response && error.response.headers && error.response.headers.get('x-request-id'))) {
    return {
      error: {
        message: 'Error processing your request with the language model',
        code: 'OPENAI_API_ERROR',
        details: process.env.NODE_ENV !== 'production' ? {
          message: error.message,
          type: error.type,
          statusCode: error.status || error.statusCode
        } : undefined
      }
    };
  }
  
  // Handle vector store errors
  if (error.message && error.message.includes('vector store')) {
    return {
      error: {
        message: 'Error retrieving information from knowledge base',
        code: 'VECTOR_STORE_ERROR',
        details: process.env.NODE_ENV !== 'production' ? {
          message: error.message
        } : undefined
      }
    };
  }
  
  // Handle timeout errors
  if (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return {
      error: {
        message: 'Request timed out. Please try again.',
        code: 'TIMEOUT_ERROR',
        details: process.env.NODE_ENV !== 'production' ? {
          message: error.message
        } : undefined
      }
    };
  }
  
  // Default error response
  return {
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV !== 'production' ? {
        message: error.message || 'Unknown error'
      } : undefined
    }
  };
}

/**
 * Format validation errors consistently
 */
export function formatValidationError(message: string, fieldErrors?: Record<string, string>): ApiErrorResponse {
  return {
    error: {
      message: message || 'Validation error',
      code: 'VALIDATION_ERROR',
      details: fieldErrors
    }
  };
}

/**
 * Logs an error message with details
 * 
 * @param message Error message
 * @param details Additional error details
 */
export function logError(message: string, details: any): void {
  // Always log to console
  console.error(`[ERROR] ${message}`, details);
  
  // Log to file if configured
  if (config.logging?.logToFile) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'error',
      message,
      details
    };
    
    const logFile = path.join(logDir, `errors-${new Date().toISOString().split('T')[0]}.log`);
    
    try {
      fs.appendFileSync(
        logFile, 
        JSON.stringify(logEntry) + '\n',
        { encoding: 'utf8' }
      );
    } catch (err) {
      console.error(`Failed to write to error log: ${err}`);
    }
  }
}

/**
 * Logs a warning message
 * 
 * @param message Warning message
 * @param details Additional details
 */
export function logWarning(message: string, details?: any): void {
  if (currentLevel <= LOG_LEVEL.warn) {
    console.warn(`[WARN] ${message}`, details || '');
    
    // Log to file if configured
    if (config.logging?.logToFile) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: 'warn',
        message,
        details
      };
      
      const logFile = path.join(logDir, `application-${new Date().toISOString().split('T')[0]}.log`);
      
      try {
        fs.appendFileSync(
          logFile, 
          JSON.stringify(logEntry) + '\n',
          { encoding: 'utf8' }
        );
      } catch (err) {
        console.error(`Failed to write to log: ${err}`);
      }
    }
  }
}

/**
 * Logs an info message
 * 
 * @param message Info message
 * @param details Additional details
 */
export function logInfo(message: string, details?: any): void {
  if (currentLevel <= LOG_LEVEL.info) {
    console.info(`[INFO] ${message}`, details || '');
    
    // Log to file if configured
    if (config.logging?.logToFile) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: 'info',
        message,
        details
      };
      
      const logFile = path.join(logDir, `application-${new Date().toISOString().split('T')[0]}.log`);
      
      try {
        fs.appendFileSync(
          logFile, 
          JSON.stringify(logEntry) + '\n',
          { encoding: 'utf8' }
        );
      } catch (err) {
        console.error(`Failed to write to log: ${err}`);
      }
    }
  }
}

/**
 * Logs a debug message
 * 
 * @param message Debug message
 * @param details Additional details
 */
export function logDebug(message: string, details?: any): void {
  if (currentLevel <= LOG_LEVEL.debug) {
    console.debug(`[DEBUG] ${message}`, details || '');
    
    // Log to file if configured
    if (config.logging?.logToFile) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: 'debug',
        message,
        details
      };
      
      const logFile = path.join(logDir, `application-${new Date().toISOString().split('T')[0]}.log`);
      
      try {
        fs.appendFileSync(
          logFile, 
          JSON.stringify(logEntry) + '\n',
          { encoding: 'utf8' }
        );
      } catch (err) {
        console.error(`Failed to write to log: ${err}`);
      }
    }
  }
}

/**
 * Create a simple error with additional context
 */
export function createError(message: string, code?: string, additionalDetails?: any): Error {
  const error: any = new Error(message);
  if (code) error.code = code;
  if (additionalDetails) error.details = additionalDetails;
  return error;
} 