import { prisma } from '../config/database';
import type { File as PrismaFile } from '../../generated/prisma/client';
import glob from 'fast-glob';
import { hashFile } from 'hasha';
import fs from 'fs/promises';
import path from 'path';
import { documentQueue } from '../queues/documentQueue';
import { JobType } from '../types/jobs.types';
import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';
import type { FileStatus, FileUpdateData, FileMetadata, ScanStats } from '../types/fileTracker.types';

const MONITORED_PATH = process.env.MONITORED_FOLDER_PATH || './files';

export class FileTrackerService {
  /**
   * Helper: Actualiza un archivo en la base de datos
   */
  private async updateFile(fileId: string, data: FileUpdateData): Promise<void> {
    await prisma.file.update({
      where: { id: fileId },
      data
    });
  }

  /**
   * Helper: Obtiene archivos por estado(s)
   */
  private async getFilesByStatus(statuses: FileStatus[]) {
    return await prisma.file.findMany({
      where: {
        status: { in: statuses }
      }
    });
  }

  /**
   * Helper: Elimina un vector de Qdrant
   */
  private async deleteFromQdrant(qdrantPointId: string): Promise<void> {
    try {
      const pointIdNumber = parseInt(qdrantPointId, 10);
      await qdrantClient.delete(COLLECTION_NAME, {
        points: [pointIdNumber]
      });
      console.log(`Vector eliminado de Qdrant: ${qdrantPointId}`);
    } catch (error) {
      console.error(`Error eliminando vector ${qdrantPointId} de Qdrant:`, error);
    }
  }

  /**
   * Helper: Obtiene todos los archivos en el folder monitorizado
   */
  private async getFilesInFolder(): Promise<string[]> {
    return await glob('**/*', {
      cwd: MONITORED_PATH,
      absolute: true,
      onlyFiles: true,
      dot: false
    });
  }

  /**
   * Helper: Extrae metadatos de un archivo
   */
  private async extractFileMetadata(filePath: string): Promise<FileMetadata> {
    const fileStats = await fs.stat(filePath);
    return {
      fileName: path.basename(filePath),
      fileExtension: path.extname(filePath).slice(1).toLowerCase(),
      contentHash: await hashFile(filePath, { algorithm: 'sha256' }),
      fileSize: fileStats.size,
      lastModified: fileStats.mtime
    };
  }

  /**
   * Helper: Crea un nuevo archivo en la base de datos
   */
  private async createNewFile(filePath: string, metadata: FileMetadata): Promise<void> {
    await prisma.file.create({
      data: {
        filePath,
        fileName: metadata.fileName,
        fileExtension: metadata.fileExtension,
        fileSize: metadata.fileSize,
        contentHash: metadata.contentHash,
        status: 'PENDING',
        lastModified: metadata.lastModified
      }
    });
  }

  /**
   * Helper: Reactiva un archivo previamente eliminado
   */
  private async reactivateDeletedFile(fileId: string, metadata: FileMetadata): Promise<void> {
    await this.updateFile(fileId, {
      contentHash: metadata.contentHash,
      status: 'PENDING',
      lastModified: metadata.lastModified,
      lastScanned: new Date(),
      fileSize: metadata.fileSize,
      lastError: null,
      processingAttempts: { increment: 0 }
    });
  }

  /**
   * Helper: Maneja un archivo modificado
   */
  private async handleModifiedFile(file: PrismaFile, metadata: FileMetadata): Promise<void> {
    if (file.qdrantPointId) {
      await this.deleteFromQdrant(file.qdrantPointId);
    }

    await this.updateFile(file.id, {
      contentHash: metadata.contentHash,
      status: 'MODIFIED',
      lastModified: metadata.lastModified,
      lastScanned: new Date(),
      fileSize: metadata.fileSize,
      qdrantPointId: null
    });
  }

  /**
   * Helper: Procesa un archivo individual y retorna su resultado
   */
  private async processIndividualFile(
    filePath: string,
    existingFile: PrismaFile | undefined,
  ): Promise<'added' | 'modified' | 'unchanged'> {
    const metadata = await this.extractFileMetadata(filePath);

    // Archivo nuevo o reactivado
    if (!existingFile || existingFile.status === 'DELETED') {
      if (!existingFile) {
        await this.createNewFile(filePath, metadata);
      } else {
        await this.reactivateDeletedFile(existingFile.id, metadata);
      }
      return 'added';
    }

    // Archivo modificado
    if (existingFile.contentHash !== metadata.contentHash) {
      await this.handleModifiedFile(existingFile, metadata);
      return 'modified';
    }

    // Archivo sin cambios
    await this.updateFile(existingFile.id, {
      lastScanned: new Date()
    });
    return 'unchanged';
  }

