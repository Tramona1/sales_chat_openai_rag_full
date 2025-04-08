/**
 * LLM Providers
 *
 * Utility for accessing different LLM providers (OpenAI, etc.)
 */
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
export declare const openai: OpenAI;
export declare const genAI: GoogleGenerativeAI;
export declare function isConfigured(provider: 'openai' | 'gemini'): boolean;
