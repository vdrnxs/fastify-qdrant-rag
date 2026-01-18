import { QdrantClient } from '@qdrant/js-client-rest';
import 'dotenv/config';

const url = new URL(process.env.QDRANT_URL || 'http://localhost:6333');

export const qdrantClient = new QdrantClient({
  host: url.hostname,
  port: parseInt(url.port)
});

export const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'documents';
export const VECTOR_SIZE = parseInt(process.env.VECTOR_DIMENSIONS || '384');
