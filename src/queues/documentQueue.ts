import { Queue } from 'bullmq';
import { redis } from '../config/redis';

export const documentQueue = new Queue('documents', {
  connection: redis
});
