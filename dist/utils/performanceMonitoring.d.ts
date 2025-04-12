/**
 * Performance Monitoring Module
 *
 * This module provides utilities for tracking and logging performance metrics
 * for the RAG system components.
 */
export interface PerformanceMetric {
    timestamp: string;
    component: string;
    operation: string;
    durationMs: number;
    success: boolean;
    additionalInfo?: Record<string, any>;
}
export interface ComponentMetrics {
    [component: string]: {
        [operation: string]: {
            count: number;
            totalDurationMs: number;
            successCount: number;
            failureCount: number;
            avgDurationMs: number;
            p95DurationMs?: number;
            durations: number[];
        };
    };
}
/**
 * Start timing an operation
 * @param trackingId Unique ID for this timing operation
 * @returns The tracking ID for chaining
 */
export declare function startTimer(trackingId: string): string;
/**
 * End timing an operation and record the metric
 * @param trackingId The tracking ID from startTimer
 * @param component Component being measured (e.g., 'vectorSearch', 'reranking')
 * @param operation Specific operation being performed
 * @param success Whether the operation was successful
 * @param additionalInfo Optional additional information about the operation
 * @returns Duration in milliseconds
 */
export declare function endTimer(trackingId: string, component: string, operation: string, success?: boolean, additionalInfo?: Record<string, any>): number;
/**
 * Record a metric directly without using the timer
 */
export declare function recordMetric(component: string, operation: string, durationMs: number, success?: boolean, additionalInfo?: Record<string, any>): void;
/**
 * Save the current metrics to disk
 */
export declare function saveMetrics(): void;
/**
 * Get performance metrics summary
 */
export declare function getPerformanceMetricsSummary(): ComponentMetrics;
/**
 * Create a performance report
 */
export declare function generatePerformanceReport(): string;
/**
 * Set up automatic metric saving at an interval
 * @param intervalMs Interval between saves in milliseconds (default: 1 hour)
 */
export declare function setupAutomaticMetricSaving(intervalMs?: number): void;
export declare function withPerformanceTracking<T>(fn: (...args: any[]) => T, component: string, operation: string): (...args: any[]) => T;
