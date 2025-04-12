"use strict";
/**
 * Performance Monitoring Module
 *
 * This module provides utilities for tracking and logging performance metrics
 * for the RAG system components.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTimer = startTimer;
exports.endTimer = endTimer;
exports.recordMetric = recordMetric;
exports.saveMetrics = saveMetrics;
exports.getPerformanceMetricsSummary = getPerformanceMetricsSummary;
exports.generatePerformanceReport = generatePerformanceReport;
exports.setupAutomaticMetricSaving = setupAutomaticMetricSaving;
exports.withPerformanceTracking = withPerformanceTracking;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const featureFlags_1 = require("./featureFlags");
const errorHandling_1 = require("./errorHandling");
// Constants
const METRICS_DIR = path_1.default.join(process.cwd(), 'data', 'performance_metrics');
const DAILY_METRICS_FILE = () => {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path_1.default.join(METRICS_DIR, `metrics_${date}.json`);
};
// Ensure metrics directory exists
if (!fs_1.default.existsSync(METRICS_DIR)) {
    try {
        fs_1.default.mkdirSync(METRICS_DIR, { recursive: true });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to create metrics directory', error);
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
function startTimer(trackingId) {
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
function endTimer(trackingId, component, operation, success = true, additionalInfo = {}) {
    // Check if monitoring is enabled
    if (!(0, featureFlags_1.isFeatureEnabled)('enablePerformanceMonitoring')) {
        return 0;
    }
    if (!timers[trackingId]) {
        (0, errorHandling_1.logError)(`No timer found for tracking ID: ${trackingId}`);
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
    if ((0, featureFlags_1.isFeatureEnabled)('logPerformanceMetrics')) {
        (0, errorHandling_1.logInfo)(`PERF: ${component}.${operation} - ${durationMs}ms ${success ? '✓' : '✗'}`);
    }
    return durationMs;
}
/**
 * Record a metric directly without using the timer
 */
