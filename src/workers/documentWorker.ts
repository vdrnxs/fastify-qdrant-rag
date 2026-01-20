import { Worker, Job } from 'bullmq';
import { workerConnection } from '../config/redis';
import { DocumentService } from '../services/documentService';

const documentService = new DocumentService();

interface DocumentJobData {
  text: string;
  metadata?: Record<string, any>;
}

interface DocumentJobResult {
  id: number;
  success: boolean;
}

export const documentWorker = new Worker<DocumentJobData, DocumentJobResult>(
  'documents',
  async (job: Job<DocumentJobData>) => {
    const { text, metadata } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 1;

    console.log(`Processing job ${job.id} - Attempt ${attemptNumber}/${maxAttempts}`);

    // Update progress at the start
    await job.updateProgress(0);

    try {
      // Process the document
      const result = await documentService.ingestDocument(text, metadata);

      // Update progress to 100% before returning
      await job.updateProgress(100);

      return result;
    } catch (error) {
      // Log the error and re-throw to mark job as failed
      console.error(`Error processing job ${job.id} (attempt ${attemptNumber}/${maxAttempts}):`, error);
      throw error;
    }
  },
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
