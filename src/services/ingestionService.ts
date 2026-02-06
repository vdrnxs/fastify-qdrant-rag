import { ParserService } from './parserService';
import { DocumentService } from './documentService';
import { fileTrackerService } from './fileTrackerService';
import { unlink } from 'fs/promises';
import { IngestionOptions, IngestionResult } from '../types/ingestion.types';

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

      // 3. Post-processing: cleanup y tracking
      await this.handleSuccess(options, result.id);

      return {
        id: result.id,
        success: result.success,
        source: options.text ? 'text' : 'file',
        metadata: options.metadata
      };
    } catch (error) {
      // 4. Error handling: cleanup y tracking
      await this.handleError(options, error);
      throw error;
    }
  }

  /**
   * Maneja el post-processing exitoso: cleanup y tracking
   */
  private async handleSuccess(options: IngestionOptions, qdrantId: number) {
    // Cleanup condicional
    if (options.shouldCleanup && options.filePath) {
      await this.cleanup(options.filePath).catch(() => {
        // Ignorar errores de cleanup
      });
    }

    // Tracking en SQLite
    if (options.fileId) {
      await fileTrackerService.markFileAsProcessed(
        options.fileId,
        qdrantId.toString()
      );
    }
  }

  /**
   * Maneja errores: cleanup y tracking
   */
  private async handleError(options: IngestionOptions, error: unknown) {
    // Cleanup condicional
    if (options.shouldCleanup && options.filePath) {
      await this.cleanup(options.filePath).catch(() => {
        // Ignorar errores de cleanup
      });
    }

    // Tracking en SQLite
    if (options.fileId) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await fileTrackerService.markFileAsError(options.fileId, errorMessage);
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
  private async cleanup(filePath: string) {
    await unlink(filePath);
  }
}

export const ingestionService = new IngestionService();
