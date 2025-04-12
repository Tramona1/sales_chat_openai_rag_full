"use strict";
/**
 * Configuration utility
 *
 * Provides access to application configuration from various sources.
 * Browser-compatible version that uses environment variables.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
exports.getConfig = getConfig;
exports.reloadConfig = reloadConfig;
// Default configuration
var defaultConfig = {
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
var configCache = null;
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
        var config = __assign(__assign({}, defaultConfig), { openai: __assign(__assign({}, defaultConfig.openai), { 
                // Access environment variables from Next.js public runtime config
                apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || ((_a = defaultConfig.openai) === null || _a === void 0 ? void 0 : _a.apiKey) }), gemini: __assign(__assign({}, defaultConfig.gemini), { apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || ((_b = defaultConfig.gemini) === null || _b === void 0 ? void 0 : _b.apiKey) }) });
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
