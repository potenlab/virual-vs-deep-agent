# Product Requirements Document (PRD) v2

**Project Name:** Virtual FS + AI Agent Engine
**Status:** In Development (Standalone Independent Project)
**Target Integration:** PotenManager (Future Phase)

---

## 1. Executive Summary

**Objective:** Build and test a standalone AI Agent engine capable of reasoning over a Virtual File System (Virtual FS). The agent simulates terminal-like commands (`ls`, `cat`, `grep`) to read, search, and write project data directly to a database, allowing the AI to manage context dynamically without exceeding token limits.

**Key Changes from v1:**
- Transitioned from direct Anthropic/Claude APIs to **OpenRouter** for model flexibility (defaulting to Kimi K2).
- Adopted "ChromaFs" logic: directory bootstrapping, chunk reassembly, and optimized grep mechanisms.
- Uses **local PostgreSQL** with Drizzle ORM — fully self-hosted, no cloud dependencies. Deployable to AWS Lambda later.
- Frontend built with **Next.js (App Router)** + Tailwind CSS + shadcn/ui.

---

## 2. Technical Stack

| Layer | Technology | Rationale |
|:---|:---|:---|
| **Frontend UI** | Next.js (App Router) + Tailwind + shadcn/ui | Chat interface with session management, model selection |
| **Backend Runtime** | Next.js API Routes (Node.js) | Colocated with frontend, simple deployment |
| **Agent Framework** | DeepAgents (npm) | LangGraph-based orchestration, state management, tool routing |
| **LLM Gateway** | OpenRouter | Agnostic model switching (Kimi K2, Claude Sonnet, GPT-4o, DeepSeek) |
| **Database** | Local PostgreSQL + Drizzle ORM | Stores Virtual FS structure, file contents, chat history. AWS RDS later. |
| **Virtual FS Engine** | just-bash (npm) | Custom IFileSystem implementation for bash command simulation |

### OpenRouter Configuration

```typescript
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  modelName: process.env.DEFAULT_MODEL,
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});
```

---

## 3. Core Functional Requirements (Must-Have)

### F1. Directory Tree Bootstrapping

- **Description:** Build an in-memory representation of the project's file/directory structure.
- **Mechanism:** Query the PostgreSQL `documents` table once on session init. Use Maps to construct the tree in-memory.
- **Benefit:** `ls`, `cd`, `find` resolve instantly without DB calls.
- **Implementation:** `TreeBuilder` class with `bootstrap()`, `readdir()`, `stat()`, `find()`, `exists()`.

### F2. Chunk Reassembly (`cat` Command)

- **Description:** Agent reads file contents dynamically from the database.
- **Mechanism:** Fetch content from the `documents` table. Long documents use `chunk_index` ordering.
- **Caching:** Content cached in-memory (TTL 30s) to prevent re-reads during grep workflows.
- **Implementation:** `VirtualFs.readFile()` with `CacheLayer`.

### F3. Optimized Search (`grep` Command)

- **Description:** Search for text across the virtual filesystem without full-table scans.
- **Mechanism:**
  1. **Coarse Filter:** PostgreSQL `ILIKE` or `tsvector` to find candidate files.
  2. **Cache:** Bulk prefetch matched file contents into memory.
  3. **Fine Filter:** In-memory regex for precise line-level matches.
- **Implementation:** `GrepOptimizer` class with `grep()` method.

### F4. Execution Caching

- **Description:** Prevent redundant DB reads during multi-step reasoning loops.
- **Mechanism:** In-memory Map cache (TTL 30s). Instant response for repeated reads within the same session.
- **Implementation:** `CacheLayer<T>` class with `get()`, `set()`, `prune()`.

### F5. IFileSystem Implementation

