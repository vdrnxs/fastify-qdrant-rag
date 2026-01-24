export interface ErrorResponse {
  error: string;
  details?: unknown;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  qdrant: {
    connected: boolean;
    collections?: number;
  };
  redis: {
    connected: boolean;
  };
  timestamp: string;
}
