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
exports.default = TextUploadForm;
const react_1 = __importStar(require("react"));
const UploadForm_module_css_1 = __importDefault(require("@/styles/UploadForm.module.css"));
function TextUploadForm() {
    const [text, setText] = (0, react_1.useState)('');
    const [title, setTitle] = (0, react_1.useState)('');
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [result, setResult] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setResult(null);
        try {
            if (!text.trim()) {
                throw new Error('Please enter some text to process');
            }
            const response = await fetch('/api/processText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    title: title.trim() || undefined,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to process text');
            }
            const data = await response.json();
            setResult(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (react_1.default.createElement("div", { className: UploadForm_module_css_1.default.container },
        react_1.default.createElement("h2", { className: UploadForm_module_css_1.default.title }, "Process Text with AI Understanding"),
        react_1.default.createElement("form", { onSubmit: handleSubmit, className: UploadForm_module_css_1.default.form },
            react_1.default.createElement("div", { className: UploadForm_module_css_1.default.formGroup },
                react_1.default.createElement("label", { htmlFor: "title", className: UploadForm_module_css_1.default.label }, "Title (optional):"),
                react_1.default.createElement("input", { type: "text", id: "title", value: title, onChange: (e) => setTitle(e.target.value), className: UploadForm_module_css_1.default.input, placeholder: "Enter a title for this text" })),
            react_1.default.createElement("div", { className: UploadForm_module_css_1.default.formGroup },
                react_1.default.createElement("label", { htmlFor: "text", className: UploadForm_module_css_1.default.label }, "Text Content:"),
                react_1.default.createElement("textarea", { id: "text", value: text, onChange: (e) => setText(e.target.value), className: UploadForm_module_css_1.default.textarea, placeholder: "Paste or type your text here...", rows: 10, required: true })),
            react_1.default.createElement("button", { type: "submit", className: UploadForm_module_css_1.default.button, disabled: isSubmitting || !text.trim() }, isSubmitting ? 'Processing...' : 'Process Text')),
        error && react_1.default.createElement("div", { className: UploadForm_module_css_1.default.error }, error),
        result && (react_1.default.createElement("div", { className: UploadForm_module_css_1.default.result },
            react_1.default.createElement("h3", null, "Processing Result"),
            react_1.default.createElement("p", null, result.message),
            result.analysis && (react_1.default.createElement("div", { className: UploadForm_module_css_1.default.analysis },
                react_1.default.createElement("h4", null, "Document Analysis"),
                react_1.default.createElement("ul", null,
                    react_1.default.createElement("li", null,
                        react_1.default.createElement("strong", null, "Title:"),
                        " ",
                        result.analysis.title),
                    react_1.default.createElement("li", null,
                        react_1.default.createElement("strong", null, "Topics:"),
                        ' ',
                        result.analysis.topics.join(', ')),
                    react_1.default.createElement("li", null,
                        react_1.default.createElement("strong", null, "Content Type:"),
                        " ",
                        result.analysis.contentType),
                    react_1.default.createElement("li", null,
                        react_1.default.createElement("strong", null, "Technical Level:"),
                        " ",
                        result.analysis.technicalLevel,
                        "/5"))))))));
}