function recordMetric(component, operation, durationMs, success = true, additionalInfo = {}) {
    // Check if monitoring is enabled
    if (!(0, featureFlags_1.isFeatureEnabled)('enablePerformanceMonitoring')) {
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
    if ((0, featureFlags_1.isFeatureEnabled)('logPerformanceMetrics')) {
        (0, errorHandling_1.logInfo)(`PERF: ${component}.${operation} - ${durationMs}ms ${success ? '✓' : '✗'}`);
    }
}
/**
 * Update the aggregated component metrics
 */
function updateComponentMetrics(metric) {
    const { component, operation, durationMs, success } = metric;
    // Initialize component if needed
    if (!componentMetrics[component]) {
        componentMetrics[component] = {};
    }
    // Initialize operation if needed
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
    opMetrics.durations.push(durationMs);
    if (success) {
        opMetrics.successCount++;
    }
    else {
        opMetrics.failureCount++;
    }
    opMetrics.avgDurationMs = opMetrics.totalDurationMs / opMetrics.count;
    // Calculate p95 if we have enough data
    if (opMetrics.durations.length >= 20) {
        const sortedDurations = [...opMetrics.durations].sort((a, b) => a - b);
        const p95Index = Math.floor(sortedDurations.length * 0.95);
        opMetrics.p95DurationMs = sortedDurations[p95Index];
        // Trim the durations array if it's getting too large
        if (opMetrics.durations.length > 1000) {
            opMetrics.durations = opMetrics.durations.slice(-100);
        }
    }
}
/**
 * Save the current metrics to disk
 */
function saveMetrics() {
    // Check if monitoring is enabled
    if (!(0, featureFlags_1.isFeatureEnabled)('enablePerformanceMonitoring')) {
        return;
    }
    try {
        const filePath = DAILY_METRICS_FILE();
        // Read existing metrics if file exists
        let existingMetrics = [];
        if (fs_1.default.existsSync(filePath)) {
            const data = fs_1.default.readFileSync(filePath, 'utf8');
            try {
                existingMetrics = JSON.parse(data);
            }
            catch (parseError) {
                (0, errorHandling_1.logError)(`Failed to parse existing metrics file: ${filePath}`, parseError);
                existingMetrics = [];
            }
        }
        // Combine existing and new metrics
        const combinedMetrics = [...existingMetrics, ...metrics];
        // Write to file
        fs_1.default.writeFileSync(filePath, JSON.stringify(combinedMetrics, null, 2));
        // Clear in-memory metrics
        metrics.length = 0;
        (0, errorHandling_1.logInfo)(`Performance metrics saved to ${filePath}`);
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to save performance metrics', error);
    }
}
/**
 * Get performance metrics summary
 */
function getPerformanceMetricsSummary() {
    return { ...componentMetrics };
}
/**
 * Create a performance report
 */
function generatePerformanceReport() {
    const summary = getPerformanceMetricsSummary();
    let report = 'PERFORMANCE METRICS SUMMARY\n';
    report += '==========================\n\n';
    let totalOperations = 0;
    let totalSuccessRate = 0;
    let operationCount = 0;
    for (const component in summary) {
        report += `COMPONENT: ${component}\n`;
        report += '-'.repeat(component.length + 10) + '\n';
        for (const operation in summary[component]) {
            const metrics = summary[component][operation];
            const successRate = metrics.count > 0 ? (metrics.successCount / metrics.count) * 100 : 0;
            report += `  ${operation}:\n`;
            report += `    Count: ${metrics.count}\n`;
            report += `    Avg Duration: ${metrics.avgDurationMs.toFixed(2)}ms\n`;
            report += `    Success Rate: ${successRate.toFixed(1)}%\n`;
            if (metrics.p95DurationMs) {
                report += `    P95 Duration: ${metrics.p95DurationMs.toFixed(2)}ms\n`;
            }
            report += '\n';
            totalOperations += metrics.count;
            totalSuccessRate += successRate;
            operationCount++;
        }
        report += '\n';
    }
    // Overall statistics
    if (operationCount > 0) {
        report += 'OVERALL STATISTICS\n';
        report += '=================\n';
        report += `Total Operations: ${totalOperations}\n`;
        report += `Average Success Rate: ${(totalSuccessRate / operationCount).toFixed(1)}%\n`;
    }
    return report;
}
/**
 * Set up automatic metric saving at an interval
 * @param intervalMs Interval between saves in milliseconds (default: 1 hour)
 */
function setupAutomaticMetricSaving(intervalMs = 60 * 60 * 1000) {
    // Check if monitoring is enabled
    if (!(0, featureFlags_1.isFeatureEnabled)('enablePerformanceMonitoring')) {
        return;
    }
    // Save metrics periodically
    setInterval(() => {
        if (metrics.length > 0) {
            saveMetrics();
        }
    }, intervalMs);
    // Set up process exit handler to save metrics
    process.on('beforeExit', () => {
        if (metrics.length > 0) {
            saveMetrics();
        }
    });
    (0, errorHandling_1.logInfo)(`Automatic metric saving set up with interval: ${intervalMs}ms`);
}
// Example wrapper for measuring function performance
function withPerformanceTracking(fn, component, operation) {
    return (...args) => {
        const trackingId = `${component}_${operation}_${Date.now()}`;
        startTimer(trackingId);
        try {
            const result = fn(...args);
            // Handle promises
            if (result instanceof Promise) {
                return result
                    .then(value => {
                    endTimer(trackingId, component, operation, true);
                    return value;
                })
                    .catch(error => {
                    endTimer(trackingId, component, operation, false, { error: String(error) });
                    throw error;
                });
            }
            // Handle regular return values
            endTimer(trackingId, component, operation, true);
            return result;
        }
        catch (error) {
            endTimer(trackingId, component, operation, false, { error: String(error) });
            throw error;
        }
    };
}
// Initialize automatic metric saving if enabled
if ((0, featureFlags_1.isFeatureEnabled)('enablePerformanceMonitoring')) {
    setupAutomaticMetricSaving();
}
