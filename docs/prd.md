# Virtual FS + AI Agent Implementation Plan v2

> Before integrating with PotenManager, **build and test the core engine as a standalone project first**.

---

## Changes (v1 → v2)

1. **LLM**: Direct Claude API calls → **OpenRouter** (freely choose models like Kimi K2, Claude, GPT, etc.)
2. **ChromaFs article analysis applied**: Real implementation patterns including directory tree bootstrapping, chunk reassembly, grep optimization, access control, read-only mode, etc.

---

## Tech Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Agent Framework | DeepAgents (npm) | LangGraph-based |
| LLM | **OpenRouter** | Kimi K2 by default, switch to Claude/GPT as needed |
| Virtual FS Engine | just-bash (npm) | Custom IFileSystem implementation |
| DB | Supabase (PostgreSQL + pgvector) | Structured + Vector |
| Cache | In-memory (Map) → Redis later | For grep optimization |
| Runtime | AWS Lambda (Node.js 20.x) | 15-minute timeout |
| Test UI | Simple web chat | React or vanilla |

### OpenRouter Configuration

```typescript
// DeepAgents is LangChain-based, so connect via ChatOpenAI compatibility
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  modelName: "moonshotai/kimi-k2",    // OpenRouter model name
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  // Just change this to switch models
  // "anthropic/claude-sonnet-4-20250514"
  // "openai/gpt-4o"
});
```

---

## Key Implementation Items from ChromaFs Article

### Must Implement (Core)

| # | Item | ChromaFs Principle | Our Implementation (SupabaseFs) |
|---|------|-------------------|-------------------------------|
| C1 | **Directory Tree Bootstrapping** | Load gzip JSON from Chroma once → build in-memory using Set + Map. After that, `ls`, `cd`, `find` resolve from memory without network calls | Query the per-project file tree from Supabase **once** and build an in-memory Map. `ls`, `find` are local memory operations |
| C2 | **Chunk Reassembly (cat)** | Fetch multiple chunks in `chunk_index` order and concatenate | Query content from the documents table. Long documents can be split into a chunks table, but initially a single content column is sufficient |
| C3 | **Grep Optimization** | (1) Chroma coarse filter → (2) cache matched files → (3) in-memory regex fine filter | (1) PostgreSQL `ILIKE` or `tsvector` coarse filter → (2) cache results → (3) pass matched files to just-bash for fine filter |
| C4 | **Result Caching** | Cache cat results to prevent repeated reads during grep workflows | In-memory Map cache (TTL 30s). Instant response for repeated reads within the same session |
| C5 | **IFileSystem Interface Implementation** | Implement just-bash's pluggable interface with Chroma queries | Same approach — implement just-bash IFileSystem with Supabase queries |
| C6 | **Session Management + History** | (ChromaFs itself is stateless) | Persist conversations with ai_sessions + ai_messages tables |

### Implement Later (Enhanced)

| # | Item | Description | Priority |
|---|------|-------------|----------|
| E1 | **Access Control (RBAC)** | Filter file tree by isPublic/groups fields | After Phase 2 (when adding team features) |
| E2 | **Lazy File Pointers** | Visible in ls but only actually loaded on cat | When large files appear |
| E3 | **Read-Only Mode** | Since we're a PM tool, support both read/write with permission checks | - |
| E4 | **Semantic grep (sgrep)** | pgvector similarity search | After Phase 3 |
| E5 | **Redis Cache** | Migrate from in-memory → Redis (for Lambda scaling) | When traffic grows |

---

## TODO

### Phase 1: Supabase + Project Setup (Day 1~2)

- [ ] **1.1** Create Supabase tables (projects, documents, todos, events, budget_items, ai_sessions, ai_messages)
- [ ] **1.2** Set up RLS policies
- [ ] **1.3** Create RPC functions (get_task_summary, get_project_dashboard)
- [ ] **1.4** Enable pgvector extension + FTS indexes
- [ ] **1.5** Seed data script
- [ ] **1.6** Project initialization (`poten-agent/`, package.json, tsconfig)
- [ ] **1.7** OpenRouter connection test (simple query with Kimi K2)

