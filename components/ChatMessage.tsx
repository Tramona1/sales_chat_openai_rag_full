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
    <>
      {isBot ? (
        <div className="prose prose-invert max-w-none text-gray-100">
          {/* @ts-ignore - Ignoring ReactMarkdown component type issues */}
          <div className="markdown-content">
            <ReactMarkdown>
              {message}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <p className="text-gray-100 whitespace-pre-wrap">{message}</p>
      )}
      
      {/* Timestamp in small subtle text */}
      <div className="text-xs text-gray-500 mt-1">
        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </>
  );
};

export default ChatMessage; 