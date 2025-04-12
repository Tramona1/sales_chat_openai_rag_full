/**
 * Image Analyzer Utility
 *
 * Provides functionality to analyze images using Gemini Vision API
 * and extract structured information for the RAG system.
 */
import { ImageAnalysisResult as BaseImageAnalysisResult } from '../../types/baseTypes';
/**
 * Types of visual content that can be identified
 * Maps to the VisualContentType enum
 */
export type ImageType = 'chart' | 'table' | 'diagram' | 'screenshot' | 'photo' | 'unknown';
/**
 * Result of image analysis
 * Extends the base interface from baseTypes.ts
 */
export interface ImageAnalysisResult extends BaseImageAnalysisResult {
    success: boolean;
    error?: string;
    data?: any;
    extractedText: string;
    detectedText?: string;
}
/**
 * Options for image analysis
 */
export interface ImageAnalysisOptions {
    extractStructuredData?: boolean;
    extractText?: boolean;
    model?: 'gemini-2.0-flash' | 'gemini-pro-vision';
    temperature?: number;
}
/**
 * ImageAnalyzer class for analyzing images with Gemini Vision
 */
export declare class ImageAnalyzer {
    private static getGeminiClient;
    /**
     * Analyzes an image using Gemini Vision API
     *
     * @param imagePathOrBuffer - Path to image file or Buffer containing image data
     * @param options - Analysis options
     * @returns Analysis result
     */
    static analyze(imagePathOrBuffer: string | Buffer, options?: ImageAnalysisOptions): Promise<ImageAnalysisResult>;
    /**
     * Determines the image type from Gemini's response
     */
    private static determineImageType;
    /**
     * Generates contextual information from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Document context for the image
     */
    static generateDocumentContext(analysis: ImageAnalysisResult): any;
    /**
     * Extracts main topics from the image analysis
     */
    private static extractTopicsFromAnalysis;
    /**
     * Extracts entities from the image analysis
     */
    private static extractEntitiesFromAnalysis;
    /**
     * Assesses the technical level of the image content
     * (0-3 scale)
     */
    private static assessTechnicalLevel;
    /**
     * Determines the likely audience type for the image
     */
    private static determineAudienceType;
    /**
     * Generates chunk context information from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Chunk context for the image
     */
    static generateChunkContext(analysis: ImageAnalysisResult): any;
    /**
     * Extracts key points from the image analysis
     */
    private static extractKeyPointsFromAnalysis;
    /**
     * Prepares text for embedding from image analysis
     *
     * @param analysis Result of image analysis
     * @returns Text prepared for embedding
     */
    static prepareTextForEmbedding(analysis: ImageAnalysisResult): string;
}
export default ImageAnalyzer;
