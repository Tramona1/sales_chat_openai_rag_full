/**
 * Base Types for Multi-Modal Processing
 * 
 * This file contains fundamental type definitions that are shared across
 * multiple modules to avoid circular dependencies.
 */

import { ContextualChunk, ChunkContext } from './documentProcessing';

/**
 * Types of visual content that can be processed
 */
export enum VisualContentType {
  CHART = 'chart',
  TABLE = 'table',
  DIAGRAM = 'diagram',
  GRAPH = 'graph',
  IMAGE = 'image',
  FIGURE = 'figure',
  SCREENSHOT = 'screenshot',
  INFOGRAPHIC = 'infographic',
  UNKNOWN = 'unknown'
}

/**
 * Interface for image analysis results
 */
export interface ImageAnalysisResult {
  description: string;
  extractedText: string;
  type: VisualContentType;
  structuredData?: any;
  
  /** Analysis metadata */
  metadata?: {
    /** When the analysis was performed */
    analysisTime?: string;
    
    /** Duration of analysis in milliseconds */
    durationMs?: number;
    
    /** Model used for analysis */
    model?: string;
    
    /** Image size in bytes */
    sizeBytes?: number;
    
    /** Unique ID for this analysis */
    analysisId?: string;
    
    /** Figure number if applicable */
    figureNumber?: number;
    
    /** Any additional metadata */
    [key: string]: any;
  };
}

/**
 * Extended ContextualChunk interface to include common additional fields
 */
export interface ExtendedContextualChunk extends ContextualChunk {
  metadata?: ContextualChunk['metadata'] & {
    /** Page number in the source document */
    page?: number;
    
    /** Document type (e.g., technical, marketing) */
    documentType?: string;
    
    /** Summary of the parent document */
    documentSummary?: string;
    
    /** Whether this chunk contains ID */
    id?: string;
    
    /** Additional content properties */
    content?: any;
    
    /** Any additional metadata */
    [key: string]: any;
  };
}

/**
 * Interface for visual content in chunks
 */
export interface VisualContentItem {
  /** Type of visual (chart, table, etc.) */
  type: VisualContentType;
  
  /** Description of the visual */
  description: string;
  
  /** Text extracted from the visual */
  detectedText?: string;
  
  /** Extracted text from the visual */
  extractedText?: string;
  
  /** Structured data from the visual (for charts, tables, etc.) */
  data?: any;
  
  /** Structured data from the visual (for charts, tables, etc.) */
  structuredData?: any;
  
  /** Path to the visual file */
  path: string;
  
  /** Page number where the visual appears */
  page?: number;
  
  /** Position on the page */
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
    page?: number;
  };
  
  /** Figure number if applicable */
  figureNumber?: number;
  
  /** Additional metadata */
  metadata?: {
    figureNumber?: number;
    captionText?: string;
    referencedInText?: boolean;
    [key: string]: any;
  };
}

/**
 * Interface for processed image data
 */
export interface ProcessedImage {
  path: string;
  page?: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  analysis: ImageAnalysisResult;
}

/**
 * Enhanced contextual chunk interface with multi-modal support
 * This is the base interface that will be extended by MultiModalChunk
 */
export interface BaseMultiModalChunk extends ExtendedContextualChunk {
  metadata?: ExtendedContextualChunk['metadata'] & {
    hasVisualContent?: boolean;
    visualCount?: number;
    processingError?: string;
  };
  
  /**
   * Visual content associated with this chunk
   */
  visualContent?: Array<VisualContentItem>;
}

/**
 * Interface for document visual analysis results
 */
export interface DocumentVisualAnalysis {
  images: ProcessedImage[];
  hasCharts: boolean;
  hasTables: boolean;
  hasDiagrams: boolean;
} 