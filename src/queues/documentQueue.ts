import { Queue } from 'bullmq';
import { config } from '../config';

export const documentQueue = new Queue('documents', {
  connection: {
    host: config.redis.host,
    port: config.redis.port
  }
});
