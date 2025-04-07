/**
 * LLM Providers
 * 
 * Utility for accessing different LLM providers (OpenAI, etc.)
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from './config';

// Get configuration
const config = getConfig();

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || config.openai?.apiKey || '',
});

// Initialize Google Generative AI client
export const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || config.gemini?.apiKey || ''
);

// Helper to check if an API key is configured
export function isConfigured(provider: 'openai' | 'gemini'): boolean {
  if (provider === 'openai') {
    return Boolean(process.env.OPENAI_API_KEY || config.openai?.apiKey);
  } else if (provider === 'gemini') {
    return Boolean(process.env.GEMINI_API_KEY || config.gemini?.apiKey);
  }
  return false;
} 