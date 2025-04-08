import React from 'react';
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    id?: string;
    feedback?: 'positive' | 'negative' | null;
}
interface ChatInterfaceProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onFeedback?: (messageIndex: number, feedback: 'positive' | 'negative') => void;
    placeholder?: string;
    containerRef?: React.RefObject<HTMLDivElement>;
}
declare const ChatInterface: React.FC<ChatInterfaceProps>;
export default ChatInterface;
