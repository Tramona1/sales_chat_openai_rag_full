import React, { useState, useEffect, useRef } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import path from 'path';
import fs from 'fs';
import { 
  Home, 
  Search, 
  BarChart, 
  Database, 
  AlertCircle, 
  MessageSquare, 
  Briefcase, 
  Clipboard,
  Layers,
  HelpCircle,
  Menu,
  X,
  DownloadCloud,
  TrendingUp, 
  Activity,
  File,
  FileText,
  Settings,
  Target,
  BarChart2,
  AlertTriangle as FileWarning, // Using AlertTriangle as a replacement for FileWarning
  Cpu, // Using Cpu directly without an alias
  CheckCircle,
  Clock,
  Percent,
  CheckSquare,
  XSquare,
  DollarSign,
  Edit, // Use for Answer Generation?
  Filter, // Use for Reranking?
  Check,
  Sliders,
  Layers3,
  Users,
  MessageCircleIcon,
  ClipboardCheck,
  Sparkles
} from 'lucide-react';
import Button from '../components/ui/Button';
import SystemMetrics from '../components/SystemMetrics';
import PendingDocuments from '../components/admin/PendingDocuments';
import DocumentManagement from '../components/admin/DocumentManagement';
import AllChunksViewer from '../components/admin/AllChunksViewer';
import AdminLayout from '../components/layout/AdminLayout';
import { FeedbackLog } from '../types/feedback';

interface AdminProps {
  logs: FeedbackLog[];
}

interface ChatSession {
  id: string;
  companyName: string;
  title?: string;
  sessionType?: 'company' | 'general';
  updatedAt: string;
}

interface ChatSessionDetailed {
  id: string;
  companyName: string;
  title?: string;
  sessionType?: 'company' | 'general';
  companyInfo: any;
  salesNotes: string;
  messages: {
    role: string;
    content: string;
    timestamp: string;
  }[];
  createdAt: string;
  updatedAt: string;
  salesRepId?: string;
  salesRepName?: string;
  tags?: string[];
  keywords?: string[];
}

export const getServerSideProps: GetServerSideProps = async () => {
  const logPath = path.join(process.cwd(), 'feedback.json');
  let logs: FeedbackLog[] = [];
  
  if (fs.existsSync(logPath)) {
    try {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      // Sort logs by timestamp, newest first
      logs.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error parsing logs:', error);
    }
  }
  
  return { props: { logs } };
};

// Define Tab Type
type AdminTabId = 
  | 'insights'
  | 'contentPerformance'
  | 'documentManagement'
  | 'pendingDocuments'
  | 'chunkManagement'
  | 'generalSessions'
  | 'companySessions'
  | 'systemStatus';

interface AdminTab {
  id: AdminTabId;
  label: string;
  icon: React.ElementType;
}

// Define Tabs - Reordered and Renamed
const adminTabs: AdminTab[] = [
  { id: 'insights', label: 'Insights', icon: BarChart2 }, 
  { id: 'contentPerformance', label: 'Content Performance', icon: BarChart },
  { id: 'documentManagement', label: 'Document Management', icon: Database },
  { id: 'pendingDocuments', label: 'Pending Documents', icon: AlertCircle },
  { id: 'chunkManagement', label: 'Chunk Management', icon: Layers },
  { id: 'generalSessions', label: 'General Sessions', icon: MessageSquare },
  { id: 'companySessions', label: 'Company Sessions', icon: Briefcase },
  { id: 'systemStatus', label: 'System Status', icon: Settings },
];

// Define TypeScript interfaces for Query Insights data structures
interface VolumeDataPoint {
  date: string;
  count: number;
}

interface QueryItem {
  id: string;
  text: string;
  count: number;
  avgResponseTime?: number;
  feedbackRate?: number;
  positiveRate?: number;
  negativeRate?: number;
  lastUsed?: string;
}

interface QueryInsightsData {
  volumeData: {
    daily: VolumeDataPoint[];
    hourly: VolumeDataPoint[];
  };
  topQueries: QueryItem[];
  noResultQueries: QueryItem[];
  negativeQueries: QueryItem[];
  stats: {
    totalQueries: number;
    avgQueryLength: number;
    avgResponseTime: number;
    noResultRate: number;
  };
}

