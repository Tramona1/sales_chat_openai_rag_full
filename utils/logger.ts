/**
 * Logger utility for standardized logging throughout the application
 * Provides different log levels and consistent formatting
 */

// Set this to true to enable debug logs in production
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

import { getSupabaseAdmin } from './supabaseClient'; // Add Supabase admin client import

/**
 * Log an error message with optional error object
 * @param message The error message
 * @param error Optional error object with details
 */
export function logError(message: string, error?: any): void {
  console.error(`[ERROR] ${message}`);
  
  if (error) {
    if (error instanceof Error) {
      console.error(`Details: ${error.message}`);
      if (error.stack) {
        console.error(`Stack: ${error.stack}`);
      }
    } else if (typeof error === 'object') {
      try {
        console.error('Error details:', JSON.stringify(error, null, 2));
      } catch (e) {
        console.error('Error details (non-stringifiable):', error);
      }
    } else {
      console.error('Error details:', error);
    }
  }
}

/**
 * Log an informational message
 * @param message The info message
 * @param data Optional data to include with the log
 */
export function logInfo(message: string, data?: any): void {
  console.log(`[INFO] ${message}`);
  
  if (data && typeof data === 'object') {
    try {
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Additional data (non-stringifiable):', data);
    }
  } else if (data !== undefined) {
    console.log(data);
  }
}

/**
 * Log a debug message - only shows if DEBUG_MODE is enabled
 * @param message The debug message
 * @param data Optional data to include with the log
 */
export function logDebug(message: string, data?: any): void {
  if (!DEBUG_MODE) return;
  
  console.log(`[DEBUG] ${message}`);
  
  if (data && typeof data === 'object') {
    try {
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Debug data (non-stringifiable):', data);
    }
  } else if (data !== undefined) {
    console.log(data);
  }
}

/**
 * Log a warning message
 * @param message The warning message
 * @param data Optional data to include with the log
 */
export function logWarning(message: string, data?: any): void {
  console.warn(`[WARNING] ${message}`);
  
  if (data && typeof data === 'object') {
    try {
      console.warn(JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn('Warning data (non-stringifiable):', data);
    }
  } else if (data !== undefined) {
    console.warn(data);
  }
}

/**
 * Log a successful operation
 * @param message The success message
 * @param data Optional data to include with the log
 */
export function logSuccess(message: string, data?: any): void {
  console.log(`[SUCCESS] ${message}`);
  
  if (data && typeof data === 'object') {
    try {
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Success data (non-stringifiable):', data);
    }
  } else if (data !== undefined) {
    console.log(data);
  }
}

/**
 * Logs an external API call attempt to the Supabase database.
 * Handles errors during the database insert silently to avoid breaking the caller.
 *
 * @param service The external service called (e.g., 'gemini', 'openai').
 * @param api_function The specific function/endpoint called (e.g., 'embedding', 'chat_completion', 'rerank').
 * @param status 'success' or 'error'.
 * @param duration_ms Optional duration of the call in milliseconds.
 * @param error_message Optional error message if status is 'error'.
 * @param metadata Optional additional JSON data (e.g., model used, input size).
 */
export async function logApiCall(
  service: string,
  api_function: string,
  status: 'success' | 'error',
  duration_ms?: number,
  error_message?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      logWarning('[logApiCall] Supabase client not available, skipping DB log.');
      return;
    }

    const { error: insertError } = await supabase
      .from('api_call_logs')
      .insert({
        service,
        api_function,
        status,
        duration_ms,
        error_message: error_message ? String(error_message).substring(0, 500) : undefined, // Limit error message length
        metadata,
      });

    if (insertError) {
      // Log the insert error but don't throw, as logging shouldn't break primary functionality
      logError('[logApiCall] Failed to insert API call log into database', {
        service,
        api_function,
        status,
        dbError: insertError.message,
      });
    }
  } catch (err) {
    // Catch any unexpected errors during the logging process itself
    logError('[logApiCall] Unexpected error during API call logging', {
       error: err instanceof Error ? err.message : String(err),
       service,
       api_function,
       status,
    });
  }
} 