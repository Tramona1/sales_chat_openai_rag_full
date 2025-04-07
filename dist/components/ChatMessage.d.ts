import React from 'react';
interface ChatMessageProps {
    message: string;
    role: 'user' | 'bot';
    timestamp: Date;
}
declare const ChatMessage: React.FC<ChatMessageProps>;
export default ChatMessage;
