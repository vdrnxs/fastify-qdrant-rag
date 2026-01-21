import Redis from 'ioredis';
import { config } from './index';

// Factory function para crear conexiones Redis con configuración base
function createRedisConnection(options: { maxRetriesPerRequest?: number | null } = {}): Redis {
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    ...options
  });
}

// Connection for queues (producers) - fail fast for HTTP endpoints
export const queueConnection = createRedisConnection({
  maxRetriesPerRequest: 1
});

// Connection for workers (consumers) - persistent retries for background processing
export const workerConnection = createRedisConnection({
  maxRetriesPerRequest: null
});

// General Redis connection for health checks and other non-BullMQ operations
export const redis = createRedisConnection();
