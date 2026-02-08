import OpenAI from 'openai';
import { Embeddings } from './base.embeddings';
import type { OpenAIEmbeddingsConfig} from '../types';


/**
 * Sanitize text for embeddings by replacing newlines with spaces
 * Recommended by OpenAI to improve embedding quality
 */
function sanitizeText(text: string): string {
  return text.replace(/\n/g, ' ');
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
   * Private helper to call OpenAI embeddings API
   */
  private async createEmbeddings(input: string | string[]) {
    return this.client.embeddings.create({
      model: this.model,
      input,
      encoding_format: 'float'
    });
  }

  /**
   * Embed a single query text
   */
  async embedQuery(text: string): Promise<number[]> {
    const sanitized = sanitizeText(text);
    const response = await this.createEmbeddings(sanitized);
    return response.data[0].embedding;
  }

  /**
   * Embed multiple documents in a single API call
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const sanitized = texts.map(sanitizeText);
    const response = await this.createEmbeddings(sanitized);
    return response.data.map(item => item.embedding);
  }
}

// Export singleton instance
export const openaiEmbeddings = new OpenAIEmbeddings();