/**
 * Feature Flags Module
 *
 * This module provides utility functions to manage feature flags
 * for enabling/disabling specific features in the RAG system.
 */
export interface FeatureFlags {
    contextualEmbeddings: boolean;
    contextualChunking: boolean;
    contextualReranking: boolean;
    enhancedQueryAnalysis: boolean;
    useGeminiForContextGeneration: boolean;
    useGeminiForEmbeddings: boolean;
    useGeminiForReranking: boolean;
    enablePerformanceMonitoring: boolean;
    logPerformanceMetrics: boolean;
    enableContextualFeatures: boolean;
    lastUpdated: string;
    [key: string]: boolean | string | number;
}
declare let featureFlags: FeatureFlags;
/**
 * Initialize feature flags from file or create default configuration
 */
export declare function initFeatureFlags(): FeatureFlags;
/**
 * Get the value of a specific feature flag
 */
export declare function getFlag(flagName: keyof FeatureFlags): boolean | string | number;
/**
 * Check if a boolean feature flag is enabled
 */
export declare function isFeatureEnabled(flagName: keyof FeatureFlags): boolean;
/**
 * Set a feature flag value (and persist to disk)
 */
export declare function setFlag(flagName: keyof FeatureFlags, value: boolean | string | number, persist?: boolean): void;
/**
 * Enable all contextual features
 */
export declare function enableAllContextualFeatures(persist?: boolean): void;
/**
 * Disable all contextual features
 */
export declare function disableAllContextualFeatures(persist?: boolean): void;
export default featureFlags;
