import { Queue } from 'bullmq';
import { queueConnection } from '../config/redis';
import { DocumentJobData, DocumentJobResult, ParseDocumentJobData } from '../types/jobs.types';

// Union type to support both legacy and new job types
export type QueueJobData = DocumentJobData | ParseDocumentJobData;

export const documentQueue = new Queue<QueueJobData, DocumentJobResult>('documents', {
  connection: queueConnection
});
