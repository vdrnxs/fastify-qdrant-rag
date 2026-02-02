// Legacy job data (keep for backward compatibility)
export interface DocumentJobData {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentJobResult {
  id: number;
  success: boolean;
}

// Job types for document processing pipeline
export enum JobType {
  PARSE_DOCUMENT = 'parse_document',
}

// Parse job - Extract text from uploaded file
export interface ParseDocumentJobData {
  jobType: JobType.PARSE_DOCUMENT;
  filePath: string;
  filename: string;
  fileType: string;
  shouldDeleteAfterProcessing?: boolean; // true para archivos temporales de API, false para archivos monitoreados
  metadata?: Record<string, unknown>;
}

export interface ParsedDocument {
  text: string;
  metadata: {
    filename: string;
    fileType: string;
    pageCount?: number;
    wordCount: number;
  };
}
