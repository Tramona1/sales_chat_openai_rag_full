import { VectorStoreItem } from './vectorStore';
/**
 * Types of conflicts that can be detected
 */
export declare enum ConflictType {
    CONTRADICTORY = "contradictory",
    OUTDATED = "outdated",
    INCOMPLETE = "incomplete",
    DUPLICATE = "duplicate"
}
/**
 * Group of documents with conflicts
 */
export interface ConflictGroup {
    topic: string;
    entityName?: string;
    documents: VectorStoreItem[];
    conflicts: {
        type: ConflictType;
        description: string;
        affectedDocIds: string[];
        confidence?: number;
        detectedBy?: 'pattern' | 'gemini';
    }[];
    suggestedResolution?: {
        preferredDocId: string;
        reason: string;
        confidence?: number;
    };
    isHighPriority: boolean;
}
/**
 * Enhanced version of ConflictGroup with Gemini analysis
 */
export interface EnhancedConflictGroup extends ConflictGroup {
    conflicts: {
        type: ConflictType;
        description: string;
        affectedDocIds: string[];
        confidence: number;
        detectedBy: 'pattern' | 'gemini';
    }[];
    suggestedResolution?: {
        preferredDocId: string;
        reason: string;
        confidence: number;
    };
}
/**
 * Detect conflicts between documents
 *
 * This function identifies contradictions, outdated information, and other
 * conflicts across the document set. It's particularly focused on high-value
 * information like leadership details, pricing, and product capabilities.
 *
 * @param documents The set of documents to analyze for conflicts
 * @param entityName Optional entity name to focus conflict detection
 * @param useGemini Whether to use Gemini for enhanced conflict detection
 * @returns Array of conflict groups
 */
export declare function detectDocumentConflicts(documents: VectorStoreItem[], entityName?: string, useGemini?: boolean): Promise<ConflictGroup[]> | ConflictGroup[];
/**
 * Detect conflicts between documents using Gemini's semantic analysis
 *
 * This enhanced version uses both pattern matching and Gemini API to identify
 * conflicts, providing more accurate detection of semantic contradictions.
 *
 * @param documents The set of documents to analyze for conflicts
 * @param entityName Optional entity name to focus conflict detection
 * @returns Array of enhanced conflict groups
 */
export declare function detectConflictsWithGemini(documents: VectorStoreItem[], entityName?: string): Promise<EnhancedConflictGroup[]>;
/**
 * Format a document snippet for display
 */
export declare function formatDocumentSnippet(doc: VectorStoreItem, maxLength?: number): string;
