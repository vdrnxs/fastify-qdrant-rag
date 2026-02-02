import { prisma } from '../config/database';
import glob from 'fast-glob';
import { hashFile } from 'hasha';
import fs from 'fs/promises';
import path from 'path';
import { documentQueue } from '../queues/documentQueue';
import { JobType } from '../types/jobs.types';

export class FileTrackerService {
  private monitoredPath: string;

  constructor() {
    this.monitoredPath = process.env.MONITORED_FOLDER_PATH || './temp/uploads';
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

      // Obtener todos los archivos existentes de una vez
      const existingFiles = await prisma.file.findMany();
      const existingFilesMap = new Map(
        existingFiles.map(f => [f.filePath, f])
      );

      // Procesar archivos en el sistema de archivos
      for (const filePath of files) {
        try {
          processedPaths.add(filePath);
          const fileStats = await fs.stat(filePath);
          const fileName = path.basename(filePath);
          const fileExtension = path.extname(filePath).toLowerCase().replace('.', '');
          const contentHash = await hashFile(filePath, { algorithm: 'sha256' });

          const existingFile = existingFilesMap.get(filePath);

          if (!existingFile) {
            // Archivo nuevo
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
            stats.added++;
          } else if (existingFile.contentHash !== contentHash) {
            // Archivo modificado
            await prisma.file.update({
              where: { id: existingFile.id },
              data: {
                contentHash,
                status: 'MODIFIED',
                lastModified: fileStats.mtime,
                lastScanned: new Date(),
                fileSize: fileStats.size
              }
            });
            stats.modified++;
          } else {
            // Archivo sin cambios
            await prisma.file.update({
              where: { id: existingFile.id },
              data: { lastScanned: new Date() }
            });
            stats.unchanged++;
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
          stats.errors++;
        }
      }

      // Marcar archivos eliminados en batch
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
    const files = await prisma.file.findMany({
      where: {
        status: { in: ['PENDING', 'MODIFIED'] }
      }
    });

    // Actualizar todos los estados a PROCESSING en batch
    if (files.length > 0) {
      await prisma.file.updateMany({
        where: {
          id: { in: files.map(f => f.id) }
        },
        data: { status: 'PROCESSING' }
      });

      // Agregar trabajos a la cola
      for (const file of files) {
        await documentQueue.add('parse', {
          jobType: JobType.PARSE_DOCUMENT,
          filePath: file.filePath,
          filename: file.fileName,
          fileType: file.fileExtension,
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
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'COMPLETED',
        processingAttempts: { increment: 1 }
      }
    });
  }

  /**
   * Marca un archivo con error
   */
  async markFileAsError(fileId: string, error: string): Promise<void> {
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'ERROR',
        lastError: error,
        processingAttempts: { increment: 1 }
      }
    });
  }

  /**
   * Obtiene archivos pendientes
   */
  async getPendingFiles() {
    return await prisma.file.findMany({
      where: {
        status: { in: ['PENDING', 'MODIFIED'] }
      }
    });
  }
}

export const fileTrackerService = new FileTrackerService();
