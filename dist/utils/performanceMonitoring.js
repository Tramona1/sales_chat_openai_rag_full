/**
 * Performance Monitoring Module
 *
 * This module provides utilities for tracking and logging performance metrics
 * for the RAG system components.
 */
import fs from 'fs';
import path from 'path';
// TEMPORARY FIX: Hardcode feature flags instead of importing them
// import { isFeatureEnabled } from './featureFlags';
import { logInfo, logError } from './logger';
// TEMPORARY FIX: Hardcode feature flags
const ENABLE_PERFORMANCE_MONITORING = true;
const LOG_PERFORMANCE_METRICS = true;
// Constants
const METRICS_DIR = path.join(process.cwd(), 'data', 'performance_metrics');
const DAILY_METRICS_FILE = () => {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(METRICS_DIR, `metrics_${date}.json`);
};
// Ensure metrics directory exists
if (!fs.existsSync(METRICS_DIR)) {
    try {
        fs.mkdirSync(METRICS_DIR, { recursive: true });
    }
    catch (error) {
        logError('Failed to create metrics directory', error);
    }
}
// In-memory metrics store
const metrics = [];
let componentMetrics = {};
// Functions to start and end performance measurements
const timers = {};
/**
 * Start timing an operation
 * @param trackingId Unique ID for this timing operation
 * @returns The tracking ID for chaining
 */
export function startTimer(trackingId) {
    timers[trackingId] = Date.now();
    return trackingId;
}
/**
 * End timing an operation and record the metric
 * @param trackingId The tracking ID from startTimer
 * @param component Component being measured (e.g., 'vectorSearch', 'reranking')
 * @param operation Specific operation being performed
 * @param success Whether the operation was successful
 * @param additionalInfo Optional additional information about the operation
 * @returns Duration in milliseconds
 */
export function endTimer(trackingId, component, operation, success = true, additionalInfo = {}) {
    // Check if monitoring is enabled
    // TEMPORARY FIX: Use hardcoded flag instead of isFeatureEnabled
    if (!ENABLE_PERFORMANCE_MONITORING) {
        return 0;
    }
    if (!timers[trackingId]) {
        logError(`No timer found for tracking ID: ${trackingId}`);
        return 0;
    }
    const startTime = timers[trackingId];
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    // Record the metric
    const metric = {
        timestamp: new Date().toISOString(),
        component,
        operation,
        durationMs,
        success,
        additionalInfo
    };
    // Add to in-memory store
    metrics.push(metric);
    // Update component metrics
    updateComponentMetrics(metric);
    // Cleanup timer
    delete timers[trackingId];
    // Log the metric if enabled
    // TEMPORARY FIX: Use hardcoded flag instead of isFeatureEnabled
    if (LOG_PERFORMANCE_METRICS) {
        logInfo(`PERF: ${component}.${operation} - ${durationMs}ms ${success ? '✓' : '✗'}`);
    }
    return durationMs;
}
/**
 * Record a metric directly without using the timer
 */
export function recordMetric(component, operation, durationMs, success = true, additionalInfo = {}) {
    // Check if monitoring is enabled
    // TEMPORARY FIX: Use hardcoded flag instead of isFeatureEnabled
    if (!ENABLE_PERFORMANCE_MONITORING) {
        return;
    }
    // Create the metric
    const metric = {
        timestamp: new Date().toISOString(),
        component,
        operation,
        durationMs,
        success,
        additionalInfo
    };
    // Add to in-memory store
    metrics.push(metric);
    // Update component metrics
    updateComponentMetrics(metric);
    // Log the metric if enabled
    // TEMPORARY FIX: Use hardcoded flag instead of isFeatureEnabled
    if (LOG_PERFORMANCE_METRICS) {
        logInfo(`PERF: ${component}.${operation} - ${durationMs}ms ${success ? '✓' : '✗'}`);
    }
}
// Function to update component metrics
function updateComponentMetrics(metric) {
    const { component, operation, durationMs, success } = metric;
    // Initialize component if not exists
    if (!componentMetrics[component]) {
        componentMetrics[component] = {};
    }
    // Initialize operation if not exists
    if (!componentMetrics[component][operation]) {
        componentMetrics[component][operation] = {
            count: 0,
            totalDurationMs: 0,
            successCount: 0,
            failureCount: 0,
            avgDurationMs: 0,
            durations: []
        };
    }
    // Update metrics
    const opMetrics = componentMetrics[component][operation];
    opMetrics.count++;
    opMetrics.totalDurationMs += durationMs;
    if (success) {
        opMetrics.successCount++;
    }
    else {
        opMetrics.failureCount++;
    }
    opMetrics.durations.push(durationMs);
    opMetrics.avgDurationMs = opMetrics.totalDurationMs / opMetrics.count;
}
// Function to persist metrics
function persistMetrics() {
    try {
        // Ensure directory exists
        if (!fs.existsSync(METRICS_DIR)) {
            fs.mkdirSync(METRICS_DIR, { recursive: true });
        }
        const metricsFile = DAILY_METRICS_FILE();
        // Combine existing metrics if file exists
        let existingMetrics = [];
        if (fs.existsSync(metricsFile)) {
            try {
                const fileData = fs.readFileSync(metricsFile, 'utf8');
                existingMetrics = JSON.parse(fileData);
            }
            catch (error) {
                logError(`Error reading existing metrics file: ${metricsFile}`, error);
            }
        }
        // Combine and save
        const allMetrics = [...existingMetrics, ...metrics];
        fs.writeFileSync(metricsFile, JSON.stringify(allMetrics, null, 2));
        // Clear in-memory metrics after saving
        metrics.length = 0;
    }
    catch (error) {
        logError('Error persisting performance metrics', error);
    }
}
// Function to get aggregated metrics
export function getAggregatedMetrics() {
    return componentMetrics;
}
// Persist metrics periodically (e.g., every 5 minutes)
// setInterval(persistMetrics, 5 * 60 * 1000);
// Persist metrics on exit
// process.on('exit', persistMetrics);
// process.on('SIGINT', () => { persistMetrics(); process.exit(); });
// process.on('SIGTERM', () => { persistMetrics(); process.exit(); });
