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
const react_1 = __importStar(require("react"));
const recharts_1 = require("recharts");
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
const AnalyticsDashboard = ({ refreshInterval = 60000 // Default refresh every minute
 }) => {
    const [analyticsData, setAnalyticsData] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [selectedTab, setSelectedTab] = (0, react_1.useState)('queries');
    // Fetch analytics data
    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/analytics');
            if (!response.ok) {
                throw new Error(`Failed to fetch analytics: ${response.statusText}`);
            }
            const data = await response.json();
            setAnalyticsData(data);
            setError(null);
        }
        catch (err) {
            console.error('Error fetching analytics:', err);
            setError('Failed to load analytics data. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    // Fetch on load and set up refresh interval
    (0, react_1.useEffect)(() => {
        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, refreshInterval);
        return () => clearInterval(interval);
    }, [refreshInterval]);
    // Format date for display
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };
    // Prepare data for feedback pie chart
    const getPieChartData = () => {
        if (!analyticsData)
            return [];
        const { positive, negative } = analyticsData.feedbackStats;
        return [
            { name: 'Positive', value: positive },
            { name: 'Negative', value: negative }
        ];
    };
    // Get data for query bar chart
    const getQueryBarData = () => {
        if (!analyticsData)
            return [];
        // Take top 10 queries
        return analyticsData.commonQueries
            .slice(0, 10)
            .map(q => ({
            name: q.query.length > 30 ? q.query.substring(0, 27) + '...' : q.query,
            total: q.count,
            positive: q.positiveCount,
            negative: q.negativeCount
        }));
    };
    // Get data for content reference bar chart
    const getContentBarData = () => {
        if (!analyticsData)
            return [];
        // Take top 10 content sources
        return analyticsData.topReferencedContent
            .slice(0, 10)
            .map(c => ({
            name: c.source.length > 30 ? c.source.substring(0, 27) + '...' : c.source,
            total: c.references,
            positive: c.positiveCount,
            negative: c.negativeCount
        }));
    };
    // Prepare data for session type pie chart
    const getSessionPieChartData = () => {
        if (!analyticsData || !analyticsData.sessionStats)
            return [];
        const { companyChats, generalChats } = analyticsData.sessionStats;
        return [
            { name: 'Company Chats', value: companyChats },
            { name: 'General Chats', value: generalChats }
        ];
    };
    // Prepare data for companies bar chart
    const getCompaniesBarData = () => {
        if (!analyticsData || !analyticsData.sessionStats)
            return [];
        // We only have company names, not counts, so we'll create a simple representation
        return analyticsData.sessionStats.companiesEngaged.slice(0, 10).map(company => ({
            name: company,
            value: 1 // Just to show the bar
        }));
    };
    if (loading && !analyticsData) {
        return (<div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
      </div>);
    }
    if (error && !analyticsData) {
        return (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>);
    }
    return (<div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Usage Analytics</h2>
        {analyticsData && (<div className="text-sm text-gray-500">
            Last updated: {formatDate(analyticsData.lastUpdated)}
          </div>)}
      </div>

      {analyticsData && (<>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg shadow">
              <div className="text-sm text-blue-500 uppercase font-semibold">Total Feedback</div>
              <div className="text-3xl font-bold">{analyticsData.feedbackStats.total}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg shadow">
              <div className="text-sm text-green-500 uppercase font-semibold">Positive Feedback</div>
              <div className="text-3xl font-bold">{analyticsData.feedbackStats.positive}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg shadow">
              <div className="text-sm text-red-500 uppercase font-semibold">Negative Feedback</div>
              <div className="text-3xl font-bold">{analyticsData.feedbackStats.negative}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg shadow">
              <div className="text-sm text-purple-500 uppercase font-semibold">Satisfaction Rate</div>
              <div className="text-3xl font-bold">
                {analyticsData.feedbackStats.percentagePositive.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Session Stats */}
          {analyticsData.sessionStats && (<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-indigo-50 p-4 rounded-lg shadow">
                <div className="text-sm text-indigo-500 uppercase font-semibold">Total Sessions</div>
                <div className="text-3xl font-bold">{analyticsData.sessionStats.totalSessions}</div>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg shadow">
                <div className="text-sm text-teal-500 uppercase font-semibold">Companies Engaged</div>
                <div className="text-3xl font-bold">{analyticsData.sessionStats.companiesEngaged.length}</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg shadow">
                <div className="text-sm text-amber-500 uppercase font-semibold">Avg. Feedback per Session</div>
                <div className="text-3xl font-bold">
                  {analyticsData.sessionStats.averageFeedbackPerSession.toFixed(1)}
                </div>
              </div>
            </div>)}

          {/* Feedback Distribution Pie Chart */}
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-4">Feedback Distribution</h3>
            <div className="h-64">
              <recharts_1.ResponsiveContainer width="100%" height="100%">
                <recharts_1.PieChart>
                  <recharts_1.Pie data={getPieChartData()} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {getPieChartData().map((entry, index) => (<recharts_1.Cell key={`cell-${index}`} fill={index === 0 ? '#4CAF50' : '#F44336'}/>))}
                  </recharts_1.Pie>
                  <recharts_1.Tooltip />
                  <recharts_1.Legend />
                </recharts_1.PieChart>
              </recharts_1.ResponsiveContainer>
            </div>
          </div>

          {/* Tab Buttons */}
          <div className="border-b border-gray-200 mb-6">
            <div className="flex -mb-px">
              <button className={`mr-8 py-2 border-b-2 font-medium text-sm ${selectedTab === 'queries'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setSelectedTab('queries')}>
                Common Questions
              </button>
              <button className={`mr-8 py-2 border-b-2 font-medium text-sm ${selectedTab === 'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setSelectedTab('content')}>
                Referenced Content
              </button>
              <button className={`mr-8 py-2 border-b-2 font-medium text-sm ${selectedTab === 'sessions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setSelectedTab('sessions')}>
                Session Stats
              </button>
            </div>
          </div>

          {/* Tab Content - Queries */}
          {selectedTab === 'queries' && (<div>
              <h3 className="text-lg font-medium mb-4">Most Common Questions</h3>
              {analyticsData.commonQueries.length === 0 ? (<p className="text-gray-500 italic">No question data available yet.</p>) : (<div className="h-96">
                  <recharts_1.ResponsiveContainer width="100%" height="100%">
                    <recharts_1.BarChart data={getQueryBarData()} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                      <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                      <recharts_1.XAxis type="number"/>
                      <recharts_1.YAxis type="category" dataKey="name" width={150}/>
                      <recharts_1.Tooltip />
                      <recharts_1.Legend />
                      <recharts_1.Bar dataKey="total" name="Total Mentions" fill="#8884d8"/>
                      <recharts_1.Bar dataKey="positive" name="Positive Feedback" fill="#4CAF50"/>
                      <recharts_1.Bar dataKey="negative" name="Negative Feedback" fill="#F44336"/>
                    </recharts_1.BarChart>
                  </recharts_1.ResponsiveContainer>
                </div>)}
            </div>)}

          {/* Tab Content - Content References */}
          {selectedTab === 'content' && (<div>
              <h3 className="text-lg font-medium mb-4">Most Referenced Content</h3>
              {analyticsData.topReferencedContent.length === 0 ? (<p className="text-gray-500 italic">No content reference data available yet.</p>) : (<div className="h-96">
                  <recharts_1.ResponsiveContainer width="100%" height="100%">
                    <recharts_1.BarChart data={getContentBarData()} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                      <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                      <recharts_1.XAxis type="number"/>
                      <recharts_1.YAxis type="category" dataKey="name" width={150}/>
                      <recharts_1.Tooltip />
                      <recharts_1.Legend />
                      <recharts_1.Bar dataKey="total" name="Total References" fill="#82ca9d"/>
                      <recharts_1.Bar dataKey="positive" name="Positive Feedback" fill="#4CAF50"/>
                      <recharts_1.Bar dataKey="negative" name="Negative Feedback" fill="#F44336"/>
                    </recharts_1.BarChart>
                  </recharts_1.ResponsiveContainer>
                </div>)}
            </div>)}

          {/* Tab Content - Session Stats */}
          {selectedTab === 'sessions' && (<div>
              <h3 className="text-lg font-medium mb-4">Session Statistics</h3>
              {!analyticsData.sessionStats ? (<p className="text-gray-500 italic">No session data available yet.</p>) : (<>
                  <div className="mb-8">
                    <h4 className="text-md font-medium mb-2">Session Types</h4>
                    <div className="h-64">
                      <recharts_1.ResponsiveContainer width="100%" height="100%">
                        <recharts_1.PieChart>
                          <recharts_1.Pie data={getSessionPieChartData()} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                            {getSessionPieChartData().map((entry, index) => (<recharts_1.Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>))}
                          </recharts_1.Pie>
                          <recharts_1.Tooltip />
                          <recharts_1.Legend />
                        </recharts_1.PieChart>
                      </recharts_1.ResponsiveContainer>
                    </div>
                  </div>

                  {analyticsData.sessionStats.companiesEngaged.length > 0 && (<div>
                      <h4 className="text-md font-medium mb-2">Companies Engaged</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex flex-wrap gap-2">
                          {analyticsData.sessionStats.companiesEngaged.map((company, idx) => (<span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                              {company}
                            </span>))}
                        </div>
                      </div>
                    </div>)}
                </>)}
            </div>)}
        </>)}
    </div>);
};
exports.default = AnalyticsDashboard;
