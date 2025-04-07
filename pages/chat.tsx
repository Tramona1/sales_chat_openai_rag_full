import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { 
  Send, 
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';

// Message type
interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with welcome message and handle URL parameters
  useEffect(() => {
    // Check if router is ready and has query parameters
    if (!router.isReady) return;

    const { question, autoResponse } = router.query;
    
    // Handle initial state with welcome message
    if (messages.length === 0) {
      // Initialize with welcome message
      const initialMessages: Message[] = [{
        id: '0',
        role: 'bot',
        content: 'Welcome to the Sales Knowledge Assistant! You can upload documents or images, paste text directly, or start asking questions about your sales materials.',
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
  
  // Helper function to process a message and get AI response
  const processMessageForResponse = async (messageText: string, currentMessages: Message[]) => {
    try {
      setIsLoading(true);
      
      // Create context from recent messages
      const recentMessages = currentMessages
        .slice(-5)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      // Call API with the message
      const response = await axios.post('/api/query', {
        query: messageText,
        context: recentMessages
      });

      // Log conversation for admin review
      await axios.post('/api/log', {
        user: 'Anonymous',
        query: messageText,
        response: response.data.answer
      });

      // Add bot response
      setMessages([
        ...currentMessages,
        {
          id: Date.now().toString(),
          role: 'bot',
          content: response.data.answer,
          timestamp: new Date()
        }
      ]);
    } catch (error) {
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
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Process message to get response
    await processMessageForResponse(messageText, updatedMessages);
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
        <h1 className="text-xl font-semibold text-center flex-1">Sales Knowledge Assistant</h1>
        <div className="w-24"></div> {/* Spacer for balance */}
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#343541]">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message.content}
            role={message.role}
            timestamp={message.timestamp}
          />
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
            placeholder="Type a question here"
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