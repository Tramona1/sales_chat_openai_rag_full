"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryProcessingError = exports.NetworkError = exports.VectorStoreError = exports.AIModelError = exports.DocumentProcessingError = void 0;
exports.handleOpenAIError = handleOpenAIError;
exports.handleError = handleError;
exports.createFallbackResponse = createFallbackResponse;
exports.safeExecute = safeExecute;
exports.standardizeApiErrorResponse = standardizeApiErrorResponse;
exports.formatValidationError = formatValidationError;
exports.logError = logError;
exports.logWarning = logWarning;
exports.logInfo = logInfo;
exports.logDebug = logDebug;
exports.createError = createError;
exports.formatApiError = formatApiError;
exports.withErrorHandling = withErrorHandling;
const openai_1 = require("openai");
const config_1 = require("./config");
// Get the config
const config = (0, config_1.getConfig)();
// Browser-compatible logging configuration
const LOG_LEVEL = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};
const currentLevel = LOG_LEVEL[((_a = config.logging) === null || _a === void 0 ? void 0 : _a.level) || 'info'];
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
 * Log error in browser-compatible way
 */
function logError(message, error, level = 'error') {
    // Skip logging if level is below the configured level
    if (LOG_LEVEL[level] < currentLevel) {
        return;
    }
    // In browser - use console for logging
    console.error(`[${level.toUpperCase()}] ${message}`, error);
    // No file system operations in this browser-compatible version
}
/**
 * Log warning in browser-compatible way
 */
function logWarning(message, data) {
    if (currentLevel <= LOG_LEVEL.warn) {
        console.warn(`[WARN] ${message}`, data);
    }
}
/**
 * Log info in browser-compatible way
 */
function logInfo(message, data) {
    if (currentLevel <= LOG_LEVEL.info) {
        console.info(`[INFO] ${message}`, data);
    }
}
/**
 * Log debug in browser-compatible way
 */
function logDebug(message, data) {
    if (currentLevel <= LOG_LEVEL.debug) {
        console.debug(`[DEBUG] ${message}`, data);
    }
}
/**
 * Create an error with a specific code
 */
function createError(message, code, additionalDetails) {
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
function formatApiError(message = 'An unexpected error occurred', code = 'UNKNOWN_ERROR', details) {
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
function withErrorHandling(fn, errorMessage = 'Operation failed') {
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
