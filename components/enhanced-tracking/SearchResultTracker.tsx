import React, { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { trackEvent } from '@/utils/analytics';

interface SearchResultTrackerProps {
  resultId: string;
  query: string;
  index: number;
  sessionId?: string;
  userId?: string;
  children: React.ReactNode;
}

const SearchResultTracker: React.FC<SearchResultTrackerProps> = ({
  resultId,
  query,
  index,
  sessionId,
  userId,
  children
}) => {
  const [hasClicked, setHasClicked] = useState(false);
  const [timeViewed, setTimeViewed] = useState(0);
  const [viewStartTime, setViewStartTime] = useState<number | null>(null);
  
  // Set up intersection observer to track when result is visible
  const { ref, inView } = useInView({
    threshold: 0.5, // At least 50% of the result must be visible
    triggerOnce: false
  });

  // Track when the result comes into view
  useEffect(() => {
    if (inView && !viewStartTime) {
      // Result just came into view
      setViewStartTime(Date.now());
    } else if (!inView && viewStartTime) {
      // Result just went out of view, calculate time viewed
      const timeInView = Date.now() - viewStartTime;
      setTimeViewed(prev => prev + timeInView);
      setViewStartTime(null);
      
      // Track impression if viewed for at least 1 second
      if (timeInView > 1000) {
        trackEvent({
          event_type: 'search_result_impression',
          user_id: userId,
          session_id: sessionId,
          event_data: {
            result_id: resultId,
            query,
            position: index,
            time_viewed_ms: timeInView
          }
        });
      }
    }
  }, [inView, viewStartTime, resultId, query, index, sessionId, userId]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (viewStartTime) {
        const finalTimeInView = Date.now() - viewStartTime;
        setTimeViewed(prev => prev + finalTimeInView);
        
        // Track final impression on unmount if viewed for at least 1 second
        if (finalTimeInView > 1000) {
          trackEvent({
            event_type: 'search_result_impression',
            user_id: userId,
            session_id: sessionId,
            event_data: {
              result_id: resultId,
              query,
              position: index,
              time_viewed_ms: finalTimeInView,
              is_final: true
            }
          });
        }
      }
    };
  }, [viewStartTime, resultId, query, index, sessionId, userId]);

  // Handler for result clicks
  const handleResultClick = () => {
    if (!hasClicked) {
      setHasClicked(true);
      
      // Track result click
      trackEvent({
        event_type: 'search_result_click',
        user_id: userId,
        session_id: sessionId,
        event_data: {
          result_id: resultId,
          query,
          position: index,
          time_to_click_ms: timeViewed + (viewStartTime ? Date.now() - viewStartTime : 0)
        }
      });
    }
  };

  return (
    <div 
      ref={ref} 
      onClick={handleResultClick}
      className="search-result-tracker"
    >
      {children}
    </div>
  );
};

export default SearchResultTracker; 