import React, { useState, useEffect, useRef } from 'react';
const ChatInterface = ({ messages, onSendMessage, onFeedback, placeholder = 'Type your message...', containerRef }) => {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    // Auto-focus input on load
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim())
            return;
        onSendMessage(input);
        setInput('');
        setIsTyping(false);
    };
    // Auto-resize textarea as user types
    const handleInput = (e) => {
        const textarea = e.target;
        setInput(textarea.value);
        setIsTyping(textarea.value.trim() !== '');
        // Reset height to auto to correctly calculate the new height
        textarea.style.height = 'auto';
        // Set the height based on scrollHeight, with a max height
        const newHeight = Math.min(textarea.scrollHeight, 150);
        textarea.style.height = `${newHeight}px`;
    };
    // Handle pressing Enter to submit (unless Shift is pressed)
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };
    // Handle feedback for a message
    const handleFeedback = (index, feedbackType) => {
        if (onFeedback) {
            onFeedback(index, feedbackType);
        }
    };
    return (<div className="flex flex-col h-full">
      {/* Chat messages */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4" ref={containerRef}>
        {messages.map((message, index) => (<div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3/4 rounded-lg px-4 py-2 ${message.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
              {/* Message content */}
              <div>
                {message.content.split('\n').map((line, i) => (<React.Fragment key={i}>
                    {line}
                    {i < message.content.split('\n').length - 1 && <br />}
                  </React.Fragment>))}
              </div>
              
              {/* Feedback buttons (only show for assistant messages) */}
              {message.role === 'assistant' && onFeedback && (<div className="mt-2 pt-2 border-t border-gray-200 flex justify-end gap-2">
                  <button onClick={() => handleFeedback(index, 'positive')} className={`p-1 rounded-full ${message.feedback === 'positive'
                    ? 'bg-green-100 text-green-600'
                    : 'hover:bg-gray-200 text-gray-500'}`} aria-label="Helpful" title="Helpful">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/>
                    </svg>
                  </button>
                  <button onClick={() => handleFeedback(index, 'negative')} className={`p-1 rounded-full ${message.feedback === 'negative'
                    ? 'bg-red-100 text-red-600'
                    : 'hover:bg-gray-200 text-gray-500'}`} aria-label="Not helpful" title="Not helpful">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"/>
                    </svg>
                  </button>
                </div>)}
            </div>
          </div>))}
        <div ref={messagesEndRef}/>
      </div>

      {/* Message input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex items-end">
          <div className="flex-grow relative">
            <textarea ref={inputRef} className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto" placeholder={placeholder} rows={1} value={input} onChange={handleInput} onKeyDown={handleKeyDown} style={{ minHeight: '42px', maxHeight: '150px' }}/>
          </div>
          <button type="submit" className={`ml-2 px-4 py-2 rounded-lg focus:outline-none ${isTyping
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`} disabled={!isTyping}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
            </svg>
          </button>
        </form>
        <div className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>);
};
export default ChatInterface;
