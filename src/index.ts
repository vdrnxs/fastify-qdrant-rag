import Fastify from 'fastify';
import 'dotenv/config';
import { documentsRoutes } from './routes/documents';
import { searchRoutes } from './routes/search';
import { healthRoutes } from './routes/health';
import { qdrantClient, COLLECTION_NAME, VECTOR_SIZE } from './config/qdrant';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';
import { documentWorker } from './workers/documentWorker';

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
    fastify.log.info('Document worker started');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  fastify.log.info('Shutting down gracefully...');

  await documentWorker.close();
  fastify.log.info('Document worker closed');

  await fastify.close();
  fastify.log.info('Fastify server closed');

  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();
