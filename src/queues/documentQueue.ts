import { Queue } from 'bullmq';
import { queueConnection } from '../config/redis';
import { DocumentJobData, DocumentJobResult } from '../types/jobs.types';

export const documentQueue = new Queue<DocumentJobData, DocumentJobResult>('documents', {
  connection: queueConnection
});
