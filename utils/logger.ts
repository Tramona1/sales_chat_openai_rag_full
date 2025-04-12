/**
 * Logger utility for standardized logging throughout the application
 * Provides different log levels and consistent formatting
 */

// Set this to true to enable debug logs in production
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

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