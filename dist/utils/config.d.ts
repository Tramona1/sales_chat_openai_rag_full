/**
 * Configuration utility
 *
 * Provides access to application configuration from various sources.
 * Browser-compatible version that uses environment variables.
 */
export interface Config {
    openai?: {
        apiKey?: string;
        defaultModel?: string;
    };
    gemini?: {
        apiKey?: string;
        defaultModel?: string;
    };
    vectorStore?: {
        path?: string;
        backupPath?: string;
    };
    logging?: {
        level?: 'debug' | 'info' | 'warn' | 'error';
        logToFile?: boolean;
        logPath?: string;
    };
}
/**
 * Get the application configuration
 *
 * @returns The application configuration
 */
export declare function getConfig(): Config;
/**
 * Reload the configuration (clears cache)
 */
export declare function reloadConfig(): Config;
