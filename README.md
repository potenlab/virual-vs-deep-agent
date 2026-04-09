# Virtual FS + AI Agent Engine

An AI agent that reasons over a **Virtual File System** backed by PostgreSQL. Files don't live on disk — they live in a database. The agent uses terminal commands (`ls`, `cat`, `grep`) to browse, read, and search project data.

This project compares two approaches side-by-side: **VFS (Virtual File System)** vs **RAG (Retrieval-Augmented Generation)** — measuring token consumption and response quality for each.

## Architecture

```mermaid
flowchart LR
    A[Browser] --> B[Next.js API SSE]
    B --> C[LangGraph ReAct Agent]
    C --> D[OpenRouter LLM]
    C --> E[Virtual FS Engine]
    E --> F[(PostgreSQL + pgvector)]
    B --> F
```

## Two Modes: VFS vs RAG

The UI has a toggle to switch between modes. Both read from the same `documents` table.

```mermaid
flowchart TB
    subgraph VFS["VFS Mode (Multi-step)"]
        V1[User asks question] --> V2[Agent thinks]
        V2 --> V3["Tool: run_vfs ls /uploads"]
        V3 --> V4["Tool: run_vfs cat /file.pdf"]
        V4 --> V5[Agent responds]
    end

    subgraph RAG["RAG Mode (Single-step)"]
        R1[User asks question] --> R2[Embed query]
        R2 --> R3[pgvector similarity search]
        R3 --> R4[Inject top-5 docs into prompt]
        R4 --> R5[Agent responds]
    end
```

### Token Consumption Comparison

Real-world test: "Compare 2 uploaded ebooks" (Art of War PDF + 48 Laws PDF)

| Metric | VFS Mode | RAG Mode |
|--------|---------|---------|
| **Prompt tokens** | 1.3K | 1.0K |
| **Completion tokens** | 85 | 96 |
| **Total tokens** | 1.4K | 1.0K |
| **LLM calls** | 2-3 (tool loop) | 1 (single call) |
| **Latency** | Higher (sequential tools) | Lower (one round-trip) |

### Pros & Cons

| Aspect | VFS (Virtual File System) | RAG (Retrieval-Augmented Generation) |
|--------|--------------------------|--------------------------------------|
| **How it works** | Agent browses files with `ls`, `cat`, `grep` — multiple LLM calls | Relevant chunks retrieved via embedding similarity, injected into prompt — single LLM call |
| **Token efficiency** | Higher cost — each tool call is a full LLM round-trip with growing context | Lower cost — context retrieved upfront, single inference |
| **Accuracy** | High — agent reads exact file content, can explore freely | Depends on embedding quality — may miss relevant sections |
| **Flexibility** | Agent can discover files it didn't know about (`find`, `grep`) | Limited to top-K retrieved chunks, no exploration |
| **Large files** | Reads full content via `cat` — accurate but token-heavy | Truncated to 2,000 chars per chunk — may lose detail |
| **Best for** | Exploratory questions ("what files exist?", "search for X") | Direct questions about known content ("summarize this PDF") |
| **Latency** | Slower — multiple sequential API calls | Faster — single API call after retrieval |
| **Scaling** | Tokens grow with file count and tool calls | Tokens grow with top-K and chunk size (predictable) |

### When to Use Which

- **VFS**: When the user doesn't know what's in the files and needs the agent to explore
- **RAG**: When the user asks about specific content and wants fast, token-efficient answers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + Tailwind CSS + shadcn/ui |
| Agent | LangGraph ReAct Agent |
| LLM | OpenRouter (Kimi K2, Claude, GPT-4o) |
| Virtual FS | Custom IFileSystem (TreeBuilder + CacheLayer + GrepOptimizer) |
| Vector DB | PostgreSQL + pgvector (cosine similarity, IVFFlat index) |
| Embeddings | OpenAI text-embedding-3-small via OpenRouter |
| Streaming | Server-Sent Events (SSE) with live tool activity |

## Database Schema

```mermaid
erDiagram
    documents {
        uuid id PK
        text path UK
        text name
        text type
        text content
        vector embedding
        int size_bytes
    }
    sessions ||--o{ messages : contains
    sessions {
        uuid id PK
        text title
    }
    messages {
        uuid id PK
        uuid session_id FK
        text role
        text content
        int prompt_tokens
        int completion_tokens
        int total_tokens
        text mode
    }
```

## Features

- Upload documents (PDF, text, code) — auto-extracted and embedded
- VFS mode: agent browses with `ls`, `cat`, `grep`, `find`
- RAG mode: pgvector similarity search, single LLM call
- Token tracking per message (prompt/completion/total)
- Mode badge on each response (VFS orange / RAG blue)
- Live activity streaming (SSE: "Running: ls /uploads", "Thinking...")
- Dark mode, markdown rendering with GFM tables
- Session management (create, switch, delete)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ with pgvector extension

### Setup

```bash
cd chatbot

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit with your OpenRouter API key and DATABASE_URL

# Run database migrations
npm run db:migrate

# Enable pgvector (if not already)
psql -d chatbot -c "CREATE EXTENSION IF NOT EXISTS vector"

# Start dev server
npm run dev
```

### Environment Variables

```env
OPENROUTER_API_KEY=sk-or-v1-...
DEFAULT_MODEL=moonshotai/kimi-k2
DATABASE_URL=postgresql://user@localhost:5432/chatbot
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed demo documents |

## How It Works

### Upload Flow

```
Upload PDF → Extract text (pdf-parse) → Store in documents table → Generate embedding (OpenRouter) → Store vector in pgvector
```

### VFS Chat Flow

```
User question → Create ReAct agent with VFS tools → Agent calls run_vfs (ls, cat, grep) → Multiple LLM rounds → Response with token count
```

### RAG Chat Flow

```
User question → Embed query → pgvector cosine search → Inject top-5 chunks → Single LLM call → Response with token count
```
