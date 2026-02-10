# RAGCore

> **NOTE:** This project is under active development and not production-ready.

A flexible **RAG (Retrieval Augmented Generation)** framework designed as a foundation for custom AI knowledge systems. Built to be adapted across different business models and use cases.

## What is this?

RAGCore provides a complete backend infrastructure for building AI systems that answer questions based on your documents:

```
Upload documents → Vector embeddings → Semantic search → AI responses
```

**Use Cases:**
- Internal knowledge bases for companies
- Customer support automation with product documentation
- Research assistants for academic papers
- Legal document analysis systems
- Custom ChatGPT interfaces with domain-specific knowledge

### Key Features

| Feature | Description |
|---------|-------------|
| **Semantic Search** | Vector embeddings for contextual understanding (no keyword matching) |
| **RAG Chat** | Customizable system prompts with conversation history |
| **Background Processing** | Scalable job queue with automatic retry logic |
| **File Monitoring** | Auto-detect and process new/modified files |

## Core Technologies

| Technology | Purpose |
|------------|---------|
| **Qdrant** | Vector database for semantic search |
| **OpenAI** | Embeddings (`text-embedding-3-small`) + Chat (`gpt-4o-mini`) |
| **Fastify** | High-performance web framework |
| **BullMQ + Redis** | Background job processing |
| **Prisma + SQLite** | File tracking and metadata storage |

## Roadmap

<details open>
<summary><strong>Completed Features</strong></summary>

- [x] PDF document parsing and chunking
- [x] OpenAI embeddings integration
- [x] Vector storage in Qdrant with metadata
- [x] Semantic search endpoint
- [x] Background job processing with retry logic
- [x] File monitoring system (auto-detect new/modified files)
- [x] **RAG chat service** with ChatGPT integration
- [x] Conversation history support
- [x] Customizable system prompts
- [x] Source attribution (response + documents with relevance scores)

</details>

<details>
<summary><strong>Planned Features</strong></summary>

**Near-term (Next Sprint)**
- [ ] Docker deployment setup (Dockerfile + docker-compose)
- [ ] Support for additional file types (JSON, TXT, Markdown)
- [ ] API documentation

**Mid-term**
- [ ] MCP Server implementation (for Claude Desktop integration)
- [ ] Frontend interface (simple web UI for testing)
- [ ] Multiple embedding providers (Cohere, HuggingFace, local models)

**Long-term (Future Releases)**
- [ ] Authentication & authorization (JWT, API keys)
- [ ] Admin dashboard for monitoring and analytics
- [ ] Rate limiting and caching layer
- [ ] Advanced chunking strategies
- [ ] Production deployment guides (AWS, GCP, Azure)

</details>

---

<div align="center">

**Status:** Active Development | **License:** ISC

</div>
