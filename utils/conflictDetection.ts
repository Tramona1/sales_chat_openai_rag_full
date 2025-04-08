import { VectorStoreItem } from './vectorStore';
import { logInfo, logError } from './errorHandling';
import { detectConflictWithGemini } from './geminiProcessor';

/**
 * Types of conflicts that can be detected
 */
export enum ConflictType {
  CONTRADICTORY = 'contradictory',
  OUTDATED = 'outdated',
  INCOMPLETE = 'incomplete',
  DUPLICATE = 'duplicate'
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
 * Expected result from Gemini conflict detection
 */
interface GeminiConflictResult {
  hasConflict: boolean;
  conflictType?: string;
  conflictDescription?: string;
  confidence: number;
  preferredDocument?: string;
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
export function detectDocumentConflicts(
  documents: VectorStoreItem[],
  entityName?: string,
  useGemini: boolean = false
): Promise<ConflictGroup[]> | ConflictGroup[] {
  // Return early if no documents
  if (!documents || documents.length === 0) {
    return [];
  }
  
  // If using Gemini for semantic conflict detection
  if (useGemini) {
    // Use enhanced conflict detection with Gemini
    return detectConflictsWithGemini(documents, entityName);
  }
  
  // Otherwise, use traditional pattern-based detection
  const conflictGroups: ConflictGroup[] = [];
  
  // If entity name is provided, filter documents for that entity
  let relevantDocs = documents;
  if (entityName) {
    relevantDocs = documents.filter(doc => 
      doc.text.toLowerCase().includes(entityName.toLowerCase())
    );
  }
  
  // Detect CEO/leadership conflicts
  const leadershipConflicts = detectLeadershipConflicts(relevantDocs);
  if (leadershipConflicts) {
    conflictGroups.push(leadershipConflicts);
  }
  
  // Detect pricing conflicts
  const pricingConflicts = detectPricingConflicts(relevantDocs);
  if (pricingConflicts) {
    conflictGroups.push(pricingConflicts);
  }
  
  // Detect product feature conflicts
  const featureConflicts = detectFeatureConflicts(relevantDocs);
  if (featureConflicts) {
    conflictGroups.push(...featureConflicts);
  }
  
  // Log conflict detection results
  logInfo(`Pattern-based conflict detection completed`, {
    totalDocuments: documents.length,
    conflictsFound: conflictGroups.length,
    highPriorityConflicts: conflictGroups.filter(g => g.isHighPriority).length
  });
  
  return conflictGroups;
}

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
export async function detectConflictsWithGemini(
  documents: VectorStoreItem[],
  entityName?: string
): Promise<EnhancedConflictGroup[]> {
  const conflictGroups: EnhancedConflictGroup[] = [];
  
  // Return early if no documents
  if (!documents || documents.length === 0) {
    return [];
  }
  
  // First, get pattern-based conflicts as a starting point
  const patternBasedGroups = detectDocumentConflicts(documents, entityName) as ConflictGroup[];
  
  // Convert pattern-based groups to enhanced format
  patternBasedGroups.forEach(group => {
    conflictGroups.push({
      ...group,
      conflicts: group.conflicts.map(conflict => ({
        ...conflict,
        confidence: conflict.confidence || 0.7, // Default confidence for pattern-based detection
        detectedBy: conflict.detectedBy || 'pattern'
      })),
      suggestedResolution: group.suggestedResolution ? {
        ...group.suggestedResolution,
        confidence: group.suggestedResolution.confidence || 0.7 // Default confidence for pattern-based resolution
      } : undefined
    });
  });
  
  // Next, identify potential document pairs for semantic conflict analysis
  const potentialConflictPairs: Array<{
    doc1: VectorStoreItem; 
    doc2: VectorStoreItem;
    topic: string;
  }> = [];
  
  // For documents with similar categories or topics, check for conflicts
  // Start by grouping documents by primary category
  const docsByCategory: Record<string, VectorStoreItem[]> = {};
  
  for (const doc of documents) {
    // Get category from metadata, handling different possible field names
    // Use indexing approach to avoid TypeScript property access errors
    const category = 
      (doc.metadata && 'category' in doc.metadata ? doc.metadata.category as string : null) || 
      (doc.metadata && 'primaryCategory' in doc.metadata ? doc.metadata.primaryCategory as string : null) || 
      'uncategorized';
      
    if (!docsByCategory[category]) {
      docsByCategory[category] = [];
    }
    docsByCategory[category].push(doc);
  }
  
  // For each category with multiple documents, create potential conflict pairs
  for (const [category, docs] of Object.entries(docsByCategory)) {
    if (docs.length < 2) continue; // Need at least 2 docs to have a conflict
    
    // Check each pair of documents in this category
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        potentialConflictPairs.push({
          doc1: docs[i],
          doc2: docs[j],
          topic: category
        });
      }
    }
  }
  
