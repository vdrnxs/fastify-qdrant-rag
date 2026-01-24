export interface SearchResult {
  id: string | number;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}
