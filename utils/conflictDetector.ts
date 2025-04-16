// utils/conflictDetector.ts
import { generateStructuredGeminiResponse } from './geminiClient';
import { logError, logInfo } from './logger';

interface DocumentInput {
  id: string;
  text: string;
}

interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictType?: "contradictory" | "outdated" | "incomplete" | "duplicate" | "none";
  conflictDescription?: string;
  confidence: number;
  preferredDocument?: string;
}

function generateConflictDetectionPrompt(doc1: DocumentInput, doc2: DocumentInput): string {
  return `
You are a conflict resolution AI designed to compare two documents and identify inconsistencies.

Analyze both documents and determine if they contain conflicting or redundant information.

DOCUMENT 1 (ID: ${doc1.id}):
${doc1.text.substring(0, 4000)}...[Truncated]

DOCUMENT 2 (ID: ${doc2.id}):
${doc2.text.substring(0, 4000)}...[Truncated]

Respond in this JSON format:
{
  "hasConflict": true|false,
  "conflictType": "contradictory | outdated | incomplete | duplicate | none",
  "conflictDescription": "Brief summary of the conflict",
  "confidence": 0.0 - 1.0,
  "preferredDocument": "ID of the more reliable or recent document, or null if equal"
}

Focus especially on:
- Executive roles (CEO, CTO, etc.)
- Product details (features, specs, versions)
- Pricing information (tiers, discounts)
- Timeline inconsistencies (launch dates, updates)

Only report conflicts if they contradict or overlap meaningfully—not just differences in scope or topic.
`;
}

const conflictResponseSchema = {
  hasConflict: { type: "boolean" },
  conflictType: { type: "string", enum: ["contradictory", "outdated", "incomplete", "duplicate", "none"] },
  conflictDescription: { type: "string" },
  confidence: { type: "number" },
  preferredDocument: { type: ["string", "null"] }, // Allow string or null
};

export async function detectConflictWithGemini(
  doc1: DocumentInput,
  doc2: DocumentInput
): Promise<ConflictDetectionResult> {
  const startTime = Date.now();
  try {
    const prompt = generateConflictDetectionPrompt(doc1, doc2);
    
    // Using generateStructuredGeminiResponse assumes it handles the call and JSON parsing
    const result = await generateStructuredGeminiResponse(
      "", // System prompt is embedded in the main prompt
      prompt,
      conflictResponseSchema
    );

    const duration = Date.now() - startTime;
    logInfo(`[API ConflictDetect] Gemini Conflict Detection Success in ${duration}ms`);
    
    // Validate result structure (basic)
    if (typeof result.hasConflict !== 'boolean' || typeof result.confidence !== 'number') {
      throw new Error('Invalid response structure from conflict detection LLM');
    }
    
    return {
      hasConflict: result.hasConflict,
      conflictType: result.conflictType,
      conflictDescription: result.conflictDescription,
      confidence: result.confidence,
      preferredDocument: result.preferredDocument,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('[API ConflictDetect] Gemini Conflict Detection Error', { error: error instanceof Error ? error.message : String(error) });
    
    // Return a default non-conflict result on error
    return {
      hasConflict: false,
      confidence: 0,
      conflictDescription: "Error during analysis",
    };
  }
} 