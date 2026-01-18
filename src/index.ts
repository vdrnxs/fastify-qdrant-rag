import Fastify from 'fastify';
import 'dotenv/config';
import { documentsRoutes } from './routes/documents';
import { searchRoutes } from './routes/search';
import { qdrantClient, COLLECTION_NAME, VECTOR_SIZE } from './config/qdrant';

const fastify = Fastify({ logger: true });

// Health check
fastify.get('/', async () => {
  return { status: 'ok', service: 'RAG API' };
});

// Registrar rutas
fastify.register(documentsRoutes);
fastify.register(searchRoutes);

const start = async () => {
  try {
    // Verificar/crear colección de Qdrant
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
      });
      fastify.log.info(`Collection ${COLLECTION_NAME} created`);
    }

    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
