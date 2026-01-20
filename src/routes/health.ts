import { FastifyInstance } from 'fastify';
import { qdrantClient } from '../config/qdrant';
import { HealthResponse } from '../types';

async function checkQdrantConnection(): Promise<{ connected: boolean; collections?: number }> {
  try {
    const collections = await qdrantClient.getCollections();
    return {
      connected: true,
      collections: collections.collections.length
    };
  } catch (error) {
    return { connected: false };
  }
}

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: HealthResponse }>('/health', async () => {
    const qdrantHealth = await checkQdrantConnection();

    const response: HealthResponse = {
      status: qdrantHealth.connected ? 'ok' : 'error',
      qdrant: qdrantHealth,
      timestamp: new Date().toISOString()
    };

    return response;
  });
}
