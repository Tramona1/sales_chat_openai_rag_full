"use strict";
/**
 * Performance Monitoring Module
 *
 * This module provides utilities for tracking and logging performance metrics
 * for the RAG system components.
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
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
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var featureFlags_1 = require("./featureFlags");
var errorHandling_1 = require("./errorHandling");
// Constants
var METRICS_DIR = path_1.default.join(process.cwd(), 'data', 'performance_metrics');
var DAILY_METRICS_FILE = function () {
    var date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path_1.default.join(METRICS_DIR, "metrics_".concat(date, ".json"));
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
var metrics = [];
var componentMetrics = {};
// Functions to start and end performance measurements
var timers = {};
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
function endTimer(trackingId, component, operation, success, additionalInfo) {
    if (success === void 0) { success = true; }
    if (additionalInfo === void 0) { additionalInfo = {}; }
    // Check if monitoring is enabled
    if (!(0, featureFlags_1.isFeatureEnabled)('enablePerformanceMonitoring')) {
        return 0;
    }
    if (!timers[trackingId]) {
        (0, errorHandling_1.logError)("No timer found for tracking ID: ".concat(trackingId));
        return 0;
    }
    var startTime = timers[trackingId];
    var endTime = Date.now();
    var durationMs = endTime - startTime;
    // Record the metric
    var metric = {
        timestamp: new Date().toISOString(),
        component: component,
        operation: operation,
        durationMs: durationMs,
        success: success,
        additionalInfo: additionalInfo
    };
    // Add to in-memory store
    metrics.push(metric);
    // Update component metrics
    updateComponentMetrics(metric);
    // Cleanup timer
    delete timers[trackingId];
    // Log the metric if enabled
    if ((0, featureFlags_1.isFeatureEnabled)('logPerformanceMetrics')) {
        (0, errorHandling_1.logInfo)("PERF: ".concat(component, ".").concat(operation, " - ").concat(durationMs, "ms ").concat(success ? '✓' : '✗'));
    }
    return durationMs;
}
/**
 * Record a metric directly without using the timer
 */
function recordMetric(component, operation, durationMs, success, additionalInfo) {
    if (success === void 0) { success = true; }
    if (additionalInfo === void 0) { additionalInfo = {}; }
    // Check if monitoring is enabled
    if (!(0, featureFlags_1.isFeatureEnabled)('enablePerformanceMonitoring')) {
        return;
    }
    // Create the metric
    var metric = {
        timestamp: new Date().toISOString(),
        component: component,
        operation: operation,
        durationMs: durationMs,
        success: success,
        additionalInfo: additionalInfo
    };
    // Add to in-memory store
    metrics.push(metric);
    // Update component metrics
    updateComponentMetrics(metric);
    // Log the metric if enabled
    if ((0, featureFlags_1.isFeatureEnabled)('logPerformanceMetrics')) {
        (0, errorHandling_1.logInfo)("PERF: ".concat(component, ".").concat(operation, " - ").concat(durationMs, "ms ").concat(success ? '✓' : '✗'));
    }
}
/**
 * Update the aggregated component metrics
 */
function updateComponentMetrics(metric) {
    var component = metric.component, operation = metric.operation, durationMs = metric.durationMs, success = metric.success;
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
    var opMetrics = componentMetrics[component][operation];
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
        var sortedDurations = __spreadArray([], opMetrics.durations, true).sort(function (a, b) { return a - b; });
        var p95Index = Math.floor(sortedDurations.length * 0.95);
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
        var filePath = DAILY_METRICS_FILE();
        // Read existing metrics if file exists
        var existingMetrics = [];
        if (fs_1.default.existsSync(filePath)) {
            var data = fs_1.default.readFileSync(filePath, 'utf8');
            try {
                existingMetrics = JSON.parse(data);
            }
            catch (parseError) {
                (0, errorHandling_1.logError)("Failed to parse existing metrics file: ".concat(filePath), parseError);
                existingMetrics = [];
            }
        }
        // Combine existing and new metrics
        var combinedMetrics = __spreadArray(__spreadArray([], existingMetrics, true), metrics, true);
        // Write to file
        fs_1.default.writeFileSync(filePath, JSON.stringify(combinedMetrics, null, 2));
        // Clear in-memory metrics
        metrics.length = 0;
        (0, errorHandling_1.logInfo)("Performance metrics saved to ".concat(filePath));
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to save performance metrics', error);
    }
}
/**
 * Get performance metrics summary
 */
function getPerformanceMetricsSummary() {
    return __assign({}, componentMetrics);
}
/**
 * Create a performance report
 */
function generatePerformanceReport() {
    var summary = getPerformanceMetricsSummary();
    var report = 'PERFORMANCE METRICS SUMMARY\n';
    report += '==========================\n\n';
    var totalOperations = 0;
    var totalSuccessRate = 0;
    var operationCount = 0;
    for (var component in summary) {
        report += "COMPONENT: ".concat(component, "\n");
        report += '-'.repeat(component.length + 10) + '\n';
        for (var operation in summary[component]) {
            var metrics_1 = summary[component][operation];
            var successRate = metrics_1.count > 0 ? (metrics_1.successCount / metrics_1.count) * 100 : 0;
            report += "  ".concat(operation, ":\n");
            report += "    Count: ".concat(metrics_1.count, "\n");
            report += "    Avg Duration: ".concat(metrics_1.avgDurationMs.toFixed(2), "ms\n");
            report += "    Success Rate: ".concat(successRate.toFixed(1), "%\n");
            if (metrics_1.p95DurationMs) {
                report += "    P95 Duration: ".concat(metrics_1.p95DurationMs.toFixed(2), "ms\n");
            }
            report += '\n';
            totalOperations += metrics_1.count;
            totalSuccessRate += successRate;
            operationCount++;
        }
        report += '\n';
    }
    // Overall statistics
    if (operationCount > 0) {
        report += 'OVERALL STATISTICS\n';
        report += '=================\n';
        report += "Total Operations: ".concat(totalOperations, "\n");
        report += "Average Success Rate: ".concat((totalSuccessRate / operationCount).toFixed(1), "%\n");
    }
    return report;
}
/**
 * Set up automatic metric saving at an interval
 * @param intervalMs Interval between saves in milliseconds (default: 1 hour)
 */
function setupAutomaticMetricSaving(intervalMs) {
    if (intervalMs === void 0) { intervalMs = 60 * 60 * 1000; }
    // Check if monitoring is enabled
    if (!(0, featureFlags_1.isFeatureEnabled)('enablePerformanceMonitoring')) {
        return;
    }
    // Save metrics periodically
    setInterval(function () {
        if (metrics.length > 0) {
            saveMetrics();
        }
    }, intervalMs);
    // Set up process exit handler to save metrics
    process.on('beforeExit', function () {
        if (metrics.length > 0) {
            saveMetrics();
        }
    });
    (0, errorHandling_1.logInfo)("Automatic metric saving set up with interval: ".concat(intervalMs, "ms"));
}
// Example wrapper for measuring function performance
function withPerformanceTracking(fn, component, operation) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var trackingId = "".concat(component, "_").concat(operation, "_").concat(Date.now());
        startTimer(trackingId);
        try {
            var result = fn.apply(void 0, args);
            // Handle promises
            if (result instanceof Promise) {
                return result
                    .then(function (value) {
                    endTimer(trackingId, component, operation, true);
                    return value;
                })
                    .catch(function (error) {
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
