import React from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: string;
  role: 'user' | 'bot';
  timestamp: Date;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, role, timestamp }) => {
  const isBot = role === 'bot';

  return (
    <div className={`py-5 ${isBot ? 'bg-[#444654]' : 'bg-[#343541]'}`}>
      <div className="max-w-3xl mx-auto px-4 flex">
        {/* Avatar */}
        <div className={`w-8 h-8 flex-shrink-0 mr-4 rounded-full flex items-center justify-center ${
          isBot ? 'bg-teal-600 text-white' : 'bg-violet-600 text-white'
        }`}>
          {isBot ? 'AI' : 'U'}
        </div>
        
        {/* Message content */}
        <div className="flex-1 min-w-0">
          {isBot ? (
            <div className="prose prose-invert max-w-none text-gray-100">
              {/* @ts-ignore - Ignoring ReactMarkdown component type issues */}
              <ReactMarkdown className="markdown-content">
                {message}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-gray-100 whitespace-pre-wrap">{message}</p>
          )}
          
          {/* Timestamp in small subtle text */}
          <div className="text-xs text-gray-500 mt-1">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 