// --- ADD Interface for SystemStatusTab data --- 
interface SystemStatusData {
  totalDocuments: number;
  totalChunks: number;
  queriesLast24h: number;
  queriesLast7d: number;
  avgResponseTime: number; // Provided by API, but might be 0 if not implemented
  perplexityCacheHits: number;
  perplexityCacheHitRate: number;
  // ADDED: Structure for API call stats
  apiCalls: {
    geminiChatSuccess?: number; // Make optional for safety during initial fetch
    geminiChatError?: number;
    totalGeminiChatCalls?: number; // ADDED total
    geminiEmbeddingSuccess?: number; // ADDED
    geminiEmbeddingError?: number;   // ADDED
    totalGeminiEmbeddingCalls?: number; // ADDED
    // Add other API calls here later (e.g., embeddingSuccess)
    estimatedChatCost?: number;
    estimatedEmbeddingCost?: number;
    totalEstimatedCost?: number;
    // ADDED: Query Analysis
    geminiQueryAnalysisSuccess?: number;
    geminiQueryAnalysisError?: number;
    totalGeminiQueryAnalysisCalls?: number;
    estimatedAnalysisCost?: number;
    // ADDED: Answer Generation
    geminiAnswerGenerationSuccess?: number;
    geminiAnswerGenerationError?: number;
    totalGeminiAnswerGenerationCalls?: number;
    estimatedAnswerGenCost?: number;
    // ADDED: Reranking
    geminiRerankingSuccess?: number;
    geminiRerankingError?: number;
    totalGeminiRerankingCalls?: number;
    estimatedRerankCost?: number;
  };
}

