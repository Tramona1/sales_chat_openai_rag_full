// Define analytics event types
export var AnalyticsEventType;
(function (AnalyticsEventType) {
    AnalyticsEventType["PAGE_VIEW"] = "page_view";
    AnalyticsEventType["CHAT_STARTED"] = "chat_started";
    AnalyticsEventType["CHAT_MESSAGE_SENT"] = "chat_message_sent";
    AnalyticsEventType["CHAT_MESSAGE_RECEIVED"] = "chat_message_received";
    AnalyticsEventType["SEARCH_PERFORMED"] = "search_performed";
    AnalyticsEventType["DOCUMENT_VIEWED"] = "document_viewed";
    AnalyticsEventType["FEEDBACK_SUBMITTED"] = "feedback_submitted";
    AnalyticsEventType["ERROR_OCCURRED"] = "error_occurred";
    AnalyticsEventType["LOGIN"] = "login";
    AnalyticsEventType["LOGOUT"] = "logout";
})(AnalyticsEventType || (AnalyticsEventType = {}));
// Define search types
export var SearchType;
(function (SearchType) {
    SearchType["HYBRID"] = "hybrid";
    SearchType["VECTOR"] = "vector";
    SearchType["KEYWORD"] = "keyword";
    SearchType["FALLBACK"] = "fallback";
})(SearchType || (SearchType = {}));
// Function to track general analytics events
export async function trackEvent(eventData) {
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
    }
    catch (error) {
        // Log error but don't break application flow
        console.error("Error tracking event:", error);
    }
}
// Function to track search metrics
export async function trackSearch(searchData) {
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
    }
    catch (error) {
        console.error("Error tracking search:", error);
    }
}
// Function to track user feedback
export async function trackFeedback(feedbackData) {
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
    }
    catch (error) {
        console.error("Error tracking feedback:", error);
    }
}
// Utility function to get user and session info
export function getTrackingInfo() {
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
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}
// Helper function to get user ID from storage
function getUserIdFromLocalStorageOrCookie() {
    // Implementation depends on your authentication system
    // This is just a placeholder
    return localStorage.getItem("user_id") || undefined;
}
// Track page views
export function trackPageView(pagePath) {
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
export function trackError(error, context) {
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
