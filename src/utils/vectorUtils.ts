import { VECTOR_SIZE } from '../config/qdrant';

/**
 * Genera vector aleatorio (mock - reemplazar con embeddings reales)
 * TODO: Reemplazar con modelo de embeddings (OpenAI, Sentence Transformers, etc.)
 */
export function generateMockVector(): number[] {
  return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
}