  // Limit the number of pairs to analyze to avoid excessive API calls
  const MAX_PAIRS_TO_ANALYZE = 10;
  const pairsToAnalyze = potentialConflictPairs.slice(0, MAX_PAIRS_TO_ANALYZE);
  
  // Analyze each pair for conflicts using Gemini
  for (const pair of pairsToAnalyze) {
    try {
      const { doc1, doc2, topic } = pair;
      
      // Check for conflicts using Gemini
      const conflictAnalysis = await detectConflictWithGemini(
        { 
          id: doc1.metadata?.source || 'doc1', 
          text: doc1.text 
        },
        { 
          id: doc2.metadata?.source || 'doc2', 
          text: doc2.text 
        }
      ) as GeminiConflictResult;
      
      // If no conflict detected, continue to next pair
      if (!conflictAnalysis.hasConflict || conflictAnalysis.confidence < 0.5) {
        continue;
      }
      
      // Create a new conflict group or add to existing one
      const existingGroupIndex = conflictGroups.findIndex(
        g => g.topic === topic && 
          g.documents.some(d => 
            d.metadata?.source === doc1.metadata?.source || 
            d.metadata?.source === doc2.metadata?.source
          )
      );
      
      if (existingGroupIndex >= 0) {
        // Add to existing group
        const group = conflictGroups[existingGroupIndex];
        
        // Add documents if not already present
        [doc1, doc2].forEach(doc => {
          if (!group.documents.some(d => d.metadata?.source === doc.metadata?.source)) {
            group.documents.push(doc);
          }
        });
        
        // Add conflict
        group.conflicts.push({
          type: (conflictAnalysis.conflictType as ConflictType) || ConflictType.CONTRADICTORY,
          description: conflictAnalysis.conflictDescription || 'Semantic contradiction detected',
          affectedDocIds: [
            doc1.metadata?.source || '', 
            doc2.metadata?.source || ''
          ].filter(Boolean),
          confidence: conflictAnalysis.confidence,
          detectedBy: 'gemini'
        });
        
        // Update high priority flag if needed
        if (conflictAnalysis.confidence > 0.8) {
          group.isHighPriority = true;
        }
        
        // Update resolution if exists
        if (conflictAnalysis.preferredDocument) {
          group.suggestedResolution = {
            preferredDocId: conflictAnalysis.preferredDocument,
            reason: 'Identified as more accurate by semantic analysis',
            confidence: conflictAnalysis.confidence
          };
        }
      } else {
        // Create new conflict group
        conflictGroups.push({
          topic,
          documents: [doc1, doc2],
          conflicts: [{
            type: (conflictAnalysis.conflictType as ConflictType) || ConflictType.CONTRADICTORY,
            description: conflictAnalysis.conflictDescription || 'Semantic contradiction detected',
            affectedDocIds: [
              doc1.metadata?.source || '', 
              doc2.metadata?.source || ''
            ].filter(Boolean),
            confidence: conflictAnalysis.confidence,
            detectedBy: 'gemini'
          }],
          suggestedResolution: conflictAnalysis.preferredDocument ? {
            preferredDocId: conflictAnalysis.preferredDocument,
            reason: 'Identified as more accurate by semantic analysis',
            confidence: conflictAnalysis.confidence
          } : undefined,
          isHighPriority: conflictAnalysis.confidence > 0.8
        });
      }
    } catch (error) {
      logError('Error analyzing conflicts with Gemini', error);
    }
  }
  
  // Log conflict detection results
  logInfo(`Gemini-enhanced conflict detection completed`, {
    totalDocuments: documents.length,
    conflictsFound: conflictGroups.length,
    highPriorityConflicts: conflictGroups.filter(g => g.isHighPriority).length,
    semanticConflicts: conflictGroups
      .flatMap(g => g.conflicts)
      .filter(c => c.detectedBy === 'gemini').length
  });
  
  return conflictGroups;
}

/**
 * Detect conflicts in leadership information (CEO, executives)
 */
