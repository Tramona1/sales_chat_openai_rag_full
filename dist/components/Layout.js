"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const head_1 = __importDefault(require("next/head"));
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const Layout = ({ children, title = 'Sales Knowledge Assistant' }) => {
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement(head_1.default, null,
            react_1.default.createElement("title", null, title),
            react_1.default.createElement("meta", { name: "description", content: "Sales knowledge assistant powered by AI" }),
            react_1.default.createElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
            react_1.default.createElement("link", { rel: "icon", href: "/favicon.ico" })),
        react_1.default.createElement("div", { className: "min-h-screen flex flex-col bg-gray-50" },
            react_1.default.createElement("header", { className: "bg-white border-b border-gray-200 shadow-sm" },
                react_1.default.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
                    react_1.default.createElement("div", { className: "flex justify-between items-center h-16" },
                        react_1.default.createElement("div", { className: "flex items-center" },
                            react_1.default.createElement(link_1.default, { href: "/", className: "flex items-center space-x-2 text-primary-600 hover:text-primary-700" },
                                react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-6 w-6" }),
                                react_1.default.createElement("span", { className: "text-xl font-semibold" }, "Sales Knowledge Assistant"))),
                        react_1.default.createElement("nav", { className: "flex items-center space-x-6" },
                            react_1.default.createElement(link_1.default, { href: "/chat", className: "text-gray-600 hover:text-primary-600 flex items-center space-x-1 text-sm font-medium" },
                                react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-4 w-4" }),
                                react_1.default.createElement("span", null, "Chat")),
                            react_1.default.createElement(link_1.default, { href: "/admin", className: "text-gray-600 hover:text-primary-600 flex items-center space-x-1 text-sm font-medium" },
                                react_1.default.createElement(lucide_react_1.Settings, { className: "h-4 w-4" }),
                                react_1.default.createElement("span", null, "Admin")))))),
            react_1.default.createElement("main", { className: "flex-1" }, children),
            react_1.default.createElement("footer", { className: "bg-white border-t border-gray-200 py-6" },
                react_1.default.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
                    react_1.default.createElement("p", { className: "text-center text-sm text-gray-500" }, "Sales Knowledge Assistant \u2014 Powered by AI"))))));
};
exports.default = Layout;
