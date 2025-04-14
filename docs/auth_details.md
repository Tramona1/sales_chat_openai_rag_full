# Authentication Details

## Overview

This document outlines the authentication approach for the Sales Chat RAG system, specifically focusing on securing the administrative sections and API endpoints.

**Goal:** To ensure that only authorized administrators can access sensitive data, manage documents, and configure the system.

**For the Non-Technical Reader:** Just like you need a password to log into your email, administrators need a secure way to log into the system's control panel (the Admin Dashboard). This prevents unauthorized users from changing the AI's knowledge or accessing private information.

## Current Status (Placeholder Implementation)

**As of the last review (`documentation/PROJECT_STATUS.md`), a full authentication system is NOT implemented.**

*   **Placeholder:** A placeholder function, likely named `withAdminAuth` (potentially located in `utils/auth.ts` or middleware), is currently used.
*   **Functionality:** This placeholder **does not perform real authentication**. It typically allows *all* requests to proceed, possibly logging a warning message indicating that proper authentication is needed.
*   **Purpose:** This allows developers to work on the admin features without being blocked by login requirements during the development phase.
*   **CRITICAL:** This placeholder **MUST BE REPLACED** with a robust authentication mechanism before deploying the application to any environment accessible by others, especially production.

## Requirements for Production Authentication

A production-ready authentication system should meet the following requirements:

1.  **Secure Login:** Provide a secure login mechanism for administrators (e.g., username/password, SSO via Google/Microsoft, etc.).
2.  **Session Management:** Securely manage user sessions (e.g., using cookies, JWTs, or Supabase Auth's built-in session handling).
3.  **API Protection:** Protect all administrative API routes (e.g., everything under `/api/admin/`) to ensure only authenticated administrators can access them.
4.  **Role-Based Access Control (RBAC) (Optional but Recommended):** Implement roles (e.g., Admin, Editor, Viewer) to grant different levels of access to various admin features.
5.  **Password Management:** If using password-based login, ensure secure password hashing and storage, plus features like password reset.
6.  **Integration with Frontend:** The frontend Admin Dashboard needs to handle login forms, manage authentication state, and conditionally render components based on user login status and role.

## Recommended Approach (Using Supabase Auth)

Leveraging Supabase Auth is the recommended approach as it integrates seamlessly with the existing Supabase backend.

1.  **Enable Supabase Auth:** Enable the Auth service in your Supabase project settings.
2.  **Choose Providers:** Configure desired authentication providers (e.g., Email/Password, Google, etc.).
3.  **Frontend Implementation:**
    *   Use the `@supabase/auth-helpers-nextjs` library for easy integration with Next.js.
    *   Create login/signup pages/components using Supabase Auth UI components or custom forms calling Supabase Auth functions (`signInWithPassword`, `signUp`, `signInWithOAuth`, `signOut`).
    *   Manage session state using the Auth helpers.
    *   Wrap the Admin Dashboard layout/pages to require authentication.
4.  **Backend (API Route Protection):**
    *   Replace the placeholder `withAdminAuth` middleware.
    *   Use Supabase Auth helpers within API routes (or middleware) to:
        *   Verify the user's session/JWT from the incoming request.
        *   Check if the authenticated user has the required administrative role (requires implementing role checking, often using custom claims in JWTs or a separate `user_roles` table).
        *   Reject requests from unauthenticated or unauthorized users with appropriate HTTP status codes (401 Unauthorized, 403 Forbidden).
5.  **Role Management (If Implementing RBAC):**
    *   Design a `roles` table and potentially a `user_roles` mapping table in Supabase.
    *   Assign roles to users upon signup or via an admin interface.
    *   Modify the API protection logic to check for specific roles.

## Security Considerations

*   **Environment Variables:** Securely store Supabase API keys and JWT secrets.
*   **Row-Level Security (RLS):** Implement Supabase RLS policies on sensitive tables (e.g., `documents`, `document_chunks`, user data) to ensure users can only access data they are permitted to, even if the API protection were somehow bypassed.
*   **Input Validation:** Always validate input on API routes.
*   **Rate Limiting:** Implement rate limiting on login and other sensitive endpoints.

Implementing proper authentication is a critical security requirement before the application can be considered production-ready. 