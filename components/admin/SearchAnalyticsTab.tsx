import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getSupabase } from '../../utils/supabaseClient';

// Colors for the charts
const COLORS = [
  '#3f51b5', '#f44336', '#4caf50', '#ff9800', '#2196f3',
  '#9c27b0', '#00bcd4', '#ffeb3b', '#795548', '#607d8b'
];

interface SearchTrace {
  id: string;
  query: string;
  timestamp: string;
  query_analysis: {
    primaryCategory: string;
    secondaryCategories: string[];
    technicalLevel: number;
    intent: string;
    entities: any[];
  };
  search_decisions: {
    initialFilter: any;
    appliedFilter: any;
    filterRelaxed: boolean;
    relaxationReason?: string;
    categoryBalancing?: {
      before: { sales: number; nonSales: number };
      after: { sales: number; nonSales: number };
    };
  };
  result_stats: {
    initialResultCount: number;
    finalResultCount: number;
    categoriesInResults: Record<string, number>;
    salesContentRatio: number;
  };
  timings: {
    analysis: number;
    search: number;
    reranking?: number;
    total: number;
  };
}

interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

const SearchAnalyticsTab: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [traces, setTraces] = useState<SearchTrace[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [timeRange, setTimeRange] = useState<number>(7); // Default to 7 days
  const [selectedTrace, setSelectedTrace] = useState<SearchTrace | null>(null);

  // Fetch data function
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = getSupabase();
      
      // Add null check for supabase client
      if (!supabase) {
        throw new Error('Failed to initialize Supabase client');
      }
      
      // Get recent search traces
      const { data: tracesData, error: tracesError } = await supabase
        .from('search_traces')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);
        
      if (tracesError) {
        throw new Error(`Error fetching traces: ${tracesError.message}`);
      }
      
      // Get category distribution using the SQL function
      const { data: distributionData, error: distributionError } = await supabase
        .rpc('get_recent_category_distribution', { days_back: timeRange });
        
      if (distributionError) {
        throw new Error(`Error fetching category distribution: ${distributionError.message}`);
      }
      
      setTraces(tracesData || []);
      setCategoryDistribution(distributionData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching search analytics:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Effect to fetch data on component mount and when timeRange changes
  useEffect(() => {
    fetchData();
  }, [timeRange]);
  
  // Handle time range change
  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeRange(Number(e.target.value));
  };
  
  // Select a trace for detailed view
  const handleSelectTrace = (trace: SearchTrace) => {
    setSelectedTrace(trace);
  };
  
  // Prepare data for the category distribution chart
  const categoryChartData = categoryDistribution.map(item => ({
    name: item.category,
    value: item.count,
    percentage: item.percentage
  }));
  
  // Calculate sales vs non-sales content ratio
  const salesRatioData = traces.length > 0
    ? [
        { name: 'Sales Content', value: traces.reduce((sum, trace) => sum + trace.result_stats.salesContentRatio, 0) / traces.length * 100 },
        { name: 'Other Content', value: 100 - (traces.reduce((sum, trace) => sum + trace.result_stats.salesContentRatio, 0) / traces.length * 100) }
      ]
    : [];
  
  // Prepare data for the intent distribution chart
  const intentCounts: Record<string, number> = {};
  traces.forEach(trace => {
    const intent = trace.query_analysis.intent;
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
  });
  
  const intentChartData = Object.entries(intentCounts).map(([name, value]) => ({
    name,
    value
  }));
  
  // Format timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Search Analytics &amp; Category Distribution</h1>
        
        <div className="flex items-center mb-4">
          <div className="mr-4">
            <label htmlFor="time-range" className="block text-sm font-medium mb-1">Time Range</label>
            <select
              id="time-range"
              className="border rounded px-3 py-2 min-w-[200px]"
              value={timeRange}
              onChange={handleTimeRangeChange}
            >
              <option value={1}>Last 24 Hours</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
          
          <button 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p>Error: {error}</p>
          </div>
        )}
        
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Distribution Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Category Distribution</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, props) => {
                      if (props && props.payload && props.payload.percentage) {
                        return [`${value} (${props.payload.percentage.toFixed(1)}%)`, name];
                      }
                      return [value, name];
                    }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Sales vs Non-Sales Content Ratio */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Sales vs Non-Sales Content</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesRatioData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#3f51b5" />
                      <Cell fill="#f44336" />
                    </Pie>
                    <Tooltip formatter={(value) => {
                      if (typeof value === 'number') {
                        return [`${value.toFixed(1)}%`];
                      }
                      return [value];
                    }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Intent Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Query Intent Distribution</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={intentChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Recent Searches */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Searches</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Query</th>
                      <th className="py-2 px-4 border-b text-left">Time</th>
                      <th className="py-2 px-4 border-b text-left">Results</th>
                      <th className="py-2 px-4 border-b text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traces.slice(0, 10).map((trace) => (
                      <tr key={trace.id} className="hover:bg-gray-50">
                        <td className="py-2 px-4 border-b">{trace.query}</td>
                        <td className="py-2 px-4 border-b">{formatDate(trace.timestamp)}</td>
                        <td className="py-2 px-4 border-b">{trace.result_stats.finalResultCount}</td>
                        <td className="py-2 px-4 border-b">
                          <button
                            className="text-blue-600 hover:underline"
                            onClick={() => handleSelectTrace(trace)}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* Selected Trace Details */}
        {selectedTrace && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Search Details</h2>
              <button 
                className="text-gray-600 hover:text-gray-800"
                onClick={() => setSelectedTrace(null)}
              >
                Close
              </button>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Query Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Query:</strong> {selectedTrace.query}</p>
                  <p><strong>Time:</strong> {formatDate(selectedTrace.timestamp)}</p>
                  <p><strong>Intent:</strong> {selectedTrace.query_analysis.intent}</p>
                  <p><strong>Technical Level:</strong> {selectedTrace.query_analysis.technicalLevel}</p>
                </div>
                <div>
                  <p><strong>Primary Category:</strong> {selectedTrace.query_analysis.primaryCategory}</p>
                  <p><strong>Secondary Categories:</strong> {selectedTrace.query_analysis.secondaryCategories.join(', ') || 'None'}</p>
                  <p><strong>Filter Relaxed:</strong> {selectedTrace.search_decisions.filterRelaxed ? 'Yes' : 'No'}</p>
                  {selectedTrace.search_decisions.relaxationReason && (
                    <p><strong>Relaxation Reason:</strong> {selectedTrace.search_decisions.relaxationReason}</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Result Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Initial Result Count:</strong> {selectedTrace.result_stats.initialResultCount}</p>
                  <p><strong>Final Result Count:</strong> {selectedTrace.result_stats.finalResultCount}</p>
                  <p><strong>Sales Content Ratio:</strong> {(selectedTrace.result_stats.salesContentRatio * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p><strong>Categories in Results:</strong></p>
                  <ul className="list-disc pl-5">
                    {Object.entries(selectedTrace.result_stats.categoriesInResults).map(([category, count]) => (
                      <li key={category}>{category}: {count}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Timing Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Analysis Time:</strong> {selectedTrace.timings.analysis.toFixed(1)} ms</p>
                  <p><strong>Search Time:</strong> {selectedTrace.timings.search.toFixed(1)} ms</p>
                  {selectedTrace.timings.reranking !== undefined && (
                    <p><strong>Reranking Time:</strong> {selectedTrace.timings.reranking.toFixed(1)} ms</p>
                  )}
                </div>
                <div>
                  <p><strong>Total Time:</strong> {selectedTrace.timings.total.toFixed(1)} ms</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchAnalyticsTab; 