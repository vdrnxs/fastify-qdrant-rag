import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';
import { generateMockVector } from '../utils/vectorUtils';

export class DocumentService {
  /**
   * Ingesta un documento en Qdrant
   */
  async ingestDocument(text: string, metadata?: Record<string, any>) {
    const vector = generateMockVector();
    const pointId = Date.now();

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload: {
            text,
            metadata: metadata || {},
            timestamp: new Date().toISOString()
          }
        }
      ]
    });

    return { id: pointId, success: true };
  }
}