  /**
   * Helper: Procesa un batch de archivos y actualiza estadísticas
   */
  private async processFilesInBatch(
    files: string[],
    existingFilesMap: Map<string, PrismaFile>,
    stats: ScanStats
  ): Promise<Set<string>> {
    const processedPaths = new Set<string>();

    for (const filePath of files) {
      try {
        processedPaths.add(filePath);
        const existingFile = existingFilesMap.get(filePath);
        const result = await this.processIndividualFile(filePath, existingFile);
        stats[result]++;
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        stats.errors++;
      }
    }

    return processedPaths;
  }

  /**
   * Helper: Maneja archivos que fueron eliminados del filesystem
   */
  private async handleDeletedFiles(
    existingFiles: PrismaFile[],
    processedPaths: Set<string>
  ): Promise<void> {
    const deletedFiles = existingFiles.filter(
      file => !processedPaths.has(file.filePath)
    );

    if (deletedFiles.length === 0) return;

    // Eliminar vectores de Qdrant
    for (const file of deletedFiles) {
      if (file.qdrantPointId) {
        await this.deleteFromQdrant(file.qdrantPointId);
      }
    }

    // Marcar como DELETED en SQLite
    await prisma.file.updateMany({
      where: {
        id: { in: deletedFiles.map(f => f.id) }
      },
      data: { status: 'DELETED' }
    });
  }

  /**
   * Helper: Marca archivos como PROCESSING en la base de datos
   */
  private async markFilesAsProcessing(fileIds: string[]): Promise<void> {
    await prisma.file.updateMany({
      where: {
        id: { in: fileIds }
      },
      data: { status: 'PROCESSING' }
    });
  }

  /**
   * Helper: Añade archivos a la cola de procesamiento
   */
  private async enqueueFilesForProcessing(files: PrismaFile[]): Promise<void> {
    for (const file of files) {
      await documentQueue.add('parse', {
        jobType: JobType.PARSE_DOCUMENT,
        filePath: file.filePath,
        filename: file.fileName,
        fileType: file.fileExtension,
        shouldDeleteAfterProcessing: false,
        metadata: {
          source: 'file-watcher',
          fileId: file.id
        }
      });
    }
  }

  /**
   * Escanea el folder monitorizado y registra/actualiza archivos
   */
  async scanFolder(): Promise<ScanStats> {
    const stats: ScanStats = { added: 0, modified: 0, unchanged: 0, errors: 0 };

    try {
      const files = await this.getFilesInFolder();
      const existingFiles = await prisma.file.findMany();
      const existingFilesMap = new Map(
        existingFiles.map(f => [f.filePath, f])
      );

      const processedPaths = await this.processFilesInBatch(files, existingFilesMap, stats);
      await this.handleDeletedFiles(existingFiles, processedPaths);

      return stats;
    } catch (error) {
      console.error('Error scanning folder:', error);
      throw error;
    }
  }

  /**
   * Procesa archivos pendientes y modificados
   */
  async processPendingFiles(): Promise<number> {
    const files = await this.getFilesByStatus(['PENDING', 'MODIFIED']);

    if (files.length === 0) return 0;

    await this.markFilesAsProcessing(files.map(f => f.id));
    await this.enqueueFilesForProcessing(files);

    return files.length;
  }

  /**
   * Marca un archivo como procesado correctamente
   */
  async markFileAsProcessed(fileId: string, qdrantPointId?: string): Promise<void> {
    await this.updateFile(fileId, {
      status: 'COMPLETED',
      processingAttempts: { increment: 1 },
      qdrantPointId: qdrantPointId || null
    });
  }

  /**
   * Marca un archivo con error
   */
  async markFileAsError(fileId: string, error: string): Promise<void> {
    await this.updateFile(fileId, {
      status: 'ERROR',
      lastError: error,
      processingAttempts: { increment: 1 }
    });
  }

  /**
   * Obtiene archivos pendientes
   */
  async getPendingFiles() {
    return await this.getFilesByStatus(['PENDING', 'MODIFIED']);
  }
}

export const fileTrackerService = new FileTrackerService();