// --- Placeholder Components for New Tabs ---
const SystemStatusTab = () => {
  const [statsData, setStatsData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSystemMetrics = async () => {
      setError(null);
      try {
        const response = await fetch('/api/system-metrics');
        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
          const data = await response.json();
        console.debug("[SystemStatusTab] Fetched metrics:", data);

        // Map data to state, including all nested apiCalls fields
        setStatsData({
          totalDocuments: data.vectorStore?.documents ?? 0,
          totalChunks: data.vectorStore?.chunks ?? 0,
          queriesLast24h: data.queries?.last24Hours ?? 0,
          queriesLast7d: data.queries?.last7Days ?? 0,
          avgResponseTime: data.performance?.averageQueryTime ?? 0,
          perplexityCacheHits: data.caching?.hits ?? 0,
          perplexityCacheHitRate: data.caching?.hitRate ?? 0,
          apiCalls: {
            geminiChatSuccess: data.apiCalls?.geminiChatSuccess ?? 0,
            geminiChatError: data.apiCalls?.geminiChatError ?? 0,
            totalGeminiChatCalls: data.apiCalls?.totalGeminiChatCalls ?? 0,
            estimatedChatCost: data.apiCalls?.estimatedChatCost ?? 0,
            geminiEmbeddingSuccess: data.apiCalls?.geminiEmbeddingSuccess ?? 0,
            geminiEmbeddingError: data.apiCalls?.geminiEmbeddingError ?? 0,
            totalGeminiEmbeddingCalls: data.apiCalls?.totalGeminiEmbeddingCalls ?? 0,
            estimatedEmbeddingCost: data.apiCalls?.estimatedEmbeddingCost ?? 0,
            geminiQueryAnalysisSuccess: data.apiCalls?.geminiQueryAnalysisSuccess ?? 0,
            geminiQueryAnalysisError: data.apiCalls?.geminiQueryAnalysisError ?? 0,
            totalGeminiQueryAnalysisCalls: data.apiCalls?.totalGeminiQueryAnalysisCalls ?? 0,
            estimatedAnalysisCost: data.apiCalls?.estimatedAnalysisCost ?? 0,
            geminiAnswerGenerationSuccess: data.apiCalls?.geminiAnswerGenerationSuccess ?? 0,
            geminiAnswerGenerationError: data.apiCalls?.geminiAnswerGenerationError ?? 0,
            totalGeminiAnswerGenerationCalls: data.apiCalls?.totalGeminiAnswerGenerationCalls ?? 0,
            estimatedAnswerGenCost: data.apiCalls?.estimatedAnswerGenCost ?? 0,
            geminiRerankingSuccess: data.apiCalls?.geminiRerankingSuccess ?? 0,
            geminiRerankingError: data.apiCalls?.geminiRerankingError ?? 0,
            totalGeminiRerankingCalls: data.apiCalls?.totalGeminiRerankingCalls ?? 0,
            estimatedRerankCost: data.apiCalls?.estimatedRerankCost ?? 0,
            totalEstimatedCost: data.apiCalls?.totalEstimatedCost ?? 0
          }
        });

      } catch (error: any) {
        console.error('[SystemStatusTab] Error fetching system metrics:', error);
        setError(error.message || 'Failed to load system metrics.');
        setStatsData(null);
      } finally {
        // Ensure loading is set false only after first attempt
        if (loading) setLoading(false);
      }
    };

    fetchSystemMetrics();
    const interval = setInterval(fetchSystemMetrics, 30000);
    return () => clearInterval(interval);
  }, [loading]); // Rerun effect only if loading state changes (relevant on initial load)
  
  // Define StatCard prop types
  interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description?: string;
    colorClass?: string;
  }
  
  // Stat Card Component
  const StatCard: React.FC<StatCardProps> = ({ 
    title, 
    value, 
    icon: Icon, 
    description, 
    colorClass = 'bg-blue-700' 
  }) => (
    <div className="bg-white rounded-lg shadow-md p-4 hover:bg-gray-50 transition-colors border border-gray-100">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <div className={`p-2 rounded-md ${colorClass}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {description && <span className="text-xs text-gray-500 mt-1">{description}</span>}
      </div>
    </div>
  );
  
  // Conditional Rendering for Loading/Error states
  if (loading) {
    return <div className="p-6 text-center">Loading system status...</div>;
  }
  
  if (error) {
    return <div className="p-6 text-center text-red-600">Error loading system status: {error}</div>;
  }
  
  // If data fetch failed but no specific error message, or data is null
  if (!statsData) {
    return <div className="p-6 text-center">System status data unavailable.</div>;
  }

  // No derived stats needed as placeholders are removed

  // Render ONLY the cards for which we have real data
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">System Status & Metrics</h2>
      
      {/* Section for General Metrics */}
      <h3 className="text-lg font-medium mb-3 text-gray-700">Knowledge & Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard 
            title="Total Documents" 
            value={statsData.totalDocuments} 
            icon={FileText} 
          description="Total indexed documents"
          colorClass="bg-blue-600"
          />
          <StatCard 
          title="Total Chunks"
          value={statsData.totalChunks}
          icon={Database}
          description="Total indexed text chunks"
          colorClass="bg-blue-700"
        />
        
        {/* Query Stats */}
          <StatCard 
          title="Queries (Last 24h)"
            value={statsData.queriesLast24h} 
          icon={Activity}
          description="Queries received in the last 24 hours"
          colorClass="bg-green-600"
          />
          <StatCard 
          title="Queries (Last 7d)"
            value={statsData.queriesLast7d} 
          icon={TrendingUp}
          description="Queries received in the last 7 days"
          colorClass="bg-green-700"
          />
          <StatCard 
          title="Avg Response Time (s)"
          value={statsData.avgResponseTime.toFixed(2)} // Format to 2 decimal places
          icon={Clock}
          description="Average query processing time (API data)" // Indicate source
          colorClass="bg-yellow-600"
        />

        {/* Caching Stats */}
          <StatCard 
            title="Cache Hits" 
            value={statsData.perplexityCacheHits} 
          icon={CheckCircle}
          description="Total cache hits (Query Analysis)"
          colorClass="bg-purple-600"
          />
          <StatCard 
          title="Cache Hit Rate (%)"
          value={statsData.perplexityCacheHitRate.toFixed(1)} // Format to 1 decimal place
          icon={Percent}
          description="Cache hit percentage (Query Analysis)"
          colorClass="bg-purple-700"
          />
        </div>

      {/* Section for API Calls & Costs */}
      <h3 className="text-lg font-medium mb-3 text-gray-700">Gemini API Usage & Estimated Costs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* --- Total Estimated Cost --- */}
        <StatCard 
          title="Total Estimated Cost"
          value={`$${statsData.apiCalls?.totalEstimatedCost?.toFixed(2) ?? '0.00'}`} 
          icon={DollarSign}
          description="All Gemini API calls (Approx.)"
          colorClass="bg-orange-600" 
        />
        {/* Filler card for alignment or add another high-level metric? */}
        <div /> 
        <div /> 
        <div /> 
        
        {/* --- Chat --- */}
        <StatCard title="Chat Calls (Total)" value={statsData.apiCalls?.totalGeminiChatCalls ?? 0} icon={MessageSquare} description="Success + Error" colorClass="bg-sky-600" />
        <StatCard title="Chat Calls (Success)" value={statsData.apiCalls?.geminiChatSuccess ?? 0} icon={CheckCircle} description="Successful calls" colorClass="bg-teal-600" />
        <StatCard title="Chat Calls (Error)" value={statsData.apiCalls?.geminiChatError ?? 0} icon={AlertCircle} description="Failed calls" colorClass="bg-red-500" />
        <StatCard title="Chat Calls (Est. Cost)" value={`$${statsData.apiCalls?.estimatedChatCost?.toFixed(2) ?? '0.00'}`} icon={DollarSign} description="Approx. cost" colorClass="bg-orange-400" />
        
        {/* --- Embedding --- */}
        <StatCard title="Embedding Calls (Total)" value={statsData.apiCalls?.totalGeminiEmbeddingCalls ?? 0} icon={Database} description="Success + Error" colorClass="bg-indigo-600" />
        <StatCard title="Embedding Calls (Success)" value={statsData.apiCalls?.geminiEmbeddingSuccess ?? 0} icon={CheckSquare} description="Successful calls" colorClass="bg-indigo-500" />
        <StatCard title="Embedding Calls (Error)" value={statsData.apiCalls?.geminiEmbeddingError ?? 0} icon={XSquare} description="Failed calls" colorClass="bg-rose-500" />
        <StatCard title="Embedding Calls (Est. Cost)" value={`$${statsData.apiCalls?.estimatedEmbeddingCost?.toFixed(2) ?? '0.00'}`} icon={DollarSign} description="Approx. cost" colorClass="bg-orange-400" />

        {/* --- Query Analysis --- */}
        <StatCard title="Query Analysis Calls (Total)" value={statsData.apiCalls?.totalGeminiQueryAnalysisCalls ?? 0} icon={Cpu} description="Success + Error" colorClass="bg-cyan-600" />
        <StatCard title="Query Analysis (Success)" value={statsData.apiCalls?.geminiQueryAnalysisSuccess ?? 0} icon={CheckCircle} description="Successful calls" colorClass="bg-cyan-500" />
        <StatCard title="Query Analysis (Error)" value={statsData.apiCalls?.geminiQueryAnalysisError ?? 0} icon={AlertCircle} description="Failed calls" colorClass="bg-red-500" />
        <StatCard title="Query Analysis (Est. Cost)" value={`$${statsData.apiCalls?.estimatedAnalysisCost?.toFixed(2) ?? '0.00'}`} icon={DollarSign} description="Approx. cost" colorClass="bg-orange-400" />
        
        {/* --- Answer Generation --- */}
        <StatCard title="Answer Gen Calls (Total)" value={statsData.apiCalls?.totalGeminiAnswerGenerationCalls ?? 0} icon={Edit} description="Success + Error (incl. Summaries)" colorClass="bg-lime-600" />
        <StatCard title="Answer Gen (Success)" value={statsData.apiCalls?.geminiAnswerGenerationSuccess ?? 0} icon={CheckCircle} description="Successful calls" colorClass="bg-lime-500" />
        <StatCard title="Answer Gen (Error)" value={statsData.apiCalls?.geminiAnswerGenerationError ?? 0} icon={AlertCircle} description="Failed calls" colorClass="bg-red-500" />
        <StatCard title="Answer Gen (Est. Cost)" value={`$${statsData.apiCalls?.estimatedAnswerGenCost?.toFixed(2) ?? '0.00'}`} icon={DollarSign} description="Approx. cost" colorClass="bg-orange-400" />
        
        {/* --- Reranking --- */}
        <StatCard title="Reranking Calls (Total)" value={statsData.apiCalls?.totalGeminiRerankingCalls ?? 0} icon={Filter} description="Success + Error" colorClass="bg-fuchsia-600" />
        <StatCard title="Reranking Calls (Success)" value={statsData.apiCalls?.geminiRerankingSuccess ?? 0} icon={CheckCircle} description="Successful calls" colorClass="bg-fuchsia-500" />
        <StatCard title="Reranking Calls (Error)" value={statsData.apiCalls?.geminiRerankingError ?? 0} icon={AlertCircle} description="Failed calls" colorClass="bg-red-500" />
        <StatCard title="Reranking Calls (Est. Cost)" value={`$${statsData.apiCalls?.estimatedRerankCost?.toFixed(2) ?? '0.00'}`} icon={DollarSign} description="Approx. cost" colorClass="bg-orange-400" />

                      </div>
      <p className="text-xs text-gray-500 mt-4 text-center">Note: API costs are estimates based on call counts and may not reflect exact billing.</p>
    </div>
  );
};

// Replace with a simple implementation:
// Define interfaces for Content Performance tab
interface ContentItem {
  id: string;
  text: string;
  source: string;
  retrievalCount: number;
  feedbackScore: number;
}

interface ContentStatsData {
  topContent: ContentItem[];
  totalRetrievals: number;
  avgFeedbackScore: number;
}

const ContentPerformanceTab = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [contentData, setContentData] = useState<ContentStatsData | null>(null);

  // Mock data for development
  const mockContentData: ContentStatsData = {
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Content Performance</h2>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {/* Stats cards */}
      {contentData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-700">Total Retrievals</h3>
              <div className="p-2 rounded-md bg-blue-700">
                <Search className="h-5 w-5 text-white" />
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
                <Activity className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{(contentData.avgFeedbackScore * 100).toFixed(0)}%</span>
              <span className="text-xs text-gray-500 mt-1">Average content feedback score</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Content Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-600">Loading content performance data...</span>
          </div>
        </div>
      ) : contentData ? (
        <div className="bg-white p-6 rounded-lg shadow-sm">
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
                {contentData.topContent.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.text}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.source}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.retrievalCount}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`text-sm ${item.feedbackScore > 0.7 ? 'text-green-600' : item.feedbackScore < 0.5 ? 'text-red-500' : 'text-yellow-500'}`}>
                        {(item.feedbackScore * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">No content performance data available</div>
      )}
      
      {/* Note about data source */}
      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>Note: Currently displaying mock data for development purposes.</p>
        <p>Integration with the content analytics API will be implemented once the backend infrastructure is ready.</p>
      </div>
    </div>
  );
};

// --- NEW CONSOLIDATED INSIGHTS TAB COMPONENT (Skeleton) ---

// Define interfaces for the new Consolidated Insights data structures
interface ConsolidatedQueryStats {
  totalQueries: number;
  avgQueryLength: number;
  avgResponseTime: number;
  noResultRate: number;
  avgFeedbackScore?: number; // Optional: Add later
}

interface TopicInsight {
  topic: string; // Could be raw query text, keyword, or extracted topic
  count: number;
  sessionTypes: { company: number; general: number }; // Breakdown by session type
  avgResponseTime?: number;
  feedback?: { positive: number; negative: number };
  noResultCount?: number;
  lastOccurrence: string;
}

interface ProductMentionInsight {
  productName: string;
  mentionCount: number;
  relatedQueries?: string[]; // Top queries mentioning this product
}

interface ConsolidatedInsightsData {
  stats: ConsolidatedQueryStats;
  topTopics: TopicInsight[];
  noResultTopics: TopicInsight[];
  negativeFeedbackTopics: TopicInsight[];
  productMentions?: ProductMentionInsight[]; // Optional: Add later
}

const InsightsTab = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [insightsData, setInsightsData] = useState<ConsolidatedInsightsData | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'all' | 'company' | 'general'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const fetchInsightsData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Construct API URL with filters
        const params = new URLSearchParams({
          timeRange,
          sessionType: sessionTypeFilter,
          // search: searchTerm // Add search later if needed
        });
        const apiUrl = `/api/admin/consolidated-insights?${params.toString()}`;
        console.log(`[InsightsTab] Fetching data from: ${apiUrl}`);

        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch insights data (Status: ${response.status})`);
        }
        const data: ConsolidatedInsightsData = await response.json();
        setInsightsData(data);
        console.log("[InsightsTab] Data fetched successfully:", data);
      } catch (error: any) { // Catch any type
        console.error("[InsightsTab] Error fetching insights:", error);
        setError(error.message || 'Failed to load insights. Please try again later.');
        setInsightsData(null); // Clear data on error
      } finally {
        setLoading(false);
      }
    };

    fetchInsightsData();
  }, [timeRange, sessionTypeFilter]); // Refetch when filters change

  // Helper function to format date (can be moved outside if reused)
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString || 'Invalid Date';
      return date.toLocaleString(undefined, { /* Desired format options */ });
    } catch (error) {
      return dateString || 'Format Error';
    }
  };

  // --- UI Rendering --- (Placeholder structure)
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Chat Insights</h2>
        {/* Add Filter Controls (Time Range, Session Type) */}
        <div className="flex items-center space-x-4">
          {/* Session Type Filter */}
          <select
            value={sessionTypeFilter}
            onChange={(e) => setSessionTypeFilter(e.target.value as any)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="all">All Sessions</option>
            <option value="company">Company Sessions</option>
            <option value="general">General Sessions</option>
          </select>

          {/* Time Range Filter */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
            <option value="all">All Time</option>
          </select>
            </div>
          </div>
          
      {loading && <div className="text-center p-10">Loading insights...</div>}
      {error && <div className="text-center p-10 text-red-600">Error: {error}</div>}
      
      {!loading && !error && !insightsData && <div className="text-center p-10">No insights data available for the selected filters.</div>}

      {insightsData && (
        <>
          {/* Section 1: Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Example Stat Card */}
            <div className="bg-white p-4 rounded shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Total Queries</h3>
              <p className="text-2xl font-bold">{insightsData.stats.totalQueries?.toLocaleString() ?? 'N/A'}</p>
              </div>
            <div className="bg-white p-4 rounded shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Avg. Response Time</h3>
              <p className="text-2xl font-bold">{insightsData.stats.avgResponseTime?.toFixed(2) ?? 'N/A'}s</p>
            </div>
            <div className="bg-white p-4 rounded shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-1">No Result Rate</h3>
              <p className="text-2xl font-bold">{insightsData.stats.noResultRate?.toFixed(1) ?? 'N/A'}%</p>
            </div>
            {/* Add Avg Feedback Score card later */}
          </div>

          {/* Section 2: Top Topics/Queries */}
          <div className="bg-white p-4 rounded shadow border border-gray-100">
            <h3 className="text-lg font-semibold mb-3">Top Topics/Queries</h3>
            {/* Placeholder for Top Topics Table */}
            <div className="overflow-x-auto">
              {insightsData.topTopics && insightsData.topTopics.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                  {/* Table Header */}
                  <thead className="bg-gray-50"><tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Topic/Query</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Count</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company/General</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Occurrence</th>
                  </tr></thead>
                  {/* Table Body */}
                <tbody className="bg-white divide-y divide-gray-200">
                    {insightsData.topTopics.slice(0, 10).map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate" title={item.topic}>{item.topic}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{item.count}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{item.sessionTypes.company} / {item.sessionTypes.general}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{formatDate(item.lastOccurrence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              ) : (
                <p className="text-sm text-gray-500">No top topics found for these filters.</p>
              )}
            </div>
          </div>
          
          {/* Section 3: Topics with Issues (No Results / Negative Feedback) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow border border-gray-100">
              <h3 className="text-lg font-semibold mb-3">Queries with No Results</h3>
              {/* Placeholder for No Results Table */}
               {insightsData.noResultTopics && insightsData.noResultTopics.length > 0 ? (
                 <ul>{insightsData.noResultTopics.slice(0,5).map((item, i)=><li key={i} className="text-sm text-gray-700 py-1">{item.topic} ({item.count})</li>)}</ul>
               ) : <p className="text-sm text-gray-500">No queries found with no results.</p>}
            </div>
            <div className="bg-white p-4 rounded shadow border border-gray-100">
              <h3 className="text-lg font-semibold mb-3">Queries with Negative Feedback</h3>
              {/* Placeholder for Negative Feedback Table */}
              {insightsData.negativeFeedbackTopics && insightsData.negativeFeedbackTopics.length > 0 ? (
                <ul>{insightsData.negativeFeedbackTopics.slice(0,5).map((item, i)=><li key={i} className="text-sm text-gray-700 py-1">{item.topic} ({item.count})</li>)}</ul>
              ) : <p className="text-sm text-gray-500">No queries found with negative feedback.</p>}
          </div>
        </div>

          {/* Section 4: Product/Feature Mentions (Add Later) */}
          {/* <div className="bg-white p-4 rounded shadow border border-gray-100">
            <h3 className="text-lg font-semibold mb-3">Product/Feature Mentions</h3>
            <p className="text-sm text-gray-500">[Product mention analysis will be added here]</p>
          </div> */}
        </>
      )}
    </div>
  );
};

