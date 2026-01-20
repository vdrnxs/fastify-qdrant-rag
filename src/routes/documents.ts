import { FastifyInstance } from 'fastify';
import { IngestSchema } from '../schemas';
import { DocumentService } from '../services/documentService';

const documentService = new DocumentService();

export async function documentsRoutes(fastify: FastifyInstance) {
  fastify.post('/documents/ingest', async (request) => {
    const body = IngestSchema.parse(request.body);
    const result = await documentService.ingestDocument(body.text, body.metadata);
    return result;
  });
}




