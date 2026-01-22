export interface DocumentJobData {
  text: string;
  metadata?: Record<string, any>;
}

export interface DocumentJobResult {
  id: number;
  success: boolean;
}
