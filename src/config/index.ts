export const config = {
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collectionName: process.env.COLLECTION_NAME || 'documents',
    vectorSize: parseInt(process.env.VECTOR_SIZE || '384')
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0'
  }
};
