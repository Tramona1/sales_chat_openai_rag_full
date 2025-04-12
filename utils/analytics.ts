import { z } from "zod";

// Define analytics event types
export enum AnalyticsEventType {
  PAGE_VIEW = "page_view",
  CHAT_STARTED = "chat_started",
  CHAT_MESSAGE_SENT = "chat_message_sent",
  CHAT_MESSAGE_RECEIVED = "chat_message_received",
  SEARCH_PERFORMED = "search_performed",
  DOCUMENT_VIEWED = "document_viewed",
  FEEDBACK_SUBMITTED = "feedback_submitted",
  ERROR_OCCURRED = "error_occurred",
  LOGIN = "login",
  LOGOUT = "logout",
}

// Define search types
export enum SearchType {
  HYBRID = "hybrid",
  VECTOR = "vector",
  KEYWORD = "keyword",
  FALLBACK = "fallback",
}

// Function to track general analytics events
export async function trackEvent(eventData: {
  event_type: string;
  user_id?: string;
  session_id?: string;
  event_data?: Record<string, any>;
  source_page?: string;
  duration_ms?: number;
  success?: boolean;
  device_info?: Record<string, any>;
}): Promise<void> {
  try {
    const response = await fetch("/api/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "event",
        data: eventData,
      }),
    });

    if (!response.ok) {
      console.error("Failed to track event:", await response.text());
    }
  } catch (error) {
    // Log error but don't break application flow
    console.error("Error tracking event:", error);
  }
}

// Function to track search metrics
export async function trackSearch(searchData: {
  user_id?: string;
  session_id?: string;
  query_text: string;
  search_type: SearchType;
  result_count: number;
  execution_time_ms?: number;
  clicked_results?: any[];
  relevance_feedback?: Record<string, any>;
  filter_used?: Record<string, any>;
  company_context?: string;
  query_category?: string;
}): Promise<void> {
  try {
    const response = await fetch("/api/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "search",
        data: searchData,
      }),
    });

    if (!response.ok) {
      console.error("Failed to track search:", await response.text());
    }
  } catch (error) {
    console.error("Error tracking search:", error);
  }
}

// Function to track user feedback
export async function trackFeedback(feedbackData: {
  user_id?: string;
  session_id?: string;
  query_id?: string;
  document_id?: string;
  rating: number;
  feedback_text?: string;
  feedback_category?: string;
}): Promise<void> {
  try {
    const response = await fetch("/api/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "feedback",
        data: feedbackData,
      }),
    });

    if (!response.ok) {
      console.error("Failed to track feedback:", await response.text());
    }
  } catch (error) {
    console.error("Error tracking feedback:", error);
  }
}

// Utility function to get user and session info
export function getTrackingInfo(): { 
  user_id?: string; 
  session_id: string;
  device_info: Record<string, any>;
} {
  // Get or create session ID
  let session_id = localStorage.getItem("chat_session_id");
  if (!session_id) {
    session_id = generateSessionId();
    localStorage.setItem("chat_session_id", session_id);
  }

  // Get user ID if logged in (implementation depends on your auth system)
  const user_id = getUserIdFromLocalStorageOrCookie();

  // Basic device info
  const device_info = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return {
    user_id,
    session_id,
    device_info,
  };
}

// Helper function to generate a random session ID
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Helper function to get user ID from storage
function getUserIdFromLocalStorageOrCookie(): string | undefined {
  // Implementation depends on your authentication system
  // This is just a placeholder
  return localStorage.getItem("user_id") || undefined;
}

// Track page views
export function trackPageView(pagePath: string): void {
  const { user_id, session_id, device_info } = getTrackingInfo();
  
  trackEvent({
    event_type: AnalyticsEventType.PAGE_VIEW,
    user_id,
    session_id,
    source_page: pagePath,
    device_info,
    event_data: {
      url: window.location.href,
      referrer: document.referrer,
    },
  });
}

// Track errors
export function trackError(error: Error, context?: Record<string, any>): void {
  const { user_id, session_id, device_info } = getTrackingInfo();
  
  trackEvent({
    event_type: AnalyticsEventType.ERROR_OCCURRED,
    user_id,
    session_id,
    device_info,
    event_data: {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
    },
    success: false,
  });
} 