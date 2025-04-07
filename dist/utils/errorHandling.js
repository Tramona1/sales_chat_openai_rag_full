"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryProcessingError = exports.NetworkError = exports.VectorStoreError = exports.AIModelError = exports.DocumentProcessingError = void 0;
exports.handleOpenAIError = handleOpenAIError;
exports.handleError = handleError;
exports.createFallbackResponse = createFallbackResponse;
exports.safeExecute = safeExecute;
exports.standardizeApiErrorResponse = standardizeApiErrorResponse;
exports.formatValidationError = formatValidationError;
exports.logError = logError;
exports.createError = createError;
const openai_1 = require("openai");
// Custom error classes for better error identification
class DocumentProcessingError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'DocumentProcessingError';
    }
}
exports.DocumentProcessingError = DocumentProcessingError;
class AIModelError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'AIModelError';
    }
}
exports.AIModelError = AIModelError;
class VectorStoreError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'VectorStoreError';
    }
}
exports.VectorStoreError = VectorStoreError;
class NetworkError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'NetworkError';
    }
}
exports.NetworkError = NetworkError;
class QueryProcessingError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'QueryProcessingError';
    }
}
exports.QueryProcessingError = QueryProcessingError;
// Error handler for OpenAI API errors
function handleOpenAIError(error) {
    if (error instanceof openai_1.OpenAI.APIError) {
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
function handleError(error, context) {
    // Log the error for debugging
    console.error(`Error in ${context}:`, error);
    // Specific handling based on error type
    if (error instanceof openai_1.OpenAI.APIError) {
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
function createFallbackResponse(defaultValue) {
    return defaultValue;
}
// Type-safe try/catch wrapper for async functions
async function safeExecute(operation, context, fallback) {
    try {
        return await operation();
    }
    catch (error) {
        handleError(error, context);
        return fallback;
    }
}
/**
 * Standardize error responses for API endpoints
 * This ensures consistent error formatting across the application
 */
function standardizeApiErrorResponse(error) {
    var _a;
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
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('timeout'))) {
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
function formatValidationError(message, fieldErrors) {
    return {
        error: {
            message: message || 'Validation error',
            code: 'VALIDATION_ERROR',
            details: fieldErrors
        }
    };
}
/**
 * Log error with standardized format for easier debugging
 */
function logError(error, context) {
    const timestamp = new Date().toISOString();
    const contextInfo = context ? `[${context}] ` : '';
    console.error(`${timestamp} ${contextInfo}Error: ${error.message}`);
    if (error.stack && process.env.NODE_ENV !== 'production') {
        console.error(`Stack trace: ${error.stack}`);
    }
    // Log additional details if available
    if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
    }
}
/**
 * Create a simple error with additional context
 */
function createError(message, code, additionalDetails) {
    const error = new Error(message);
    if (code)
        error.code = code;
    if (additionalDetails)
        error.details = additionalDetails;
    return error;
}
