/**
 * API Error Utilities
 * 
 * Provides standardized error response structures and formatting for API endpoints.
 */

// Standard API error response format
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
  // Log the raw error for debugging on the server
  console.error('Standardizing API Error:', error);
  
  // Handle specific error types if needed (e.g., OpenAI, Supabase)
  // Example: Check for Supabase errors (adjust based on actual error structure)
  if (error && (error.code?.startsWith('PGRST') || error.message?.includes('supabase'))) {
     return {
      error: {
        message: 'Database error occurred',
        code: 'DATABASE_ERROR', // More generic code
        details: process.env.NODE_ENV !== 'production' ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : undefined
      }
    };
  }

  // Example: Handle OpenAI API errors (adjust based on actual error structure if using OpenAI directly)
  if (error.name === 'OpenAIError' || (error.response && error.response.headers && error.response.headers.get('x-request-id'))) {
    return {
      error: {
        message: 'Error processing your request with the language model',
        code: 'LLM_API_ERROR', // More generic code
        details: process.env.NODE_ENV !== 'production' ? {
          message: error.message,
          type: error.type,
          statusCode: error.status || error.statusCode
        } : undefined
      }
    };
  }
  
  // Example: Handle vector store specific errors if identifiable
  if (error.name === 'VectorStoreError' || (error.message && error.message.includes('vector store'))) {
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
  
  // Example: Handle timeout errors
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

  // Example: Handle custom error classes from errorHandling.ts
  if (error instanceof Error) {
      let code = 'UNKNOWN_ERROR';
      if (error.name === 'DocumentProcessingError') code = 'DOC_PROCESSING_ERROR';
      else if (error.name === 'AIModelError') code = 'AI_MODEL_ERROR';
      else if (error.name === 'NetworkError') code = 'NETWORK_ERROR';
      else if (error.name === 'QueryProcessingError') code = 'QUERY_PROCESSING_ERROR';
      // Add other custom error types here

      return {
          error: {
              message: error.message || 'An internal error occurred.',
              code: (error as any).code || code, // Use specific code if available
              details: process.env.NODE_ENV !== 'production' ? { name: error.name, stack: error.stack } : undefined
          }
      };
  }
  
  // Default error response for non-Error objects or unknown errors
  return {
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV !== 'production' ? {
        rawError: error // Include the raw error for debugging if not in production
      } : undefined
    }
  };
} 