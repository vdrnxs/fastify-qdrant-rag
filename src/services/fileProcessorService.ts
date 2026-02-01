import { fileTrackerService } from './fileTrackerService';
import { documentQueue } from '../queues/documentQueue';
import { JobType } from '../types/jobs.types';

export class FileProcessorService {
  /**
   * Procesa archivos pendientes agregándolos a la cola
   */
  async processPendingFiles(limit = 50): Promise<number> {
    const pendingFiles = await fileTrackerService.getPendingFiles(limit);
    let processedCount = 0;

    for (const file of pendingFiles) {
      try {
        await documentQueue.add('parse-document', {
          jobType: JobType.PARSE_DOCUMENT,
          filePath: file.filePath,
          fileType: file.fileExtension.slice(1), // Remove leading dot
          filename: file.fileName,
          metadata: {
            fileId: file.id,
            source: 'monitored-folder'
          }
        });

        processedCount++;
      } catch (error) {
        console.error(`Error queuing file ${file.fileName}:`, error);
        await fileTrackerService.markFileAsError(
          file.id,
          error instanceof Error ? error.message : 'Error queuing file'
        );
      }
    }

    return processedCount;
  }
}

export const fileProcessorService = new FileProcessorService();
