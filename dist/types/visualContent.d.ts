/**
 * Visual Content Types
 *
 * This file defines interfaces and types for visual content processing.
 */
import { VisualContentType, VisualContentItem as BaseVisualContentItem, BaseMultiModalChunk } from './baseTypes';
export { VisualContentType };
/**
 * Interface for visual content in chunks
 * This extends the base interface from baseTypes.ts
 */
export interface VisualContent extends BaseVisualContentItem {
}
/**
 * Type alias for BaseMultiModalChunk to maintain backward compatibility
 * This replaces the circular dependency that existed with MultiModalChunk
 */
export type TypedMultiModalChunk = BaseMultiModalChunk;