- **Description:** Implement the just-bash `IFileSystem` interface backed by PostgreSQL.
- **Methods:** `readFile`, `writeFile`, `mkdir`, `rm`, `stat`, `readdir`, `exists`, `resolvePath`.
- **Behavior:** `readdir`/`stat` are in-memory (via TreeBuilder). `readFile`/`writeFile` hit the DB with caching.
- **Implementation:** `VirtualFs` class.

### F6. Persistent Sessions & History

- **Description:** AI remembers conversation context across messages.
- **Mechanism:** PostgreSQL tables (`sessions`, `messages`) with Drizzle ORM.
- **Features:** Session CRUD, message history, auto-titling on first message, context window management.
- **Implementation:** `SessionStore` class (singleton via `getStore()`).

### F7. Agent Tools

The agent has access to these tools:
| Tool | Description |
|:---|:---|
| `execute_command` | Run bash commands (ls, cat, find, grep) in the virtual FS via just-bash |
| `create_task` | Create a todo/task in the project |
| `update_task` | Update task status, priority, assignee |
| `create_event` | Create a calendar event |
| `search_docs` | Full-text search across project documents |

---

## 4. Enhanced Features (Future Roadmap)

| Feature | Description | Priority |
|:---|:---|:---|
| **Access Control (RBAC)** | Filter file tree by `isPublic`/group permissions | Phase 2+ |
| **Semantic Grep (`sgrep`)** | pgvector similarity search across documents | Phase 3+ |
| **Lazy File Pointers** | Visible in `ls` but only loaded on `cat` | High Volume |
| **Redis Cache** | Migrate from in-memory to Redis for cross-session caching | Production Scale |
| **SSE Streaming** | Token-by-token streaming to frontend | Next iteration |
| **AWS Lambda Deploy** | Migrate backend from Next.js local to AWS Lambda + API Gateway | Production |

---

## 5. Database Schema

### Tables

| Table | Purpose |
|:---|:---|
| `sessions` | AI conversation sessions (id, title, created_at) |
| `messages` | Messages within sessions (id, session_id FK, role, content, model, timestamp) |
| `projects` | Projects (future — for multi-project support) |
| `documents` | Virtual filesystem entries (path, name, type, content, metadata) |
| `todos` | Tasks/todos (title, status, priority, assignee, due_date) |
| `events` | Calendar events (title, start_time, end_time, location) |

### Current Schema (implemented)

```sql
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  model text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_session_id_idx ON messages(session_id);
```

### Virtual FS Schema (to be added)

