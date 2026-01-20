import { FastifyInstance } from 'fastify';
import { IngestSchema } from '../schemas';
import { documentQueue } from '../queues/documentQueue';

export async function documentsRoutes(fastify: FastifyInstance) {
  fastify.post('/documents/ingest', async (request) => {
    const body = IngestSchema.parse(request.body);

    const job = await documentQueue.add('ingest', {
      text: body.text,
      metadata: body.metadata
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        count: 100,
        age: 3600
      },
      removeOnFail: {
        age: 604800
      }
    });

    return {
      jobId: job.id,
      message: 'Document queued for processing'
    };
  });
}
