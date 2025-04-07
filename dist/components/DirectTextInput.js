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
const react_1 = __importStar(require("react"));
const axios_1 = __importDefault(require("axios"));
const lucide_react_1 = require("lucide-react");
const DirectTextInput = ({ onUploadComplete }) => {
    const [text, setText] = (0, react_1.useState)('');
    const [title, setTitle] = (0, react_1.useState)('');
    const [uploading, setUploading] = (0, react_1.useState)(false);
    const [uploadStatus, setUploadStatus] = (0, react_1.useState)('');
    const handleSubmit = async () => {
        if (!text.trim()) {
            setUploadStatus('Please enter some text');
            return;
        }
        setUploading(true);
        setUploadStatus('Processing...');
        try {
            const res = await axios_1.default.post('/api/uploadText', {
                text,
                title: title.trim() || 'Direct Text Input'
            });
            setUploadStatus(res.data.message);
            onUploadComplete(res.data.message);
            setText('');
            setTitle('');
        }
        catch (error) {
            console.error('Error processing text:', error);
            setUploadStatus('Failed to process text. Please try again.');
        }
        finally {
            setUploading(false);
        }
    };
    return (react_1.default.createElement("div", { className: "space-y-4" },
        react_1.default.createElement("input", { type: "text", placeholder: "Title for this knowledge (optional)", value: title, onChange: (e) => setTitle(e.target.value), className: "w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-300 focus:outline-none" }),
        react_1.default.createElement("textarea", { value: text, onChange: (e) => setText(e.target.value), placeholder: "Paste or enter your knowledge here...", className: "w-full h-40 p-3 border border-gray-200 rounded-lg bg-white text-gray-800 shadow-sm resize-y focus:ring-2 focus:ring-primary-300 focus:border-primary-300 focus:outline-none" }),
        react_1.default.createElement("div", { className: "flex justify-end" },
            react_1.default.createElement("button", { onClick: handleSubmit, disabled: uploading || !text.trim(), className: `flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${uploading || !text.trim()
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'}` }, uploading ? (react_1.default.createElement(react_1.default.Fragment, null,
                react_1.default.createElement(lucide_react_1.Loader2, { className: "h-4 w-4 mr-2 animate-spin" }),
                "Processing")) : (react_1.default.createElement(react_1.default.Fragment, null,
                react_1.default.createElement(lucide_react_1.FileText, { className: "h-4 w-4 mr-2" }),
                "Save & Process")))),
        uploadStatus && (react_1.default.createElement("p", { className: `text-sm ${uploadStatus.includes('Failed') ? 'text-red-500' : 'text-green-600'}` }, uploadStatus))));
};
exports.default = DirectTextInput;
