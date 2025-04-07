"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_markdown_1 = __importDefault(require("react-markdown"));
const ChatMessage = ({ message, role, timestamp }) => {
    const isBot = role === 'bot';
    return (react_1.default.createElement("div", { className: `py-5 ${isBot ? 'bg-[#444654]' : 'bg-[#343541]'}` },
        react_1.default.createElement("div", { className: "max-w-3xl mx-auto px-4 flex" },
            react_1.default.createElement("div", { className: `w-8 h-8 flex-shrink-0 mr-4 rounded-full flex items-center justify-center ${isBot ? 'bg-teal-600 text-white' : 'bg-violet-600 text-white'}` }, isBot ? 'AI' : 'U'),
            react_1.default.createElement("div", { className: "flex-1 min-w-0" },
                isBot ? (react_1.default.createElement("div", { className: "prose prose-invert max-w-none text-gray-100" },
                    react_1.default.createElement(react_markdown_1.default, { components: {
                            p: ({ children }) => react_1.default.createElement("p", { className: "mb-2" }, children),
                            a: ({ href, children }) => react_1.default.createElement("a", { href: href, className: "text-blue-400 hover:underline", target: "_blank", rel: "noopener noreferrer" }, children),
                            ul: ({ children }) => react_1.default.createElement("ul", { className: "list-disc pl-5 mb-3" }, children),
                            ol: ({ children }) => react_1.default.createElement("ol", { className: "list-decimal pl-5 mb-3" }, children),
                            li: ({ children }) => react_1.default.createElement("li", { className: "mb-1" }, children),
                            h1: ({ children }) => react_1.default.createElement("h1", { className: "text-xl font-bold my-3" }, children),
                            h2: ({ children }) => react_1.default.createElement("h2", { className: "text-lg font-bold my-2" }, children),
                            h3: ({ children }) => react_1.default.createElement("h3", { className: "text-md font-bold my-2" }, children),
                            code: ({ children }) => react_1.default.createElement("code", { className: "bg-[#2d2d3a] px-1 py-0.5 rounded" }, children),
                            pre: ({ children }) => react_1.default.createElement("pre", { className: "bg-[#2d2d3a] p-3 rounded-md overflow-x-auto my-2" }, children),
                        } }, message))) : (react_1.default.createElement("p", { className: "text-gray-100 whitespace-pre-wrap" }, message)),
                react_1.default.createElement("div", { className: "text-xs text-gray-500 mt-1" }, timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))))));
};
exports.default = ChatMessage;
