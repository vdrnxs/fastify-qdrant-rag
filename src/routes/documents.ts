import { FastifyInstance } from 'fastify';
import { qdrantClient, COLLECTION_NAME, VECTOR_SIZE } from '../config/qdrant';
import { IngestSchema } from '../schemas';

// Mock: genera vector aleatorio (reemplazar con embeddings reales)
function generateMockVector(): number[] {
  return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
}

export async function documentsRoutes(fastify: FastifyInstance) {
  fastify.post('/documents/ingest', async (request, reply) => {
    const body = IngestSchema.parse(request.body);

    const vector = generateMockVector();
    const pointId = Date.now();

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload: {
            text: body.text,
            metadata: body.metadata || {},
            timestamp: new Date().toISOString()
          }
        }
      ]
    });

    return { id: pointId, success: true };
  });
}
