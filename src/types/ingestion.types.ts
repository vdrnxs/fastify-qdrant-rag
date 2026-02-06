export interface IngestionOptions {
  // Texto directo (para /documents/ingest)
  text?: string;

  // Archivo (para /documents/upload y FileWatcher)
  filePath?: string;
  fileType?: string;
  filename?: string;

  // Control de comportamiento
  shouldCleanup?: boolean;  // Borrar archivo después de procesar
  fileId?: string;          // ID para tracking en SQLite

  // Metadata común
  metadata?: Record<string, unknown>;
}

export interface IngestionResult {
  id: number;
  success: boolean;
  source: 'text' | 'file';
  metadata?: Record<string, unknown>;
}