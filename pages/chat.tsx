import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { 
  Send, 
  ChevronLeft,
  Loader2,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import { StoredChatMessage, generateSessionTitle, extractKeywords } from '@/utils/chatStorage';
import { trackEvent, trackSearch } from '@/utils/analytics';
import { ChatFeedback } from '@/components/enhanced-tracking';

// Message type
interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  feedback?: 'positive' | 'negative' | null;
  queryLogId?: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatTitle, setChatTitle] = useState<string>('New Chat');
  const [isCompanyChat, setIsCompanyChat] = useState<boolean>(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [companyInfo, setCompanyInfo] = useState<string>('');
  const [salesNotes, setSalesNotes] = useState<string>('');

  // Initialize with welcome message and handle URL parameters
  useEffect(() => {
    // Check if router is ready and has query parameters
    if (!router.isReady) return;

    const { question, autoResponse, session } = router.query;
    
    // If a session ID is provided, try to load that session
    if (session && typeof session === 'string') {
      loadChatSession(session);
      return;
    }
    
    // Handle initial state with welcome message
    if (messages.length === 0) {
      // Initialize with welcome message
      const initialMessages: Message[] = [{
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
        } else {
          // Process immediately without showing loading state first
          processMessageForResponse(question, initialMessages);
        }
      } else {
        // Just set welcome message if no question
        setMessages(initialMessages);
      }
    }
  }, [router.isReady]); // Only run this effect when router is ready
  
  // Function to load a chat session
  const loadChatSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/chat-sessions?id=${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load chat session');
      }
      
      const sessionData = await response.json();
      
      // Convert the stored messages to the local Message format
      const loadedMessages: Message[] = sessionData.messages.map((msg: StoredChatMessage) => ({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        role: msg.role === 'user' ? 'user' : 'bot',
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      }));
      
      setMessages(loadedMessages);
      setSessionId(sessionId);
    } catch (error) {
      console.error('Error loading chat session:', error);
      // Start a new session with welcome message
      setMessages([{
        id: '0',
        role: 'bot',
        content: 'Welcome to the Workstream Knowledge Assistant! Ask questions about our HR, Payroll, and Hiring platform for the hourly workforce.',
        timestamp: new Date()
      }]);
    } finally {
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
      const response = await fetch('/api/storage/chat-operations?operation=save', {
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
    } catch (error) {
      console.error('Error saving chat session:', error);
      // Implement better error handling here
    }
  };
  
  // Update existing session
  const updateChatSession = async () => {
    if (!sessionId) return;

    // If we're using a local session storage mechanism, don't try to update via API
    if (sessionId.startsWith('local-')) {
      saveToLocalStorage(sessionId, messages, { 
        title: chatTitle || 'Chat Session', 
        companyName: companyName || '',
        companyInfo: companyInfo || '',
        salesNotes: salesNotes || ''
      });
      return;
    }

    try {
      // Create local backup first in case the API call fails
      saveToLocalStorage(`backup-${sessionId}`, messages, { 
        title: chatTitle || 'Chat Session', 
        companyName: companyName || '',
        companyInfo: companyInfo || '',
        salesNotes: salesNotes || ''
      });
      
      // Only proceed with API call if we actually have messages to save
      if (messages.length === 0) return;
      
      // Use a random token for anonymous authentication - only for demo purposes
      // In production, you would use proper authentication
      const anonymousToken = localStorage.getItem('anonymousToken') || 
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('anonymousToken', anonymousToken);

      const updateResponse = await fetch(`/api/storage/chat-operations?operation=update&id=${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages,
          title: chatTitle || 'Chat Session',
          companyName: companyName,
          companyInfo: companyInfo,
          salesNotes: salesNotes,
        })
      });

      if (!updateResponse.ok) {
        // If we got a 404, it's likely a permission issue
        if (updateResponse.status === 404) {
          console.warn('Session not found when updating chat session. Falling back to local storage only.');
          return;
        }
        
        throw new Error(`Failed to update chat session: ${updateResponse.status} ${updateResponse.statusText}`);
      }

      console.log('Chat session updated successfully');
    } catch (error) {
      console.error('Error updating chat session:', error);
      // We already saved a backup to local storage, so no need to do anything else
    }
  };
  
  // Save session when messages change
  useEffect(() => {
    // Skip if no messages or only welcome message
    if (messages.length <= 1) return;
    
    // Debounce the save operation to avoid excessive API calls
    const saveTimeout = setTimeout(() => {
      if (sessionId) {
        // Update existing session
        updateChatSession();
      } else {
        // Create new session
        saveChatSession();
      }
    }, 2000);
    
    return () => clearTimeout(saveTimeout);
  }, [messages, sessionId]);
  
  // Helper function to detect company-specific queries
  const isCompanySpecificQuery = (query: string): boolean => {
    const companyTerms = [
      'workstream', 'company', 'our', 'we', 'us', 'client', 'customer', 
      'product', 'service', 'price', 'pricing', 'feature', 'offering', 'team'
    ];
    
    const lowerQuery = query.toLowerCase();
    return companyTerms.some(term => lowerQuery.includes(term));
  };
  
  // Helper function to save chat data to local storage
  const saveToLocalStorage = (id: string, messages: Message[], metadata: any) => {
    try {
      localStorage.setItem(`chat_${id}`, JSON.stringify({
        messages,
        metadata,
        lastUpdated: new Date().toISOString()
      }));
      console.log(`Chat session saved to local storage with ID: ${id}`);
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  };
  
  // Helper function to track events for analytics
  const trackEvent = (eventName: string, eventData: any) => {
    try {
      console.log(`[Analytics] Tracking event: ${eventName}`, eventData);
      // In a real implementation, you would send this to your analytics provider
      // Example: analytics.track(eventName, eventData);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };
  
  // Helper function to process a message and get AI response
  const processMessageForResponse = async (messageText: string, currentMessages: Message[]) => {
    const startTime = Date.now();
    
    try {
      setIsLoading(true);

      // Create conversationHistory from current messages (excluding the newly added message)
      const conversationHistory = currentMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      const requestBody = {
        query: messageText,
        limit: 10,
        searchMode: 'hybrid',
        sessionId: sessionId,
        includeCitations: true,
        includeMetadata: true,
        useContextualRetrieval: true,
        conversationHistory  // Include conversation history in the request
      };

      // Log the request for debugging
      console.log("Sending request with history:", {
        messageCount: conversationHistory.length,
        lastUserMessage: conversationHistory.length > 0 ? 
          conversationHistory[conversationHistory.length - 1]?.content?.substring(0, 50) + "..." : "none",
        sessionId: sessionId
      });

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 404) {
        console.error("API endpoint not found");
        return {
          content: "I'm having trouble connecting to the knowledge base. Please try again in a moment.",
          citations: [],
          sources: []
        };
      }

      const data = await response.json();

      // Check if this was identified as a follow-up question
      const isFollowUp = data.metadata?.followUpDetected;
      const contextUsed = data.metadata?.usedConversationContext;
      
      if (isFollowUp) {
        console.log("Follow-up question detected", {
          contextUsed,
          queryExpanded: data.metadata?.queryWasExpanded,
          searchFailed: data.metadata?.searchFailed
        });
      }

      // Track the event for analytics
      trackEvent('message_processed', {
        messageLength: messageText.length,
        responseTime: Date.now() - startTime,
        hasAnswer: !!data.answer,
        resultCount: data.results?.length || 0,
        isFollowUp,
        contextUsed
      });

      return {
        content: data.answer || "I couldn't find an answer to your question.",
        citations: data.citations || [],
        sources: data.sources || []
      };
    } catch (error) {
      console.error('Error in processMessageForResponse:', error);
      
      // Determine if this is likely a follow-up question based on multiple signals
      // 1. Check conversation length (not the first message)
      const isNotFirstMessage = currentMessages.length > 1;
      
      // 2. Check for pronouns or contextual words that indicate a follow-up
      const followUpKeywords = ['who', 'where', 'when', 'why', 'how', 'which', 'they', 'them', 'those', 'that', 'it', 'this', 'he', 'she', 'his', 'her', 'its', 'their', 'what'];
      const hasFollowUpIndicators = followUpKeywords.some(keyword => 
        messageText.toLowerCase().startsWith(keyword) || 
        messageText.toLowerCase().split(' ').slice(0, 3).includes(keyword)
      );
      
      // 3. Short queries in a conversation are often follow-ups
      const isShortQuery = messageText.length < 20;
      
      // Combine signals to determine if this is a follow-up
      const isLikelyFollowUp = isNotFirstMessage && (hasFollowUpIndicators || isShortQuery);
      
      // Log the follow-up detection for debugging
      if (isLikelyFollowUp) {
        console.log("Likely follow-up detected:", { messageText, isNotFirstMessage, hasFollowUpIndicators, isShortQuery });
      }
      
      // Use the same friendly error message for all errors, encouraging training
      const errorMessage = "It looks like I don't have that information. Please train me so I can answer better next time.";
      
      return {
        content: errorMessage,
        citations: [],
        sources: []
      };
    } finally {
      setIsLoading(false);
    }
  };
  
  // Send message and get response
  const handleSendMessage = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim() || isLoading) return;

    // Check if this message is already in the list (to avoid duplication)
    const messageExists = messages.some(msg => 
      msg.role === 'user' && msg.content === messageText
    );
    
    // Only add user message if it doesn't already exist
    let updatedMessages = [...messages];
    if (!messageExists) {
      // Add user message
      const userMessage: Message = {
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
    trackEvent('chat_message_sent', {
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
    const botResponse = await processMessageForResponse(messageText, updatedMessages);

    // Add bot's message to the state
    if (botResponse && botResponse.content) {
      const botMessage: Message = {
        id: `${Date.now()}_bot`,
        role: 'bot',
        content: botResponse.content,
        timestamp: new Date(),
        // Potentially add sources/citations if needed from botResponse
      };
      // Update state *again* to include the bot message
      setMessages(prevMessages => [...prevMessages, botMessage]);
    }
  };
  
  // Handle feedback on assistant messages
  const handleFeedback = async (messageIndex: number, feedbackType: 'positive' | 'negative') => {
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
    } catch (error) {
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
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize the textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      } else {
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
        <h1 className="text-xl font-semibold text-center flex-1">Workstream Knowledge Assistant</h1>
        <div className="flex space-x-2">
          <button 
            onClick={resetChat}
            className="px-4 py-2 bg-[#3e3f4b] hover:bg-[#4e4f5b] rounded-lg text-sm transition"
          >
            New Chat
          </button>
          <button 
            onClick={() => router.push('/company-chat')}
            className="px-4 py-2 bg-[#3e3f4b] hover:bg-[#4e4f5b] rounded-lg text-sm transition"
          >
            Company Chat
          </button>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#343541]">
        {messages.map((message, index) => (
          <div key={message.id} className={`py-5 ${message.role === 'bot' ? 'bg-[#444654]' : 'bg-[#343541]'}`}>
            <div className="max-w-3xl mx-auto px-4 flex">
              {/* Avatar */}
              <div className={`w-8 h-8 flex-shrink-0 mr-4 rounded-full flex items-center justify-center ${
                message.role === 'bot' ? 'bg-teal-600 text-white' : 'bg-violet-600 text-white'
              }`}>
                {message.role === 'bot' ? 'AI' : 'U'}
              </div>
              
              {/* Message content */}
              <div className="flex-1 min-w-0">
                <ChatMessage
                  message={message.content}
                  role={message.role}
                  timestamp={message.timestamp}
                />
                
                {/* Feedback buttons (only show for assistant messages) */}
                {message.role === 'bot' && index > 0 && (
                  <ChatFeedback
                    messageIndex={index}
                    query={index > 0 ? messages[index - 1].content : ''}
                    response={message.content}
                    sessionId={sessionId || undefined}
                    onFeedbackSubmitted={(type) => handleFeedback(index, type)}
                  />
                )}
              </div>
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
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Workstream's features, pricing, or implementation..."
            className="w-full bg-[#2a2b32] text-white rounded-lg pl-4 pr-12 py-3 focus:outline-none resize-none"
            rows={1}
            style={{ maxHeight: '200px' }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !input.trim()}
            className={`absolute right-3 top-3 rounded-md p-1 ${
              isLoading || !input.trim()
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
} 