"use strict";
/**
 * Feature Flags Module
 *
 * This module provides utility functions to manage feature flags
 * for enabling/disabling specific features in the RAG system.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFeatureFlags = initFeatureFlags;
exports.getFlag = getFlag;
exports.isFeatureEnabled = isFeatureEnabled;
exports.setFlag = setFlag;
exports.enableAllContextualFeatures = enableAllContextualFeatures;
exports.disableAllContextualFeatures = disableAllContextualFeatures;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandling_1 = require("./errorHandling");
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env.local') });
// Constants
const FLAGS_FILE = path_1.default.join(process.cwd(), 'data', 'feature_flags.json');
// Default flags configuration
const DEFAULT_FLAGS = {
    // Contextual retrieval flags
    contextualEmbeddings: true,
    contextualChunking: true,
    contextualReranking: true,
    enhancedQueryAnalysis: true,
    // Gemini-specific flags
    useGeminiForContextGeneration: true,
    useGeminiForEmbeddings: false,
    useGeminiForReranking: true,
    // Feature monitoring flags
    enablePerformanceMonitoring: true,
    logPerformanceMetrics: true,
    // Global feature control
    enableContextualFeatures: true,
    // Last updated timestamp
    lastUpdated: new Date().toISOString()
};
// In-memory cache of feature flags
let featureFlags = { ...DEFAULT_FLAGS };
/**
 * Initialize feature flags from file or create default configuration
 */
function initFeatureFlags() {
    try {
        if (fs_1.default.existsSync(FLAGS_FILE)) {
            // Load existing flags
            const data = fs_1.default.readFileSync(FLAGS_FILE, 'utf8');
            const parsedFlags = JSON.parse(data);
            // Merge with defaults to ensure all flags exist
            featureFlags = {
                ...DEFAULT_FLAGS,
                ...parsedFlags,
                lastUpdated: parsedFlags.lastUpdated || new Date().toISOString()
            };
        }
        else {
            // Create default flags
            featureFlags = { ...DEFAULT_FLAGS };
            // Ensure the directory exists
            const dir = path_1.default.dirname(FLAGS_FILE);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            // Save default flags
            fs_1.default.writeFileSync(FLAGS_FILE, JSON.stringify(featureFlags, null, 2));
        }
        // Check for environment variable overrides
        if (process.env.ENABLE_CONTEXTUAL_FEATURES === 'false') {
            featureFlags.enableContextualFeatures = false;
        }
        if (process.env.USE_GEMINI_EMBEDDINGS === 'true') {
            featureFlags.useGeminiForEmbeddings = true;
        }
        return featureFlags;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error initializing feature flags', error);
        return { ...DEFAULT_FLAGS };
    }
}
/**
 * Get the value of a specific feature flag
 */
function getFlag(flagName) {
    // Initialize if not already done
    if (featureFlags === null) {
        initFeatureFlags();
    }
    // Return the flag value
    return featureFlags[flagName];
}
/**
 * Check if a boolean feature flag is enabled
 */
function isFeatureEnabled(flagName) {
    const flag = getFlag(flagName);
    // If the master contextual switch is off, disable all contextual features
    if (typeof flagName === 'string' && flagName.startsWith('contextual') && !featureFlags.enableContextualFeatures) {
        return false;
    }
    return Boolean(flag);
}
/**
 * Set a feature flag value (and persist to disk)
 */
function setFlag(flagName, value, persist = true) {
    // Update in-memory flag
    featureFlags[flagName] = value;
    featureFlags.lastUpdated = new Date().toISOString();
    // Persist to disk if requested
    if (persist) {
        try {
            fs_1.default.writeFileSync(FLAGS_FILE, JSON.stringify(featureFlags, null, 2));
        }
        catch (error) {
            (0, errorHandling_1.logError)('Error persisting feature flags', error);
        }
    }
}
/**
 * Enable all contextual features
 */
function enableAllContextualFeatures(persist = true) {
    featureFlags.enableContextualFeatures = true;
    featureFlags.contextualEmbeddings = true;
    featureFlags.contextualChunking = true;
    featureFlags.contextualReranking = true;
    featureFlags.enhancedQueryAnalysis = true;
    featureFlags.lastUpdated = new Date().toISOString();
    if (persist) {
        try {
            fs_1.default.writeFileSync(FLAGS_FILE, JSON.stringify(featureFlags, null, 2));
        }
        catch (error) {
            (0, errorHandling_1.logError)('Error persisting feature flags', error);
        }
    }
}
/**
 * Disable all contextual features
 */
function disableAllContextualFeatures(persist = true) {
    featureFlags.enableContextualFeatures = false;
    featureFlags.lastUpdated = new Date().toISOString();
    if (persist) {
        try {
            fs_1.default.writeFileSync(FLAGS_FILE, JSON.stringify(featureFlags, null, 2));
        }
        catch (error) {
            (0, errorHandling_1.logError)('Error persisting feature flags', error);
        }
    }
}
// Initialize feature flags on module import
initFeatureFlags();
// Export feature flags
exports.default = featureFlags;
