import { prisma } from '../config/database';
import crypto from 'crypto';
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
   * Calcula el hash SHA-256 de un archivo
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Obtiene todos los archivos recursivamente en un directorio
   */
  private async getFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getFilesRecursively(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Folder doesn't exist or no permissions
      console.error(`Error reading directory ${dir}:`, error);
    }

    return files;
  }

  /**
   * Obtiene todos los archivos en el folder monitorizado
   */
  private async getFilesInFolder(): Promise<string[]> {
    return this.getFilesRecursively(this.monitoredPath);
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

      for (const filePath of files) {
        try {
          processedPaths.add(filePath);
          const fileStats = await fs.stat(filePath);
          const fileName = path.basename(filePath);
          const fileExtension = path.extname(filePath).toLowerCase();
          const contentHash = await this.calculateFileHash(filePath);

          // Buscar archivo existente
          const existingFile = await prisma.file.findUnique({
            where: { filePath }
          });

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

      // Marcar archivos eliminados
      const allFiles = await prisma.file.findMany();
      for (const file of allFiles) {
        if (!processedPaths.has(file.filePath)) {
          await prisma.file.update({
            where: { id: file.id },
            data: { status: 'DELETED' }
          });
        }
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
        status: {
          in: ['PENDING', 'MODIFIED']
        }
      }
    });

    for (const file of files) {
      await prisma.file.update({
        where: { id: file.id },
        data: { status: 'PROCESSING' }
      });

      await documentQueue.add('parse', {
        jobType: JobType.PARSE_DOCUMENT,
        filePath: file.filePath,
        filename: file.fileName,
        fileType: file.fileExtension,
        metadata: { fileId: file.id }
      });
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
        status: {
          in: ['PENDING', 'MODIFIED']
        }
      }
    });
  }
}

export const fileTrackerService = new FileTrackerService();
