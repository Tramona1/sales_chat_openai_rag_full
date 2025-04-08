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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerSideProps = void 0;
exports.default = Admin;
const react_1 = __importStar(require("react"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Layout_1 = __importDefault(require("../components/Layout"));
const lucide_react_1 = require("lucide-react");
const SystemMetrics_1 = __importDefault(require("../components/SystemMetrics"));
const DocumentManager_1 = __importDefault(require("../components/DocumentManager"));
const PendingDocuments_1 = __importDefault(require("../components/admin/PendingDocuments"));
const router_1 = require("next/router");
const getServerSideProps = async () => {
    const logPath = path_1.default.join(process.cwd(), 'feedback.json');
    let logs = [];
    if (fs_1.default.existsSync(logPath)) {
        try {
            logs = JSON.parse(fs_1.default.readFileSync(logPath, 'utf8'));
            // Sort logs by timestamp, newest first
            logs.sort((a, b) => b.timestamp - a.timestamp);
        }
        catch (error) {
            console.error('Error parsing logs:', error);
        }
    }
    return { props: { logs } };
};
exports.getServerSideProps = getServerSideProps;
function Admin({ logs }) {
    const [searchTerm, setSearchTerm] = (0, react_1.useState)('');
    const [activeTab, setActiveTab] = (0, react_1.useState)('metrics');
    const [sessions, setSessions] = (0, react_1.useState)([]);
    const [selectedSession, setSelectedSession] = (0, react_1.useState)(null);
    const [sessionSearchQuery, setSessionSearchQuery] = (0, react_1.useState)('');
    const [contentSearchQuery, setContentSearchQuery] = (0, react_1.useState)('');
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [generalSessions, setGeneralSessions] = (0, react_1.useState)([]);
    const [selectedGeneralSession, setSelectedGeneralSession] = (0, react_1.useState)(null);
    const router = (0, router_1.useRouter)();
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
    // Fetch general chat sessions when the chatSessions tab is active
    (0, react_1.useEffect)(() => {
        if (activeTab === 'chatSessions') {
            fetchGeneralSessions();
        }
        else if (activeTab === 'companySessions') {
            fetchSessions();
        }
    }, [activeTab]);
    // Fetch sessions from API
    const fetchGeneralSessions = async (query, byContent = false) => {
        setLoading(true);
        setError(null);
        try {
            let url = '/api/admin/chat-sessions?type=general';
            if (query) {
                url += `&${byContent ? 'content=' : 'search='}${encodeURIComponent(query)}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch sessions: ${response.statusText}`);
            }
            const data = await response.json();
            setGeneralSessions(data.sessions || []);
        }
        catch (err) {
            console.error('Error fetching general chat sessions:', err);
            setError('Failed to load general chat sessions. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    // Fetch company sessions
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
    // Handle search for general chat sessions
    const handleGeneralSessionSearch = (e) => {
        e.preventDefault();
        fetchGeneralSessions(contentSearchQuery, true);
    };
    // Handle search for company chat sessions
    const handleSessionSearch = (e) => {
        e.preventDefault();
        fetchSessions(sessionSearchQuery);
    };
    // Fetch general session details
    const fetchGeneralSessionDetails = async (sessionId) => {
        var _a;
        try {
            setLoading(true);
            console.log(`Fetching details for general session: ${sessionId}`);
            const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch session details: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`Loaded session with ${((_a = data.messages) === null || _a === void 0 ? void 0 : _a.length) || 0} messages`);
            // Ensure messages are sorted by timestamp
            if (data.messages && Array.isArray(data.messages)) {
                data.messages.sort((a, b) => {
                    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                });
            }
            setSelectedGeneralSession(data);
        }
        catch (err) {
            console.error('Error fetching session details:', err);
            setError('Failed to load session details. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    // Fetch company session details
    const fetchSessionDetails = async (sessionId) => {
        var _a;
        try {
            setLoading(true);
            console.log(`Fetching details for company session: ${sessionId}`);
            const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch session details: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`Loaded session with ${((_a = data.messages) === null || _a === void 0 ? void 0 : _a.length) || 0} messages`);
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
    const chatMessagesRef = (0, react_1.useRef)(null);
    const companyMessagesRef = (0, react_1.useRef)(null);
    // Scroll to bottom of chat messages when a session is selected
    (0, react_1.useEffect)(() => {
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
    (0, react_1.useEffect)(() => {
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
    return (<Layout_1.default title="Admin Dashboard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold mb-6 text-primary-900">Admin Dashboard</h1>
        
        {/* Navigation tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            <button onClick={() => setActiveTab('metrics')} className={`${activeTab === 'metrics'
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}>
              <lucide_react_1.Layers className="h-5 w-5 mr-2"/>
              System Metrics
            </button>
            <button onClick={() => setActiveTab('documents')} className={`${activeTab === 'documents'
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}>
              <lucide_react_1.MessageSquare className="h-5 w-5 mr-2"/>
              Document Management
            </button>
            <button onClick={() => setActiveTab('chatSessions')} className={`${activeTab === 'chatSessions'
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}>
              <lucide_react_1.User className="h-5 w-5 mr-2"/>
              Chat Sessions
            </button>
            <button onClick={() => setActiveTab('companySessions')} className={`${activeTab === 'companySessions'
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}>
              <lucide_react_1.MessageSquare className="h-5 w-5 mr-2"/>
              Company Sessions
            </button>
            <button onClick={() => setActiveTab('pendingDocuments')} className={`${activeTab === 'pendingDocuments'
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}>
              <lucide_react_1.FileText className="h-5 w-5 mr-2"/>
              Pending Documents
            </button>
          </nav>
        </div>
        
        {/* Tab content */}
        <div>
          {activeTab === 'metrics' && (<SystemMetrics_1.default refreshInterval={30000}/>)}
          
          {activeTab === 'documents' && (<DocumentManager_1.default limit={100}/>)}
          
          {activeTab === 'pendingDocuments' && (<PendingDocuments_1.default />)}
          
          {activeTab === 'chatSessions' && (<div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-x divide-gray-200">
                {/* Sessions List */}
                <div className="md:col-span-1 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Chat Sessions</h2>
                    <button onClick={() => router.push('/chat')} className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition-colors">
                      New Session
                    </button>
                  </div>
                  
                  {/* Search Form */}
                  <form onSubmit={handleGeneralSessionSearch} className="mb-4">
                    <div className="flex">
                      <input type="text" value={contentSearchQuery} onChange={(e) => setContentSearchQuery(e.target.value)} placeholder="Search by content or keywords..." className="flex-grow p-2 border border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"/>
                      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 transition-colors">
                        Search
                      </button>
                    </div>
                  </form>
                  
                  {/* Error Message */}
                  {error && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                      {error}
                    </div>)}
                  
                  {/* Loading State */}
                  {loading ? (<div className="flex justify-center my-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                    </div>) : (<>
                      {/* Sessions List */}
                      {generalSessions.length === 0 ? (<p className="text-gray-500 italic">No chat sessions found.</p>) : (<div className="overflow-y-auto max-h-[500px]">
                          <ul className="divide-y divide-gray-200">
                            {generalSessions.map((session) => (<li key={session.id} className="py-3">
                                <button onClick={() => fetchGeneralSessionDetails(session.id)} className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                                  <div className="flex justify-between">
                                    <p className="font-medium text-gray-900 truncate">{session.title || 'Untitled Session'}</p>
                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-700 whitespace-nowrap ml-2">
                                      ID: {formatSessionId(session.id)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-1">{formatDate(session.updatedAt)}</p>
                                </button>
                              </li>))}
                          </ul>
                        </div>)}
                    </>)}
                </div>
                
                {/* Session Details */}
                <div className="md:col-span-2 p-4 bg-gray-50">
                  {selectedGeneralSession ? (<div className="h-full flex flex-col">
                      <div className="border-b border-gray-200 pb-4 mb-4">
                        <div className="flex justify-between items-start">
                          <h2 className="text-xl font-semibold">{selectedGeneralSession.title || 'Untitled Session'}</h2>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-700">
                              ID: {formatSessionId(selectedGeneralSession.id)}
                            </span>
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-700">
                              {formatDate(selectedGeneralSession.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Chat Messages */}
                      <div ref={chatMessagesRef} className="flex-grow overflow-y-auto mb-4 space-y-4 p-4 max-h-[60vh] h-[500px] bg-gray-50 rounded border border-gray-200">
                        {selectedGeneralSession.messages.length === 0 ? (<div className="text-center py-8 text-gray-500">
                            No messages in this session.
                          </div>) : (selectedGeneralSession.messages.map((msg, idx) => (<div key={idx} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                              <div className={`rounded-lg p-4 max-w-[85%] shadow-sm ${msg.role === 'assistant'
                        ? 'bg-blue-100 text-blue-900 border-blue-200 border'
                        : 'bg-gray-200 text-gray-900 border-gray-300 border'}`}>
                                <div className="whitespace-pre-wrap text-sm mb-2">{msg.content}</div>
                                <div className="text-xs text-gray-500 text-right mt-1 flex justify-between items-center">
                                  <span className={`${msg.role === 'assistant' ? 'text-blue-600' : 'text-gray-600'} font-medium`}>
                                    {msg.role === 'assistant' ? 'Assistant' : 'User'}
                                  </span>
                                  <span>{new Date(msg.timestamp).toLocaleTimeString()} {new Date(msg.timestamp).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>)))}
                      </div>
                    </div>) : (<div className="flex justify-center items-center h-full">
                      <p className="text-gray-500 italic">Select a session to view details</p>
                    </div>)}
                </div>
              </div>
            </div>)}
          
          {activeTab === 'companySessions' && (<div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-x divide-gray-200">
                {/* Company Sessions List */}
                <div className="md:col-span-1 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Company Sessions</h2>
                    <button onClick={() => router.push('/company-chat')} className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition-colors">
                      New Session
                    </button>
                  </div>
                  
                  {/* Search Form */}
                  <form onSubmit={handleSessionSearch} className="mb-4">
                    <div className="flex">
                      <input type="text" value={sessionSearchQuery} onChange={(e) => setSessionSearchQuery(e.target.value)} placeholder="Search by company name..." className="flex-grow p-2 border border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"/>
                      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 transition-colors">
                        Search
                      </button>
                    </div>
                  </form>
                  
                  {/* Error Message */}
                  {error && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                      {error}
                    </div>)}
                  
                  {/* Loading State */}
                  {loading ? (<div className="flex justify-center my-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                    </div>) : (<>
                      {/* Sessions List */}
                      {sessions.length === 0 ? (<p className="text-gray-500 italic">No company sessions found.</p>) : (<div className="overflow-y-auto max-h-[500px]">
                          <ul className="divide-y divide-gray-200">
                            {sessions.map((session) => (<li key={session.id} className="py-3">
                                <button onClick={() => fetchSessionDetails(session.id)} className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                                  <div className="flex justify-between">
                                    <p className="font-medium text-gray-900 truncate">{session.companyName}</p>
                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-700 whitespace-nowrap ml-2">
                                      ID: {formatSessionId(session.id)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-1">{formatDate(session.updatedAt)}</p>
                                </button>
                              </li>))}
                          </ul>
                        </div>)}
                    </>)}
                </div>
                
                {/* Company Session Details */}
                <div className="md:col-span-2 p-4 bg-gray-50">
                  {selectedSession ? (<div className="h-full flex flex-col">
                      <div className="border-b border-gray-200 pb-4 mb-4">
                        <div className="flex justify-between items-start">
                          <h2 className="text-xl font-semibold">{selectedSession.companyName}</h2>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-700">
                              ID: {formatSessionId(selectedSession.id)}
                            </span>
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-700">
                              {formatDate(selectedSession.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Company Info */}
                      <div className="mb-4 bg-white p-3 rounded-lg border border-gray-200">
                        <h3 className="font-medium mb-2">Company Information</h3>
                        <div className="text-sm text-gray-700">
                          {selectedSession.companyInfo ? (<div>
                              {selectedSession.companyInfo.description && (<p className="mb-2">{selectedSession.companyInfo.description}</p>)}
                              
                              {selectedSession.companyInfo.industry && (<p><span className="font-medium">Industry:</span> {selectedSession.companyInfo.industry}</p>)}
                              
                              {selectedSession.companyInfo.size && (<p><span className="font-medium">Size:</span> {selectedSession.companyInfo.size}</p>)}
                              
                              {selectedSession.companyInfo.location && (<p><span className="font-medium">Location:</span> {selectedSession.companyInfo.location}</p>)}
                            </div>) : (<p className="italic text-gray-500">No company information available.</p>)}
                        </div>
                      </div>
                      
                      {/* Sales Notes */}
                      {selectedSession.salesNotes && (<div className="mb-4 bg-white p-3 rounded-lg border border-gray-200">
                          <h3 className="font-medium mb-2">Sales Notes</h3>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {selectedSession.salesNotes}
                          </div>
                        </div>)}
                      
                      {/* Chat Messages */}
                      <div ref={companyMessagesRef} className="flex-grow overflow-y-auto mb-4 space-y-4 p-4 max-h-[60vh] h-[500px] bg-gray-50 rounded border border-gray-200">
                        {selectedSession.messages.length === 0 ? (<div className="text-center py-8 text-gray-500">
                            No messages in this session.
                          </div>) : (selectedSession.messages.map((msg, idx) => (<div key={idx} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                              <div className={`rounded-lg p-4 max-w-[85%] shadow-sm ${msg.role === 'assistant'
                        ? 'bg-blue-100 text-blue-900 border-blue-200 border'
                        : 'bg-gray-200 text-gray-900 border-gray-300 border'}`}>
                                <div className="whitespace-pre-wrap text-sm mb-2">{msg.content}</div>
                                <div className="text-xs text-gray-500 text-right mt-1 flex justify-between items-center">
                                  <span className={`${msg.role === 'assistant' ? 'text-blue-600' : 'text-gray-600'} font-medium`}>
                                    {msg.role === 'assistant' ? 'Assistant' : 'User'}
                                  </span>
                                  <span>{new Date(msg.timestamp).toLocaleTimeString()} {new Date(msg.timestamp).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>)))}
                      </div>
                    </div>) : (<div className="flex justify-center items-center h-full">
                      <p className="text-gray-500 italic">Select a company session to view details</p>
                    </div>)}
                </div>
              </div>
            </div>)}
        </div>
      </div>
    </Layout_1.default>);
}
