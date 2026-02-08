import path from 'path';

export const config = {
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collectionName: process.env.COLLECTION_NAME || 'documents',
    vectorSize: parseInt(process.env.VECTOR_SIZE || '1536')
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0'
  },
  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '50'),
    allowedTypes: ['pdf'], // Start with PDF only, expand later
    tempDir: path.resolve(process.cwd(), process.env.TEMP_UPLOAD_DIR || 'temp/uploads')
  }
};
