import { Worker, Job } from 'bullmq';
import { workerConnection } from '../config/redis';
import { DocumentService } from '../services/documentService';
import { DocumentJobResult, JobType } from '../types/jobs.types';
import { QueueJobData } from '../queues/documentQueue';
import { ParserService } from '../services/parserService';
import { unlink } from 'fs/promises';
import { fileTrackerService } from '../services/fileTrackerService';

const documentService = new DocumentService();
const parserService = new ParserService();

async function processDocumentJob(job: Job<QueueJobData>): Promise<DocumentJobResult> {
  await job.updateProgress(0);

  // Check if this is a parse job or legacy ingest job
  if ('jobType' in job.data && job.data.jobType === JobType.PARSE_DOCUMENT) {
    const { filePath, fileType, filename, metadata, shouldDeleteAfterProcessing } = job.data;

    try {
      // Parse the document
      await job.updateProgress(25);
      const parsedDoc = await parserService.parseFile(filePath, fileType);

      // Ingest the parsed text
      await job.updateProgress(50);
      const result = await documentService.ingestDocument(parsedDoc.text, {
        ...metadata,
        ...parsedDoc.metadata,
        originalFilename: filename
      });

      await job.updateProgress(75);

      // Borrar archivo solo si está marcado explícitamente para eliminación
      if (shouldDeleteAfterProcessing) {
        await unlink(filePath);
      }

      // Actualizar estado del archivo si tiene fileId en metadata
      if (metadata?.fileId) {
        await fileTrackerService.markFileAsProcessed(metadata.fileId as string);
      }

      await job.updateProgress(100);
      return result;
    } catch (error) {
      // Limpiar archivo temporal solo si estaba marcado para eliminación
      if (shouldDeleteAfterProcessing) {
        try {
          await unlink(filePath);
        } catch {
          // Ignore cleanup errors
        }
      }

      // Marcar archivo con error si tiene fileId
      if (job.data.metadata?.fileId) {
        await fileTrackerService.markFileAsError(
          job.data.metadata.fileId as string,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      throw error;
    }
  } else {
    // Legacy ingest job
    if (!('text' in job.data)) {
      throw new Error('Invalid job data: missing text field');
    }
    const { text, metadata } = job.data;
    const result = await documentService.ingestDocument(text, metadata);
    await job.updateProgress(100);
    return result;
  }
}

export const documentWorker = new Worker<QueueJobData, DocumentJobResult>(
  'documents',
  processDocumentJob,
  {
    connection: workerConnection,
    concurrency: 5, // Process up to 5 jobs simultaneously
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 50 } // Keep last 50 failed jobs
  }
);

// Critical: Handle worker errors to prevent crashes
documentWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

documentWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully with result:`, job.returnvalue);
});

documentWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err.message);
});

documentWorker.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});

documentWorker.on('active', (job) => {
  const attemptNumber = job.attemptsMade + 1;
  if (attemptNumber > 1) {
    console.log(`Job ${job.id} is being retried (attempt ${attemptNumber})`);
  }
});