export default function Admin({ logs }: AdminProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTabId>('insights');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSessionDetailed | null>(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generalSessions, setGeneralSessions] = useState<ChatSession[]>([]);
  const [selectedGeneralSession, setSelectedGeneralSession] = useState<ChatSessionDetailed | null>(null);
  const [generalContentSearchQuery, setGeneralContentSearchQuery] = useState('');
  const [generalLoading, setGeneralLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const router = useRouter();
  
  const filteredLogs = logs.filter(log => 
    log.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.response.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
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
    } else if (activeTab === 'generalSessions') {
      fetchGeneralSessions();
    } else if (activeTab === 'pendingDocuments') {
      // Fetch pending docs data if needed - PendingDocuments component might handle its own fetching
    } else if (activeTab === 'documentManagement') {
      // Fetch document manager data if needed - DocumentManager component might handle its own fetching
    }
    // Add conditions for fetching data for new tabs later

  }, [activeTab]);

  // Fetch GENERAL chat sessions (function fixed - duplicate removed)
  const fetchGeneralSessions = async (query?: string, byContent: boolean = false) => {
    setGeneralLoading(true);
    setGeneralError(null);
    try {
      let url = '/api/admin/chat-sessions?type=general';
      if (query) {
        url += `&${byContent ? 'content=' : 'search='}${encodeURIComponent(query)}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      const data = await response.json();
      setGeneralSessions(data.sessions || []);
    } catch (err: any) {
      console.error('Error fetching general chat sessions:', err);
      setGeneralError(`Failed to load general chat sessions: ${err.message}`);
    } finally {
      setGeneralLoading(false);
    }
  };

  // Fetch COMPANY chat sessions
  const fetchSessions = async (query?: string) => {
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
    } catch (err) {
      console.error('Error fetching company sessions:', err);
      setError('Failed to load company chat sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch GENERAL session details
  const fetchGeneralSessionDetails = async (sessionId: string) => {
    setGeneralLoading(true);
    try {
      const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
      if (!response.ok) throw new Error(`Failed to fetch session details: ${response.statusText}`);
      const data = await response.json();
      if (data.messages && Array.isArray(data.messages)) {
        data.messages.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
      setSelectedGeneralSession(data);
    } catch (err: any) {
      console.error('Error fetching general session details:', err);
      setGeneralError(`Failed to load session details: ${err.message}`);
    } finally {
      setGeneralLoading(false);
    }
  };

  // Fetch COMPANY session details
  const fetchSessionDetails = async (sessionId: string) => {
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
        data.messages.sort((a: any, b: any) => {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
      }
      
      setSelectedSession(data);
    } catch (err) {
      console.error('Error fetching session details:', err);
      setError('Failed to load session details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format session ID for display
  const formatSessionId = (id: string) => {
    // Return last 8 characters of ID for display
    return id.length > 8 ? '...' + id.substring(id.length - 8) : id;
  };

  // Add a ref for chat containers
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const companyMessagesRef = useRef<HTMLDivElement>(null);

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
      case 'systemStatus': 
        return <SystemStatusTab />;
      case 'insights':
        return <InsightsTab />;
      case 'contentPerformance':
        return <ContentPerformanceTab />;
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
        return <InsightsTab />;
    }
  };

  // --- JSX for General Sessions Tab ---
  const renderGeneralSessions = () => (
    <div className="flex h-full">
      {/* Session List */} 
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-4 bg-white">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">General Chat Sessions</h2>
        <form onSubmit={handleGeneralSessionContentSearch} className="mb-4">
          <div className="relative">
            <input 
              type="text"
              value={generalContentSearchQuery}
              onChange={(e) => setGeneralContentSearchQuery(e.target.value)}
              placeholder="Search message content..."
              className="w-full p-2 pl-8 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-700"
            />
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={18}/>
          </div>
          <button type="submit" className="mt-2 w-full bg-blue-700 hover:bg-blue-800 text-white py-1 px-3 rounded text-sm">Search Content</button>
        </form>
        {generalLoading && <p>Loading sessions...</p>}
        {generalError && <p className="text-red-500">{generalError}</p>}
        <ul className="space-y-2">
          {generalSessions.map(session => (
            <li 
              key={session.id}
              onClick={() => fetchGeneralSessionDetails(session.id)}
              className={`p-2 rounded cursor-pointer ${selectedGeneralSession?.id === session.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
            >
              <p className="font-medium truncate text-gray-800">{session.title || `Session ${formatSessionId(session.id)}`}</p>
              <p className="text-xs text-gray-500">Updated: {formatDate(session.updatedAt)}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Session Details */} 
      <div className="w-2/3 overflow-y-auto p-4 bg-white">
        {selectedGeneralSession ? (
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900">{selectedGeneralSession.title || `Session ${formatSessionId(selectedGeneralSession.id)}`}</h3>
            <p className="text-sm text-gray-500 mb-4">Created: {formatDate(selectedGeneralSession.createdAt)} | Last Updated: {formatDate(selectedGeneralSession.updatedAt)}</p>
            <div 
              ref={chatMessagesRef} 
              className="h-[calc(100vh-250px)] overflow-y-auto bg-gray-50 p-4 rounded space-y-3 border border-gray-200"
            >
              {selectedGeneralSession.messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-700 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'}`}>
                    <p className="text-xs font-semibold mb-1 capitalize">{msg.role}</p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 text-right ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>{formatDate(msg.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a general session to view details.
          </div>
        )}
      </div>
    </div>
  );

  // --- JSX for Company Sessions Tab ---
  const renderCompanySessions = () => (
    <div className="flex h-full">
      {/* Session List */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-4 bg-white">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Company Chat Sessions</h2>
        <form onSubmit={handleSessionSearch} className="mb-4">
          <div className="relative">
            <input 
              type="text"
              value={sessionSearchQuery}
              onChange={(e) => setSessionSearchQuery(e.target.value)}
              placeholder="Search company or title..."
              className="w-full p-2 pl-8 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-700"
            />
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={18}/>
          </div>
          <button type="submit" className="mt-2 w-full bg-blue-700 hover:bg-blue-800 text-white py-1 px-3 rounded text-sm">Search Sessions</button>
        </form>
        {loading && <p>Loading sessions...</p>}
        {error && <p className="text-red-500">{error}</p>}
        <ul className="space-y-2">
          {sessions.map(session => (
            <li 
              key={session.id}
              onClick={() => fetchSessionDetails(session.id)}
              className={`p-2 rounded cursor-pointer ${selectedSession?.id === session.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
            >
              <p className="font-medium truncate text-gray-800">{session.companyName}</p>
              <p className="text-xs text-gray-500">Updated: {formatDate(session.updatedAt)}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Session Details */}
      <div className="w-2/3 overflow-y-auto p-4 bg-white">
        {selectedSession ? (
          <div>
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
            
            <div 
              ref={companyMessagesRef} 
              className="h-[calc(100vh-350px)] overflow-y-auto bg-gray-50 p-4 rounded space-y-3 border border-gray-200"
            >
              {selectedSession.messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-700 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'}`}>
                    <p className="text-xs font-semibold mb-1 capitalize">{msg.role}</p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 text-right ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>{formatDate(msg.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a company session to view details.
          </div>
        )}
      </div>
    </div>
  );

  // --- Event Handlers (Refactored) ---
  const handleSessionSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSessions(sessionSearchQuery);
  };

  const handleGeneralSessionContentSearch = (e: React.FormEvent) => {
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
        setActiveTab(tab as AdminTabId);
      }
    }
  }, [router.query]);

  return (
    <AdminLayout title="Admin Dashboard">
      <Head>
        <title>Admin Dashboard</title>
      </Head>
      <div className="p-6 bg-white text-gray-800 min-h-screen">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900">Admin Dashboard</h1>
        
        {/* Tab Navigation (This will automatically reflect the new order from adminTabs) */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-colors duration-150 ease-in-out 
                  ${activeTab === tab.id
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <tab.icon className="mr-2 h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {renderTabContent()}
        </div>
      </div>
    </AdminLayout>
  );
} 