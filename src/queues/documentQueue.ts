import { Queue } from 'bullmq';
import { queueConnection } from '../config/redis';

export const documentQueue = new Queue('documents', {
  connection: queueConnection
});
