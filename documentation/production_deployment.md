# Production Deployment Plan for Internal Feedback Dashboard

## Overview

This document outlines the steps needed to securely deploy the Workstream Sales Chat application with its feedback and analytics dashboard as an internal tool. The plan addresses URL formation issues, security concerns, and provides guidance for different deployment scenarios.

## 1. URL Resolution and Environment Configuration

### Environment Variables

Set up the following environment variables in your production environment:

```bash
# Base URL for the application (e.g., https://sales-chat.workstream.us)
NEXT_PUBLIC_BASE_URL=https://your-production-domain.com

# Admin API key (use a strong random value)
ADMIN_API_KEY=<generate-a-strong-random-key>

# OpenAI and other external API keys
OPENAI_API_KEY=<your-openai-key>
GEMINI_API_KEY=<your-gemini-key>

# For Vercel deployments
VERCEL_URL=<your-vercel-url> # Set automatically in Vercel
```

### URL Formation Best Practices

1. **Client-side requests**: Always use relative URLs for API calls from browser code
   - Example: `/api/feedback` instead of full URLs

2. **Server-side requests**: Always use absolute URLs with proper protocol and host
   - Use `getBaseUrl()` utility or construct URLs as implemented in the fixes

3. **Cross-environment compatibility**: Ensure URL construction works across:
   - Local development
   - Production environments
   - Preview deployments

## 2. Database Integration for Production

Replace the current file-based in-memory storage with a proper database:

1. **Choose a database**:
   - MongoDB for document-based storage
   - PostgreSQL for relational data needs
   - Supabase or Firebase for managed solutions

2. **Update APIs to use database**:
   - Replace the direct API calls in `pages/api/admin/analytics.ts`
   - Update `pages/api/admin/feedback.ts` to use database instead of in-memory array
   - Create proper database models and schemas

3. **Sample implementation with MongoDB**:

```typescript
// pages/api/admin/feedback.ts
import { MongoClient, ObjectId } from 'mongodb';

// Database connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const database = client.db('sales_chat');
const feedbackCollection = database.collection('feedback');

// GET handler
async function handleGet(req, res) {
  const { sessionId, type } = req.query;
  let query = {};
  
  if (sessionId) {
    query.sessionId = sessionId;
  }
  
  if (type === 'company' || type === 'general') {
    query['metadata.sessionType'] = type;
  }
  
  const results = await feedbackCollection.find(query).toArray();
  return res.status(200).json(results);
}

// POST handler
async function handlePost(req, res) {
  const feedback = req.body;
  const result = await feedbackCollection.insertOne({
    ...feedback,
    timestamp: Date.now()
  });
  
  return res.status(201).json({ 
    success: true, 
    id: result.insertedId.toString() 
  });
}
```

## 3. Security Measures for Internal Tool

1. **Authentication**:
   - Implement a proper authentication system (NextAuth.js recommended)
   - Add login requirement for accessing `/admin` routes
   - Use JWT tokens with proper expiration

2. **Authorization**:
   - Replace the simple admin key check with role-based access control
   - Restrict dashboard access to specific user roles (admin, manager)

3. **API Protection**:
   - Add rate limiting to prevent abuse
   - Implement proper CORS policies
   - Add request validation

4. **Implementation example**:

```typescript
// pages/api/admin/[...path].ts - API route middleware
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Check authorization (role-based)
  if (!session.user.roles.includes('admin')) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  // Continue to actual handler based on path
  const path = req.query.path || [];
  const endpoint = path[0];
  
  switch(endpoint) {
    case 'feedback':
      return handleFeedback(req, res);
    case 'analytics':
      return handleAnalytics(req, res);
    default:
      return res.status(404).json({ error: "Not found" });
  }
}
```

5. **Protect Admin UI**:

```typescript
// pages/admin/index.tsx
export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  
  if (!session || !session.user.roles.includes('admin')) {
    return {
      redirect: {
        destination: '/login?returnUrl=/admin',
        permanent: false,
      },
    };
  }
  
  return { props: { session } };
}
```

## 4. Deployment Strategy

### 1. Single-instance Deployment (Simplest)

Deploy the entire application as a single Next.js instance with restricted access to the `/admin` routes.

**Pros:**
- Simpler infrastructure
- Shared codebase
- No cross-origin issues

**Cons:**
- No separation between public and internal tools
- Larger attack surface

### 2. Separate Deployment for Admin Dashboard (Recommended)

Deploy two separate instances:
1. Public-facing sales chat application
2. Internal admin dashboard with feedback analytics

**Pros:**
- Stronger separation of concerns
- Better security isolation
- Can apply different scaling policies

**Cons:**
- More complex setup
- Requires API coordination between services

### 3. Implementation Steps for Separate Deployments

1. **Split the codebase**:
   - Create a separate repo for the admin dashboard
   - Extract shared utilities to a common package

2. **Configure API communication**:
   - Set up secure API endpoints for communication between services
   - Use proper authentication between services

3. **Database access**:
   - Both applications connect to the same database
   - Apply proper access controls at the database level

## 5. Monitoring and Maintenance

1. **Error Tracking**:
   - Implement Sentry or similar error tracking
   - Set up alerts for critical errors

2. **Performance Monitoring**:
   - Add New Relic or similar APM solution
   - Monitor API endpoints for latency issues

3. **Security Updates**:
   - Regularly update dependencies
   - Implement security scanners in CI/CD pipeline

## 6. Testing Checklist Before Deployment

- [ ] All API endpoints return proper status codes
- [ ] Authentication and authorization work as expected
- [ ] Feedback is correctly stored in the database
- [ ] Analytics dashboard displays accurate data
- [ ] URL formation works correctly across environments
- [ ] Error handling gracefully manages failures
- [ ] Rate limiting and security measures are effective

## 7. Rollout Plan

1. **Phase 1: Infrastructure Setup**
   - Set up database
   - Configure environment variables
   - Implement authentication system

2. **Phase 2: Internal Testing**
   - Deploy to staging environment
   - Test with small group of internal users
   - Fix issues and refine

3. **Phase 3: Production Deployment**
   - Deploy to production with restricted access
   - Monitor closely for first 48 hours
   - Gradually expand access to all intended users

4. **Phase 4: Maintenance Mode**
   - Regular backups
   - Performance optimization
   - Feature enhancements based on feedback 