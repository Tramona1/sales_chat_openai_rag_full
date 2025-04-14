import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Database, Archive, MessageSquare, Clock, Activity } from 'lucide-react';
export default function SystemMetrics({ refreshInterval = 30000 }) {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
    useEffect(() => {
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
    // Prepare data for document chart
    const documentChartData = metrics ? [
        { name: 'Documents', value: metrics.vectorStore.documents },
        { name: 'Chunks', value: metrics.vectorStore.chunks },
    ] : [];
    if (loading && !metrics) {
        return (<div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
        <p className="text-center text-gray-500 mt-4">Loading system metrics...</p>
      </div>);
    }
    if (error) {
        return (<div className="p-6 bg-white rounded-lg shadow border-l-4 border-red-500">
        <h3 className="text-lg font-medium text-red-800">Error Loading Metrics</h3>
        <p className="mt-2 text-red-600">{error}</p>
        <button onClick={fetchMetrics} className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition">
          Retry
        </button>
      </div>);
    }
    return (<div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-medium text-gray-800 flex items-center">
          <Database className="h-5 w-5 mr-2 text-primary-600"/>
          System Metrics
          <span className="ml-auto text-xs text-gray-500">
            Updated: {metrics ? formatDate(metrics.lastUpdated) : 'N/A'}
            <button onClick={fetchMetrics} className="ml-2 p-1 rounded hover:bg-gray-200 transition" title="Refresh metrics">
              <Clock className="h-3 w-3"/>
            </button>
          </span>
        </h2>
      </div>

      {metrics && (<div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vector Store Card */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex items-center mb-2">
              <Archive className="h-5 w-5 text-blue-600 mr-2"/>
              <h3 className="font-medium text-gray-700">Vector Store</h3>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={documentChartData}>
                  <XAxis dataKey="name"/>
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-sm text-gray-500 mt-2">
              {metrics.vectorStore.totalItems.toLocaleString()} total items
            </div>
          </div>

          {/* Cache Stats Card */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex items-center mb-2">
              <Database className="h-5 w-5 text-green-600 mr-2"/>
              <h3 className="font-medium text-gray-700">Cache</h3>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cacheChartData}>
                  <XAxis dataKey="name"/>
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-sm text-gray-500 mt-2">
              {metrics.caching.size} total entries
            </div>
          </div>

          {/* Feedback Data Card */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex items-center mb-2">
              <MessageSquare className="h-5 w-5 text-purple-600 mr-2"/>
              <h3 className="font-medium text-gray-700">Feedback</h3>
            </div>
            <div className="mt-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {metrics.feedback.count.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">Total Logs</div>
            </div>
            <div className="text-xs text-gray-500 mt-3">
              <div>Size: {formatBytes(metrics.feedback.sizeBytes)}</div>
              <div>Last Updated: {formatDate(metrics.feedback.lastUpdated)}</div>
            </div>
          </div>

          {/* Query Stats Card */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex items-center mb-2">
              <Activity className="h-5 w-5 text-amber-600 mr-2"/>
              <h3 className="font-medium text-gray-700">Queries</h3>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={queryChartData}>
                  <XAxis dataKey="name"/>
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#F59E0B"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-sm text-gray-500 mt-2">
              {metrics.queries.last24Hours} queries in last 24 hours
            </div>
            {metrics.performance && (<div className="text-xs text-gray-500 mt-1">
                Avg. Response: {metrics.performance.averageQueryTime.toFixed(2)}ms
              </div>)}
          </div>
        </div>)}
    </div>);
}
