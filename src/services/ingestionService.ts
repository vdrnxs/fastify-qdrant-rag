import { ParserService } from './parserService';
import { DocumentService } from './documentService';
import { fileTrackerService } from './fileTrackerService';
import { unlink } from 'fs/promises';

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

export class IngestionService {
  private parserService: ParserService;
  private documentService: DocumentService;

  constructor() {
    this.parserService = new ParserService();
    this.documentService = new DocumentService();
  }

  /**
   * Método unificado para ingestar contenido desde cualquier fuente
   */
  async ingest(options: IngestionOptions): Promise<IngestionResult> {
    try {
      // 1. Obtener texto (ya sea directo o parseado desde archivo)
      const text = await this.getText(options);

      // 2. Procesar y subir a Qdrant
      const result = await this.documentService.ingestDocument(text, {
        ...options.metadata,
        originalFilename: options.filename
      });

      // 3. Cleanup condicional (borrar archivo temporal si aplica)
      if (options.shouldCleanup && options.filePath) {
        await this.cleanup(options.filePath);
      }

      // 4. Actualizar tracking en SQLite si aplica (FileWatcher)
      if (options.fileId) {
        await fileTrackerService.markFileAsProcessed(options.fileId);
      }

      return {
        id: result.id,
        success: result.success,
        source: options.text ? 'text' : 'file',
        metadata: options.metadata
      };
    } catch (error) {
      // En caso de error, limpiar archivo temporal si aplica
      if (options.shouldCleanup && options.filePath) {
        try {
          await this.cleanup(options.filePath);
        } catch {
          // Ignorar errores de cleanup
        }
      }

      // Marcar archivo con error si tiene tracking
      if (options.fileId) {
        await fileTrackerService.markFileAsError(
          options.fileId,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      throw error;
    }
  }

  /**
   * Obtiene el texto desde la fuente proporcionada
   */
  private async getText(options: IngestionOptions): Promise<string> {
    // Si viene texto directo, devolverlo
    if (options.text) {
      return options.text;
    }

    // Si viene archivo, parsearlo
    if (options.filePath && options.fileType) {
      const parsedDoc = await this.parserService.parseFile(
        options.filePath,
        options.fileType
      );
      return parsedDoc.text;
    }

    throw new Error('No text or file provided for ingestion');
  }

  /**
   * Limpia archivos temporales
   */
  private async cleanup(filePath: string): Promise<void> {
    await unlink(filePath);
  }
}

export const ingestionService = new IngestionService();
