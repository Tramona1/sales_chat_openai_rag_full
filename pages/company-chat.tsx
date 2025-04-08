import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import CompanySearch from '@/components/CompanySearch';
import ChatInterface from '@/components/ChatInterface';
import CompanyProfile from '@/components/CompanyProfile';
import { CompanyInformation } from '@/utils/perplexityClient';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Define a type for chat messages
type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
  feedback?: 'positive' | 'negative' | null;
};

export default function CompanyChatPage() {
  const [companyName, setCompanyName] = useState('');
  const [companyInfo, setCompanyInfo] = useState<CompanyInformation | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [salesNotes, setSalesNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const router = useRouter();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize system message when company info is set
  useEffect(() => {
    if (companyInfo && chatMessages.length === 0) {
      const initialMessages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a Workstream sales assistant with information about ${companyName}. Use this context about the company to provide tailored responses about how Workstream's products can help them: ${companyInfo.companyInfo}`
        },
        {
          role: 'assistant',
          content: `I've gathered information about ${companyName}. How can I help you understand how Workstream's solutions might benefit them?`
        }
      ];
      setChatMessages(initialMessages);
    }
  }, [companyInfo, companyName, chatMessages.length]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Function to save the chat session to the admin dashboard
  const saveChatSession = async () => {
    if (!companyInfo || chatMessages.length === 0) return;
    
    try {
      const response = await fetch('/api/admin/chat-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          companyInfo,
          salesNotes,
          messages: chatMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          salesRepName: 'Anonymous User' // Replace with actual user when auth is implemented
        }),
      });
      
      const data = await response.json();
      
      if (data.sessionId) {
        setSessionId(data.sessionId);
        console.log(`Chat session saved with ID: ${data.sessionId}`);
      }
    } catch (error) {
      console.error('Failed to save chat session:', error);
    }
  };

  // Update session when messages or notes change
  useEffect(() => {
    // Skip first render and when no company info yet
    if (!companyInfo) return;
    
    // Debounce the save operation to avoid excessive API calls
    const saveTimeout = setTimeout(() => {
      if (sessionId) {
        // Update the existing session
        updateExistingSession();
      } else if (chatMessages.length > 1) {
        // Only save if we have some conversation history
        saveChatSession();
      }
    }, 2000);
    
    return () => clearTimeout(saveTimeout);
  }, [chatMessages, salesNotes, companyInfo]);

  // Function to update existing session
  const updateExistingSession = async () => {
    if (!sessionId || !companyInfo) return;
    
    try {
      const response = await fetch(`/api/admin/chat-sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          companyInfo,
          salesNotes,
          messages: chatMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to update chat session');
      }
    } catch (error) {
      console.error('Error updating chat session:', error);
    }
  };

  // Function to search for company information
  const searchCompany = async () => {
    if (!companyName.trim()) {
      setSearchError('Please enter a company name');
      return;
    }

    setIsSearching(true);
    setSearchError('');

    try {
      // First verify the company existence
      const verifyResponse = await fetch('/api/company/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.exists) {
        setSearchError(`Couldn't find information about ${companyName}. Please check the spelling or try a different company.`);
        setIsSearching(false);
        return;
      }

      // Then get detailed information
      const infoResponse = await fetch('/api/company/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName: verifyData.fullName || companyName }),
      });

      const companyData = await infoResponse.json();

      if (companyData.isRateLimited) {
        setSearchError('Rate limit reached. Please try again later.');
        setIsSearching(false);
        return;
      }

      setCompanyInfo(companyData);
    } catch (error) {
      console.error('Error searching for company:', error);
      setSearchError('An error occurred while searching. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Function to handle chat messages
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = { role: 'user', content: message };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    
    setIsLoading(true);
    try {
      // Send message to API with company context and sales notes
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          context: JSON.stringify(newMessages),
          options: {
            companyContext: {
              ...companyInfo,
              companyName: companyName,
              salesNotes: salesNotes.trim() ? salesNotes : undefined
            },
          }
        }),
      });
      
      const data = await response.json();
      
      // Add assistant response to chat with unique ID
      const messageId = `comp_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const assistantMessage: ChatMessage = { 
        role: 'assistant', 
        content: data.answer,
        id: messageId
      };
      setChatMessages([...newMessages, assistantMessage]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your message. Please try again.' 
      };
      setChatMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle feedback on assistant messages
  const handleFeedback = async (messageIndex: number, feedbackType: 'positive' | 'negative') => {
    const message = chatMessages[messageIndex];
    
    if (message.role !== 'assistant') return;
    
    // Update UI immediately
    const updatedMessages = [...chatMessages];
    updatedMessages[messageIndex] = {
      ...message,
      feedback: feedbackType
    };
    setChatMessages(updatedMessages);
    
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
          metadata: {
            companyName: companyName,
            sources: [],  // Populate with actual source data when available
            companyIndustry: companyInfo?.industry
          }
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  // Function to save notes
  const saveNotes = () => {
    // Re-initialize the system message with updated notes
    if (companyInfo) {
      const systemMessageIndex = chatMessages.findIndex(msg => msg.role === 'system');
      if (systemMessageIndex >= 0) {
        const updatedMessages = [...chatMessages];
        updatedMessages[systemMessageIndex] = {
          role: 'system',
          content: `You are a Workstream sales assistant with information about ${companyName}. 
Use this context about the company to provide tailored responses about how Workstream's products can help them: 
${companyInfo.companyInfo}

