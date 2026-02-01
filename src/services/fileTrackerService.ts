import { prisma } from '../config/database';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { FileStatus } from '@prisma/client';

export class FileTrackerService {
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
   * Escanea un folder y registra/actualiza archivos en la base de datos
   */
  async scanFolder(folderId: string): Promise<{
    added: number;
    modified: number;
    unchanged: number;
    errors: number;
  }> {
    const folder = await prisma.monitoredFolder.findUnique({
      where: { id: folderId }
    });

    if (!folder) {
      throw new Error(`Folder with id ${folderId} not found`);
    }

    if (!folder.isActive) {
      throw new Error(`Folder ${folder.name} is not active`);
    }

    const stats = { added: 0, modified: 0, unchanged: 0, errors: 0 };
    const files = await this.getFilesInFolder(folder.path, folder.recursive, folder.scanPattern);

    for (const filePath of files) {
      try {
        await this.processFile(filePath, folderId, stats);
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        stats.errors++;
      }
    }

    // Marcar archivos eliminados
    await this.markDeletedFiles(folderId, files);

    return stats;
  }

  /**
   * Procesa un archivo individual
   */
  private async processFile(
    filePath: string,
    folderId: string,
    stats: { added: number; modified: number; unchanged: number }
  ): Promise<void> {
    const fileStats = await fs.stat(filePath);
    const contentHash = await this.calculateFileHash(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath);

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
          status: FileStatus.PENDING,
          lastModified: fileStats.mtime,
          lastScanned: new Date(),
          folderId,
          processingAttempts: 0
        }
      });
      stats.added++;
    } else if (existingFile.contentHash !== contentHash) {
      // Archivo modificado
      await prisma.file.update({
        where: { id: existingFile.id },
        data: {
          contentHash,
          fileSize: fileStats.size,
          lastModified: fileStats.mtime,
          lastScanned: new Date(),
          status: FileStatus.MODIFIED,
          processingAttempts: 0,
          lastError: null
        }
      });
      stats.modified++;
    } else {
      // Archivo sin cambios
      await prisma.file.update({
        where: { id: existingFile.id },
        data: {
          lastScanned: new Date()
        }
      });
      stats.unchanged++;
    }
  }

  /**
   * Marca archivos que ya no existen en el filesystem
   */
  private async markDeletedFiles(folderId: string, existingFiles: string[]): Promise<void> {
    const dbFiles = await prisma.file.findMany({
      where: {
        folderId,
        status: { not: FileStatus.DELETED }
      }
    });

    const existingSet = new Set(existingFiles);

    for (const dbFile of dbFiles) {
      if (!existingSet.has(dbFile.filePath)) {
        await prisma.file.update({
          where: { id: dbFile.id },
          data: { status: FileStatus.DELETED }
        });
      }
    }
  }

  /**
   * Obtiene lista de archivos en un folder
   */
  private async getFilesInFolder(
    folderPath: string,
    recursive: boolean,
    pattern?: string | null
  ): Promise<string[]> {
    const files: string[] = [];

    const scan = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (recursive) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          // Filtrar por patrón si existe
          if (!pattern || this.matchesPattern(entry.name, pattern)) {
            files.push(fullPath);
          }
        }
      }
    };

    await scan(folderPath);
    return files;
  }

  /**
   * Simple pattern matching (soporta *.ext)
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      return filename.endsWith(ext);
    }
    return filename.includes(pattern);
  }

  /**
   * Obtiene archivos pendientes de procesar
   */
  async getPendingFiles(limit = 10): Promise<Array<{
    id: string;
    filePath: string;
    fileName: string;
    status: FileStatus;
  }>> {
    return prisma.file.findMany({
      where: {
        status: { in: [FileStatus.PENDING, FileStatus.MODIFIED] },
        folder: { isActive: true }
      },
      take: limit,
      orderBy: { lastModified: 'desc' }
    });
  }

  /**
   * Marca un archivo como procesado exitosamente
   */
  async markFileAsProcessed(fileId: string): Promise<void> {
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.COMPLETED
      }
    });
  }

  /**
   * Marca un archivo con error
   */
  async markFileAsError(fileId: string, error: string): Promise<void> {
    const file = await prisma.file.findUnique({ where: { id: fileId } });

    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.ERROR,
        lastError: error,
        processingAttempts: (file?.processingAttempts || 0) + 1
      }
    });
  }

  /**
   * Agrega un nuevo folder para monitorizar
   */
  async addMonitoredFolder(
    folderPath: string,
    name: string,
    options: {
      recursive?: boolean;
      scanPattern?: string;
    } = {}
  ): Promise<string> {
    // Verificar que el folder existe
    try {
      await fs.access(folderPath);
    } catch {
      throw new Error(`Folder ${folderPath} does not exist or is not accessible`);
    }

    const folder = await prisma.monitoredFolder.create({
      data: {
        path: folderPath,
        name,
        recursive: options.recursive ?? true,
        scanPattern: options.scanPattern || null,
        isActive: true
      }
    });

    return folder.id;
  }

  /**
   * Lista todos los folders monitorizados
   */
  async listMonitoredFolders() {
    return prisma.monitoredFolder.findMany({
      include: {
        _count: {
          select: { files: true }
        }
      }
    });
  }

  /**
   * Desactiva un folder monitorizado
   */
  async deactivateFolder(folderId: string): Promise<void> {
    await prisma.monitoredFolder.update({
      where: { id: folderId },
      data: { isActive: false }
    });
  }

  /**
   * Activa un folder monitorizado
   */
  async activateFolder(folderId: string): Promise<void> {
    await prisma.monitoredFolder.update({
      where: { id: folderId },
      data: { isActive: true }
    });
  }

  /**
   * Escanea todos los folders activos
   */
  async scanAllFolders(): Promise<Record<string, {
    added: number;
    modified: number;
    unchanged: number;
    errors: number;
  }>> {
    const folders = await prisma.monitoredFolder.findMany({
      where: { isActive: true }
    });

    const results: Record<string, {
      added: number;
      modified: number;
      unchanged: number;
      errors: number;
    }> = {};

    for (const folder of folders) {
      try {
        results[folder.name] = await this.scanFolder(folder.id);
      } catch (error) {
        console.error(`Error scanning folder ${folder.name}:`, error);
        results[folder.name] = { added: 0, modified: 0, unchanged: 0, errors: 1 };
      }
    }

    return results;
  }
}

export const fileTrackerService = new FileTrackerService();
