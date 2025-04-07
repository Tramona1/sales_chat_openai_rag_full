export interface FeedbackLog {
  id: string;
  timestamp: string;
  query: string;
  feedback: {
    helpful: boolean;
    rating?: number;
    comments?: string;
  };
  context?: {
    retrievedDocuments?: string[];
    modelUsed?: string;
    processingTimeMs?: number;
  };
} 