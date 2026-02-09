export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  query: string;
  history?: ChatMessage[];
  systemPrompt?: string;
  maxContextDocs?: number;
}

export interface ChatResponse {
  response: string;
  sources: Array<{
    text: string;
    score: number;
    metadata: Record<string, unknown>;
  }>;
}

export interface ChatConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPromptTemplate?: string;
}