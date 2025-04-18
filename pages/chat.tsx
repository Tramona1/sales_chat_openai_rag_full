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
  const [messageCounter, setMessageCounter] = useState(0);
  const processedInitialQuestionRef = useRef<string | null>(null);

  // ---> Log Component Mount/Unmount <---
  useEffect(() => {
    console.log('[ChatPage LIFECYCLE] Component Mounted');
    return () => {
      console.log('[ChatPage LIFECYCLE] Component Unmounting');
    };
  }, []); // Empty dependency array runs only on mount and unmount

  // Initialize with welcome message and handle URL parameters
  useEffect(() => {
    const processInitialQuestion = async () => {
      // ---> Log Initial useEffect Trigger <--- (moved inside async func)
      console.log('[ChatPage useEffect INITIAL] Running effect for initial question/session load.');

      // Check if router is ready and has query parameters
      if (!router.isReady) {
        console.log('[ChatPage useEffect INITIAL] Router not ready, exiting effect.');
        return;
      }

      const { question, autoResponse, session } = router.query;
      
      // ---> Check if we've already processed this specific question <--- (moved inside async func)
      if (question && typeof question === 'string' && question === processedInitialQuestionRef.current) {
        console.log("[ChatPage useEffect INITIAL] Initial question already processed, skipping.");
        return;
      }

      // If a session ID is provided, try to load that session
      if (session && typeof session === 'string') {
        // ---> Reset processed ref if loading a session <-----
        processedInitialQuestionRef.current = null;
        await loadChatSession(session); // await loading
        return;
      }
      
      // Handle initial state with welcome message only if messages are empty
      if (messages.length === 0) {
        // Initialize with welcome message
        const initialMessages: Message[] = [{
          id: '0',
          role: 'bot',
          content: 'Welcome to the Workstream Knowledge Assistant! Ask questions about our HR, Payroll, and Hiring platform for the hourly workforce.',
          timestamp: new Date()
        }];
        
        // If we have a question parameter, process it
        if (question && typeof question === 'string') {
          console.log("useEffect: Processing initial question from URL:", question);
          const userMessage: Message = {
            id: '1',
            role: 'user',
            content: question,
            timestamp: new Date()
          };
          
          // Set user message first
          setMessages([...initialMessages, userMessage]);
          
          // ---> Mark this question as processed <---
          processedInitialQuestionRef.current = question;
          
          // Set loading state
          setIsLoading(true);
          
          try {
            // Get AI response
            const botResponse = await processMessageForResponse(question, [...initialMessages, userMessage]);
            
            // Add bot response if valid
            if (botResponse && botResponse.content) {
              const botMessage: Message = {
                id: `${Date.now()}_initial_bot`,
                role: 'bot',
                content: botResponse.content,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, botMessage]); // Add bot message to the state
            } else {
              console.error("Initial question processing returned no content.");
            }
          } catch (error) {
            console.error("Error processing initial question response:", error);
            // Optionally add an error message to chat
            const errorMessage: Message = {
              id: `${Date.now()}_initial_error`,
              role: 'bot',
              content: "Sorry, I couldn't process the initial question.",
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
          } finally {
            setIsLoading(false); // Ensure loading is turned off
          }

        } else {
          // Just set welcome message if no question, reset processed ref
          processedInitialQuestionRef.current = null;
          setMessages(initialMessages);
        }
      }
    };

    processInitialQuestion(); // Call the async function

  }, [router.isReady, router.query]); // Dependencies: router readiness and query parameters
  
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
    const clientRequestId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[${clientRequestId}] BEGIN processMessageForResponse for: "${messageText.substring(0, 30)}${messageText.length > 30 ? '...' : ''}"`);
    
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
      console.log(`[${clientRequestId}] Sending request with history:`, {
        messageCount: conversationHistory.length,
        lastUserMessage: conversationHistory.length > 0 ? 
          conversationHistory[conversationHistory.length - 1]?.content?.substring(0, 50) + "..." : "none",
        sessionId: sessionId
      });

      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.log(`[${clientRequestId}] Request timed out after 90 seconds`);
          reject(new Error('Request timed out after 90 seconds'));
        }, 90000);
      });

      // Create the actual fetch promise
      const fetchPromise = fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[${clientRequestId}] Fetch request sent to /api/query at ${new Date().toISOString()}`);

      // Race the fetch against the timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      console.log(`[${clientRequestId}] API response received after ${Date.now() - startTime}ms - Status:`, response.status, response.statusText);

      if (response.status === 404) {
        console.error(`[${clientRequestId}] API endpoint not found`);
        return {
          content: "I'm having trouble connecting to the knowledge base. Please try again in a moment.",
          citations: [],
          sources: []
        };
      }

      const data = await response.json();
      console.log(`[${clientRequestId}] API response parsed:`, {
        hasAnswer: !!data.answer,
        answerLength: data.answer?.length || 0,
        resultCount: data.resultCount || 0,
        metadataKeys: data.metadata ? Object.keys(data.metadata) : []
      });

      // More robust response handling - check all possible response formats
      let answer = '';
      if (data.answer) {
        // Standard format from query.ts API
        answer = data.answer;
        console.log(`[${clientRequestId}] Using standard 'answer' response format`);
      } else if (data.response) {
        // Alternative format sometimes used
        answer = data.response;
        console.log(`[${clientRequestId}] Using alternative 'response' format`);
      } else if (data.completion) {
        // Format used by chat.ts API endpoint
        answer = data.completion;
        console.log(`[${clientRequestId}] Using 'completion' format from /api/chat endpoint`);
      } else if (data.text || data.content) {
        // Other possible formats
        answer = data.text || data.content;
        console.log(`[${clientRequestId}] Using fallback text/content format`);
      } else if (typeof data === 'string') {
        // Direct string response
        answer = data;
        console.log(`[${clientRequestId}] Using direct string response format`);
      } else {
        console.warn(`[${clientRequestId}] Unexpected API response format:`, data);
        
        // Last resort: Try to use the chat.ts API endpoint as a fallback
        try {
          console.log(`[${clientRequestId}] Attempting fallback to /api/chat endpoint`);
          
          // ---> Define the structured fallback prompt (Updated) <--- 
          const fallbackSystemPrompt = "System: You are a helpful assistant answering questions about Workstream's products. Be direct and informative.";
          const fallbackUserPrompt = `User: ${messageText}`;
          // ---> TODO: Add query classification if available <---
          // const queryClassification = ...;
          // const fallbackPrompt = `${fallbackSystemPrompt}\n${fallbackUserPrompt}\n${queryClassification ? `[Query Type: ${queryClassification}]` : ''}`;
          // For now, just send system + user prompt
          const fallbackMessages = [
            { role: 'system', content: fallbackSystemPrompt },
            // Include conversation history if appropriate? Maybe just the last few turns?
            // { role: 'user', content: conversationHistory[conversationHistory.length - 1]?.content }, // Example: Last user msg
            // { role: 'assistant', content: conversationHistory[conversationHistory.length - 1]?.content }, // Example: Last bot msg
            { role: 'user', content: messageText } // Current user message
          ];

          const chatResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: fallbackMessages, // Send structured messages
              model: 'gemini' // Ensure model is specified if required by /api/chat
            })
          });
          
          if (chatResponse.ok) {
            const chatData = await chatResponse.json();
            if (chatData.completion) {
              answer = chatData.completion;
              console.log(`[${clientRequestId}] Successfully received response from fallback /api/chat endpoint`);
            } else {
              throw new Error('No completion in chat API response');
            }
          } else {
            throw new Error(`Chat API returned status ${chatResponse.status}`);
          }
        } catch (fallbackError) {
          console.error(`[${clientRequestId}] Fallback to /api/chat failed:`, fallbackError);
          answer = "I received a response but couldn't interpret it correctly. Please try again.";
        }
      }

      // Check if this was identified as a follow-up question
      const isFollowUp = data.metadata?.followUpDetected;
      const contextUsed = data.metadata?.usedConversationContext;
      
      if (isFollowUp) {
        console.log(`[${clientRequestId}] Follow-up question detected`, {
          contextUsed,
          queryExpanded: data.metadata?.queryWasExpanded,
          searchFailed: data.metadata?.searchFailed
        });
      }

      // Track the event for analytics
      trackEvent('message_processed', {
        messageLength: messageText.length,
        responseTime: Date.now() - startTime,
        hasAnswer: !!answer,
        resultCount: data.results?.length || 0,
        isFollowUp,
        contextUsed
      });

      console.log(`[${clientRequestId}] COMPLETE processMessageForResponse - Success after ${Date.now() - startTime}ms`);
      
      return {
        content: answer,
        citations: data.citations || [],
        sources: data.sources || []
      };
    } catch (error) {
      console.error(`[${clientRequestId}] Error in processMessageForResponse after ${Date.now() - startTime}ms:`, error);
      
      // Log more detailed error information
      if (error instanceof Error) {
        console.error(`[${clientRequestId}] Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      if (error instanceof TypeError && error.message.includes('json')) {
        console.error(`[${clientRequestId}] JSON parsing error - the API might be returning invalid JSON or HTML instead of JSON`);
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`[${clientRequestId}] Network error - the API endpoint might be unavailable`);
      }
      
      // Check if this is a timeout error
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      if (isTimeout) {
        console.error(`[${clientRequestId}] Request timed out`);
      }

      // Special handling for basic greetings
      const basicGreetings = ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'];
      if (basicGreetings.includes(messageText.toLowerCase().trim())) {
        console.log(`[${clientRequestId}] Using fallback greeting response`);
        return {
          content: "Hello! I'm the Workstream Knowledge Assistant. I can help you with information about our HR, Payroll, and Hiring platform for hourly workers. What would you like to know?",
          citations: [],
          sources: []
        };
      }
      
      // Use a more helpful error message based on error type
      let errorMessage = "I'm sorry, but I encountered an issue while processing your request.";
      
      if (isTimeout) {
        errorMessage = "I'm sorry, but it's taking longer than expected to generate a response. Please try asking a more specific question.";
      } else {
        errorMessage = "It looks like I don't have that information. Please try asking a different question about Workstream's HR, Payroll, or Hiring solutions.";
      }
      
      console.log(`[${clientRequestId}] COMPLETE processMessageForResponse - Error after ${Date.now() - startTime}ms`);
      
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
    // ---> Log Entry <---
    console.log(`[handleSendMessage ENTRY] Function called. isLoading: ${isLoading}`);

    const messageText = overrideInput || input;
    if (!messageText.trim() || isLoading) {
      // ---> Log Exit <---
      console.log(`[handleSendMessage EXIT] Exiting early. isLoading: ${isLoading}, messageText empty: ${!messageText.trim()}`);
      return;
    }

    // ---> Log isLoading Set <---
    console.log(`[handleSendMessage] Setting isLoading to TRUE`);
    setIsLoading(true);

    const clientMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[${clientMsgId}] BEGIN handleSendMessage processing for: "${messageText.substring(0, 30)}${messageText.length > 30 ? '...' : ''}"`);

    try { // Wrap the main logic in try...finally to ensure isLoading is unset
        const messageExists = messages.some(msg =>
          msg.role === 'user' && msg.content === messageText
        );

        let updatedMessages = [...messages];
        if (!messageExists) {
          const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: new Date()
          };
          updatedMessages = [...messages, userMessage]; // Use current messages state
          setMessages(updatedMessages); // Set user message immediately
          console.log(`[${clientMsgId}] Added user message to state, new message count: ${updatedMessages.length}`);
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
        
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }

        console.log(`[${clientMsgId}] Calling processMessageForResponse`);
        // IMPORTANT: Pass the state *after* adding the user message
        const botResponse = await processMessageForResponse(messageText, updatedMessages);
        console.log(`[${clientMsgId}] Received bot response:`, {
           hasContent: !!botResponse.content,
           contentLength: botResponse.content?.length || 0,
           hasCitations: Array.isArray(botResponse.citations) && botResponse.citations.length > 0,
           hasSources: Array.isArray(botResponse.sources) && botResponse.sources.length > 0
        });

        console.log(`[${clientMsgId}] Checking botResponse content. botResponse exists: ${!!botResponse}, botResponse.content exists: ${!!botResponse?.content}, content length: ${botResponse?.content?.length}`);

        if (botResponse && botResponse.content) {
          console.log(`[${clientMsgId}] Condition (botResponse && botResponse.content) is TRUE. Creating botMessage object.`);
          const botMessage: Message = {
            id: `${Date.now()}_bot`,
            role: 'bot',
            content: botResponse.content,
            timestamp: new Date(),
          };
          console.log(`[${clientMsgId}] Adding bot message to state:`, {
            id: botMessage.id,
            role: botMessage.role,
            contentPreview: botMessage.content.substring(0, 50) + (botMessage.content.length > 50 ? '...' : ''),
            timestamp: botMessage.timestamp
          });
          
          setMessages(prevMessages => {
            console.log(`[${clientMsgId}] Inside setMessages: prevMessages length: ${prevMessages.length}`);
            const newMessages = [...prevMessages, botMessage];
            console.log(`[${clientMsgId}] Inside setMessages: newMessages length: ${newMessages.length}`);
            setMessageCounter(count => count + 1); // Increment counter
            return newMessages;
          });

          console.log(`[${clientMsgId}] Bot message state update dispatched`);
        } else {
          console.error(`[${clientMsgId}] No content in bot response:`, botResponse);
          console.log(`[${clientMsgId}] COMPLETE handleSendMessage - Failed (no content in response)`);
          // Optionally add an error message to the chat?
          // setMessages(prev => [...prev, { id: `${Date.now()}_error`, role: 'bot', content: "Sorry, I couldn't generate a response.", timestamp: new Date() }]);
        }
    } catch (error) {
        console.error(`[${clientMsgId}] Error within handleSendMessage main logic:`, error);
        // Handle potential errors during the process, maybe add an error message to chat
    } finally {
        // ---> Log isLoading Unset <---
        console.log(`[handleSendMessage] Setting isLoading to FALSE in finally block`);
        setIsLoading(false);
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

  // Add debug logging for message state changes
  useEffect(() => {
    console.log("Messages state updated:", messages.length, "messages");
    // Log the last message if there is one
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log("Last message:", {
        role: lastMsg.role, 
        contentLength: lastMsg.content.length,
        contentPreview: lastMsg.content.substring(0, 50) + (lastMsg.content.length > 50 ? '...' : '')
      });
    }
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
      // ---> Log KeyDown Trigger <---
      console.log('[ChatPage EVENT] Enter key pressed, calling handleSendMessage.');
      handleSendMessage();
    }
  };

  // Reset the chat function
  const resetChat = () => {
    // Save the current session before resetting (only if we have more than just welcome message)
    if (messages.length > 1) {
      try {
        if (sessionId) {
          updateChatSession();
        } else {
          saveChatSession();
        }
      } catch (error) {
        console.error("Error saving session during reset:", error);
        // Continue with reset even if saving fails
      }
    }
    
    console.log("Resetting chat session");
    
    // Reset state
    setMessages([{
      id: '0',
      role: 'bot',
      content: 'Welcome to the Workstream Knowledge Assistant! Ask questions about our HR, Payroll, and Hiring platform for the hourly workforce.',
      timestamp: new Date()
    }]);
    setSessionId(null);
    
    // Force a reload if requested (added for debugging)
    if (process.env.NODE_ENV === 'development') {
      console.log("Development mode: You can reload the page if the chat gets stuck");
    }
  };

  // ---> Re-add Render Debug Log <---
  console.log('[Render Debug] Messages array before return:', messages.map(m => ({ id: m.id, role: m.role, length: m.content.length })));

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
            onClick={() => {
              // ---> Log Button Click <---
              console.log('[ChatPage EVENT] Send button clicked, calling handleSendMessage.');
              handleSendMessage();
            }}
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