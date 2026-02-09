import OpenAI from 'openai';
import { SearchService } from './searchService';
import type { ChatMessage, ChatRequest, ChatResponse, ChatConfig } from '../types';

const DEFAULT_SYSTEM_PROMPT = `Eres un asistente experto que responde preguntas basándose ÚNICAMENTE en el contexto proporcionado.

REGLAS:
- Responde SOLO basándote en el contexto dado
- Si la información no está en el contexto, di "No tengo información sobre eso en los documentos disponibles"
- Sé preciso y conciso
- Cita información específica del contexto cuando sea relevante`;

export class ChatService {
  private openai: OpenAI;
  private searchService: SearchService;
  private config: ChatConfig;

  constructor(config: ChatConfig = {}) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.searchService = new SearchService();
    this.config = {
      model: config.model || 'gpt-4o-mini',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 2000,
      systemPromptTemplate: config.systemPromptTemplate || DEFAULT_SYSTEM_PROMPT
    };
  }

  /**
   * Generate a chat response using RAG (Retrieval Augmented Generation)
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { query, history = [], systemPrompt, maxContextDocs = 3 } = request;

    // 1. Retrieve relevant context from Qdrant
    const searchResults = await this.searchService.searchDocuments(query, maxContextDocs);

    // 2. Build context from retrieved documents
    const context = this.buildContext(searchResults.results);

    // 3. Build the system prompt with context
    const finalSystemPrompt = systemPrompt || this.buildSystemPrompt(context);

    // 4. Construct messages for ChatGPT
    const messages: ChatMessage[] = [
      { role: 'system', content: finalSystemPrompt },
      ...history,
      { role: 'user', content: query }
    ];

    // 5. Call ChatGPT
    const completion = await this.openai.chat.completions.create({
      model: this.config.model!,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    });

    // 6. Return response with sources
    return {
      response: completion.choices[0].message.content || '',
      sources: searchResults.results
    };
  }

  /**
   * Build context string from search results
   */
  private buildContext(results: Array<{ text: string; score: number }>): string {
    if (results.length === 0) {
      return 'No hay contexto disponible.';
    }

    return results
      .map((result, index) => {
        return `[Documento ${index + 1}] (Relevancia: ${(result.score * 100).toFixed(1)}%)\n${result.text}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Build system prompt with context injection
   */
  private buildSystemPrompt(context: string): string {
    return `${this.config.systemPromptTemplate}

CONTEXTO RELEVANTE:
${context}`;
  }
}

export const chatService = new ChatService();