"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_markdown_1 = __importDefault(require("react-markdown"));
const ChatMessage = ({ message, role, timestamp }) => {
    const isBot = role === 'bot';
    return (<>
      {isBot ? (<div className="prose prose-invert max-w-none text-gray-100">
          {/* @ts-ignore - Ignoring ReactMarkdown component type issues */}
          <react_markdown_1.default className="markdown-content">
            {message}
          </react_markdown_1.default>
        </div>) : (<p className="text-gray-100 whitespace-pre-wrap">{message}</p>)}
      
      {/* Timestamp in small subtle text */}
      <div className="text-xs text-gray-500 mt-1">
        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </>);
};
exports.default = ChatMessage;
