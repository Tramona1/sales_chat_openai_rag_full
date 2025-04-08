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
exports.default = ChatPage;
const react_1 = __importStar(require("react"));
const router_1 = require("next/router");
const axios_1 = __importDefault(require("axios"));
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const ChatMessage_1 = __importDefault(require("@/components/ChatMessage"));
const chatStorage_1 = require("@/utils/chatStorage");
function ChatPage() {
    const router = (0, router_1.useRouter)();
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [input, setInput] = (0, react_1.useState)('');
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [sessionId, setSessionId] = (0, react_1.useState)(null);
    const endOfMessagesRef = (0, react_1.useRef)(null);
    const textareaRef = (0, react_1.useRef)(null);
    // Initialize with welcome message and handle URL parameters
    (0, react_1.useEffect)(() => {
        // Check if router is ready and has query parameters
        if (!router.isReady)
            return;
        const { question, autoResponse, session } = router.query;
        // If a session ID is provided, try to load that session
        if (session && typeof session === 'string') {
            loadChatSession(session);
            return;
        }
        // Handle initial state with welcome message
        if (messages.length === 0) {
            // Initialize with welcome message
            const initialMessages = [{
                    id: '0',
                    role: 'bot',
                    content: 'Welcome to the Workstream Knowledge Assistant! Ask questions about our HR, Payroll, and Hiring platform for the hourly workforce.',
                    timestamp: new Date()
                }];
            // If we have a question parameter, also add the user question
            if (question && typeof question === 'string') {
                initialMessages.push({
                    id: '1',
                    role: 'user',
                    content: question,
                    timestamp: new Date()
                });
                // Set all messages at once
                setMessages(initialMessages);
                // If autoResponse is true, simulate loading and trigger the AI response
                if (autoResponse === 'true') {
                    setIsLoading(true);
                    // Slight delay to simulate AI thinking
                    setTimeout(() => {
                        // Process the message to get AI response
                        processMessageForResponse(question, initialMessages);
                    }, 800);
                }
                else {
                    // Process immediately without showing loading state first
                    processMessageForResponse(question, initialMessages);
                }
            }
            else {
                // Just set welcome message if no question
                setMessages(initialMessages);
            }
        }
    }, [router.isReady]); // Only run this effect when router is ready
    // Function to load a chat session
    const loadChatSession = async (sessionId) => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
            if (!response.ok) {
                throw new Error('Failed to load chat session');
            }
            const sessionData = await response.json();
            // Convert the stored messages to the local Message format
            const loadedMessages = sessionData.messages.map((msg) => ({
                id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                role: msg.role === 'user' ? 'user' : 'bot',
                content: msg.content,
                timestamp: new Date(msg.timestamp)
            }));
            setMessages(loadedMessages);
            setSessionId(sessionId);
        }
        catch (error) {
            console.error('Error loading chat session:', error);
            // Start a new session with welcome message
            setMessages([{
                    id: '0',
                    role: 'bot',
                    content: 'Welcome to the Workstream Knowledge Assistant! Ask questions about our HR, Payroll, and Hiring platform for the hourly workforce.',
                    timestamp: new Date()
                }]);
        }
        finally {
            setIsLoading(false);
        }
    };
    // Function to save the current chat session
    const saveChatSession = async () => {
        if (messages.length <= 1)
            return; // Don't save if we only have the welcome message
        try {
            // Convert our messages to the format expected by the API
            const storedMessages = messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
                timestamp: msg.timestamp.toISOString()
            }));
            // Get keywords and generate a title
            const keywords = (0, chatStorage_1.extractKeywords)(storedMessages);
            const title = (0, chatStorage_1.generateSessionTitle)(storedMessages);
            const response = await fetch('/api/admin/chat-sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionType: 'general',
                    title,
                    messages: storedMessages,
                    keywords,
                }),
            });
            const data = await response.json();
            if (data.sessionId) {
                setSessionId(data.sessionId);
                console.log(`Chat session saved with ID: ${data.sessionId}`);
            }
        }
        catch (error) {
            console.error('Failed to save chat session:', error);
        }
    };
    // Update existing session
    const updateChatSession = async () => {
        if (!sessionId || messages.length <= 1)
            return;
        try {
            // Convert our messages to the format expected by the API
            const storedMessages = messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
                timestamp: msg.timestamp.toISOString()
            }));
            // Get keywords and generate a title
            const keywords = (0, chatStorage_1.extractKeywords)(storedMessages);
            const title = (0, chatStorage_1.generateSessionTitle)(storedMessages);
            await fetch(`/api/admin/chat-sessions/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionType: 'general',
                    title,
                    messages: storedMessages,
                    keywords,
                }),
            });
        }
        catch (error) {
            console.error('Failed to update chat session:', error);
        }
    };
    // Save session when messages change
    (0, react_1.useEffect)(() => {
        // Skip if no messages or only welcome message
        if (messages.length <= 1)
            return;
        // Debounce the save operation to avoid excessive API calls
        const saveTimeout = setTimeout(() => {
            if (sessionId) {
                // Update existing session
                updateChatSession();
            }
            else {
                // Create new session
                saveChatSession();
            }
        }, 2000);
        return () => clearTimeout(saveTimeout);
    }, [messages, sessionId]);
    // Helper function to detect company-specific queries
    const isCompanySpecificQuery = (query) => {
        const companyTerms = [
            'workstream', 'company', 'our', 'we', 'us', 'client', 'customer',
            'product', 'service', 'price', 'pricing', 'feature', 'offering', 'team'
        ];
        const lowerQuery = query.toLowerCase();
        return companyTerms.some(term => lowerQuery.includes(term));
    };
    // Helper function to process a message and get AI response
    const processMessageForResponse = async (messageText, currentMessages) => {
        try {
            setIsLoading(true);
            // Create context from recent messages
            const recentMessages = currentMessages
                .slice(-5)
                .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                .join('\n');
            // Determine if this is a company-specific query
            const isCompanyQuery = isCompanySpecificQuery(messageText);
            // Set options for the API call
            const options = isCompanyQuery ? {
                // Use lower hybrid ratio for company queries to favor BM25 term matching
                hybridRatio: 0.3,
                // Increase search results limit for company queries
                limit: 5
            } : {};
            // Call API with the message
            const response = await axios_1.default.post('/api/query', {
                query: messageText,
                context: recentMessages,
                options: options
            });
            // Generate a unique ID for the message
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // Log conversation for admin review and feedback tracking
            await axios_1.default.post('/api/log', {
                user: 'Anonymous',
                query: messageText,
                response: response.data.answer,
                isCompanyQuery: isCompanyQuery,
                sessionId: sessionId,
                messageId: messageId,
            });
            // Add bot response
            setMessages([
                ...currentMessages,
                {
                    id: messageId,
                    role: 'bot',
                    content: response.data.answer,
                    timestamp: new Date()
                }
            ]);
        }
        catch (error) {
            console.error('Error getting response:', error);
            // Add error message
            setMessages([
                ...currentMessages,
                {
                    id: Date.now().toString(),
                    role: 'bot',
                    content: 'Sorry, I encountered an error while processing your request. Please try again.',
                    timestamp: new Date()
                }
            ]);
        }
        finally {
            setIsLoading(false);
        }
    };
    // Send message and get response
    const handleSendMessage = async (overrideInput) => {
        const messageText = overrideInput || input;
        if (!messageText.trim() || isLoading)
            return;
        // Check if this message is already in the list (to avoid duplication)
        const messageExists = messages.some(msg => msg.role === 'user' && msg.content === messageText);
        // Only add user message if it doesn't already exist
        let updatedMessages = [...messages];
        if (!messageExists) {
            // Add user message
            const userMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: messageText,
                timestamp: new Date()
            };
            updatedMessages = [...messages, userMessage];
            setMessages(updatedMessages);
        }
        setInput('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        // Process message to get response
        await processMessageForResponse(messageText, updatedMessages);
    };
    // Handle feedback on assistant messages
    const handleFeedback = async (messageIndex, feedbackType) => {
        const message = messages[messageIndex];
        if (message.role !== 'bot')
            return;
        // Update UI immediately
        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = {
            ...message,
            feedback: feedbackType
        };
        setMessages(updatedMessages);
        // Find the corresponding user query (message before this one)
        let userQuery = '';
        if (messageIndex > 0 && updatedMessages[messageIndex - 1].role === 'user') {
            userQuery = updatedMessages[messageIndex - 1].content;
        }
        // Submit feedback to API
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: userQuery,
                    response: message.content,
                    feedback: feedbackType,
                    messageIndex,
                    sessionId: sessionId,
                    messageId: message.id,
                    metadata: {
                        sessionType: 'general'
                    }
                }),
            });
            if (!response.ok) {
                console.error('Failed to submit feedback');
            }
        }
        catch (error) {
            console.error('Error submitting feedback:', error);
        }
    };
    // Always scroll to bottom when messages change
    (0, react_1.useEffect)(() => {
        scrollToBottom();
    }, [messages]);
    const scrollToBottom = () => {
        var _a;
        (_a = endOfMessagesRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth' });
    };
    // Handle input change and auto-resize textarea
    const handleInputChange = (e) => {
        setInput(e.target.value);
        // Auto-resize the textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };
    // Handle key presses
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };
    // Reset the chat function
    const resetChat = () => {
        // Save the current session before resetting
        if (messages.length > 1) {
            if (sessionId) {
                updateChatSession();
            }
            else {
                saveChatSession();
            }
        }
        // Reset state
        setMessages([{
                id: '0',
                role: 'bot',
                content: 'Welcome to the Workstream Knowledge Assistant! Ask questions about our HR, Payroll, and Hiring platform for the hourly workforce.',
                timestamp: new Date()
            }]);
        setSessionId(null);
    };
    return (<div className="flex flex-col h-screen bg-[#343541]">
      {/* Header */}
      <header className="bg-[#202123] text-white p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <link_1.default href="/" className="flex items-center text-gray-300 hover:text-white transition">
            <lucide_react_1.ChevronLeft className="h-5 w-5 mr-1"/>
            <span>Back to Hub</span>
          </link_1.default>
        </div>
        <h1 className="text-xl font-semibold text-center flex-1">Workstream Knowledge Assistant</h1>
        <div className="flex space-x-2">
          <button onClick={resetChat} className="px-4 py-2 bg-[#3e3f4b] hover:bg-[#4e4f5b] rounded-lg text-sm transition">
            New Chat
          </button>
          <button onClick={() => router.push('/company-chat')} className="px-4 py-2 bg-[#3e3f4b] hover:bg-[#4e4f5b] rounded-lg text-sm transition">
            Company Chat
          </button>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#343541]">
        {messages.map((message, index) => (<div key={message.id} className={`py-5 ${message.role === 'bot' ? 'bg-[#444654]' : 'bg-[#343541]'}`}>
            <div className="max-w-3xl mx-auto px-4 flex">
              {/* Avatar */}
              <div className={`w-8 h-8 flex-shrink-0 mr-4 rounded-full flex items-center justify-center ${message.role === 'bot' ? 'bg-teal-600 text-white' : 'bg-violet-600 text-white'}`}>
                {message.role === 'bot' ? 'AI' : 'U'}
              </div>
              
              {/* Message content */}
              <div className="flex-1 min-w-0">
                <ChatMessage_1.default message={message.content} role={message.role} timestamp={message.timestamp}/>
                
                {/* Feedback buttons (only show for assistant messages) */}
                {message.role === 'bot' && index > 0 && (<div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => handleFeedback(index, 'positive')} className={`p-1 rounded-full ${message.feedback === 'positive'
                    ? 'bg-green-800 text-green-200'
                    : 'hover:bg-gray-700 text-gray-400'}`} aria-label="Helpful" title="Helpful">
                      <lucide_react_1.ThumbsUp className="h-4 w-4"/>
                    </button>
                    <button onClick={() => handleFeedback(index, 'negative')} className={`p-1 rounded-full ${message.feedback === 'negative'
                    ? 'bg-red-800 text-red-200'
                    : 'hover:bg-gray-700 text-gray-400'}`} aria-label="Not helpful" title="Not helpful">
                      <lucide_react_1.ThumbsDown className="h-4 w-4"/>
                    </button>
                  </div>)}
              </div>
            </div>
          </div>))}
        
        {isLoading && (<div className="flex items-center justify-center p-4">
            <lucide_react_1.Loader2 className="h-6 w-6 text-gray-400 animate-spin"/>
          </div>)}
        
        <div ref={endOfMessagesRef}/>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-700 bg-[#3e3f4b] p-4">
        <div className="max-w-4xl mx-auto relative">
          <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Ask about Workstream's features, pricing, or implementation..." className="w-full bg-[#2a2b32] text-white rounded-lg pl-4 pr-12 py-3 focus:outline-none resize-none" rows={1} style={{ maxHeight: '200px' }}/>
          <button onClick={() => handleSendMessage()} disabled={isLoading || !input.trim()} className={`absolute right-3 top-3 rounded-md p-1 ${isLoading || !input.trim()
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}>
            <lucide_react_1.Send className="h-5 w-5"/>
          </button>
        </div>
      </div>
    </div>);
}