### Phase 2: Virtual File System (Day 3~6)

- [ ] **2.1** `TreeBuilder` — Project tree bootstrapping (C1)
- [ ] **2.2** `SupabaseFs` — IFileSystem implementation (readdir, stat are in-memory) (C5)
- [ ] **2.3** `SupabaseFs` — readFile (cat) + caching (C2, C4)
- [ ] **2.4** `SupabaseFs` — writeFile (write + tree update)
- [ ] **2.5** Grep optimization — coarse filter + bulk prefetch + fine filter (C3)
- [ ] **2.6** just-bash integration test

### Phase 3: DeepAgents + OpenRouter (Day 7~9)

- [ ] **3.1** Connect OpenRouter LLM to DeepAgents (ChatOpenAI compatible)
- [ ] **3.2** Write system prompt
- [ ] **3.3** Connect custom tools (execute_command, create_task, update_task, create_event, search_docs)
- [ ] **3.4** Local terminal interactive test

### Phase 4: Sessions + History (Day 10~11)

- [ ] **4.1** Implement SessionManager (create, list, delete)
- [ ] **4.2** Implement HistoryLoader (save, load, context window)
- [ ] **4.3** Inject history into agent
- [ ] **4.4** Session switching test

### Phase 5: Lambda Deployment + Test UI (Day 12~14)

- [ ] **5.1** Lambda deployment (Node.js 20.x, 15-minute timeout)
- [ ] **5.2** API Gateway setup (POST /chat, GET/POST /sessions, GET /sessions/{id}/messages)
- [ ] **5.3** Lambda Response Streaming
- [ ] **5.4** Test web UI (chat + session sidebar)
- [ ] **5.5** Integration tests (session persistence, DB reflection, concurrent sessions)

---

## Project Structure

```
poten-agent/
├── src/
│   ├── virtual-fs/
│   │   ├── supabase-fs.ts        ← IFileSystem implementation (core)
│   │   ├── tree-builder.ts       ← Directory tree bootstrapping
│   │   ├── grep-optimizer.ts     ← Grep coarse/fine filter
│   │   ├── cache-layer.ts        ← In-memory cache (TTL)
│   │   └── path-parser.ts        ← Path parsing utility
│   ├── agent/
│   │   ├── create-agent.ts       ← DeepAgents + OpenRouter setup
│   │   ├── tools.ts              ← Custom tools
│   │   └── system-prompt.ts      ← System prompt
│   ├── session/
│   │   ├── session-manager.ts    ← Session CRUD
│   │   └── history-loader.ts     ← Conversation history + summarization
│   ├── config/
│   │   └── openrouter.ts         ← OpenRouter LLM configuration
│   └── handler.ts                ← Lambda entry point
├── scripts/
│   ├── seed.ts                   ← Test data
│   └── test-local.ts             ← Local REPL test
├── test-ui/                      ← Simple chat UI
│   ├── index.html
│   └── app.js
├── supabase/
│   └── migrations/
│       ├── 001_tables.sql
│       ├── 002_rls.sql
│       └── 003_rpc_functions.sql
├── package.json
├── tsconfig.json
└── serverless.yml                ← Lambda deployment
```

---

## Verification Criteria per Checkpoint

| Phase | Completion Criteria |
|-------|-------------------|
| 1 | Confirm tables + seed data in Supabase. Successfully receive a response from Kimi K2 via OpenRouter |
| 2 | `ls`, `cat`, `grep` work correctly in `test-local.ts`. Confirm grep uses coarse→fine filter instead of full scan |
| 3 | In terminal: "Show me tasks with upcoming deadlines" → Agent automatically runs ls/cat and responds |
| 4 | Chat in Session A → switch to Session B → return to Session A and previous context is remembered |
| 5 | In web UI: chat + session switching + tasks created by the agent are actually reflected in Supabase |
