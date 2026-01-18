import { FastifyInstance } from 'fastify';
import { qdrantClient, COLLECTION_NAME, VECTOR_SIZE } from '../config/qdrant';
import { SearchSchema } from '../schemas';

// Mock: genera vector aleatorio (reemplazar con embeddings reales)
function generateMockVector(): number[] {
  return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
}

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.post('/search', async (request, reply) => {
    const body = SearchSchema.parse(request.body);

    const queryVector = generateMockVector();

    const searchResult = await qdrantClient.query(COLLECTION_NAME, {
      query: queryVector,
      limit: body.limit,
      with_payload: true
    });

    const results = searchResult.points.map((point) => ({
      id: point.id,
      score: point.score || 0,
      text: (point.payload?.text as string) || '',
      metadata: (point.payload?.metadata as Record<string, any>) || {}
    }));

    return {
      results,
      total: results.length
    };
  });
}
