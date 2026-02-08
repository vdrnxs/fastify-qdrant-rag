import OpenAI from 'openai';
import { Embeddings } from './base.embeddings';

export interface OpenAIEmbeddingsConfig {
  apiKey?: string;
  model?: string;
}

/**
 * OpenAI Embeddings wrapper
 * Uses OpenAI's text-embedding models to generate embeddings
 */
export class OpenAIEmbeddings implements Embeddings {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIEmbeddingsConfig = {}) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY
    });
    this.model = config.model || 'text-embedding-3-small';
  }

  /**
   * Embed a single query text
   */
  async embedQuery(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  }

  /**
   * Embed multiple documents in a single API call
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      encoding_format: 'float'
    });

    return response.data.map(item => item.embedding);
  }
}

// Export singleton instance
export const openaiEmbeddings = new OpenAIEmbeddings();