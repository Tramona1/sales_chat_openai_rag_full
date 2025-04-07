"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ChatPage;
const react_1 = __importStar(require("react"));
const router_1 = require("next/router");
const axios_1 = __importDefault(require("axios"));
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const ChatMessage_1 = __importDefault(require("@/components/ChatMessage"));
function ChatPage() {
    const router = (0, router_1.useRouter)();
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [input, setInput] = (0, react_1.useState)('');
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const endOfMessagesRef = (0, react_1.useRef)(null);
    const textareaRef = (0, react_1.useRef)(null);
    // Initialize with welcome message and handle URL parameters
    (0, react_1.useEffect)(() => {
        // Check if router is ready and has query parameters
        if (!router.isReady)
            return;
        const { question, autoResponse } = router.query;
        // Handle initial state with welcome message
        if (messages.length === 0) {
            // Initialize with welcome message
            const initialMessages = [{
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
                }
                else {
                    // Process immediately without showing loading state first
                    processMessageForResponse(question, initialMessages);
                }
            }
            else {
                // Just set welcome message if no question
                setMessages(initialMessages);
            }
        }
    }, [router.isReady]); // Only run this effect when router is ready
    // Helper function to process a message and get AI response
    const processMessageForResponse = async (messageText, currentMessages) => {
        try {
            setIsLoading(true);
            // Create context from recent messages
            const recentMessages = currentMessages
                .slice(-5)
                .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                .join('\n');
            // Call API with the message
            const response = await axios_1.default.post('/api/query', {
                query: messageText,
                context: recentMessages
            });
            // Log conversation for admin review
            await axios_1.default.post('/api/log', {
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
        }
        catch (error) {
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
        }
        finally {
            setIsLoading(false);
        }
    };
    // Send message and get response
    const handleSendMessage = async (overrideInput) => {
        const messageText = overrideInput || input;
        if (!messageText.trim() || isLoading)
            return;
        // Check if this message is already in the list (to avoid duplication)
        const messageExists = messages.some(msg => msg.role === 'user' && msg.content === messageText);
        // Only add user message if it doesn't already exist
        let updatedMessages = [...messages];
        if (!messageExists) {
            // Add user message
            const userMessage = {
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
    (0, react_1.useEffect)(() => {
        scrollToBottom();
    }, [messages]);
    const scrollToBottom = () => {
        var _a;
        (_a = endOfMessagesRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth' });
    };
    // Handle input change and auto-resize textarea
    const handleInputChange = (e) => {
        setInput(e.target.value);
        // Auto-resize the textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };
    // Handle key presses
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };
    return (react_1.default.createElement("div", { className: "flex flex-col h-screen bg-[#343541]" },
        react_1.default.createElement("header", { className: "bg-[#202123] text-white p-3 border-b border-gray-700 flex items-center justify-between" },
            react_1.default.createElement("div", { className: "flex items-center" },
                react_1.default.createElement(link_1.default, { href: "/", className: "flex items-center text-gray-300 hover:text-white transition" },
                    react_1.default.createElement(lucide_react_1.ChevronLeft, { className: "h-5 w-5 mr-1" }),
                    react_1.default.createElement("span", null, "Back to Hub"))),
            react_1.default.createElement("h1", { className: "text-xl font-semibold text-center flex-1" }, "Sales Knowledge Assistant"),
            react_1.default.createElement("div", { className: "w-24" }),
            " "),
        react_1.default.createElement("div", { className: "flex-1 overflow-y-auto p-4 space-y-4 bg-[#343541]" },
            messages.map((message) => (react_1.default.createElement(ChatMessage_1.default, { key: message.id, message: message.content, role: message.role, timestamp: message.timestamp }))),
            isLoading && (react_1.default.createElement("div", { className: "flex items-center justify-center p-4" },
                react_1.default.createElement(lucide_react_1.Loader2, { className: "h-6 w-6 text-gray-400 animate-spin" }))),
            react_1.default.createElement("div", { ref: endOfMessagesRef })),
        react_1.default.createElement("div", { className: "border-t border-gray-700 bg-[#3e3f4b] p-4" },
            react_1.default.createElement("div", { className: "max-w-4xl mx-auto relative" },
                react_1.default.createElement("textarea", { ref: textareaRef, value: input, onChange: handleInputChange, onKeyDown: handleKeyDown, placeholder: "Type a question here", className: "w-full bg-[#2a2b32] text-white rounded-lg pl-4 pr-12 py-3 focus:outline-none resize-none", rows: 1, style: { maxHeight: '200px' } }),
                react_1.default.createElement("button", { onClick: () => handleSendMessage(), disabled: isLoading || !input.trim(), className: `absolute right-3 top-3 rounded-md p-1 ${isLoading || !input.trim()
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'}` },
                    react_1.default.createElement(lucide_react_1.Send, { className: "h-5 w-5" }))))));
}
