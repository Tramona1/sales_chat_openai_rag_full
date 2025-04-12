"use strict";
/**
 * Configuration utility
 *
 * Provides access to application configuration from various sources.
 * Browser-compatible version that uses environment variables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
exports.getConfig = getConfig;
exports.reloadConfig = reloadConfig;
// Default configuration
const defaultConfig = {
    openai: {
        defaultModel: 'gpt-3.5-turbo',
    },
    gemini: {
        defaultModel: 'gemini-2.0-flash',
    },
    vectorStore: {
        path: '/data/vectorStore.json',
        backupPath: '/data/backups',
    },
    logging: {
        level: 'info',
        logToFile: false, // No file logging in browser
        logPath: '/logs',
    }
};
// Cache for config to avoid repeated processing
let configCache = null;
/**
 * Get the application configuration
 *
 * @returns The application configuration
 */
function getConfig() {
    var _a, _b;
    // Return cached config if available
    if (configCache) {
        return configCache;
    }
    try {
        // In browser environment, we only use environment variables
        // and default values since we can't access the file system
        const config = {
            ...defaultConfig,
            openai: {
                ...defaultConfig.openai,
                // Access environment variables from Next.js public runtime config
                apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || ((_a = defaultConfig.openai) === null || _a === void 0 ? void 0 : _a.apiKey),
            },
            gemini: {
                ...defaultConfig.gemini,
                apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || ((_b = defaultConfig.gemini) === null || _b === void 0 ? void 0 : _b.apiKey),
            },
        };
        // Cache the config
        configCache = config;
        return config;
    }
    catch (error) {
        console.error('Error loading configuration:', error);
        return defaultConfig;
    }
}
/**
 * Reload the configuration (clears cache)
 */
function reloadConfig() {
    configCache = null;
    return getConfig();
}
exports.appConfig = {
    // Model Configuration
    modelConfig: {
        defaultModel: 'gemini-2.0-flash',
        temperature: 0.2,
        // ... existing code ...
    },
    // ... existing code ...
};
