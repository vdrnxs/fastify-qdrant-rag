import { FastifyInstance } from 'fastify';
import { ChatSchema } from '../schemas';
import { chatService } from '../services/chatService';

export async function chatRoutes(fastify: FastifyInstance) {
  /**
   * POST /chat
   * Generate a chat response using RAG
   */
  fastify.post('/chat', async (request, reply) => {
    const body = ChatSchema.parse(request.body);

    try {
      const result = await chatService.chat({
        query: body.query,
        history: body.history,
        systemPrompt: body.systemPrompt,
        maxContextDocs: body.maxContextDocs
      });

      return reply.code(200).send({
        success: true,
        data: result
      });
    } catch (error) {
      fastify.log.error({ error }, 'Chat error');
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}