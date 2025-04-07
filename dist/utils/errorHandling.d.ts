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
 * Log error with standardized format for easier debugging
 */
export declare function logError(error: any, context?: string): void;
/**
 * Create a simple error with additional context
 */
export declare function createError(message: string, code?: string, additionalDetails?: any): Error;
