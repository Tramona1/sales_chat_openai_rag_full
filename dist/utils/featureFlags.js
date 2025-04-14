/**
 * Feature Flags Module (Simplified Version)
 *
 * This module provides utility functions to manage feature flags
 * for enabling/disabling specific features in the RAG system.
 *
 * Note: This is a simplified version of the feature flags module
 * that always returns defaults to get the chat working.
 */
// Default flags configuration
export const featureFlags = {
    // Contextual retrieval flags
    contextualEmbeddings: true,
    contextualChunking: true,
    contextualReranking: true,
    enhancedQueryAnalysis: true,
    // Gemini-specific flags
    useGeminiForContextGeneration: true,
    useGeminiForEmbeddings: true,
    useGeminiForReranking: true,
    // Feature monitoring flags
    enablePerformanceMonitoring: true,
    logPerformanceMetrics: true,
    // Global feature control
    enableContextualFeatures: true,
    // Last updated timestamp
    lastUpdated: new Date().toISOString()
};
/**
 * Initialize feature flags (simplified - just returns defaults)
 */
export function initFeatureFlags() {
    return { ...featureFlags };
}
/**
 * Get the value of a specific feature flag (simplified)
 */
export function getFlag(flagName) {
    return featureFlags[flagName];
}
/**
 * Check if a boolean feature flag is enabled (simplified)
 */
export function isFeatureEnabled(flagName) {
    // If the master contextual switch is off, disable all contextual features
    if (typeof flagName === 'string' && flagName.startsWith('contextual') && !featureFlags.enableContextualFeatures) {
        return false;
    }
    return Boolean(featureFlags[flagName]);
}
/**
 * Set a feature flag value (in-memory only in this simplified version)
 */
export function setFlag(flagName, value) {
    featureFlags[flagName] = value;
    featureFlags.lastUpdated = new Date().toISOString();
}
/**
 * Enable all contextual features (in-memory only)
 */
export function enableAllContextualFeatures() {
    featureFlags.enableContextualFeatures = true;
    featureFlags.contextualEmbeddings = true;
    featureFlags.contextualChunking = true;
    featureFlags.contextualReranking = true;
    featureFlags.enhancedQueryAnalysis = true;
    featureFlags.lastUpdated = new Date().toISOString();
}
/**
 * Disable all contextual features (in-memory only)
 */
export function disableAllContextualFeatures() {
    featureFlags.enableContextualFeatures = false;
    featureFlags.lastUpdated = new Date().toISOString();
}
// Export default
export default featureFlags;