Sales Rep Notes: 
${salesNotes.trim() ? salesNotes : "No additional notes provided."}`
        };
        setChatMessages(updatedMessages);
      }
    }
    setIsEditingNotes(false);
    
    // Save session with updated notes
    saveChatSession();
  };

  // Function to reset the chat
  const resetChat = () => {
    // Save the current session before resetting if we have data
    if (companyInfo && chatMessages.length > 1) {
      saveChatSession();
    }
    
    setCompanyName('');
    setCompanyInfo(null);
    setChatMessages([]);
    setSalesNotes('');
    setSearchError('');
    setIsEditingNotes(false);
    setSessionId(null);
  };

  // Function to handle textarea input changes
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    
    // Auto-resize the textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  // Function to handle keydown events in the textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
      setInputMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#343541]">
      {/* Header */}
      <header className="bg-[#202123] text-white p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="flex items-center text-gray-300 hover:text-white transition">
            <ChevronLeft className="h-5 w-5 mr-1" />
            <span>Back to Hub</span>
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-center flex-1">Company-Specific Assistant</h1>
        <div className="w-24 flex justify-end">
          <button 
            onClick={() => router.push('/chat')}
            className="px-4 py-2 bg-[#3e3f4b] hover:bg-[#4e4f5b] rounded-lg text-sm transition"
          >
            General Chat
          </button>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex-grow overflow-auto">
        {!companyInfo ? (
          <div className="max-w-md mx-auto mt-10 p-6 bg-[#202123] rounded-xl shadow-lg text-white">
            <h2 className="text-xl font-semibold mb-4">Search for a Company</h2>
            <p className="text-gray-300 mb-6">
              Enter a company name to get tailored information and product recommendations
            </p>
            
            <CompanySearch
              companyName={companyName}
              onChange={setCompanyName}
              onSearch={searchCompany}
              isSearching={isSearching}
              error={searchError}
              darkMode={true}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Company Info + Notes Section */}
            <div className="bg-[#2a2b32] text-white border-b border-gray-700 p-4 space-y-4">
              {/* Company Profile */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">{companyName}</h2>
                  <div className="flex space-x-4 text-sm text-gray-300 mt-1">
                    {companyInfo.industry && <span>{companyInfo.industry}</span>}
                    {companyInfo.size && <span>• {companyInfo.size}</span>}
                    {companyInfo.location && <span>• {companyInfo.location}</span>}
                  </div>
                </div>
                <button
                  onClick={resetChat}
                  className="px-3 py-1 bg-[#3e3f4b] hover:bg-[#4e4f5b] rounded-md text-sm text-white"
                >
                  New Search
                </button>
              </div>
              
              {/* Sales Notes Section */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">
                  <span className="font-medium">Sales Notes:</span>
                  {isEditingNotes ? (
                    <textarea
                      ref={notesRef}
                      value={salesNotes}
                      onChange={(e) => setSalesNotes(e.target.value)}
                      className="w-full h-16 mt-2 p-2 bg-[#3e3f4b] border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add your notes about this company here. These notes will be used to inform responses."
                    />
                  ) : (
                    <span className="ml-2">
                      {salesNotes ? salesNotes.substring(0, 60) + (salesNotes.length > 60 ? '...' : '') : 
                        <span className="italic text-gray-500">No notes added</span>}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsEditingNotes(!isEditingNotes);
                    if (!isEditingNotes) {
                      setTimeout(() => notesRef.current?.focus(), 0);
                    } else {
                      saveNotes();
                    }
                  }}
                  className="px-3 py-1 bg-[#3e3f4b] hover:bg-[#4e4f5b] rounded-md text-sm text-white"
                >
                  {isEditingNotes ? 'Save Notes' : 'Edit Notes'}
                </button>
              </div>
            </div>
            
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#343541]">
              {chatMessages
                .filter(msg => msg.role !== 'system')
                .map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-3/4 rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-[#2a2b32] text-white rounded-bl-none'
                      }`}
                    >
                      {/* Message content */}
                      <div>
                        {message.content.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < message.content.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </div>
                      
                      {/* Feedback buttons (only show for assistant messages) */}
                      {message.role === 'assistant' && (
                        <div className="mt-2 pt-2 border-t border-gray-600 flex justify-end gap-2">
                          <button
                            onClick={() => handleFeedback(index, 'positive')}
                            className={`p-1 rounded-full ${
                              message.feedback === 'positive'
                                ? 'bg-green-800 text-green-200'
                                : 'hover:bg-gray-700 text-gray-400'
                            }`}
                            aria-label="Helpful"
                            title="Helpful"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleFeedback(index, 'negative')}
                            className={`p-1 rounded-full ${
                              message.feedback === 'negative'
                                ? 'bg-red-800 text-red-200'
                                : 'hover:bg-gray-700 text-gray-400'
                            }`}
                            aria-label="Not helpful"
                            title="Not helpful"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              
              {isLoading && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                </div>
              )}
              
              <div ref={endOfMessagesRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-gray-700 bg-[#3e3f4b] p-4">
              <div className="max-w-4xl mx-auto relative">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask how Workstream can help this company..."
                  className="w-full bg-[#2a2b32] text-white rounded-lg pl-4 pr-12 py-3 focus:outline-none resize-none"
                  rows={1}
                  style={{ maxHeight: '200px' }}
                  disabled={isLoading}
                />
                <button
                  onClick={() => {
                    handleSendMessage(inputMessage);
                    setInputMessage('');
                    
                    // Reset textarea height
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto';
                    }
                  }}
                  disabled={isLoading || !inputMessage.trim()}
                  className={`absolute right-3 top-3 rounded-md p-1 ${
                    isLoading || !inputMessage.trim()
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="h-5 w-5"
                  >
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 