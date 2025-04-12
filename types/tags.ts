/**
 * Tag type definition for search filtering
 */
export interface Tag {
  value: string;  // The tag text value
  count?: number; // Optional count for how many items have this tag
  type: 'topic' | 'audience' | 'entity' | 'technical'; // Category of tag
} 