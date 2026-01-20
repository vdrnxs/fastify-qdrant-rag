import Fastify from 'fastify';
import 'dotenv/config';
import { documentsRoutes } from './routes/documents';
import { searchRoutes } from './routes/search';
import { healthRoutes } from './routes/health';
import { qdrantClient, COLLECTION_NAME, VECTOR_SIZE } from './config/qdrant';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';

const fastify = Fastify({ logger: true });

// Register error handler
fastify.setErrorHandler(errorHandler);

// Registrar rutas
fastify.register(healthRoutes);
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

    await fastify.listen({ port: config.server.port, host: config.server.host });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
