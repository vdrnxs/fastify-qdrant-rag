import { z } from 'zod';

export const IngestSchema = z.object({
  text: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const SearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional().default(5)
});

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
});

export const ChatSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  history: z.array(ChatMessageSchema).optional().default([]),
  systemPrompt: z.string().optional(),
  maxContextDocs: z.number().int().positive().optional().default(3)
});

