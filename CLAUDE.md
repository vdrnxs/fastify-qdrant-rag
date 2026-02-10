# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **RAG (Retrieval Augmented Generation)** system that combines:
- **Document ingestion** from PDFs and monitored folders
- **Vector search** via Qdrant for semantic similarity
- **OpenAI embeddings** (text-embedding-3-small, 1536 dimensions)
- **ChatGPT integration** (gpt-4o-mini) for natural language responses based on retrieved context

## Development Commands

```bash
# Development
pnpm dev                 # Start server with hot reload (tsx watch)

# Code Quality
pnpm lint               # Run ESLint
pnpm lint:fix           # Auto-fix linting issues
pnpm typecheck          # Type-check without building

# Database
npx prisma generate     # Generate Prisma client
npx prisma migrate dev  # Run migrations (SQLite)
```

## Required Services

Before running the application, ensure these services are running:

- **Qdrant**: Vector database on port 6333 (`http://localhost:6333`)
- **Redis**: Queue management on port 6379
- **OpenAI API Key**: Set in `.env` as `OPENAI_API_KEY`

## Architecture Overview

### RAG Pipeline

1. **Document Ingestion** (`IngestionService`)
   - PDFs parsed via `unpdf`
   - Text chunked by `DocumentService` (configurable `chunkSize` and `overlap`)
   - Each chunk embedded via OpenAI API
   - Vectors stored in Qdrant with metadata

2. **Semantic Search** (`SearchService`)
   - Query embedded using same OpenAI model
   - Cosine similarity search in Qdrant
   - Returns top-N most relevant document chunks

3. **RAG Chat** (`ChatService`)
   - Retrieves relevant chunks via `SearchService`
   - Injects chunks into system prompt as context
   - Sends to ChatGPT with conversation history
   - Returns AI response + source documents with scores

### Background Processing

Uses **BullMQ** with Redis for async document processing:

- **Queue**: `documentQueue` (src/queues/documentQueue.ts)
- **Worker**: `documentWorker` (src/workers/documentWorker.ts)
  - Concurrency: 5 jobs simultaneously
  - Retries: Automatic with exponential backoff
  - Cleanup: Deletes temp files after processing

### File Tracking

**Prisma + SQLite** tracks files in monitored folder (`./files` by default):

- Detects new/modified/deleted files via content hash
- Prevents duplicate processing
- Tracks status: PENDING → PROCESSING → COMPLETED/ERROR
- Links files to Qdrant point IDs

On startup, app scans monitored folder and queues pending files.

### API Routes

- `POST /upload` - Upload and process a PDF
- `POST /search` - Semantic search (query → similar chunks)
- `POST /chat` - RAG chat (query + history → AI response with sources)
- `GET /health` - Health check

## Key Configuration (.env)

```bash
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=documents
VECTOR_DIMENSIONS=1536                    # Must match OpenAI model

OPENAI_API_KEY=sk-...                     # Required for embeddings + chat

MONITORED_FOLDER_PATH=./files             # Auto-processes files here
MAX_FILE_SIZE_MB=50
DATABASE_URL="file:./data/tracking.db"    # SQLite for file tracking
```

## Type System

All types centralized in `src/types/`:
- Use **barrel exports** via `src/types/index.ts`
- Import as: `import { ChatRequest, JobType } from '../types'`
- **Important**: `JobType` is an enum (value), not just a type - use regular import, not `import type`

## Text Sanitization

OpenAI embeddings API requires newlines replaced with spaces:
```typescript
// src/embeddings/openai.embeddings.ts
function sanitizeText(text: string): string {
  return text.replace(/\n/g, ' ');
}
```
Applied to all text before embedding (queries and documents).

## RAG System Prompt

Default system prompt in `ChatService`:
- **Spanish**: "Eres un asistente experto que responde preguntas basándose ÚNICAMENTE en el contexto proporcionado"
- **Strict RAG**: Only answers from retrieved context, admits when info is missing
- Customizable via `systemPrompt` parameter in chat request

## Common Patterns

### Adding a New Embedding Provider

1. Create `src/embeddings/yourprovider.embeddings.ts`
2. Extend `BaseEmbeddings` (src/embeddings/base.embeddings.ts)
3. Implement `embedQuery()` and `embedDocuments()`
4. Update vector size in config

### Modifying Chunking Strategy

Edit `DocumentService.ingestDocument()`:
- Current: Simple character-based chunking with overlap
- Consider: Sentence-aware, paragraph-aware, or semantic chunking

### Extending File Support

1. Add parser in `ParserService.parseFile()` (src/services/parserService.ts)
2. Update `allowedTypes` in config
3. Install necessary parser library

## Important Notes

- **Vector dimensions must match**: Qdrant collection (1536) ↔ OpenAI model (text-embedding-3-small)
- **Graceful shutdown**: SIGTERM/SIGINT handlers close worker and Fastify cleanly
- **Temp file cleanup**: Worker deletes uploads after processing (only if `shouldDeleteAfterProcessing: true`)
- **Monitored folder**: Files remain in `./files`, only temp uploads are deleted
- **Error handling**: Failed jobs tracked in SQLite with error messages

## Testing

Test scripts in `scripts/`:
- `scripts/test-chat.ts` - Test RAG chat endpoint with examples
- Create similar scripts for other endpoints as needed

Run with: `pnpm tsx scripts/test-chat.ts`
