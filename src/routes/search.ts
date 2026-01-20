import { FastifyInstance } from 'fastify';
import { SearchSchema } from '../schemas';
import { SearchService } from '../services/searchService';

const searchService = new SearchService();

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.post('/search', async (request) => {
    const body = SearchSchema.parse(request.body);
    const result = await searchService.searchDocuments(body.query, body.limit);
    return result;
  });
}
