export interface DocumentPayload {
  text: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface SearchResult {
  id: string | number;
  score: number;
  text: string;
  metadata: Record<string, any>;
}

export interface IngestResponse {
  id: number;
  success: true;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export interface ErrorResponse {
  error: string;
  details?: any;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  qdrant: {
    connected: boolean;
    collections?: number;
  };
  timestamp: string;
}
