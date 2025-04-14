import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, } from 'chart.js';
import { useRouter } from 'next/router';
import { format, subDays, parseISO } from 'date-fns';
// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);
const Analytics = () => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // Analytics data state
    const [searchMetrics, setSearchMetrics] = useState([]);
    const [topSearches, setTopSearches] = useState([]);
    const [feedbackSummary, setFeedbackSummary] = useState([]);
    const [searchTrends, setSearchTrends] = useState([]);
    const [zeroResultQueries, setZeroResultQueries] = useState([]);
    // Dashboard filters
    const [filters, setFilters] = useState({
        dateRange: '7days',
        searchType: 'all',
    });
    // Active tab state
    const [activeTab, setActiveTab] = useState('overview');
    // Fetch analytics data
    useEffect(() => {
        const fetchAnalyticsData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Calculate date range based on filters
                const endDate = new Date();
                let startDate = new Date();
                switch (filters.dateRange) {
                    case '7days':
                        startDate = subDays(endDate, 7);
                        break;
                    case '30days':
                        startDate = subDays(endDate, 30);
                        break;
                    case '90days':
                        startDate = subDays(endDate, 90);
                        break;
                    case 'custom':
                        if (filters.customStartDate && filters.customEndDate) {
                            startDate = parseISO(filters.customStartDate);
                            // Use end of day for the end date
                            const customEnd = parseISO(filters.customEndDate);
                            endDate.setHours(23, 59, 59, 999);
                        }
                        break;
                }
                // Format dates for API
                const startDateStr = format(startDate, 'yyyy-MM-dd');
                const endDateStr = format(endDate, 'yyyy-MM-dd');
                // Fetch search metrics by type
                const searchMetricsRes = await fetch(`/api/analytics/reports/search-metrics?start=${startDateStr}&end=${endDateStr}&type=${filters.searchType}`);
                // Fetch top searches
                const topSearchesRes = await fetch(`/api/analytics/reports/top-searches?start=${startDateStr}&end=${endDateStr}&limit=10`);
                // Fetch feedback summary
                const feedbackSummaryRes = await fetch(`/api/analytics/reports/feedback-summary?start=${startDateStr}&end=${endDateStr}`);
                // Fetch search trends over time
                const searchTrendsRes = await fetch(`/api/analytics/reports/search-trends?start=${startDateStr}&end=${endDateStr}&interval=day`);
                // Fetch zero result queries
                const zeroResultsRes = await fetch(`/api/analytics/reports/zero-results?start=${startDateStr}&end=${endDateStr}&limit=10`);
                // Check responses and set data
                if (!searchMetricsRes.ok || !topSearchesRes.ok || !feedbackSummaryRes.ok ||
                    !searchTrendsRes.ok || !zeroResultsRes.ok) {
                    throw new Error('Failed to fetch analytics data');
                }
                const searchMetricsData = await searchMetricsRes.json();
                const topSearchesData = await topSearchesRes.json();
                const feedbackSummaryData = await feedbackSummaryRes.json();
                const searchTrendsData = await searchTrendsRes.json();
                const zeroResultsData = await zeroResultsRes.json();
                setSearchMetrics(searchMetricsData);
                setTopSearches(topSearchesData);
                setFeedbackSummary(feedbackSummaryData);
                setSearchTrends(searchTrendsData);
                setZeroResultQueries(zeroResultsData);
            }
            catch (err) {
                console.error('Error fetching analytics data:', err);
                setError('Failed to load analytics data. Please try again later.');
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchAnalyticsData();
    }, [filters]);
    // Handle filter changes
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };
    // Prepare chart data for search metrics
    const searchMetricsChartData = {
        labels: searchMetrics.map(metric => metric.search_type),
        datasets: [
            {
                label: 'Search Count',
                data: searchMetrics.map(metric => metric.search_count),
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
            },
            {
                label: 'Avg. Result Count',
                data: searchMetrics.map(metric => metric.avg_result_count),
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
            },
        ],
    };
    // Prepare chart data for feedback summary
    const feedbackChartData = {
        labels: feedbackSummary.map(item => `${item.rating} Star${item.rating !== 1 ? 's' : ''}`),
        datasets: [
            {
                label: 'Feedback Count',
                data: feedbackSummary.map(item => item.feedback_count),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(255, 159, 64, 0.5)',
                    'rgba(255, 205, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                ],
                borderWidth: 1,
            },
        ],
    };
    // Prepare chart data for search trends
    const searchTrendsChartData = {
        labels: searchTrends.map(trend => trend.date),
        datasets: [
            {
                label: 'Search Volume',
                data: searchTrends.map(trend => trend.count),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                tension: 0.1,
            },
        ],
    };
    const exportData = () => {
        const exportFormat = window.prompt('Export format? (csv/json)', 'json');
        if (exportFormat === 'csv' || exportFormat === 'json') {
            // Call API to export data
            window.open(`/api/analytics/export?format=${exportFormat}&start=${filters.customStartDate || ''}&end=${filters.customEndDate || ''}&range=${filters.dateRange}`);
        }
    };
    return (<div className="min-h-screen bg-gray-100">
      <Head>
        <title>Analytics Dashboard | Sales Chat</title>
        <meta name="description" content="Analytics dashboard for sales chat application"/>
      </Head>
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
          <button onClick={exportData} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
            Export Data
          </button>
        </div>
        
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select value={filters.dateRange} onChange={(e) => handleFilterChange('dateRange', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            {filters.dateRange === 'custom' && (<>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={filters.customStartDate} onChange={(e) => handleFilterChange('customStartDate', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={filters.customEndDate} onChange={(e) => handleFilterChange('customEndDate', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2"/>
                </div>
              </>)}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Type</label>
              <select value={filters.searchType} onChange={(e) => handleFilterChange('searchType', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="all">All</option>
                <option value="hybrid">Hybrid</option>
                <option value="vector">Vector</option>
                <option value="keyword">Keyword</option>
                <option value="fallback">Fallback</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Dashboard Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 font-medium text-sm ${activeTab === 'overview'
            ? 'border-b-2 border-blue-500 text-blue-600'
            : 'text-gray-500 hover:text-gray-700'}`}>
                Overview
              </button>
              <button onClick={() => setActiveTab('search')} className={`px-4 py-2 font-medium text-sm ${activeTab === 'search'
            ? 'border-b-2 border-blue-500 text-blue-600'
            : 'text-gray-500 hover:text-gray-700'}`}>
                Search Analytics
              </button>
              <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2 font-medium text-sm ${activeTab === 'feedback'
            ? 'border-b-2 border-blue-500 text-blue-600'
            : 'text-gray-500 hover:text-gray-700'}`}>
                User Feedback
              </button>
              <button onClick={() => setActiveTab('insights')} className={`px-4 py-2 font-medium text-sm ${activeTab === 'insights'
            ? 'border-b-2 border-blue-500 text-blue-600'
            : 'text-gray-500 hover:text-gray-700'}`}>
                Insights
              </button>
            </nav>
          </div>
          
          <div className="p-6">
            {isLoading ? (<div className="flex justify-center items-center h-64">
                <p className="text-lg text-gray-600">Loading analytics data...</p>
              </div>) : error ? (<div className="bg-red-50 p-4 rounded">
                <p className="text-red-600">{error}</p>
              </div>) : (<>
                {/* Overview Tab */}
                {activeTab === 'overview' && (<div className="space-y-8">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Total Searches</h3>
                        <p className="text-3xl font-bold text-gray-800">
                          {searchTrends.reduce((acc, curr) => acc + curr.count, 0)}
                        </p>
                        <div className="mt-2 text-sm text-gray-600">
                          {filters.dateRange === 'custom'
                    ? 'In selected date range'
                    : `Last ${filters.dateRange.replace('days', ' days')}`}
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Avg. Results Per Search</h3>
                        <p className="text-3xl font-bold text-gray-800">
                          {searchMetrics.length > 0
                    ? (searchMetrics.reduce((acc, curr) => acc + curr.avg_result_count, 0) / searchMetrics.length).toFixed(1)
                    : 'N/A'}
                        </p>
                        <div className="mt-2 text-sm text-gray-600">
                          Across all search types
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Avg. Feedback Rating</h3>
                        <p className="text-3xl font-bold text-gray-800">
                          {feedbackSummary.length > 0
                    ? feedbackSummary[0].avg_rating.toFixed(1)
                    : 'N/A'}
                        </p>
                        <div className="mt-2 text-sm text-gray-600">
                          Out of 5.0
                        </div>
                      </div>
                    </div>
                    
                    {/* Search Trends Chart */}
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">Search Volume Trends</h3>
                      <div className="h-80">
                        <Line data={searchTrendsChartData} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                        },
                    },
                }}/>
                      </div>
                    </div>
                    
                    {/* Top Queries Table */}
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">Top Search Queries</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Query
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Count
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Success Rate
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Avg. Results
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Last Seen
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {topSearches.map((search, idx) => (<tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {search.query_normalized}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {search.total_count}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {search.total_count > 0
                        ? `${((search.successful_count / search.total_count) * 100).toFixed(1)}%`
                        : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {search.avg_result_count.toFixed(1)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {format(parseISO(search.last_seen), 'MMM d, yyyy')}
                                </td>
                              </tr>))}
                            {topSearches.length === 0 && (<tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                  No search data available for the selected filters.
                                </td>
                              </tr>)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>)}
                
                {/* Search Analytics Tab */}
                {activeTab === 'search' && (<div className="space-y-8">
                    {/* Search Metrics by Type */}
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">Search Performance by Type</h3>
                      <div className="h-80">
                        <Bar data={searchMetricsChartData} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                        },
                    },
                }}/>
                      </div>
                    </div>
                    
                    {/* Zero Result Queries */}
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">Queries with Zero Results</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Query
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Count
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Last Seen
                              </th>
                              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {zeroResultQueries.map((query, idx) => (<tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {query.query_normalized}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {query.zero_results_count}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {format(parseISO(query.last_seen), 'MMM d, yyyy')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                  <button className="text-blue-600 hover:text-blue-900" onClick={() => router.push(`/admin/content?suggest=${query.query_normalized}`)}>
                                    Add Content
                                  </button>
                                </td>
                              </tr>))}
                            {zeroResultQueries.length === 0 && (<tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                  No zero-result queries in the selected time period.
                                </td>
                              </tr>)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>)}
                
                {/* User Feedback Tab */}
                {activeTab === 'feedback' && (<div className="space-y-8">
                    {/* Feedback Distribution */}
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">Feedback Distribution</h3>
                      <div className="h-80 flex justify-center">
                        <div className="w-1/2">
                          <Pie data={feedbackChartData} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                }}/>
                        </div>
                      </div>
                    </div>
                    
                    {/* Feedback Table - Would implement if we had detailed feedback data */}
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">Recent Feedback</h3>
                      <p className="text-gray-500 text-center py-8">
                        Detailed feedback data will appear here as users provide ratings and comments.
                      </p>
                    </div>
                  </div>)}
                
                {/* Insights Tab */}
                {activeTab === 'insights' && (<div className="space-y-8">
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-semibold mb-4">Suggested Improvements</h3>
                      
                      <div className="space-y-4">
                        <div className="border border-gray-200 p-4 rounded-lg">
                          <h4 className="font-medium text-lg mb-2">Content Gaps</h4>
                          <p className="text-gray-600 mb-2">
                            Based on zero-result queries, consider adding content about:
                          </p>
                          <ul className="list-disc pl-5">
                            {zeroResultQueries.slice(0, 3).map((query, idx) => (<li key={idx} className="text-gray-700">
                                {query.query_normalized}
                              </li>))}
                            {zeroResultQueries.length === 0 && (<li className="text-gray-500">No content gaps detected in the selected period.</li>)}
                          </ul>
                        </div>
                        
                        <div className="border border-gray-200 p-4 rounded-lg">
                          <h4 className="font-medium text-lg mb-2">Search Performance</h4>
                          <p className="text-gray-600 mb-2">
                            Insights on search algorithm performance:
                          </p>
                          <ul className="list-disc pl-5">
                            {searchMetrics.length > 0 ? (<>
                                <li className="text-gray-700">
                                  {`${searchMetrics[0]?.search_type || 'Hybrid'} search is most frequently used (${searchMetrics[0]?.search_count || 0} searches).`}
                                </li>
                                <li className="text-gray-700">
                                  Average search time is {searchMetrics.reduce((acc, curr) => acc + curr.avg_execution_time_ms, 0) /
                        searchMetrics.length}ms.
                                </li>
                              </>) : (<li className="text-gray-500">No search performance data available for the selected period.</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>)}
              </>)}
          </div>
        </div>
      </main>
    </div>);
};
export default Analytics;
