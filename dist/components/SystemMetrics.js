"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SystemMetrics;
const react_1 = __importStar(require("react"));
const recharts_1 = require("recharts");
const lucide_react_1 = require("lucide-react");
function SystemMetrics({ refreshInterval = 30000 }) {
    const [metrics, setMetrics] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/system-metrics');
            if (!response.ok) {
                throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            setMetrics(data);
            setError(null);
        }
        catch (err) {
            console.error('Error fetching system metrics:', err);
            setError(err instanceof Error ? err.message : 'Unknown error fetching metrics');
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchMetrics();
        // Set up regular polling if refreshInterval is provided
        if (refreshInterval > 0) {
            const intervalId = setInterval(fetchMetrics, refreshInterval);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval]);
    // Format bytes to a human-readable format
    const formatBytes = (bytes) => {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    // Format date string
    const formatDate = (dateString) => {
        if (!dateString)
            return 'Never';
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        }
        catch (e) {
            return 'Invalid date';
        }
    };
    // Prepare data for cache chart
    const cacheChartData = metrics ? [
        { name: 'Active', value: metrics.caching.activeEntries },
        { name: 'Expired', value: metrics.caching.expiredEntries },
    ] : [];
    // Prepare data for query chart
    const queryChartData = metrics ? [
        { name: 'Last 24h', value: metrics.queries.last24Hours },
        { name: 'Last 7d', value: metrics.queries.last7Days },
    ] : [];
    if (loading && !metrics) {
        return (react_1.default.createElement("div", { className: "p-6 bg-white rounded-lg shadow" },
            react_1.default.createElement("div", { className: "animate-pulse flex space-x-4" },
                react_1.default.createElement("div", { className: "flex-1 space-y-4 py-1" },
                    react_1.default.createElement("div", { className: "h-4 bg-gray-200 rounded w-3/4" }),
                    react_1.default.createElement("div", { className: "space-y-2" },
                        react_1.default.createElement("div", { className: "h-4 bg-gray-200 rounded" }),
                        react_1.default.createElement("div", { className: "h-4 bg-gray-200 rounded w-5/6" })))),
            react_1.default.createElement("p", { className: "text-center text-gray-500 mt-4" }, "Loading system metrics...")));
    }
    if (error) {
        return (react_1.default.createElement("div", { className: "p-6 bg-white rounded-lg shadow border-l-4 border-red-500" },
            react_1.default.createElement("h3", { className: "text-lg font-medium text-red-800" }, "Error Loading Metrics"),
            react_1.default.createElement("p", { className: "mt-2 text-red-600" }, error),
            react_1.default.createElement("button", { onClick: fetchMetrics, className: "mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition" }, "Retry")));
    }
    return (react_1.default.createElement("div", { className: "bg-white rounded-lg shadow overflow-hidden" },
        react_1.default.createElement("div", { className: "p-4 border-b border-gray-100 bg-gray-50" },
            react_1.default.createElement("h2", { className: "font-medium text-gray-800 flex items-center" },
                react_1.default.createElement(lucide_react_1.Database, { className: "h-5 w-5 mr-2 text-primary-600" }),
                "System Metrics",
                react_1.default.createElement("span", { className: "ml-auto text-xs text-gray-500" },
                    "Updated: ",
                    metrics ? formatDate(metrics.lastUpdated) : 'N/A',
                    react_1.default.createElement("button", { onClick: fetchMetrics, className: "ml-2 p-1 rounded hover:bg-gray-200 transition", title: "Refresh metrics" },
                        react_1.default.createElement(lucide_react_1.Clock, { className: "h-3 w-3" }))))),
        metrics && (react_1.default.createElement("div", { className: "p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" },
            react_1.default.createElement("div", { className: "bg-gray-50 p-4 rounded-lg border border-gray-100" },
                react_1.default.createElement("div", { className: "flex items-center mb-2" },
                    react_1.default.createElement(lucide_react_1.Archive, { className: "h-5 w-5 text-blue-600 mr-2" }),
                    react_1.default.createElement("h3", { className: "font-medium text-gray-700" }, "Vector Store")),
                react_1.default.createElement("div", { className: "mt-4 text-center" },
                    react_1.default.createElement("div", { className: "text-3xl font-bold text-blue-600" }, metrics.vectorStore.totalItems.toLocaleString()),
                    react_1.default.createElement("div", { className: "text-sm text-gray-500 mt-1" }, "Total Items"))),
            react_1.default.createElement("div", { className: "bg-gray-50 p-4 rounded-lg border border-gray-100" },
                react_1.default.createElement("div", { className: "flex items-center mb-2" },
                    react_1.default.createElement(lucide_react_1.Database, { className: "h-5 w-5 text-green-600 mr-2" }),
                    react_1.default.createElement("h3", { className: "font-medium text-gray-700" }, "Cache")),
                react_1.default.createElement("div", { className: "h-32" },
                    react_1.default.createElement(recharts_1.ResponsiveContainer, { width: "100%", height: "100%" },
                        react_1.default.createElement(recharts_1.BarChart, { data: cacheChartData },
                            react_1.default.createElement(recharts_1.XAxis, { dataKey: "name" }),
                            react_1.default.createElement(recharts_1.YAxis, null),
                            react_1.default.createElement(recharts_1.Tooltip, null),
                            react_1.default.createElement(recharts_1.Bar, { dataKey: "value", fill: "#10B981" })))),
                react_1.default.createElement("div", { className: "text-center text-sm text-gray-500 mt-2" },
                    metrics.caching.size,
                    " total entries")),
            react_1.default.createElement("div", { className: "bg-gray-50 p-4 rounded-lg border border-gray-100" },
                react_1.default.createElement("div", { className: "flex items-center mb-2" },
                    react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-5 w-5 text-purple-600 mr-2" }),
                    react_1.default.createElement("h3", { className: "font-medium text-gray-700" }, "Feedback")),
                react_1.default.createElement("div", { className: "mt-4 text-center" },
                    react_1.default.createElement("div", { className: "text-3xl font-bold text-purple-600" }, metrics.feedback.count.toLocaleString()),
                    react_1.default.createElement("div", { className: "text-sm text-gray-500 mt-1" }, "Total Logs")),
                react_1.default.createElement("div", { className: "text-xs text-gray-500 mt-3" },
                    react_1.default.createElement("div", null,
                        "Size: ",
                        formatBytes(metrics.feedback.sizeBytes)),
                    react_1.default.createElement("div", null,
                        "Last Updated: ",
                        formatDate(metrics.feedback.lastUpdated)))),
            react_1.default.createElement("div", { className: "bg-gray-50 p-4 rounded-lg border border-gray-100" },
                react_1.default.createElement("div", { className: "flex items-center mb-2" },
                    react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-5 w-5 text-amber-600 mr-2" }),
                    react_1.default.createElement("h3", { className: "font-medium text-gray-700" }, "Queries")),
                react_1.default.createElement("div", { className: "h-32" },
                    react_1.default.createElement(recharts_1.ResponsiveContainer, { width: "100%", height: "100%" },
                        react_1.default.createElement(recharts_1.BarChart, { data: queryChartData },
                            react_1.default.createElement(recharts_1.XAxis, { dataKey: "name" }),
                            react_1.default.createElement(recharts_1.YAxis, null),
                            react_1.default.createElement(recharts_1.Tooltip, null),
                            react_1.default.createElement(recharts_1.Bar, { dataKey: "value", fill: "#F59E0B" })))),
                react_1.default.createElement("div", { className: "text-center text-sm text-gray-500 mt-2" },
                    metrics.queries.last24Hours,
                    " queries in last 24 hours"))))));
}
