# Virtual FS + AI Agent Engine

An AI agent that reasons over a **Virtual File System** backed by PostgreSQL. Files don't live on disk — they live in a database. The agent uses terminal commands (`ls`, `cat`, `grep`) to browse, read, and search project data, while managing context dynamically without exceeding token limits.

## Architecture Overview

```mermaid
graph TB
    subgraph Browser["Browser (Next.js React)"]
        UI[Chat UI]
        Sidebar[Session Sidebar<br/>+ Document List]
        Upload[File Upload]
    end

    subgraph NextJS["Next.js API Routes"]
        ChatAPI[POST /api/chat]
        SessionAPI[/api/sessions]
        DocAPI[POST /api/documents]
    end

    subgraph Agent["DeepAgents (LangGraph)"]
        DA[DeepAgent]
        Tools[Agent Tools]
        SP[System Prompt]
    end

    subgraph VFS["Virtual FS Engine"]
        JB[just-bash<br/>Bash Interpreter]
        VF[VirtualFs<br/>IFileSystem]
        TB[TreeBuilder<br/>In-Memory Map]
        CL[CacheLayer<br/>TTL 30s]
        GO[GrepOptimizer<br/>Coarse → Fine]
    end

    subgraph DB["PostgreSQL"]
        Sessions[(sessions)]
        Messages[(messages)]
        Projects[(projects)]
        Documents[(documents)]
        Todos[(todos)]
        Events[(events)]
    end

    LLM[OpenRouter<br/>Kimi K2 / Claude / GPT]

    UI -->|fetch| ChatAPI
    Sidebar -->|fetch| SessionAPI
    Upload -->|FormData| DocAPI

    ChatAPI --> DA
    DA --> Tools
    DA --> SP
    DA -->|LLM call| LLM

    Tools -->|execute_command| JB
    Tools -->|create_task| Todos
    Tools -->|update_task| Todos
    Tools -->|create_event| Events
    Tools -->|search_docs| Documents

    JB -->|ls, cat, grep| VF
    VF --> TB
    VF --> CL
    VF --> GO

    TB -->|bootstrap once| Documents
    CL -->|cache reads| Documents
    GO -->|ILIKE coarse| Documents

    ChatAPI --> Sessions
    ChatAPI --> Messages
    DocAPI --> Documents
    SessionAPI --> Sessions

    style Browser fill:#1a1a2e,stroke:#e94560,color:#fff
    style NextJS fill:#16213e,stroke:#0f3460,color:#fff
    style Agent fill:#0f3460,stroke:#533483,color:#fff
    style VFS fill:#533483,stroke:#e94560,color:#fff
    style DB fill:#1a1a2e,stroke:#0f3460,color:#fff
```

## How It Works

### Flow 1: User Chats with the Agent

```mermaid
sequenceDiagram
    actor User
    participant UI as Chat UI
    participant API as POST /api/chat
    participant Agent as DeepAgent
    participant VFS as VirtualFs
    participant DB as PostgreSQL
    participant LLM as OpenRouter

    User->>UI: "Show me project files"
    UI->>API: { message, project_id, session_id }
    API->>DB: Save user message
    API->>Agent: Invoke with history

    Agent->>LLM: What tools should I use?
    LLM-->>Agent: Call execute_command("ls /")

    Agent->>VFS: exec("ls /")
    Note over VFS: TreeBuilder answers<br/>from in-memory Map<br/>(no DB call!)
    VFS-->>Agent: "docs/  src/  uploads/"

    Agent->>LLM: Here are the results, respond to user
    LLM-->>Agent: "Your project has 3 directories..."

    Agent-->>API: Response text
    API->>DB: Save assistant message
    API-->>UI: { message, session_id }
    UI-->>User: Renders markdown response
```

### Flow 2: User Uploads a Document

```mermaid
sequenceDiagram
    actor User
    participant Sidebar as Document List
    participant API as POST /api/documents
    participant DB as PostgreSQL
    participant Agent as DeepAgent
    participant VFS as VirtualFs

    User->>Sidebar: Click "Upload File"
    User->>Sidebar: Select meeting-notes.md
    Sidebar->>API: FormData { file, project_id }

    API->>DB: Create /uploads directory (if needed)
    API->>DB: INSERT document at /uploads/meeting-notes.md
    API-->>Sidebar: { success, path }
    Sidebar->>Sidebar: Refresh document list

    Note over User: Later...
    User->>Agent: "Read my uploaded meeting notes"
    Agent->>VFS: exec("cat /uploads/meeting-notes.md")
    VFS->>DB: SELECT content WHERE path = '/uploads/meeting-notes.md'
    Note over VFS: Content cached<br/>for 30 seconds
    VFS-->>Agent: File contents
    Agent-->>User: "Here's what your meeting notes say..."
```

### Flow 3: Agent Searches for Information (Grep)

