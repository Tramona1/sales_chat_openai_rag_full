# SalesBuddy API Documentation

## Overview

The SalesBuddy API allows developers to integrate our conversational AI capabilities directly into their applications. This document provides technical details about authentication, endpoints, request formats, and response structures.

## Authentication

All API requests must be authenticated using JWT tokens. To obtain a token:

1. Make a POST request to `https://api.salesbuddy.ai/v1/auth/token`
2. Include your API key in the header: `X-API-Key: your_api_key_here`
3. The response will contain a JWT token valid for 24 hours

Example token request:

```bash
curl -X POST https://api.salesbuddy.ai/v1/auth/token \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json"
```

Example response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2023-07-01T23:59:59Z"
}
```

## API Endpoints

### Conversation Management

#### Start Conversation

```
POST /v1/conversations
```

Request body:

```json
{
  "user_id": "u-123456",
  "context": {
    "customer_id": "c-78910",
    "product_focus": ["SalesBuddy Pro", "Analytics Add-on"]
  }
}
```

Response:

```json
{
  "conversation_id": "conv-abcdef123456",
  "created_at": "2023-06-30T14:22:10Z"
}
```

#### Send Message

```
POST /v1/conversations/{conversation_id}/messages
```

Request body:

```json
{
  "message": "What features are included in the Professional tier?",
  "attachment_urls": []
}
```

Response:

```json
{
  "message_id": "msg-123456",
  "response": "The Professional tier includes all Starter features plus custom training capabilities, dedicated support hours, and full CRM integration with Salesforce, HubSpot, or Microsoft Dynamics.",
  "confidence_score": 0.98,
  "sources": [
    {
      "document_id": "doc-pricing-001",
      "relevance": 0.95
    }
  ]
}
```

### Knowledge Base Management

#### Add Document

```
POST /v1/knowledge/documents
```

Request body:

```json
{
  "title": "Professional Tier Specifications",
  "content": "Full markdown or text content...",
  "metadata": {
    "category": "pricing",
    "visibility": "internal",
    "version": "2023-Q2"
  }
}
```

Response:

```json
{
  "document_id": "doc-pricing-002",
  "status": "processing",
  "estimated_completion": "2023-06-30T14:25:10Z"
}
```

## Rate Limits

The API has the following rate limits:

- Authentication: 10 requests per minute
- Conversation endpoints: 60 requests per minute per API key
- Knowledge base endpoints: 30 requests per minute per API key

Exceeding these limits will result in 429 Too Many Requests responses.

## Error Handling

The API uses standard HTTP status codes and returns error details in the response body:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid conversation ID format",
    "details": {
      "param": "conversation_id",
      "value": "invalid-id-format"
    }
  }
}
```

## Webhook Integration

You can configure webhooks to receive real-time notifications:

1. Register a webhook URL in the developer dashboard
2. Select the events you want to subscribe to
3. We'll send POST requests to your URL when those events occur

Example webhook payload:

```json
{
  "event_type": "conversation.completed",
  "conversation_id": "conv-abcdef123456",
  "timestamp": "2023-06-30T15:01:22Z",
  "data": {
    "duration_seconds": 423,
    "message_count": 8,
    "satisfaction_score": 9
  }
}
```

## SDK Libraries

We provide official SDK libraries for:
- Python: `pip install salesbuddy-python`
- JavaScript: `npm install salesbuddy-node`
- Java: Available through Maven Central
- C#: Available through NuGet

## Technical Support

For technical assistance with API integration:
- Email: api-support@salesbuddy.ai
- Developer Forum: https://developers.salesbuddy.ai/forum
- Office Hours: Tuesdays and Thursdays, 9 AM - 12 PM PT

---

*API specifications are subject to change. Always check the developer portal for the most current documentation.* 