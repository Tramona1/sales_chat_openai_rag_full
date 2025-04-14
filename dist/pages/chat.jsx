import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Send, ChevronLeft, Loader2, } from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import { generateSessionTitle, extractKeywords } from '@/utils/chatStorage';
import { trackEvent } from '@/utils/analytics';
import { ChatFeedback } from '@/components/enhanced-tracking';
export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const endOfMessagesRef = useRef(null);
    const textareaRef = useRef(null);
    const [chatTitle, setChatTitle] = useState('New Chat');
    const [isCompanyChat, setIsCompanyChat] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [companyInfo, setCompanyInfo] = useState('');
    const [salesNotes, setSalesNotes] = useState('');
    // Initialize with welcome message and handle URL parameters
    useEffect(() => {
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
        try {
            // Make sure we have messages and a title
            if (!messages.length || !chatTitle.trim()) {
                return;
            }
            // Format the messages for storage
            const formattedMessages = messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
                timestamp: msg.timestamp.toISOString()
            }));
            // Prepare session data
            const sessionData = {
                title: chatTitle,
                sessionType: isCompanyChat ? 'company' : 'general',
                messages: formattedMessages,
                salesRepName: 'Anonymous User', // Would be replaced by user info in a real auth system
                companyName: isCompanyChat ? companyName : undefined,
                companyInfo: isCompanyChat ? companyInfo : undefined,
                salesNotes: salesNotes
            };
            // Call the API to save the session
            const response = await fetch('/api/storage/chat-operations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sessionData),
            });
            if (!response.ok) {
                throw new Error(`Failed to save chat session: ${response.statusText}`);
            }
            const data = await response.json();
            // Update the session ID
            setSessionId(data.id);
            console.log('Chat session saved successfully with ID:', data.id);
            return data.id;
        }
        catch (error) {
            console.error('Error saving chat session:', error);
            // Implement better error handling here
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
            const keywords = extractKeywords(storedMessages);
            const title = generateSessionTitle(storedMessages);
            await fetch(`/api/admin/chat-sessions/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionType: isCompanyChat ? 'company' : 'general',
                    title,
                    messages: storedMessages,
                    keywords,
                    companyName: isCompanyChat ? companyName : undefined,
                    companyInfo: isCompanyChat ? companyInfo : undefined,
                    salesNotes
                }),
            });
        }
        catch (error) {
            console.error('Failed to update chat session:', error);
        }
    };
    // Save session when messages change
    useEffect(() => {
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
            // Log start of processing
            console.log("Processing message for response:", messageText.substring(0, 50) + "...");
            // Determine if this is company-specific
            const isCompanyQuery = isCompanySpecificQuery(messageText);
            // Prepare the request body
            const requestBody = {
                query: messageText,
                sessionId: sessionId,
                conversationHistory: currentMessages.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                })),
                options: {
                    includeSourceCitations: true,
                    useGemini: true
                }
            };
            // Call the actual query API with the proper POST request
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            const result = await response.json();
            // Create a unique ID for the bot message
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // Add bot response to messages
            const botMessage = {
                id: messageId,
                role: 'bot',
                content: result.answer || "I'm sorry, I couldn't generate a response. Please try again.",
                timestamp: new Date()
            };
            // Update messages with bot response
            setMessages([...currentMessages, botMessage]);
            // Log the conversation for admin review if enabled
            try {
                if (sessionId) {
                    await fetch('/api/log-conversation', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            sessionId,
                            message: messageText,
                            response: result.answer,
                            metadata: {
                                sessionType: isCompanyQuery ? 'company' : 'general',
                                timestamp: new Date().toISOString()
                            }
                        }),
                    });
                }
            }
            catch (logError) {
                console.error("Failed to log conversation:", logError);
                // Non-blocking, continue despite log failure
            }
        }
        catch (error) {
            console.error("Error processing message:", error);
            // Add error message to chat
            setMessages([
                ...currentMessages,
                {
                    id: Date.now().toString(),
                    role: 'bot',
                    content: "Sorry, I encountered an error processing your request. Please try again.",
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
        // Track message sent event
        trackEvent({
            event_type: 'chat_message_sent',
            session_id: sessionId || undefined,
            event_data: {
                message_type: 'text',
                content_length: messageText.length,
                is_company_specific: isCompanySpecificQuery(messageText)
            }
        });
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        // Process message to get response
        await processMessageForResponse(messageText, updatedMessages);
    };
    // Handle feedback on assistant messages
    const handleFeedback = async (messageIndex, feedbackType) => {
        try {
            // Don't allow feedback on system messages or multiple feedback submissions
            if (messages[messageIndex].role !== 'bot' || messages[messageIndex].feedback) {
                return;
            }
            // Find the preceding user message to get the query
            let userMessageIndex = messageIndex - 1;
            while (userMessageIndex >= 0) {
                if (messages[userMessageIndex].role === 'user') {
                    break;
                }
                userMessageIndex--;
            }
            if (userMessageIndex < 0) {
                console.error('Could not find user message for feedback');
                return;
            }
            // Update UI immediately
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                feedback: feedbackType
            };
            setMessages(updatedMessages);
            // Send to API
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: messages[userMessageIndex].content,
                    response: messages[messageIndex].content,
                    feedback: feedbackType,
                    messageIndex: messageIndex,
                    sessionId: sessionId,
                    metadata: {
                        isCompanyChat: isCompanyChat,
                        companyName: companyName || undefined
                    }
                })
            });
            if (!response.ok) {
                throw new Error('Failed to record feedback');
            }
            console.log('Feedback submitted successfully');
        }
        catch (error) {
            console.error('Error submitting feedback:', error);
            // Don't revert UI state to avoid confusion
        }
    };
    // Always scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    const scrollToBottom = () => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
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
          <Link href="/" className="flex items-center text-gray-300 hover:text-white transition">
            <ChevronLeft className="h-5 w-5 mr-1"/>
            <span>Back to Hub</span>
          </Link>
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
                <ChatMessage message={message.content} role={message.role} timestamp={message.timestamp}/>
                
                {/* Feedback buttons (only show for assistant messages) */}
                {message.role === 'bot' && index > 0 && (<ChatFeedback messageIndex={index} query={index > 0 ? messages[index - 1].content : ''} response={message.content} sessionId={sessionId || undefined} onFeedbackSubmitted={(type) => handleFeedback(index, type)}/>)}
              </div>
            </div>
          </div>))}
        
        {isLoading && (<div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 text-gray-400 animate-spin"/>
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
            <Send className="h-5 w-5"/>
          </button>
        </div>
      </div>
    </div>);
}
