import { prisma } from '../config/database';
import glob from 'fast-glob';
import { hashFile } from 'hasha';
import fs from 'fs/promises';
import path from 'path';
import { documentQueue } from '../queues/documentQueue';
import { JobType } from '../types/jobs.types';
import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';

type FileStatus = 'PENDING' | 'MODIFIED' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'DELETED';

interface FileUpdateData {
  status?: FileStatus;
  contentHash?: string;
  lastModified?: Date;
  lastScanned?: Date;
  fileSize?: number;
  lastError?: string | null;
  processingAttempts?: { increment: number };
  qdrantPointId?: string | null;
}

export class FileTrackerService {
  private monitoredPath: string;

  constructor() {
    this.monitoredPath = process.env.MONITORED_FOLDER_PATH || './files';
  }

  /**
   * Helper: Actualiza un archivo en la base de datos
   */
  private async updateFile(fileId: string, data: FileUpdateData) {
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
  private async deleteFromQdrant(qdrantPointId: string) {
    try {
      // Convertir el ID a número ya que Qdrant espera números
      const pointIdNumber = parseInt(qdrantPointId, 10);

      await qdrantClient.delete(COLLECTION_NAME, {
        points: [pointIdNumber]
      });
      console.log(`Vector eliminado de Qdrant: ${qdrantPointId}`);
    } catch (error) {
      console.error(`Error eliminando vector ${qdrantPointId} de Qdrant:`, error);
      // No lanzamos el error para que el proceso continúe
    }
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

    // Si no existe o estaba marcado como DELETED, tratarlo como nuevo
    if (!existingFile || existingFile.status === 'DELETED') {
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
      } else {
        // Reactivar archivo previamente eliminado
        await this.updateFile(existingFile.id, {
          contentHash,
          status: 'PENDING',
          lastModified: fileStats.mtime,
          lastScanned: new Date(),
          fileSize: fileStats.size,
          lastError: null,
          processingAttempts: { increment: 0 } // Reset counter
        });
      }
      return 'added';
    }

    if (existingFile.contentHash !== contentHash) {
      // Si el archivo fue modificado y tenía un vector en Qdrant, borrarlo
      if (existingFile.qdrantPointId) {
        await this.deleteFromQdrant(existingFile.qdrantPointId);
      }

      await this.updateFile(existingFile.id, {
        contentHash,
        status: 'MODIFIED',
        lastModified: fileStats.mtime,
        lastScanned: new Date(),
        fileSize: fileStats.size,
        qdrantPointId: null // Limpiar el ID ya que el vector fue eliminado
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
        // Eliminar vectores de Qdrant para archivos eliminados
        for (const file of deletedFiles) {
          if (file.qdrantPointId) {
            await this.deleteFromQdrant(file.qdrantPointId);
          }
        }

        // Marcar archivos como DELETED en SQLite
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
          metadata: {
            source: 'file-watcher',
            fileId: file.id
          }
        });
      }
    }

    return files.length;
  }

  /**
   * Marca un archivo como procesado correctamente
   */
  async markFileAsProcessed(fileId: string, qdrantPointId?: string) {
    await this.updateFile(fileId, {
      status: 'COMPLETED',
      processingAttempts: { increment: 1 },
      qdrantPointId: qdrantPointId || null
    });
  }

  /**
   * Marca un archivo con error
   */
  async markFileAsError(fileId: string, error: string) {
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
