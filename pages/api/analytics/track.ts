import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Add validation to prevent the error
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase configuration is missing. Please check your environment variables.');
  // We'll initialize supabase conditionally below
}

// Only create client if we have valid credentials
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Define schema for analytics events
const AnalyticsEventSchema = z.object({
  event_type: z.string(),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  event_data: z.record(z.any()).optional(),
  source_page: z.string().optional(),
  duration_ms: z.number().optional(),
  success: z.boolean().optional(),
  device_info: z.record(z.any()).optional(),
  timestamp: z.string().optional(),
});

// Define schema for search metrics
const SearchMetricSchema = z.object({
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  query_text: z.string(),
  search_type: z.enum(['hybrid', 'vector', 'keyword', 'fallback']),
  result_count: z.number(),
  execution_time_ms: z.number().optional(),
  clicked_results: z.array(z.any()).optional(),
  relevance_feedback: z.record(z.any()).optional(),
  filter_used: z.record(z.any()).optional(),
  company_context: z.string().optional(),
  query_category: z.string().optional(),
});

// Define schema for user feedback
const FeedbackSchema = z.object({
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  query_id: z.string().optional(),
  document_id: z.string().optional(),
  rating: z.number().min(1).max(5),
  feedback_text: z.string().optional(),
  feedback_category: z.string().optional(),
});

// Define the payload schema to encompass different types
const PayloadSchema = z.object({
  type: z.enum(['event', 'search', 'feedback']),
  data: z.union([
    AnalyticsEventSchema,
    SearchMetricSchema,
    FeedbackSchema
  ]),
});

/**
 * API handler for tracking various analytics events
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Parse and validate request data
    const validationResult = PayloadSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Invalid request data",
        errors: validationResult.error.format()
      });
    }
    
    const { type, data } = validationResult.data;

    // Process based on the event type
    let result;
    switch (type) {
      case "event":
        result = await trackEvent(data as z.infer<typeof AnalyticsEventSchema>);
        break;
      case "search":
        result = await trackSearch(data as z.infer<typeof SearchMetricSchema>);
        break;
      case "feedback":
        result = await trackFeedback(data as z.infer<typeof FeedbackSchema>);
        break;
      default:
        return res.status(400).json({ message: "Invalid event type" });
    }

    return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
  } catch (error) {
    console.error("Error tracking analytics:", error);
    return res.status(500).json({ message: "Failed to track analytics", error: error instanceof Error ? error.message : "Unknown error" });
  }
}

/**
 * Track general analytics events
 */
async function trackEvent(eventData: z.infer<typeof AnalyticsEventSchema>) {
  if (!supabase) {
    console.error('Supabase client not initialized. Analytics event not tracked.');
    return;
  }

  const { error } = await supabase
    .from("analytics_events")
    .insert({
      event_type: eventData.event_type,
      user_id: eventData.user_id,
      session_id: eventData.session_id,
      event_data: eventData.event_data,
      source_page: eventData.source_page,
      duration_ms: eventData.duration_ms,
      success: eventData.success,
      device_info: eventData.device_info,
      timestamp: eventData.timestamp || new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Error inserting analytics event: ${error.message}`);
  }
}

/**
 * Track search metrics
 */
async function trackSearch(searchData: z.infer<typeof SearchMetricSchema>) {
  if (!supabase) {
    console.error('Supabase client not initialized. Search metrics not tracked.');
    return;
  }

  const { error } = await supabase
    .from("search_metrics")
    .insert({
      user_id: searchData.user_id,
      session_id: searchData.session_id,
      query_text: searchData.query_text,
      search_type: searchData.search_type,
      result_count: searchData.result_count,
      execution_time_ms: searchData.execution_time_ms,
      clicked_results: searchData.clicked_results,
      relevance_feedback: searchData.relevance_feedback,
      filter_used: searchData.filter_used,
      company_context: searchData.company_context,
      query_category: searchData.query_category,
      timestamp: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Error inserting search metric: ${error.message}`);
  }
  
  // Optionally update or create an aggregated entry in search_queries_aggregated
  // You can add this functionality later if needed
}

/**
 * Track user feedback
 */
async function trackFeedback(feedbackData: z.infer<typeof FeedbackSchema>) {
  if (!supabase) {
    console.error('Supabase client not initialized. User feedback not tracked.');
    return;
  }

  const { error } = await supabase
    .from("user_feedback")
    .insert({
      user_id: feedbackData.user_id,
      session_id: feedbackData.session_id,
      query_id: feedbackData.query_id,
      document_id: feedbackData.document_id,
      rating: feedbackData.rating,
      feedback_text: feedbackData.feedback_text,
      feedback_category: feedbackData.feedback_category,
      timestamp: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Error inserting feedback: ${error.message}`);
  }
} 