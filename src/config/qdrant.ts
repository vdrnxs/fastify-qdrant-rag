import { QdrantClient } from '@qdrant/js-client-rest';
import 'dotenv/config';
import { config } from './index';

const url = new URL(config.qdrant.url);

export const qdrantClient = new QdrantClient({
  host: url.hostname,
  port: parseInt(url.port)
});

export const COLLECTION_NAME = config.qdrant.collectionName;
export const VECTOR_SIZE = config.qdrant.vectorSize;
