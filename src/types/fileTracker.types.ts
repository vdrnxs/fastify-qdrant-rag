export type FileStatus = 'PENDING' | 'MODIFIED' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'DELETED';

export interface FileUpdateData {
  status?: FileStatus;
  contentHash?: string;
  lastModified?: Date;
  lastScanned?: Date;
  fileSize?: number;
  lastError?: string | null;
  processingAttempts?: { increment: number };
  qdrantPointId?: string | null;
}

export interface FileMetadata {
  fileName: string;
  fileExtension: string;
  contentHash: string;
  fileSize: number;
  lastModified: Date;
}

export interface ScanStats {
  added: number;
  modified: number;
  unchanged: number;
  errors: number;
}