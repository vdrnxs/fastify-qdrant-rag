import { qdrantClient, COLLECTION_NAME } from '../config/qdrant';
import { generateMockVector } from '../utils/vectorUtils';

export interface SearchResult {
  id: string | number;
  score: number;
  text: string;
  metadata: Record<string, any>;
}

export class SearchService {
  /**
   * Busca documentos similares en Qdrant
   */
  async searchDocuments(query: string, limit: number = 10): Promise<{ results: SearchResult[], total: number }> {
    const queryVector = generateMockVector();

    const searchResult = await qdrantClient.query(COLLECTION_NAME, {
      query: queryVector,
      limit,
      with_payload: true
    });

    const results = searchResult.points.map((point) => ({
      id: point.id,
      score: point.score || 0,
      text: (point.payload?.text as string) || '',
      metadata: (point.payload?.metadata as Record<string, any>) || {}
    }));

    return {
      results,
      total: results.length
    };
  }
}
