/**
 * Base interface for embedding providers
 * Inspired by LangChain's Embeddings interface
 */
export interface Embeddings {
  /**
   * Embed a single query text (for search queries)
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Embed multiple documents (for ingestion)
   */
  embedDocuments(texts: string[]): Promise<number[][]>;
}