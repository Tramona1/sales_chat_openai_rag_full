/**
 * Configuration Module
 *
 * This module provides access to the application configuration settings.
 */
// Default configuration
const defaultConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
    },
    gemini: {
        apiKey: process.env.GOOGLE_AI_API_KEY,
        defaultModel: 'gemini-pro',
    },
    vectorStore: {
        path: process.env.VECTOR_STORE_DIR || 'data/vector_batches',
        backupPath: 'data/backups',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: 'data/logs/app.log',
    },
};
// Singleton to hold the config
let configInstance = { ...defaultConfig };
/**
 * Get the current configuration
 */
export function getConfig() {
    return configInstance;
}
/**
 * Reload the configuration from environment variables
 */
export function reloadConfig() {
    configInstance = {
        openai: {
            apiKey: process.env.OPENAI_API_KEY,
            defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
        },
        gemini: {
            apiKey: process.env.GOOGLE_AI_API_KEY,
            defaultModel: 'gemini-pro',
        },
        vectorStore: {
            path: process.env.VECTOR_STORE_DIR || 'data/vector_batches',
            backupPath: 'data/backups',
        },
        logging: {
            level: process.env.LOG_LEVEL || 'info',
            file: 'data/logs/app.log',
        },
    };
    return configInstance;
}
export default getConfig();
