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
exports.getServerSideProps = void 0;
exports.default = Admin;
const react_1 = __importStar(require("react"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Layout_1 = __importDefault(require("../components/Layout"));
const lucide_react_1 = require("lucide-react");
const SystemMetrics_1 = __importDefault(require("../components/SystemMetrics"));
const DocumentManager_1 = __importDefault(require("../components/DocumentManager"));
const getServerSideProps = async () => {
    const logPath = path_1.default.join(process.cwd(), 'feedback.json');
    let logs = [];
    if (fs_1.default.existsSync(logPath)) {
        try {
            logs = JSON.parse(fs_1.default.readFileSync(logPath, 'utf8'));
            // Sort logs by timestamp, newest first
            logs.sort((a, b) => b.timestamp - a.timestamp);
        }
        catch (error) {
            console.error('Error parsing logs:', error);
        }
    }
    return { props: { logs } };
};
exports.getServerSideProps = getServerSideProps;
function Admin({ logs }) {
    const [searchTerm, setSearchTerm] = (0, react_1.useState)('');
    const [activeTab, setActiveTab] = (0, react_1.useState)('metrics');
    const filteredLogs = logs.filter(log => log.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.response.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.sender.toLowerCase().includes(searchTerm.toLowerCase()));
    // Function to export logs as JSON
    const exportLogs = () => {
        const dataStr = JSON.stringify(logs, null, 2);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
        const exportFileDefaultName = `sales_assistant_logs_${new Date().toISOString().slice(0, 10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };
    return (react_1.default.createElement(Layout_1.default, { title: "Admin Dashboard" },
        react_1.default.createElement("div", { className: "max-w-7xl mx-auto" },
            react_1.default.createElement("div", { className: "mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" },
                react_1.default.createElement("h1", { className: "text-2xl font-bold text-gray-900" }, "Admin Dashboard"),
                activeTab === 'feedback' && (react_1.default.createElement("div", { className: "flex gap-3" },
                    react_1.default.createElement("div", { className: "relative" },
                        react_1.default.createElement(lucide_react_1.Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" }),
                        react_1.default.createElement("input", { type: "text", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), placeholder: "Search logs...", className: "pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" })),
                    react_1.default.createElement("button", { onClick: exportLogs, className: "flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 transition" },
                        react_1.default.createElement(lucide_react_1.Download, { className: "h-4 w-4" }),
                        "Export")))),
            react_1.default.createElement("div", { className: "mb-6 border-b border-gray-200" },
                react_1.default.createElement("nav", { className: "-mb-px flex space-x-8", "aria-label": "Tabs" },
                    react_1.default.createElement("button", { onClick: () => setActiveTab('metrics'), className: `${activeTab === 'metrics'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center` },
                        react_1.default.createElement(lucide_react_1.Layers, { className: "h-5 w-5 mr-2" }),
                        "System Metrics"),
                    react_1.default.createElement("button", { onClick: () => setActiveTab('documents'), className: `${activeTab === 'documents'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center` },
                        react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-5 w-5 mr-2" }),
                        "Document Management"),
                    react_1.default.createElement("button", { onClick: () => setActiveTab('feedback'), className: `${activeTab === 'feedback'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center` },
                        react_1.default.createElement(lucide_react_1.User, { className: "h-5 w-5 mr-2" }),
                        "Feedback Logs"))),
            react_1.default.createElement("div", { className: "space-y-6" },
                activeTab === 'metrics' && (react_1.default.createElement(SystemMetrics_1.default, { refreshInterval: 30000 })),
                activeTab === 'documents' && (react_1.default.createElement(DocumentManager_1.default, { limit: 100 })),
                activeTab === 'feedback' && (react_1.default.createElement(react_1.default.Fragment, null,
                    filteredLogs.length === 0 && (react_1.default.createElement("div", { className: "bg-white rounded-lg shadow p-6 text-center" },
                        react_1.default.createElement("p", { className: "text-gray-500" }, logs.length === 0 ? 'No logs available yet.' : 'No logs match your search.'))),
                    react_1.default.createElement("div", { className: "space-y-4" }, filteredLogs.map((log, idx) => (react_1.default.createElement("div", { key: idx, className: "bg-white rounded-lg shadow overflow-hidden" },
                        react_1.default.createElement("div", { className: "p-4 border-b border-gray-100 flex items-center bg-gray-50" },
                            react_1.default.createElement("div", { className: "flex items-center flex-1" },
                                react_1.default.createElement(lucide_react_1.User, { className: "h-4 w-4 text-primary-600 mr-2" }),
                                react_1.default.createElement("span", { className: "font-medium text-gray-700" }, log.sender)),
                            react_1.default.createElement("div", { className: "text-sm text-gray-500 flex items-center" },
                                react_1.default.createElement(lucide_react_1.Calendar, { className: "h-4 w-4 mr-1" }),
                                new Date(log.timestamp).toLocaleString())),
                        react_1.default.createElement("div", { className: "p-4 space-y-3" },
                            react_1.default.createElement("div", { className: "flex items-start" },
                                react_1.default.createElement("div", { className: "mt-1 mr-3" },
                                    react_1.default.createElement("div", { className: "bg-primary-100 text-primary-800 p-1 rounded-full" },
                                        react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-4 w-4" }))),
                                react_1.default.createElement("div", null,
                                    react_1.default.createElement("p", { className: "text-sm font-medium text-gray-900 mb-1" }, "Question"),
                                    react_1.default.createElement("p", { className: "text-sm text-gray-700 whitespace-pre-wrap" }, log.text))),
                            react_1.default.createElement("div", { className: "flex items-start" },
                                react_1.default.createElement("div", { className: "mt-1 mr-3" },
                                    react_1.default.createElement("div", { className: "bg-gray-100 text-gray-800 p-1 rounded-full" },
                                        react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-4 w-4" }))),
                                react_1.default.createElement("div", null,
                                    react_1.default.createElement("p", { className: "text-sm font-medium text-gray-900 mb-1" }, "Response"),
                                    react_1.default.createElement("p", { className: "text-sm text-gray-700 whitespace-pre-wrap" }, log.response))))))))))))));
}
