import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import path from 'path';
import fs from 'fs';
import { Home, Search, BarChart, Database, AlertCircle, MessageSquare, Briefcase, Clipboard, Layers, TrendingUp, Activity, FileText, Settings, Target, BarChart2, AlertTriangle as FileWarning, // Using AlertTriangle as a replacement for FileWarning
Cpu as BrainCircuit // Using Cpu as a replacement for BrainCircuit
 } from 'react-feather';
import PendingDocuments from '../components/admin/PendingDocuments';
import DocumentManagement from '../components/admin/DocumentManagement';
import AllChunksViewer from '../components/admin/AllChunksViewer';
import AdminLayout from '../components/layout/AdminLayout';
export const getServerSideProps = async () => {
    const logPath = path.join(process.cwd(), 'feedback.json');
    let logs = [];
    if (fs.existsSync(logPath)) {
        try {
            logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            // Sort logs by timestamp, newest first
            logs.sort((a, b) => b.timestamp - a.timestamp);
        }
        catch (error) {
            console.error('Error parsing logs:', error);
        }
    }
    return { props: { logs } };
};
// Define Tabs
const adminTabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'queryInsights', label: 'Query Insights', icon: Search },
    { id: 'contentPerformance', label: 'Content Performance', icon: BarChart },
    { id: 'salesInsights', label: 'Sales Insights', icon: TrendingUp },
    { id: 'documentManagement', label: 'Document Management', icon: Database },
    { id: 'pendingDocuments', label: 'Pending Documents', icon: AlertCircle },
    { id: 'chunkManagement', label: 'Chunk Management', icon: Layers },
    { id: 'generalSessions', label: 'General Sessions', icon: MessageSquare },
    { id: 'companySessions', label: 'Company Sessions', icon: Briefcase },
];
// --- Placeholder Components for New Tabs ---
const OverviewTab = () => {
    const [statsData, setStatsData] = useState({
        // Chat Stats
        totalSessions: 157,
        companySessions: 89,
        generalSessions: 68,
        totalMessages: 2354,
        // Document Stats
        totalDocuments: 42,
        pendingDocuments: 7,
        approvedDocuments: 35,
        totalChunks: 1285,
        // Query Stats
        queriesLast24h: 128,
        queriesLast7d: 847,
        avgResponseTime: 0.42, // seconds
        feedbackRate: 23, // percentage
        // API Stats
        perplexityCalls: 104,
        perplexityCacheHits: 67,
        perplexityCacheHitRate: 64.4, // percentage
        systemStatus: 'Healthy'
    });
    // Refresh stats every 30 seconds
    useEffect(() => {
        // In the future, fetch real data here from the /api/system-metrics endpoint
        const fetchSystemMetrics = async () => {
            try {
                const response = await fetch('/api/system-metrics');
                if (response.ok) {
                    const data = await response.json();
                    // Transform the API response into our stats format
                    setStatsData(prev => ({
                        ...prev,
                        totalChunks: data.vectorStore?.chunks || prev.totalChunks,
                        totalDocuments: data.vectorStore?.documents || prev.totalDocuments,
                        queriesLast24h: data.queries?.last24Hours || prev.queriesLast24h,
                        queriesLast7d: data.queries?.last7Days || prev.queriesLast7d,
                        // Add more mappings as the API evolves
                    }));
                }
            }
            catch (error) {
                console.error('Error fetching system metrics:', error);
            }
        };
        // Initial fetch
        fetchSystemMetrics();
        // Set up refresh interval
        const interval = setInterval(() => {
            console.log('Refreshing Overview stats...');
            fetchSystemMetrics();
        }, 30000);
        return () => clearInterval(interval);
    }, []);
    // Stat Card Component
    const StatCard = ({ title, value, icon: Icon, description, colorClass = 'bg-blue-700' }) => (<div className="bg-white rounded-lg shadow-md p-4 hover:bg-gray-50 transition-colors border border-gray-100">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <div className={`p-2 rounded-md ${colorClass}`}>
          <Icon className="h-5 w-5 text-white"/>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {description && <span className="text-xs text-gray-500 mt-1">{description}</span>}
      </div>
    </div>);
    return (<div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard Overview</h2>
        <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleString()}</p>
      </div>
      
      {/* Chat Activity Section */}
      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 border-b border-gray-200 pb-2">Chat Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Chat Sessions" value={statsData.totalSessions} icon={MessageSquare} description="All-time sessions" colorClass="bg-blue-700"/>
          <StatCard title="Company Sessions" value={statsData.companySessions} icon={Clipboard} description={`${Math.round(statsData.companySessions / statsData.totalSessions * 100)}% of total`} colorClass="bg-blue-600"/>
          <StatCard title="General Sessions" value={statsData.generalSessions} icon={MessageSquare} description={`${Math.round(statsData.generalSessions / statsData.totalSessions * 100)}% of total`} colorClass="bg-blue-500"/>
          <StatCard title="Total Messages" value={statsData.totalMessages} icon={MessageSquare} description={`Avg ${Math.round(statsData.totalMessages / statsData.totalSessions)} per session`} colorClass="bg-blue-400"/>
        </div>
      </section>
      
      {/* Knowledge Base Section */}
      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 border-b border-gray-200 pb-2">Knowledge Base</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Documents" value={statsData.totalDocuments} icon={FileText} description="All documents in the database" colorClass="bg-indigo-600"/>
          <StatCard title="Pending Documents" value={statsData.pendingDocuments} icon={FileWarning} description="Awaiting approval" colorClass="bg-amber-500"/>
          <StatCard title="Approved Documents" value={statsData.approvedDocuments} icon={FileText} description={`${Math.round(statsData.approvedDocuments / statsData.totalDocuments * 100)}% of total`} colorClass="bg-emerald-600"/>
          <StatCard title="Content Chunks" value={statsData.totalChunks.toLocaleString()} icon={Layers} description="Vector embeddings in DB" colorClass="bg-indigo-500"/>
        </div>
      </section>
      
      {/* Query Performance Section */}
      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 border-b border-gray-200 pb-2">Query Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Queries (24h)" value={statsData.queriesLast24h} icon={Search} description="Last 24 hours" colorClass="bg-blue-700"/>
          <StatCard title="Queries (7d)" value={statsData.queriesLast7d} icon={BarChart2} description="Last 7 days" colorClass="bg-blue-700"/>
          <StatCard title="Avg Response Time" value={`${statsData.avgResponseTime}s`} icon={Activity} description="Average response latency" colorClass="bg-blue-700"/>
          <StatCard title="Feedback Rate" value={`${statsData.feedbackRate}%`} icon={MessageSquare} description="User feedback percentage" colorClass="bg-blue-700"/>
        </div>
      </section>
      
      {/* API Usage & System Health */}
      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-gray-800 border-b border-gray-200 pb-2">API Usage & System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Perplexity API Calls" value={statsData.perplexityCalls} icon={BrainCircuit} description="Total API calls" colorClass="bg-blue-700"/>
          <StatCard title="Cache Hits" value={statsData.perplexityCacheHits} icon={Layers} description={`${statsData.perplexityCacheHitRate}% hit rate`} colorClass="bg-blue-700"/>
          <StatCard title="System Status" value={statsData.systemStatus} icon={Settings} description="All systems operational" colorClass="bg-emerald-600"/>
          <StatCard title="Cache Efficiency" value={`${statsData.perplexityCacheHitRate}%`} icon={Target} description="Cache hit percentage" colorClass="bg-blue-700"/>
        </div>
      </section>
    </div>);
};
const QueryInsightsTab = () => {
    const [timeRange, setTimeRange] = useState('7d');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [queryData, setQueryData] = useState(null);
    const [activeTab, setActiveTab] = useState('volume');
    // Mock data for development until API is implemented
    const mockVolumeData = {
        daily: Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return {
                date: date.toISOString().split('T')[0],
                count: Math.floor(Math.random() * 100) + 50
            };
        }),
        hourly: Array.from({ length: 24 }, (_, i) => {
            const date = new Date();
            date.setHours(date.getHours() - (23 - i));
            return {
                date: `${date.getHours()}:00`,
                count: Math.floor(Math.random() * 20) + 5
            };
        })
    };
    const mockTopQueries = Array.from({ length: 10 }, (_, i) => ({
        id: `q-${i + 1}`,
        text: [
            "How do I integrate with Salesforce?",
            "What are the main features?",
            "Is there a free trial available?",
            "How to export data?",
            "Pricing for enterprise",
            "Technical documentation",
            "API integration guide",
            "How to reset my password",
            "Mobile app features",
            "Help with onboarding"
        ][i],
        count: Math.floor(Math.random() * 100) + (100 - i * 10),
        avgResponseTime: Number((Math.random() * 2 + 0.5).toFixed(2)),
        feedbackRate: Math.floor(Math.random() * 30) + 10,
        positiveRate: Math.floor(Math.random() * 80) + 20,
        negativeRate: Math.floor(Math.random() * 20),
        lastUsed: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString()
    }));
    const mockNoResultQueries = Array.from({ length: 5 }, (_, i) => ({
        id: `nq-${i + 1}`,
        text: [
            "Compatibility with legacy systems",
            "International compliance requirements",
            "Workstream integration details",
            "Hardware requirements for on-premises",
            "SLA for enterprise customers"
        ][i],
        count: Math.floor(Math.random() * 20) + 5,
        lastUsed: new Date(Date.now() - Math.random() * 86400000 * 5).toISOString()
    }));
    const mockNegativeQueries = Array.from({ length: 5 }, (_, i) => ({
        id: `neg-${i + 1}`,
        text: [
            "How to cancel subscription",
            "Refund policy details",
            "Why is system so slow",
            "Missing features comparison",
            "Complex workflow explanation"
        ][i],
        count: Math.floor(Math.random() * 15) + 3,
        negativeRate: Math.floor(Math.random() * 50) + 50,
        lastUsed: new Date(Date.now() - Math.random() * 86400000 * 4).toISOString()
    }));
    const mockStats = {
        totalQueries: 1248,
        avgQueryLength: 8.3,
        avgResponseTime: 0.82,
        noResultRate: 4.2
    };
    useEffect(() => {
        // Load mock data initially, replace with API call when available
        setLoading(true);
        // Simulate network delay
        setTimeout(() => {
            try {
                setQueryData({
                    volumeData: mockVolumeData,
                    topQueries: mockTopQueries,
                    noResultQueries: mockNoResultQueries,
                    negativeQueries: mockNegativeQueries,
                    stats: mockStats
                });
                setLoading(false);
            }
            catch (err) {
                setError('Failed to load query data');
                setLoading(false);
            }
        }, 800);
    }, [timeRange]);
    // Future real API fetch implementation
    const fetchQueryData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Replace with actual API call when implemented
            // const response = await fetch(`/api/admin/query-insights?timeRange=${timeRange}`);
            // if (!response.ok) throw new Error('Failed to fetch query insights data');
            // const data = await response.json();
            // setQueryData(data);
            // For now, just use mock data
            setQueryData({
                volumeData: mockVolumeData,
                topQueries: mockTopQueries,
                noResultQueries: mockNoResultQueries,
                negativeQueries: mockNegativeQueries,
                stats: mockStats
            });
        }
        catch (err) {
            setError(err.message || 'An error occurred');
            console.error('Error fetching query insights:', err);
        }
        finally {
            setLoading(false);
        }
    };
    // Filter queries based on search term
    const filterQueries = (queries) => {
        if (!searchTerm)
            return queries;
        return queries.filter(q => q.text.toLowerCase().includes(searchTerm.toLowerCase()));
    };
    // Format date for display
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };
    // Render volume chart section
    const renderVolumeSection = () => {
        if (!queryData)
            return <div>No data available</div>;
        return (<div className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Query Volume ({timeRange})</h3>
        
        {/* Chart placeholder - Replace with actual chart component when available */}
        <div className="h-64 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center mb-4">
          <div className="text-gray-500">
            {loading ? (<div className="flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading chart data...</span>
              </div>) : (<div>
                <p>Chart visualization would go here.</p>
                <p className="text-sm">Bar chart showing query volume over time.</p>
                <p className="text-xs mt-2">Data: {timeRange === '24h' ? 'Last 24 hours' : 'Last 7 days'}</p>
              </div>)}
          </div>
        </div>
        
        {/* Stats cards section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">Total Queries</h3>
              <div className="p-2 rounded-md bg-blue-700">
                <Search className="h-5 w-5 text-white"/>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{queryData.stats.totalQueries}</span>
              <span className="text-xs text-gray-500 mt-1">In selected period</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">Avg Response Time</h3>
              <div className="p-2 rounded-md bg-blue-700">
                <Activity className="h-5 w-5 text-white"/>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{queryData.stats.avgResponseTime}s</span>
              <span className="text-xs text-gray-500 mt-1">Average query response time</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">No Results Rate</h3>
              <div className="p-2 rounded-md bg-amber-500">
                <FileWarning className="h-5 w-5 text-white"/>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{queryData.stats.noResultRate}%</span>
              <span className="text-xs text-gray-500 mt-1">Queries with no relevant results</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">Avg Query Length</h3>
              <div className="p-2 rounded-md bg-blue-700">
                <FileText className="h-5 w-5 text-white"/>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{queryData.stats.avgQueryLength}</span>
              <span className="text-xs text-gray-500 mt-1">Words per query</span>
            </div>
          </div>
        </div>
      </div>);
    };
    // Render top queries table section
    const renderTopQueriesSection = () => {
        if (!queryData)
            return <div>No data available</div>;
        const filteredQueries = filterQueries(queryData.topQueries);
        return (<div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Most Frequent Queries</h3>
        
        {filteredQueries.length === 0 ? (<div className="text-center py-6 text-gray-500">No matching queries found</div>) : (<div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Query Text</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Response</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQueries.map((query) => (<tr key={query.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{query.text}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{query.count}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{query.avgResponseTime}s</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-1 items-center">
                        <span className="text-green-600">{query.positiveRate}%</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-red-500">{query.negativeRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(query.lastUsed || '')}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>);
    };
    // Render no results queries section
    const renderNoResultsSection = () => {
        if (!queryData)
            return <div>No data available</div>;
        const filteredQueries = filterQueries(queryData.noResultQueries);
        return (<div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Queries with No Results</h3>
        
        {filteredQueries.length === 0 ? (<div className="text-center py-6 text-gray-500">No matching queries found</div>) : (<div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Query Text</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Occurrence</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQueries.map((query) => (<tr key={query.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{query.text}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{query.count}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(query.lastUsed || '')}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 hover:text-blue-800">
                      <button className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded">
                        Add Content
                      </button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>);
    };
    // Render negative feedback queries section
    const renderNegativeSection = () => {
        if (!queryData)
            return <div>No data available</div>;
        const filteredQueries = filterQueries(queryData.negativeQueries);
        return (<div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Queries with Negative Feedback</h3>
        
        {filteredQueries.length === 0 ? (<div className="text-center py-6 text-gray-500">No matching queries found</div>) : (<div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Query Text</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negative Rate</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Occurrence</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQueries.map((query) => (<tr key={query.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{query.text}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{query.count}</td>
                    <td className="px-4 py-3 text-sm text-red-500">{query.negativeRate}%</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(query.lastUsed || '')}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 hover:text-blue-800">
                      <button className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded">
                        Review
                      </button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>);
    };
    return (<div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Query Insights</h2>
        
        <div className="flex items-center space-x-4">
          {/* Time range selector */}
          <div className="flex border border-gray-200 rounded overflow-hidden">
            <button onClick={() => setTimeRange('24h')} className={`px-3 py-1 text-sm ${timeRange === '24h' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              24h
            </button>
            <button onClick={() => setTimeRange('7d')} className={`px-3 py-1 text-sm ${timeRange === '7d' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              7d
            </button>
            <button onClick={() => setTimeRange('30d')} className={`px-3 py-1 text-sm ${timeRange === '30d' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              30d
            </button>
            <button onClick={() => setTimeRange('all')} className={`px-3 py-1 text-sm ${timeRange === 'all' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              All
            </button>
          </div>
          
          {/* Search input */}
          <div className="relative">
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search queries..." className="w-64 pl-8 pr-4 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"/>
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={16}/>
          </div>
          
          {/* Refresh button */}
          <button onClick={fetchQueryData} disabled={loading} className="p-1 rounded-full hover:bg-gray-100 text-gray-600" title="Refresh data">
            {loading ? (<svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>)}
          </button>
        </div>
      </div>
      
      {error && (<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          {error}
        </div>)}
      
      {/* View selection tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button onClick={() => setActiveTab('volume')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'volume' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>
            Query Volume
          </button>
          <button onClick={() => setActiveTab('top')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'top' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>
            Top Queries
          </button>
          <button onClick={() => setActiveTab('no-results')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'no-results' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>
            Queries with No Results
          </button>
          <button onClick={() => setActiveTab('negative')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'negative' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>
            Negative Feedback
          </button>
        </nav>
      </div>
      
      {/* Content based on active tab */}
      {loading && !queryData ? (<div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-600">Loading query insights...</span>
          </div>
        </div>) : (<>
          {activeTab === 'volume' && renderVolumeSection()}
          {activeTab === 'top' && renderTopQueriesSection()}
          {activeTab === 'no-results' && renderNoResultsSection()}
          {activeTab === 'negative' && renderNegativeSection()}
        </>)}
      
      {/* Note about data source */}
      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>Note: Currently displaying mock data for development purposes.</p>
        <p>Integration with the query logs API will be implemented once the backend infrastructure is ready.</p>
      </div>
    </div>);
};
const ContentPerformanceTab = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [contentData, setContentData] = useState(null);
    // Mock data for development
    const mockContentData = {
        topContent: [
            {
                id: 'c-1',
                text: 'Introduction to the product architecture',
                source: 'Technical Documentation',
                retrievalCount: 156,
                feedbackScore: 0.87
            },
            {
                id: 'c-2',
                text: 'API integration guidelines for enterprise customers',
                source: 'Developer Guide',
                retrievalCount: 124,
                feedbackScore: 0.92
            },
            {
                id: 'c-3',
                text: 'Troubleshooting common integration issues',
                source: 'Troubleshooting Handbook',
                retrievalCount: 98,
                feedbackScore: 0.74
            }
        ],
        totalRetrievals: 1248,
        avgFeedbackScore: 0.78
    };
    useEffect(() => {
        // Load mock data
        setLoading(true);
        setTimeout(() => {
            setContentData(mockContentData);
            setLoading(false);
        }, 800);
    }, []);
    return (<div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Content Performance</h2>
      </div>
      
      {error && (<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          {error}
        </div>)}
      
      {/* Stats cards */}
      {contentData && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">Total Retrievals</h3>
              <div className="p-2 rounded-md bg-blue-700">
                <Search className="h-5 w-5 text-white"/>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{contentData.totalRetrievals.toLocaleString()}</span>
              <span className="text-xs text-gray-500 mt-1">All-time content retrievals</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">Avg Feedback Score</h3>
              <div className="p-2 rounded-md bg-green-600">
                <Activity className="h-5 w-5 text-white"/>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{(contentData.avgFeedbackScore * 100).toFixed(0)}%</span>
              <span className="text-xs text-gray-500 mt-1">Average content feedback score</span>
            </div>
          </div>
        </div>)}
      
      {/* Content Table */}
      {loading ? (<div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-600">Loading content performance data...</span>
          </div>
        </div>) : contentData ? (<div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium mb-4 text-gray-800">Most Retrieved Content</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retrievals</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contentData.topContent.map((item) => (<tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.text}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.source}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.retrievalCount}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`text-sm ${item.feedbackScore > 0.7 ? 'text-green-600' : item.feedbackScore < 0.5 ? 'text-red-500' : 'text-yellow-500'}`}>
                        {(item.feedbackScore * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>) : (<div className="text-center py-6 text-gray-500">No content performance data available</div>)}
      
      {/* Note about data source */}
      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>Note: Currently displaying mock data for development purposes.</p>
        <p>Integration with the content analytics API will be implemented once the backend infrastructure is ready.</p>
      </div>
    </div>);
};
const SalesCompanyInsightsTab = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [salesData, setSalesData] = useState(null);
    // Mock data for development
    const mockSalesData = {
        topResearchedCompanies: [
            {
                id: 'company-1',
                companyName: 'Acme Corporation',
                searchCount: 42,
                lastSearched: new Date(Date.now() - 3600000 * 24).toISOString()
            },
            {
                id: 'company-2',
                companyName: 'Stark Industries',
                searchCount: 38,
                lastSearched: new Date(Date.now() - 3600000 * 48).toISOString()
            },
            {
                id: 'company-3',
                companyName: 'Wayne Enterprises',
                searchCount: 29,
                lastSearched: new Date(Date.now() - 3600000 * 72).toISOString()
            },
            {
                id: 'company-4',
                companyName: 'Umbrella Corporation',
                searchCount: 24,
                lastSearched: new Date(Date.now() - 3600000 * 96).toISOString()
            },
            {
                id: 'company-5',
                companyName: 'Globex Corporation',
                searchCount: 19,
                lastSearched: new Date(Date.now() - 3600000 * 120).toISOString()
            }
        ],
        salesReps: [
            {
                id: 'rep-1',
                name: 'John Smith',
                sessionCount: 68,
                companyResearchCount: 45,
                averageFeedbackScore: 0.92
            },
            {
                id: 'rep-2',
                name: 'Sarah Johnson',
                sessionCount: 52,
                companyResearchCount: 38,
                averageFeedbackScore: 0.87
            },
            {
                id: 'rep-3',
                name: 'Mike Williams',
                sessionCount: 47,
                companyResearchCount: 31,
                averageFeedbackScore: 0.84
            }
        ],
        totalCompanySearches: 342,
        totalSalesSessions: 256
    };
    useEffect(() => {
        // Load mock data
        setLoading(true);
        setTimeout(() => {
            setSalesData(mockSalesData);
            setLoading(false);
        }, 800);
    }, []);
    // Format date for display
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };
    return (<div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Sales & Company Insights</h2>
      </div>
      
      {error && (<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          {error}
        </div>)}
      
      {/* Stats cards */}
      {salesData && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">Total Company Searches</h3>
              <div className="p-2 rounded-md bg-blue-700">
                <Search className="h-5 w-5 text-white"/>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{salesData.totalCompanySearches.toLocaleString()}</span>
              <span className="text-xs text-gray-500 mt-1">All-time company research searches</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">Total Sales Sessions</h3>
              <div className="p-2 rounded-md bg-indigo-600">
                <MessageSquare className="h-5 w-5 text-white"/>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{salesData.totalSalesSessions.toLocaleString()}</span>
              <span className="text-xs text-gray-500 mt-1">All-time sales chat sessions</span>
            </div>
          </div>
        </div>)}
      
      {/* Loading state */}
      {loading ? (<div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-600">Loading sales insights...</span>
          </div>
        </div>) : salesData ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Researched Companies */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium mb-4 text-gray-800">Most Researched Companies</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Search Count</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Searched</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesData.topResearchedCompanies.map((company) => (<tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{company.companyName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{company.searchCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(company.lastSearched)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Sales Rep Performance */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium mb-4 text-gray-800">Sales Rep Performance</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Researches</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesData.salesReps.map((rep) => (<tr key={rep.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{rep.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{rep.sessionCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{rep.companyResearchCount}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`text-sm ${rep.averageFeedbackScore > 0.8 ? 'text-green-600' : rep.averageFeedbackScore < 0.6 ? 'text-red-500' : 'text-yellow-500'}`}>
                          {(rep.averageFeedbackScore * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>) : (<div className="text-center py-6 text-gray-500">No sales insights data available</div>)}
      
      {/* Note about data source */}
      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>Note: Currently displaying mock data for development purposes.</p>
        <p>Integration with the sales analytics API will be implemented once the user authentication system is ready.</p>
      </div>
    </div>);
};
export default function Admin({ logs }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [sessionSearchQuery, setSessionSearchQuery] = useState('');
    const [contentSearchQuery, setContentSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generalSessions, setGeneralSessions] = useState([]);
    const [selectedGeneralSession, setSelectedGeneralSession] = useState(null);
    const [generalContentSearchQuery, setGeneralContentSearchQuery] = useState('');
    const [generalLoading, setGeneralLoading] = useState(false);
    const [generalError, setGeneralError] = useState(null);
    const router = useRouter();
    const filteredLogs = logs.filter(log => log.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.response.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.sender.toLowerCase().includes(searchTerm.toLowerCase()));
    // Function to export logs as JSON
    const exportLogs = () => {
        const dataStr = JSON.stringify(logs, null, 2);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
        const exportFileDefaultName = `sales_assistant_logs_${new Date().toISOString().slice(0, 10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };
    // Fetch data based on active tab
    useEffect(() => {
        // Reset selections when tab changes
        setSelectedSession(null);
        setSelectedGeneralSession(null);
        if (activeTab === 'companySessions') {
            fetchSessions();
        }
        else if (activeTab === 'generalSessions') {
            fetchGeneralSessions();
        }
        else if (activeTab === 'pendingDocuments') {
            // Fetch pending docs data if needed - PendingDocuments component might handle its own fetching
        }
        else if (activeTab === 'documentManagement') {
            // Fetch document manager data if needed - DocumentManager component might handle its own fetching
        }
        // Add conditions for fetching data for new tabs later
    }, [activeTab]);
    // Fetch GENERAL chat sessions
    const fetchGeneralSessions = async (query, byContent = false) => {
        setGeneralLoading(true);
        setGeneralError(null);
        try {
            let url = '/api/admin/chat-sessions?type=general';
            if (query) {
                url += `&${byContent ? 'content=' : 'search='}${encodeURIComponent(query)}`;
            }
            const response = await fetch(url);
            if (!response.ok)
                throw new Error(`Failed to fetch sessions: ${response.statusText}`);
            const data = await response.json();
            setGeneralSessions(data.sessions || []);
        }
        catch (err) {
            console.error('Error fetching general chat sessions:', err);
            setGeneralError(`Failed to load general chat sessions: ${err.message}`);
        }
        finally {
            setGeneralLoading(false);
        }
    };
    // Fetch COMPANY chat sessions
    const fetchSessions = async (query) => {
        setLoading(true);
        setError(null);
        try {
            const url = query
                ? `/api/admin/chat-sessions?search=${encodeURIComponent(query)}&type=company`
                : '/api/admin/chat-sessions?type=company';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch sessions: ${response.statusText}`);
            }
            const data = await response.json();
            setSessions(data.sessions || []);
        }
        catch (err) {
            console.error('Error fetching company sessions:', err);
            setError('Failed to load company chat sessions. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    // Fetch GENERAL session details
    const fetchGeneralSessionDetails = async (sessionId) => {
        setGeneralLoading(true);
        try {
            const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
            if (!response.ok)
                throw new Error(`Failed to fetch session details: ${response.statusText}`);
            const data = await response.json();
            if (data.messages && Array.isArray(data.messages)) {
                data.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            }
            setSelectedGeneralSession(data);
        }
        catch (err) {
            console.error('Error fetching general session details:', err);
            setGeneralError(`Failed to load session details: ${err.message}`);
        }
        finally {
            setGeneralLoading(false);
        }
    };
    // Fetch COMPANY session details
    const fetchSessionDetails = async (sessionId) => {
        try {
            setLoading(true);
            console.log(`Fetching details for company session: ${sessionId}`);
            const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch session details: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`Loaded session with ${data.messages?.length || 0} messages`);
            // Ensure messages are sorted by timestamp
            if (data.messages && Array.isArray(data.messages)) {
                data.messages.sort((a, b) => {
                    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                });
            }
            setSelectedSession(data);
        }
        catch (err) {
            console.error('Error fetching session details:', err);
            setError('Failed to load session details. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    // Format date for display
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };
    // Format session ID for display
    const formatSessionId = (id) => {
        // Return last 8 characters of ID for display
        return id.length > 8 ? '...' + id.substring(id.length - 8) : id;
    };
    // Add a ref for chat containers
    const chatMessagesRef = useRef(null);
    const companyMessagesRef = useRef(null);
    // Scroll to bottom of chat messages when a session is selected
    useEffect(() => {
        if (selectedGeneralSession && chatMessagesRef.current) {
            // Delay slightly to ensure rendering is complete
            setTimeout(() => {
                if (chatMessagesRef.current) {
                    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
                    console.log('Scrolling general chat to bottom, height:', chatMessagesRef.current.scrollHeight);
                }
            }, 200); // Increased delay to ensure DOM is fully rendered
        }
    }, [selectedGeneralSession]);
    // Scroll to bottom of company messages when a session is selected
    useEffect(() => {
        if (selectedSession && companyMessagesRef.current) {
            // Delay slightly to ensure rendering is complete
            setTimeout(() => {
                if (companyMessagesRef.current) {
                    companyMessagesRef.current.scrollTop = companyMessagesRef.current.scrollHeight;
                    console.log('Scrolling company chat to bottom, height:', companyMessagesRef.current.scrollHeight);
                }
            }, 200); // Increased delay to ensure DOM is fully rendered
        }
    }, [selectedSession]);
    // --- Render Function --- 
    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab />;
            case 'queryInsights':
                return <QueryInsightsTab />;
            case 'contentPerformance':
                return <ContentPerformanceTab />;
            case 'salesInsights':
                return <SalesCompanyInsightsTab />;
            case 'documentManagement':
                return <DocumentManagement />;
            case 'pendingDocuments':
                return <PendingDocuments />;
            case 'chunkManagement':
                return <AllChunksViewer />;
            case 'generalSessions':
                return renderGeneralSessions();
            case 'companySessions':
                return renderCompanySessions();
            default:
                return <div>Select a tab to view content</div>;
        }
    };
    // --- JSX for General Sessions Tab ---
    const renderGeneralSessions = () => (<div className="flex h-full">
      {/* Session List */} 
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-4 bg-white">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">General Chat Sessions</h2>
        <form onSubmit={handleGeneralSessionContentSearch} className="mb-4">
          <div className="relative">
            <input type="text" value={generalContentSearchQuery} onChange={(e) => setGeneralContentSearchQuery(e.target.value)} placeholder="Search message content..." className="w-full p-2 pl-8 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-700"/>
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={18}/>
          </div>
          <button type="submit" className="mt-2 w-full bg-blue-700 hover:bg-blue-800 text-white py-1 px-3 rounded text-sm">Search Content</button>
        </form>
        {generalLoading && <p>Loading sessions...</p>}
        {generalError && <p className="text-red-500">{generalError}</p>}
        <ul className="space-y-2">
          {generalSessions.map(session => (<li key={session.id} onClick={() => fetchGeneralSessionDetails(session.id)} className={`p-2 rounded cursor-pointer ${selectedGeneralSession?.id === session.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
              <p className="font-medium truncate text-gray-800">{session.title || `Session ${formatSessionId(session.id)}`}</p>
              <p className="text-xs text-gray-500">Updated: {formatDate(session.updatedAt)}</p>
            </li>))}
        </ul>
      </div>

      {/* Session Details */} 
      <div className="w-2/3 overflow-y-auto p-4 bg-white">
        {selectedGeneralSession ? (<div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900">{selectedGeneralSession.title || `Session ${formatSessionId(selectedGeneralSession.id)}`}</h3>
            <p className="text-sm text-gray-500 mb-4">Created: {formatDate(selectedGeneralSession.createdAt)} | Last Updated: {formatDate(selectedGeneralSession.updatedAt)}</p>
            <div ref={chatMessagesRef} className="h-[calc(100vh-250px)] overflow-y-auto bg-gray-50 p-4 rounded space-y-3 border border-gray-200">
              {selectedGeneralSession.messages.map((msg, index) => (<div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-700 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'}`}>
                    <p className="text-xs font-semibold mb-1 capitalize">{msg.role}</p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 text-right ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>{formatDate(msg.timestamp)}</p>
                  </div>
                </div>))}
            </div>
          </div>) : (<div className="flex items-center justify-center h-full text-gray-500">
            Select a general session to view details.
          </div>)}
      </div>
    </div>);
    // --- JSX for Company Sessions Tab ---
    const renderCompanySessions = () => (<div className="flex h-full">
      {/* Session List */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-4 bg-white">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Company Chat Sessions</h2>
        <form onSubmit={handleSessionSearch} className="mb-4">
          <div className="relative">
            <input type="text" value={sessionSearchQuery} onChange={(e) => setSessionSearchQuery(e.target.value)} placeholder="Search company or title..." className="w-full p-2 pl-8 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-700"/>
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={18}/>
          </div>
          <button type="submit" className="mt-2 w-full bg-blue-700 hover:bg-blue-800 text-white py-1 px-3 rounded text-sm">Search Sessions</button>
        </form>
        {loading && <p>Loading sessions...</p>}
        {error && <p className="text-red-500">{error}</p>}
        <ul className="space-y-2">
          {sessions.map(session => (<li key={session.id} onClick={() => fetchSessionDetails(session.id)} className={`p-2 rounded cursor-pointer ${selectedSession?.id === session.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
              <p className="font-medium truncate text-gray-800">{session.companyName}</p>
              <p className="text-xs text-gray-500">Updated: {formatDate(session.updatedAt)}</p>
            </li>))}
        </ul>
      </div>

      {/* Session Details */}
      <div className="w-2/3 overflow-y-auto p-4 bg-white">
        {selectedSession ? (<div>
            <h3 className="text-xl font-semibold mb-1 text-gray-900">{selectedSession.companyName}</h3>
            <p className="text-sm text-gray-500 mb-1">Session ID: {formatSessionId(selectedSession.id)}</p>
            <p className="text-sm text-gray-500 mb-4">Created: {formatDate(selectedSession.createdAt)} | Last Updated: {formatDate(selectedSession.updatedAt)}</p>
            
            <details className="mb-4 bg-gray-50 rounded p-2 border border-gray-200">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">Company Info & Sales Notes</summary>
                <div className="mt-2 space-y-2 text-xs">
                    <p><strong>Industry:</strong> {selectedSession.companyInfo?.industry || 'N/A'}</p>
                    <p><strong>Size:</strong> {selectedSession.companyInfo?.size || 'N/A'}</p>
                    <p><strong>Location:</strong> {selectedSession.companyInfo?.location || 'N/A'}</p>
                    <p><strong>Website:</strong> {selectedSession.companyInfo?.website ? <a href={selectedSession.companyInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{selectedSession.companyInfo.website}</a> : 'N/A'}</p>
                    <p><strong>Sales Rep:</strong> {selectedSession.salesRepName || 'N/A'}</p>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="font-semibold">Sales Notes:</p>
                      <p className="whitespace-pre-wrap bg-white p-2 rounded border border-gray-200">{selectedSession.salesNotes || 'No notes available.'}</p>
                    </div>
                </div>
            </details>
            
            <div ref={companyMessagesRef} className="h-[calc(100vh-350px)] overflow-y-auto bg-gray-50 p-4 rounded space-y-3 border border-gray-200">
              {selectedSession.messages.map((msg, index) => (<div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-700 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'}`}>
                    <p className="text-xs font-semibold mb-1 capitalize">{msg.role}</p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 text-right ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>{formatDate(msg.timestamp)}</p>
                  </div>
                </div>))}
            </div>
          </div>) : (<div className="flex items-center justify-center h-full text-gray-500">
            Select a company session to view details.
          </div>)}
      </div>
    </div>);
    // --- Event Handlers (Refactored) ---
    const handleSessionSearch = (e) => {
        e.preventDefault();
        fetchSessions(sessionSearchQuery);
    };
    const handleGeneralSessionContentSearch = (e) => {
        e.preventDefault();
        fetchGeneralSessions(generalContentSearchQuery, true);
    };
    // --- End Event Handlers ---
    // Check for tab parameter in URL
    useEffect(() => {
        // Get the tab from query parameter
        const { tab } = router.query;
        // If a valid tab is provided in the URL, set it as active
        if (tab && typeof tab === 'string') {
            // Check if it's a valid AdminTabId
            const isValidTab = adminTabs.some(t => t.id === tab);
            if (isValidTab) {
                setActiveTab(tab);
            }
        }
    }, [router.query]);
    return (<AdminLayout title="Admin Dashboard">
      <Head>
        <title>Admin Dashboard</title>
      </Head>
      <div className="p-6 bg-white text-gray-800 min-h-screen">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900">Admin Dashboard</h1>
        
        {/* Tab Navigation */} 
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {adminTabs.map((tab) => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-colors duration-150 ease-in-out 
                  ${activeTab === tab.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                <tab.icon className="mr-2 h-5 w-5"/>
                {tab.label}
              </button>))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {renderTabContent()}
        </div>
      </div>
    </AdminLayout>);
}
