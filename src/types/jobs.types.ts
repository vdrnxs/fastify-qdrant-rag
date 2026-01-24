export interface DocumentJobData {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentJobResult {
  id: number;
  success: boolean;
}
