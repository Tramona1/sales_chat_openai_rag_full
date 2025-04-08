export interface FeedbackLog {
    sender: string;
    text: string;
    response: string;
    timestamp: number;
    sessionId?: string;
}
