declare module 'tesseract.js' {
  interface Worker {
    load(): Promise<Worker>;
    loadLanguage(language: string): Promise<Worker>;
    initialize(language: string): Promise<Worker>;
    recognize(image: string | Buffer | ImageLike): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }

  interface ImageLike {
    width: number;
    height: number;
  }

  interface RecognizeResult {
    data: {
      text: string;
      hocr: string;
      tsv: string;
      blocks: any[];
      confidence: number;
      lines: any[];
      words: any[];
    };
  }

  function createWorker(options?: {
    logger?: (message: any) => void;
    langPath?: string;
    cachePath?: string;
    gzip?: boolean;
    corePath?: string;
    workerPath?: string;
  }): Worker;

  export { createWorker };
} 