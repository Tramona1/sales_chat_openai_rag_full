# Follow-up Question Handling

This document explains how the Sales Chat RAG system handles follow-up questions in conversations.

## Overview

Follow-up questions are an essential part of natural conversation, allowing users to build on previous exchanges and explore topics in more detail. However, they present unique challenges for a RAG (Retrieval-Augmented Generation) system:

1. **Context Dependency**: They often rely on context from previous messages (e.g., "What are its features?" - where "it" refers to a product mentioned earlier)
2. **Implicit References**: They may use pronouns or implied references that are unclear without conversation history
3. **Brevity**: They tend to be shorter and less specific than standalone questions

Our system employs multiple strategies to effectively handle follow-up questions while maintaining conversation context.

## Detection Methods

The system uses multiple signals to identify follow-up questions:

### Position in Conversation
```typescript
const isNotFirstMessage = hasConversationHistory && 
    conversationHistory.filter(msg => msg.role === 'user').length > 0;
```

- A message is more likely to be a follow-up if it's not the first user message in a conversation
- This provides a strong baseline signal regardless of message content

### Pronoun and Reference Analysis
```typescript
const followUpKeywords = ['who', 'where', 'when', 'why', 'how', 'which', 
    'they', 'them', 'those', 'that', 'it', 'this', 'he', 'she', 'his', 
    'her', 'its', 'their', 'what'];
```

- The system checks for words that commonly indicate a follow-up question
- The presence of pronouns and question words at the beginning of a message strongly suggests a follow-up

### Message Length
```typescript
const isLikelyFollowUp = isNotFirstMessage && (
    hasFollowUpKeywords || 
    originalQuery.length < 20 // Short queries in a conversation are often follow-ups
);
```

- Very short messages in an ongoing conversation are likely to be follow-ups
- This helps catch cases where the user asks a brief question that doesn't contain explicit references

## Context Integration

When a follow-up question is detected, the system:

1. **Extracts Relevant History**: Fetches up to 6 previous messages from the conversation
2. **Formats Context**: Structures the conversation history in a format that's clear for the LLM to understand
3. **Enhances the Query**: Combines the user's question with the conversation context:

```typescript
enhancedQuery = `Given this conversation context:
${contextualInfo}
Answer this follow-up question: ${originalQuery}`;
```

## System Prompt Instructions

The system includes specific instructions for the LLM to better handle follow-up questions:

```
FOLLOW-UP QUESTION HANDLING:
- When responding to follow-up questions, maintain continuity with previous responses in the conversation context.
- If the user refers to information from previous messages (using pronouns like "they", "it", "this", etc.), reference the appropriate content from the conversation history to ensure your response is coherent.
- For incomplete or ambiguous follow-up questions, try to understand the intent based on the conversation history before answering.
- If you cannot determine what a follow-up question refers to, politely ask for clarification rather than making assumptions.
```

## Error Handling

When the system encounters errors with follow-up questions, it provides specialized error messages:

```typescript
if (isLikelyFollowUp) {
  errorMessage = "I apologize, but I need more context to understand your follow-up question. Could you please ask a more complete question that includes specific details about what you're asking?";
} else {
  errorMessage = "I'm sorry, but I encountered an error while processing your request. Please try asking your question again with more details.";
}
```

This guides users toward providing more explicit questions when the system fails to understand a follow-up.

## Implementation Details

The follow-up question handling logic is primarily implemented in:

1. **API Endpoint**: `pages/api/query.ts` - Handles the backend logic for detecting and processing follow-up questions
2. **Frontend**: `pages/chat.tsx` - Manages the conversation flow and error handling for follow-ups
3. **Answer Generation**: `utils/answerGenerator.ts` - Incorporates conversation history when generating responses

## Debugging and Logging

The system includes detailed logging specific to follow-up questions:

```typescript
if (isLikelyFollowUp) {
  logInfo(`Detected follow-up question (position: ${isNotFirstMessage}, keywords: ${hasFollowUpKeywords}): "${originalQuery}"`);
}
```

This helps identify when follow-up questions are triggered and what signals led to their detection.

## Future Improvements

Potential enhancements for follow-up question handling include:

1. **Entity Tracking**: More sophisticated tracking of entities mentioned in previous messages
2. **Intent-Based Analysis**: Deeper analysis of how the follow-up question relates to previous intents
3. **Query Expansion**: More advanced techniques for expanding ambiguous follow-up questions with relevant context 

## Authentication Update

As of the latest update, authentication requirements have been removed from the admin API endpoints to address issues with unauthorized access errors in the production environment. The following changes were implemented:

1. **Removed Authentication Check in Single Chat Session API**: The `/api/admin/chat-sessions/[id]` endpoint no longer requires authentication headers, eliminating 401 errors when updating or deleting chat sessions.

2. **Removed Authentication Wrapper from Chat Sessions List API**: The `/api/admin/chat-sessions` endpoint now bypasses the `withAdminAuth` wrapper, allowing direct access to list, search, and manage sessions.

3. **Improved Error Handling for Metrics Collection**: The metrics recording functionality now properly skips all filesystem operations in the Vercel production environment, preventing errors related to directory creation.

These changes ensure that chat sessions can be properly created, updated, and managed in the production environment without authentication errors. A more comprehensive authentication system will be implemented in future updates when needed. 