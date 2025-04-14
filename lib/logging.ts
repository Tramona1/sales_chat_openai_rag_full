/**
 * Centralized logging utility for the Sales Chat RAG system
 * 
 * This module provides standardized logging functions with severity levels
 * and consistent formatting for use throughout the application.
 */

/**
 * Log informational messages
 * @param message The message to log
 * @param args Additional arguments to include in the log
 */
export function logInfo(message: string, ...args: any[]) {
  console.log(`[INFO] ${message}`, ...args);
}

/**
 * Log warning messages
 * @param message The warning message to log
 * @param args Additional arguments to include in the log
 */
export function logWarning(message: string, ...args: any[]) {
  console.warn(`[WARNING] ${message}`, ...args);
}

/**
 * Log error messages
 * @param message The error message to log
 * @param args Additional arguments to include in the log
 */
export function logError(message: string, ...args: any[]) {
  console.error(`[ERROR] ${message}`, ...args);
}

/**
 * Log debug messages (only when DEBUG=true)
 * @param message The debug message to log
 * @param args Additional arguments to include in the log
 */
export function logDebug(message: string, ...args: any[]) {
  if (process.env.DEBUG === 'true') {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
} 