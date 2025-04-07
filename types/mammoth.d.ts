declare module 'mammoth' {
  interface ConversionOptions {
    convertImage?: (image: any) => Promise<any>;
    includeDefaultStyleMap?: boolean;
    includeEmbeddedStyleMap?: boolean;
    styleMap?: string[] | string;
  }

  interface ConversionResult {
    value: string;
    messages: any[];
  }

  function convertToHtml(input: Buffer | string, options?: ConversionOptions): Promise<ConversionResult>;
  function extractRawText(input: Buffer | string): Promise<ConversionResult>;

  export default {
    convertToHtml,
    extractRawText
  };
} 