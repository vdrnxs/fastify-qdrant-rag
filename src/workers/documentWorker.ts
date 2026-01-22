import { Worker, Job } from 'bullmq';
import { workerConnection } from '../config/redis';
import { DocumentService } from '../services/documentService';
import { DocumentJobData, DocumentJobResult } from '../types/jobs.types';

const documentService = new DocumentService();
async function processDocumentJob(job: Job<DocumentJobData>): Promise<DocumentJobResult> {
  const { text, metadata } = job.data;

  // Initialize progress tracking
  await job.updateProgress(0);

  // Process the document through the service
  const result = await documentService.ingestDocument(text, metadata);

  // Mark as complete
  await job.updateProgress(100);

  return result;
}

export const documentWorker = new Worker<DocumentJobData, DocumentJobResult>(
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
