declare const LOG_LEVEL: {
    debug: number;
    info: number;
    warn: number;
    error: number;
};
export declare class DocumentProcessingError extends Error {
    readonly originalError?: Error | undefined;
    constructor(message: string, originalError?: Error | undefined);
}
export declare class AIModelError extends Error {
    readonly originalError?: Error | undefined;
    constructor(message: string, originalError?: Error | undefined);
}
export declare class VectorStoreError extends Error {
    readonly originalError?: Error | undefined;
    constructor(message: string, originalError?: Error | undefined);
}
export declare class NetworkError extends Error {
    readonly originalError?: Error | undefined;
    constructor(message: string, originalError?: Error | undefined);
}
export declare class QueryProcessingError extends Error {
    readonly originalError?: Error | undefined;
    constructor(message: string, originalError?: Error | undefined);
}
export declare function handleOpenAIError(error: unknown): AIModelError;
export declare function handleError(error: unknown, context: string): Error;
export declare function createFallbackResponse<T>(defaultValue: T): T;
export declare function safeExecute<T>(operation: () => Promise<T>, context: string, fallback: T): Promise<T>;
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
export declare function standardizeApiErrorResponse(error: any): ApiErrorResponse;
/**
 * Format validation errors consistently
 */
export declare function formatValidationError(message: string, fieldErrors?: Record<string, string>): ApiErrorResponse;
/**
 * Log error in browser-compatible way
 */
export declare function logError(message: string, error?: any, level?: keyof typeof LOG_LEVEL): void;
/**
 * Log warning in browser-compatible way
 */
export declare function logWarning(message: string, data?: any): void;
/**
 * Log info in browser-compatible way
 */
export declare function logInfo(message: string, data?: any): void;
/**
 * Log debug in browser-compatible way
 */
export declare function logDebug(message: string, data?: any): void;
/**
 * Create an error with a specific code
 */
export declare function createError(message: string, code?: string, additionalDetails?: any): Error;
/**
 * Format API errors consistently for response
 */
export declare function formatApiError(message?: string, code?: string, details?: any): {
    error: {
        message: string;
        code: string;
        timestamp: string;
    };
};
/**
 * Higher-order function for error handling
 * Wraps a function with automatic error handling
 */
export declare function withErrorHandling<T, Args extends any[]>(fn: (...args: Args) => Promise<T>, errorMessage?: string): (...args: Args) => Promise<T>;
export {};
