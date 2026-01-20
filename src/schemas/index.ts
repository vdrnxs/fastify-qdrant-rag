import { z } from 'zod';

export const IngestSchema = z.object({
  text: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional()
});

export const SearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional().default(5)
});

export type IngestRequest = z.infer<typeof IngestSchema>;
export type SearchRequest = z.infer<typeof SearchSchema>;
