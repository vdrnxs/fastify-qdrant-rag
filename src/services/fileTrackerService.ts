import { prisma } from '../config/database';
import glob from 'fast-glob';
import { hashFile } from 'hasha';
import fs from 'fs/promises';
import path from 'path';
import { documentQueue } from '../queues/documentQueue';
import { JobType } from '../types/jobs.types';

type FileStatus = 'PENDING' | 'MODIFIED' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'DELETED';

interface FileUpdateData {
  status?: FileStatus;
  contentHash?: string;
  lastModified?: Date;
  lastScanned?: Date;
  fileSize?: number;
  lastError?: string;
  processingAttempts?: { increment: number };
}

export class FileTrackerService {
  private monitoredPath: string;

  constructor() {
    this.monitoredPath = process.env.MONITORED_FOLDER_PATH || './files';
  }

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
   * Obtiene todos los archivos en el folder monitorizado usando fast-glob
   */
  private async getFilesInFolder(): Promise<string[]> {
    return await glob('**/*', {
      cwd: this.monitoredPath,
      absolute: true,
      onlyFiles: true,
      dot: false
    });
  }

  /**
   * Helper: Procesa un archivo individual y retorna su resultado
   */
  private async processIndividualFile(
    filePath: string,
    existingFile: any | undefined
  ): Promise<'added' | 'modified' | 'unchanged'> {
    const fileStats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase().replace('.', '');
    const contentHash = await hashFile(filePath, { algorithm: 'sha256' });

    if (!existingFile) {
      await prisma.file.create({
        data: {
          filePath,
          fileName,
          fileExtension,
          fileSize: fileStats.size,
          contentHash,
          status: 'PENDING',
          lastModified: fileStats.mtime
        }
      });
      return 'added';
    }

    if (existingFile.contentHash !== contentHash) {
      await this.updateFile(existingFile.id, {
        contentHash,
        status: 'MODIFIED',
        lastModified: fileStats.mtime,
        lastScanned: new Date(),
        fileSize: fileStats.size
      });
      return 'modified';
    }

    await this.updateFile(existingFile.id, {
      lastScanned: new Date()
    });
    return 'unchanged';
  }

  /**
   * Escanea el folder monitorizado y registra/actualiza archivos
   */
  async scanFolder(): Promise<{
    added: number;
    modified: number;
    unchanged: number;
    errors: number;
  }> {
    const stats = { added: 0, modified: 0, unchanged: 0, errors: 0 };

    try {
      const files = await this.getFilesInFolder();
      const processedPaths = new Set<string>();

      const existingFiles = await prisma.file.findMany();
      const existingFilesMap = new Map(
        existingFiles.map(f => [f.filePath, f])
      );

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

      const deletedFiles = existingFiles.filter(
        file => !processedPaths.has(file.filePath)
      );

      if (deletedFiles.length > 0) {
        await prisma.file.updateMany({
          where: {
            id: { in: deletedFiles.map(f => f.id) }
          },
          data: { status: 'DELETED' }
        });
      }

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

    if (files.length > 0) {
      await prisma.file.updateMany({
        where: {
          id: { in: files.map(f => f.id) }
        },
        data: { status: 'PROCESSING' }
      });

      for (const file of files) {
        await documentQueue.add('parse', {
          jobType: JobType.PARSE_DOCUMENT,
          filePath: file.filePath,
          filename: file.fileName,
          fileType: file.fileExtension,
          shouldDeleteAfterProcessing: false, // Archivos monitoreados NO deben borrarse
          metadata: { fileId: file.id }
        });
      }
    }

    return files.length;
  }

  /**
   * Marca un archivo como procesado correctamente
   */
  async markFileAsProcessed(fileId: string): Promise<void> {
    await this.updateFile(fileId, {
      status: 'COMPLETED',
      processingAttempts: { increment: 1 }
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
