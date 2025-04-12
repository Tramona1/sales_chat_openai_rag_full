/**
 * Type declarations for pdf-parse module
 */

declare module 'pdf-parse' {
  interface PDFExtractResult {
    text: string;
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion: string;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      [key: string]: any;
    };
    metadata: {
      [key: string]: any;
    };
    version: string;
  }

  type PdfParseOptions = {
    pagerender?: (pageData: any) => string;
    max?: number;
  };

  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: PdfParseOptions
  ): Promise<PDFExtractResult>;

  export = pdfParse;
} 