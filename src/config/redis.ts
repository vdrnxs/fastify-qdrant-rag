import Redis from 'ioredis';
import { config } from './index';

// Connection for queues (producers) - fail fast for HTTP endpoints
export const queueConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: 1
});

// Connection for workers (consumers) - persistent retries for background processing
export const workerConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null
});

// General Redis connection for health checks and other non-BullMQ operations
export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port
});
