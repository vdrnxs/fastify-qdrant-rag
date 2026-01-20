import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { DocumentService } from '../services/documentService';

const documentService = new DocumentService();

export const documentWorker = new Worker('documents', async (job) => {
  const { text, metadata } = job.data;
  return await documentService.ingestDocument(text, metadata);
}, { connection: redis });

documentWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

documentWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});
