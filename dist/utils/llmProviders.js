"use strict";
/**
 * LLM Providers
 *
 * Utility for accessing different LLM providers (OpenAI, etc.)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.genAI = exports.openai = void 0;
exports.isConfigured = isConfigured;
const openai_1 = __importDefault(require("openai"));
const generative_ai_1 = require("@google/generative-ai");
const config_1 = require("./config");
// Get configuration
const config = (0, config_1.getConfig)();
// Initialize OpenAI client
exports.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY || ((_a = config.openai) === null || _a === void 0 ? void 0 : _a.apiKey) || '',
});
// Initialize Google Generative AI client
exports.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || ((_b = config.gemini) === null || _b === void 0 ? void 0 : _b.apiKey) || '');
// Helper to check if an API key is configured
function isConfigured(provider) {
    var _a, _b;
    if (provider === 'openai') {
        return Boolean(process.env.OPENAI_API_KEY || ((_a = config.openai) === null || _a === void 0 ? void 0 : _a.apiKey));
    }
    else if (provider === 'gemini') {
        return Boolean(process.env.GEMINI_API_KEY || ((_b = config.gemini) === null || _b === void 0 ? void 0 : _b.apiKey));
    }
    return false;
}