function detectLeadershipConflicts(documents: VectorStoreItem[]): ConflictGroup | null {
  // Pattern for leadership mentions
  const ceoPattern = /\b(ceo|chief\s+executive|founder|co-founder)\b/i;
  
  // Filter for documents mentioning leadership
  const leadershipDocs = documents.filter(doc => 
    ceoPattern.test(doc.text.toLowerCase())
  );
  
  if (leadershipDocs.length <= 1) {
    return null; // No conflicts possible with 0-1 documents
  }
  
  // Extract CEO names using regex patterns
  const ceoMentions: Array<{
    docId: string;
    name: string;
    context: string;
    createdAt: Date;
  }> = [];
  
  for (const doc of leadershipDocs) {
    // Simple pattern to identify CEO mentions (can be improved with NLP)
    const ceoMentionPatterns = [
      /(?:our|the|current|new)\s+(?:ceo|chief\s+executive)\s+(?:is|:|named)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:is|serves\s+as|has\s+been|was\s+named|was\s+appointed)\s+(?:the|our|as)\s+(?:ceo|chief\s+executive)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:,| is| -| –)\s+(?:the\s+)?(?:co-founder|founder)\s+(?:and|&)\s+(?:ceo|chief\s+executive)/i
    ];
    
    for (const pattern of ceoMentionPatterns) {
      const matches = doc.text.match(pattern);
      if (matches && matches[1]) {
        const name = matches[1].trim();
        const contextStart = Math.max(0, doc.text.indexOf(matches[0]) - 50);
        const contextEnd = Math.min(doc.text.length, doc.text.indexOf(matches[0]) + matches[0].length + 50);
        const context = doc.text.substring(contextStart, contextEnd);
        
        ceoMentions.push({
          docId: doc.metadata?.source || '',
          name,
          context,
          createdAt: doc.metadata?.createdAt ? new Date(doc.metadata.createdAt) : new Date(0)
        });
      }
    }
  }
  
  // Check for conflicts
  if (ceoMentions.length <= 1) {
    return null; // No conflicts detected
  }
  
  // Get unique names
  const uniqueNames = [...new Set(ceoMentions.map(m => m.name))];
  
  // If there's only one unique name, no conflict
  if (uniqueNames.length <= 1) {
    return null;
  }
  
  // We have a conflict - multiple names mentioned as CEO
  // Get the newest mention by createdAt date
  const sortedMentions = [...ceoMentions].sort((a, b) => 
    b.createdAt.getTime() - a.createdAt.getTime()
  );
  
  const newestMention = sortedMentions[0];
  
  // Create conflict group
  return {
    topic: 'Leadership',
    entityName: 'CEO',
    documents: leadershipDocs,
    conflicts: [{
      type: ConflictType.CONTRADICTORY,
      description: `Multiple people identified as CEO: ${uniqueNames.join(', ')}`,
      affectedDocIds: ceoMentions.map(m => m.docId)
    }],
    suggestedResolution: {
      preferredDocId: newestMention.docId,
      reason: `Most recent mention (${newestMention.createdAt.toISOString()}) identifies ${newestMention.name} as CEO`
    },
    isHighPriority: true
  };
}

/**
 * Detect conflicts in pricing information
 */
function detectPricingConflicts(documents: VectorStoreItem[]): ConflictGroup | null {
  // Implement specific pricing conflict detection
  // Similar to leadership detection but focused on pricing patterns
  
  // For now, return a placeholder
  return null;
}

/**
 * Detect conflicts in product feature descriptions
 */
function detectFeatureConflicts(documents: VectorStoreItem[]): ConflictGroup[] {
  // Implement specific feature conflict detection
  // Search for contradictory descriptions of the same feature
  
  // For now, return an empty array
  return [];
}

/**
 * Determine if a document is newer than another
 */
function isNewer(doc1: VectorStoreItem, doc2: VectorStoreItem): boolean {
  // Try different date fields in order of preference
  const getDate = (doc: VectorStoreItem): Date => {
    if (doc.metadata?.lastUpdated) {
      return new Date(doc.metadata.lastUpdated);
    }
    if (doc.metadata?.createdAt) {
      return new Date(doc.metadata.createdAt);
    }
    if (doc.metadata?.timestamp) {
      return new Date(doc.metadata.timestamp);
    }
    return new Date(0); // Default to epoch if no date
  };
  
  return getDate(doc1).getTime() > getDate(doc2).getTime();
}

/**
 * Format a document snippet for display
 */
export function formatDocumentSnippet(doc: VectorStoreItem, maxLength: number = 100): string {
  if (!doc.text) return '';
  
  const text = doc.text.substring(0, maxLength);
  return text + (doc.text.length > maxLength ? '...' : '');
} 