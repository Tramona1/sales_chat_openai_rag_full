import React, { useState } from 'react';
import { ThumbUpIcon, ThumbDownIcon } from '@heroicons/react/outline';
import { trackFeedback } from '@/utils/analytics';
const ChatFeedback = ({ messageIndex, query, response, sessionId, userId, onFeedbackSubmitted }) => {
    const [feedback, setFeedback] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [showTextarea, setShowTextarea] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const handleFeedback = async (type) => {
        if (submitting)
            return;
        try {
            setSubmitting(true);
            setFeedback(type);
            // Submit feedback to API
            await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    response,
                    feedback: type,
                    messageIndex,
                    sessionId,
                    userId,
                }),
            });
            // Track feedback in analytics
            await trackFeedback({
                user_id: userId,
                session_id: sessionId,
                rating: type === 'positive' ? 5 : 1,
                feedback_text: '',
            });
            // Show text area for additional feedback if negative
            if (type === 'negative') {
                setShowTextarea(true);
            }
            // Call callback if provided
            if (onFeedbackSubmitted) {
                onFeedbackSubmitted(type);
            }
        }
        catch (error) {
            console.error('Error submitting feedback:', error);
        }
        finally {
            setSubmitting(false);
        }
    };
    const submitDetailedFeedback = async () => {
        if (!feedbackText.trim()) {
            setShowTextarea(false);
            return;
        }
        try {
            setSubmitting(true);
            // Submit detailed feedback
            await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    response,
                    feedback: feedback,
                    messageIndex,
                    sessionId,
                    userId,
                    metadata: {
                        detailed_feedback: feedbackText,
                    }
                }),
            });
            // Track detailed feedback in analytics
            await trackFeedback({
                user_id: userId,
                session_id: sessionId,
                rating: feedback === 'positive' ? 5 : 1,
                feedback_text: feedbackText,
            });
            // Hide textarea after submission
            setShowTextarea(false);
            setFeedbackText('');
        }
        catch (error) {
            console.error('Error submitting detailed feedback:', error);
        }
        finally {
            setSubmitting(false);
        }
    };
    return (<div className="flex flex-col">
      <div className="flex items-center space-x-2 mt-2">
        <span className="text-xs text-gray-500">Was this response helpful?</span>
        <button onClick={() => handleFeedback('positive')} disabled={submitting || feedback !== null} className={`p-1 rounded-full ${feedback === 'positive'
            ? 'bg-green-100 text-green-600'
            : 'text-gray-400 hover:text-green-600 hover:bg-green-100'} transition-colors`} aria-label="Thumbs up">
          <ThumbUpIcon className="h-4 w-4"/>
        </button>
        <button onClick={() => handleFeedback('negative')} disabled={submitting || feedback !== null} className={`p-1 rounded-full ${feedback === 'negative'
            ? 'bg-red-100 text-red-600'
            : 'text-gray-400 hover:text-red-600 hover:bg-red-100'} transition-colors`} aria-label="Thumbs down">
          <ThumbDownIcon className="h-4 w-4"/>
        </button>
        
        {feedback && (<span className="text-xs text-gray-500 ml-2">
            {feedback === 'positive' ? 'Thank you for your feedback!' : 'Thanks for letting us know.'}
          </span>)}
      </div>
      
      {showTextarea && (<div className="mt-2 w-full">
          <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Please tell us how we can improve..." className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" rows={3}/>
          <div className="mt-1 flex justify-end space-x-2">
            <button onClick={() => setShowTextarea(false)} className="px-3 py-1 text-xs text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
              Cancel
            </button>
            <button onClick={submitDetailedFeedback} className="px-3 py-1 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700" disabled={submitting}>
              Submit
            </button>
          </div>
        </div>)}
    </div>);
};
export default ChatFeedback;