```mermaid
sequenceDiagram
    participant Agent as DeepAgent
    participant JB as just-bash
    participant GO as GrepOptimizer
    participant DB as PostgreSQL
    participant Cache as CacheLayer

    Agent->>JB: exec('grep -r "TODO" /src')

    JB->>GO: grep("TODO", { filePattern: "/src/*" })

    Note over GO: Step 1: Coarse Filter
    GO->>DB: SELECT path FROM documents<br/>WHERE content ILIKE '%TODO%'
    DB-->>GO: ["/src/index.ts", "/src/app.ts"]

    Note over GO: Step 2: Bulk Prefetch
    GO->>Cache: Check cache for each file
    Cache-->>GO: Miss on /src/app.ts
    GO->>DB: SELECT content WHERE path = '/src/app.ts'
    DB-->>GO: File content
    GO->>Cache: Store with 30s TTL

    Note over GO: Step 3: Fine Filter
    GO->>GO: Regex match line-by-line

    GO-->>JB: [{ path, line: 12, content: "// TODO: fix" }]
    JB-->>Agent: "src/index.ts:12: // TODO: fix this"
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + Tailwind CSS + shadcn/ui |
| Agent | DeepAgents (LangGraph) |
| LLM | OpenRouter (Kimi K2, Claude, GPT-4o) |
| Virtual FS | just-bash + custom IFileSystem |
| Database | PostgreSQL + Drizzle ORM |

## Project Structure

```
chatbot/
├── src/
│   ├── app/                    # Next.js pages + API routes
│   │   ├── page.tsx            # Main chat page
│   │   └── api/
│   │       ├── chat/           # POST - agent conversation
│   │       ├── documents/      # GET/POST - file upload & list
│   │       └── sessions/       # CRUD - chat sessions
│   ├── components/             # UI components
│   │   ├── chat/               # ChatBubble, ChatInput, ChatHeader
│   │   ├── session/            # SessionSidebar, DocumentList
│   │   └── common/             # EmptyState, TypingIndicator
│   ├── features/               # Business logic hooks
│   │   ├── chat/               # useChat, useSendMessage
│   │   ├── session/            # useSessions, useSessionManager
│   │   └── documents/          # useDocuments
│   └── lib/
│       ├── agent/              # DeepAgent, tools, system prompt
│       ├── db/                 # Drizzle schema + connection
│       └── fs/                 # TreeBuilder, VirtualFs, GrepOptimizer, CacheLayer
├── scripts/
│   ├── seed-project.ts         # Seed demo data
│   └── test-repl.ts            # Terminal REPL test
├── drizzle/                    # SQL migrations
└── docker-compose.yml          # Local PostgreSQL
```

## Database Schema

```mermaid
erDiagram
    projects ||--o{ documents : contains
    projects ||--o{ todos : has
    projects ||--o{ events : has
    sessions ||--o{ messages : contains

    projects {
        uuid id PK
        text name
        text slug UK
        text description
        uuid owner_id
        jsonb metadata
    }

    documents {
        uuid id PK
        uuid project_id FK
        text path
        text name
        text type
        text content
        int chunk_index
        int size_bytes
    }

    todos {
        uuid id PK
        uuid project_id FK
        text title
        text status
        text priority
        text assignee
        timestamptz due_date
    }

    events {
        uuid id PK
        uuid project_id FK
        text title
        timestamptz start_time
        timestamptz end_time
        text location
    }

    sessions {
        uuid id PK
        text title
        timestamptz created_at
    }

    messages {
        uuid id PK
        uuid session_id FK
        text role
        text content
        text model
    }
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+

### Setup

```bash
cd chatbot

# Install dependencies
npm install

# Start PostgreSQL (Docker)
docker compose up -d
# Or use an existing local PostgreSQL

# Configure environment
cp .env.example .env.local
# Edit .env.local with your OpenRouter API key and DATABASE_URL

# Run database migrations
npm run db:migrate

# (Optional) Seed demo project data
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
OPENROUTER_API_KEY=sk-or-v1-...
DEFAULT_MODEL=moonshotai/kimi-k2
DATABASE_URL=postgresql://user@localhost:5432/chatbot
```

## Agent Tools

| Tool | What it does |
|------|-------------|
| `execute_command` | Run bash commands (`ls`, `cat`, `grep`, `find`) in the Virtual FS |
| `create_task` | Create a todo with title, priority, assignee, due date |
| `update_task` | Update task status, priority, or assignee |
| `create_event` | Schedule a calendar event |
| `search_docs` | Full-text search across all project documents |

## Key Design Decisions

1. **Files in database, not disk** — enables the agent to manage context without filesystem access, portable to serverless (AWS Lambda)
2. **Tree bootstrapped once** — full directory tree loaded into memory on init, `ls`/`find` are instant (no DB calls)
3. **Grep: coarse then fine** — PostgreSQL ILIKE narrows candidates, in-memory regex does precise matching. Avoids full-table scans.
4. **30-second cache** — prevents redundant DB reads during multi-step agent reasoning loops
5. **OpenRouter for LLM** — switch between Kimi K2, Claude, GPT-4o without code changes

## Future Roadmap

- [ ] SSE streaming (token-by-token output)
- [ ] File browser tree view in UI
- [ ] Tool call visualization in chat
- [ ] Semantic search via pgvector
- [ ] RBAC (role-based file access)
- [ ] AWS Lambda deployment
- [ ] Redis cache for production scale
