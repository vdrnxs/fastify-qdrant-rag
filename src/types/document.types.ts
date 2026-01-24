export interface DocumentPayload {
  text: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface IngestResponse {
  id: number;
  success: true;
}
