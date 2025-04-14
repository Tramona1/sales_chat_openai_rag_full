import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

// Define the type for feedback
type FeedbackType = 'positive' | 'negative';

// Type definition for component props
export interface ChatFeedbackProps {
  messageIndex: number;
  query: string;
  response: string;
  sessionId?: string;
  queryLogId?: string; // Added to link feedback to query log
  onFeedbackSubmitted: (type: FeedbackType) => void;
}

// The actual ChatFeedback component
export const ChatFeedback: React.FC<ChatFeedbackProps> = ({
  messageIndex,
  query,
  response,
  sessionId,
  queryLogId, // Destructure queryLogId from props
  onFeedbackSubmitted,
}) => {
  const [submittedFeedback, setSubmittedFeedback] = useState<FeedbackType | null>(null);

  // Function to submit feedback to the backend
  const submitFeedback = async (type: FeedbackType) => {
    // Avoid multiple submissions
    if (submittedFeedback) {
      console.log('Feedback already submitted for this message.');
      return;
    }

    // Basic validation
    if (!query || !response) {
      console.error("Cannot submit feedback: Query or Response is missing.");
      return;
    }

    setSubmittedFeedback(type); // Optimistically update UI

    try {
      // Send feedback data to the backend API
      const feedbackResponse = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          response,
          feedback: type,
          messageIndex,
          sessionId,
          queryLogId: queryLogId, // Include queryLogId from props
          metadata: {
            // Additional metadata can be included here
            pageUrl: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
          }
        })
      });

      if (!feedbackResponse.ok) {
        const errorData = await feedbackResponse.text(); // Get error text for more detail
        throw new Error(`Feedback API Error: ${feedbackResponse.status} ${feedbackResponse.statusText} - ${errorData}`);
      }

      const result = await feedbackResponse.json();

      // Call parent callback on success
      onFeedbackSubmitted(type);

      // Optionally log success
      console.log(`Feedback (${type}) submitted successfully. ID: ${result.id}`);

    } catch (error) {
      // Log error if feedback submission fails
      console.error('Failed to submit feedback:', error);
      // Revert optimistic update on failure
      setSubmittedFeedback(null);
      // Optionally show an error message to the user
      // alert('Failed to submit feedback. Please try again.');
    }
  };

  // Render feedback buttons
  return (
    <div className="mt-2 flex items-center space-x-2 text-gray-400">
      <button
        onClick={() => submitFeedback('positive')}
        disabled={!!submittedFeedback}
        className={`flex items-center p-1 rounded hover:bg-gray-700 transition ${
          submittedFeedback === 'positive' ? 'text-green-500 bg-gray-700' : 'hover:text-green-400'
        } ${submittedFeedback && submittedFeedback !== 'positive' ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Good response"
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button
        onClick={() => submitFeedback('negative')}
        disabled={!!submittedFeedback}
        className={`flex items-center p-1 rounded hover:bg-gray-700 transition ${
          submittedFeedback === 'negative' ? 'text-red-500 bg-gray-700' : 'hover:text-red-400'
        } ${submittedFeedback && submittedFeedback !== 'negative' ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Bad response"
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
      {submittedFeedback && <span className="text-xs">(Feedback submitted)</span>}
    </div>
  );
};

// Default export for convenience if needed elsewhere, though named export is generally preferred
// export default ChatFeedback; 