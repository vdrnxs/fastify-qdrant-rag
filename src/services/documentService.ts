import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';
import { openaiEmbeddings } from '../embeddings/openai.embeddings';
import { IngestResponse } from '../types';

export class DocumentService {
  /**
   * Ingesta un documento en Qdrant
   */
  async ingestDocument(text: string, metadata?: Record<string, unknown>): Promise<IngestResponse> {
    const vector = await openaiEmbeddings.embedQuery(text);
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
