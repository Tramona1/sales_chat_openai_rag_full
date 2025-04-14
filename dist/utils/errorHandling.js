/**
 * Error handling utilities
 *
 * This module provides utilities for handling errors in a consistent way.
 */
import { OpenAI } from 'openai';
import { logError } from './logger';
// Custom error classes for better error identification
export class DocumentProcessingError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'DocumentProcessingError';
    }
}
export class AIModelError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'AIModelError';
    }
}
export class VectorStoreError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'VectorStoreError';
    }
}
export class NetworkError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'NetworkError';
    }
}
export class QueryProcessingError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'QueryProcessingError';
    }
}
// Error handler for OpenAI API errors
export function handleOpenAIError(error) {
    if (error instanceof OpenAI.APIError) {
        if (error.status === 400) {
            return new AIModelError(`Invalid request to OpenAI: ${error.message}`, error);
        }
        else if (error.status === 401) {
            return new AIModelError('Authentication error with OpenAI API. Check your API key.', error);
        }
        else if (error.status === 429) {
            return new AIModelError('Rate limit exceeded with OpenAI API. Please try again later.', error);
        }
        else if (error.status >= 500) {
            return new AIModelError('OpenAI service is currently unavailable. Please try again later.', error);
        }
    }
    return new AIModelError(`Unexpected error with OpenAI: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
}
// General purpose error handler
export function handleError(error, context) {
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
export function createFallbackResponse(defaultValue) {
    return defaultValue;
}
// Type-safe try/catch wrapper for async functions
export async function safeExecute(operation, context, fallback) {
    try {
        return await operation();
    }
    catch (error) {
        logError(`Error during safeExecute in context: ${context}`, error);
        return fallback;
    }
}
/**
 * Standardize error responses for API endpoints
 * This ensures consistent error formatting across the application
 */
export function standardizeApiErrorResponse(error) {
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
export function formatValidationError(message, fieldErrors) {
    return {
        error: {
            message: message || 'Validation error',
            code: 'VALIDATION_ERROR',
            details: fieldErrors
        }
    };
}
/**
 * Create an error with a specific code
 */
export function createError(message, code, additionalDetails) {
    const error = new Error(message);
    if (code) {
        error.code = code;
    }
    if (additionalDetails) {
        error.details = additionalDetails;
    }
    return error;
}
/**
 * Format API errors consistently for response
 */
export function formatApiError(message = 'An unexpected error occurred', code = 'UNKNOWN_ERROR', details) {
    return {
        error: {
            message,
            code,
            timestamp: new Date().toISOString()
        }
    };
}
/**
 * Higher-order function for error handling
 * Wraps a function with automatic error handling
 */
export function withErrorHandling(fn, errorMessage = 'Operation failed') {
    return async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            logError(errorMessage, error);
            throw createError(error instanceof Error ? error.message : errorMessage, error.code || 'UNKNOWN_ERROR');
        }
    };
}
