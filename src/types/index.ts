export interface DocumentPayload {
  text: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface SearchResult {
  id: string | number;
  score: number;
  text: string;
  metadata?: Record<string, any>;
}

export interface IngestResponse {
  id: string | number;
  success: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}
