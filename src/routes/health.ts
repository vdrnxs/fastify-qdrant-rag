import { FastifyInstance } from 'fastify';
import { qdrantClient } from '../config/qdrant';
import { redis } from '../config/redis';
import { HealthResponse } from '../types';

async function checkQdrantConnection(): Promise<{ connected: boolean; collections?: number }> {
  try {
    const collections = await qdrantClient.getCollections();
    return {
      connected: true,
      collections: collections.collections.length
    };
  } catch {
    return { connected: false };
  }
}

async function checkRedisConnection(): Promise<{ connected: boolean }> {
  try {
    await redis.ping();
    return { connected: true };
  } catch {
    return { connected: false };
  }
}

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: HealthResponse }>('/health', async () => {
    const qdrantHealth = await checkQdrantConnection();
    const redisHealth = await checkRedisConnection();

    const response: HealthResponse = {
      status: qdrantHealth.connected && redisHealth.connected ? 'ok' : 'error',
      qdrant: qdrantHealth,
      redis: redisHealth,
      timestamp: new Date().toISOString()
    };

    return response;
  });
}