```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  owner_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('file', 'directory')),
  content text,
  chunk_index integer DEFAULT 0,
  size_bytes integer DEFAULT 0,
  is_public boolean DEFAULT false,
  groups text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, path)
);

CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_path ON documents(project_id, path);
CREATE INDEX idx_documents_content_fts ON documents
  USING gin(to_tsvector('english', coalesce(content, '')));

CREATE TABLE todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority text DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee text,
  due_date timestamptz,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  attendees text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## 6. Implementation Roadmap

### Milestone 1: Chat Foundation (DONE)
- [x] Next.js project with Tailwind + shadcn/ui
- [x] DeepAgents + OpenRouter integration
- [x] Session store with PostgreSQL + Drizzle ORM
- [x] API routes (POST /api/chat, sessions CRUD)
- [x] Chat UI with session sidebar, model selector, typing indicator
- [x] Dark mode, accessibility, animations

### Milestone 2: Virtual FS + Project Database
- [ ] Add `projects`, `documents`, `todos`, `events` tables (Drizzle schema + migration)
- [ ] Implement `TreeBuilder` for directory bootstrapping (F1)
- [ ] Implement `VirtualFs` (IFileSystem) with readFile, writeFile, mkdir, rm, stat, readdir (F2, F5)
- [ ] Implement `CacheLayer` with TTL (F4)
- [ ] Implement `GrepOptimizer` with coarse→fine search (F3)
- [ ] Integrate just-bash with VirtualFs
- [ ] Seed script for demo project data

### Milestone 3: Agent Tools + System Prompt
- [ ] Implement `execute_command` tool (just-bash in virtual FS)
- [ ] Implement `create_task`, `update_task` tools
- [ ] Implement `create_event` tool
- [ ] Implement `search_docs` tool (PostgreSQL FTS)
- [ ] Write Virtual FS-aware system prompt
- [ ] Connect tools to DeepAgent

### Milestone 4: UI Enhancements
- [ ] Project selector in the UI
- [ ] File browser panel (tree view)
- [ ] Tool call visualization (show what commands the agent runs)
- [ ] SSE streaming for token-by-token output

### Milestone 5: Testing & Polish
- [ ] Seed demo project with docs, tasks, events
- [ ] Integration tests (session persistence, VFS operations, tool execution)
- [ ] Performance test: tree bootstrap < 500ms
- [ ] Memory profiling for large file trees

---

## 7. Environment Variables

```env
OPENROUTER_API_KEY=your_openrouter_api_key
DEFAULT_MODEL=moonshotai/kimi-k2
DATABASE_URL=postgresql://user@localhost:5432/chatbot
```

---

## 8. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│                                                      │
│  ┌──────────────┐        ┌────────────────────────┐ │
│  │   React UI   │        │     API Routes         │ │
│  │              │───────▶│  /api/chat             │ │
│  │  - Chat      │        │  /api/sessions         │ │
│  │  - Sidebar   │        │  /api/projects (future)│ │
│  │  - Model     │        └──────────┬─────────────┘ │
│  │    selector  │                   │                │
│  │  - File tree │                   ▼                │
│  │    (future)  │        ┌────────────────────────┐ │
│  └──────────────┘        │     DeepAgents         │ │
│                          │  (Agent + Tools)       │ │
│                          └──────────┬─────────────┘ │
│                                     │                │
│                          ┌──────────┴─────────────┐ │
│                          │    Virtual FS Engine    │ │
│                          │  ┌──────────────────┐  │ │
│                          │  │   just-bash      │  │ │
│                          │  │   (IFileSystem)  │  │ │
│                          │  └────────┬─────────┘  │ │
│                          │           │             │ │
│                          │  ┌────────┴─────────┐  │ │
│                          │  │  TreeBuilder     │  │ │
│                          │  │  CacheLayer      │  │ │
│                          │  │  GrepOptimizer   │  │ │
│                          │  └──────────────────┘  │ │
│                          └──────────┬─────────────┘ │
│                                     │                │
│                          ┌──────────┴─────────────┐ │
│                          │   Session Store        │ │
│                          │   (Drizzle ORM)        │ │
│                          └────────────────────────┘ │
└──────────────────────────┬──────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
    ┌────────────────┐       ┌────────────────┐
    │   PostgreSQL   │       │   OpenRouter   │
    │  (Local DB)    │       │   (LLM API)   │
    └────────────────┘       └────────────────┘
```

---

## 9. Non-Functional Requirements

- **Performance:** File tree bootstrapping must complete in < 500ms.
- **Memory:** Agent execution footprint should stay reasonable for Node.js runtime.
- **UX:** Frontend must show typing indicator immediately; streamed responses in future iteration.
- **Scalability:** Connection pooling via `pg.Pool` (max 10 connections) with `globalThis` singleton for HMR survival.

---

## 10. Verification Criteria

| Milestone | Completion Criteria |
|:---|:---|
| 1 (Chat) | Chat with the bot, switch sessions, change models, data persists in PostgreSQL |
| 2 (VFS) | `ls`, `cat`, `grep` work in virtual FS. Grep uses coarse→fine filter. Tree bootstraps in < 500ms |
| 3 (Tools) | Ask "show me tasks with upcoming deadlines" → agent runs ls/cat and responds with data |
| 4 (UI) | Project selector, file browser, tool call visualization visible in UI |
| 5 (Test) | Tasks created by agent are reflected in PostgreSQL. Sessions persist across restarts |
