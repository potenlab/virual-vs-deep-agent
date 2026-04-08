# Simple Chatbot with DeepAgents

> A lightweight chatbot powered by DeepAgents + OpenRouter with a Next.js frontend.

---

## Goal

Build a minimal chatbot system that:
1. Uses **DeepAgents** as the agent framework
2. Connects to **OpenRouter** for LLM access (configurable via .env)
3. Has a clean, simple **Next.js chat UI**
4. Supports **conversation history** (in-memory)
5. Can be extended with custom tools later

---

## Tech Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Agent Framework | DeepAgents (npm) | LangGraph-based |
| LLM | **OpenRouter** | Model set via DEFAULT_MODEL in .env |
| Framework | **Next.js 15** (App Router) | API Routes + React frontend in one project |
| Styling | Tailwind CSS | Utility-first CSS |
| Runtime | Node.js 20.x | Local dev first |

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

## TODO

### Phase 1: Project Setup (Day 1)

- [ ] **1.1** Initialize Next.js project (`npx create-next-app@latest chatbot --typescript --tailwind --app`)
- [ ] **1.2** Install dependencies (deepagents, @langchain/openai, @langchain/core, zod)
- [ ] **1.3** OpenRouter connection test (simple query)
- [ ] **1.4** Environment config (.env.local with OPENROUTER_API_KEY and DEFAULT_MODEL)

### Phase 2: Agent + Tools (Day 2)

- [ ] **2.1** Create OpenRouter LLM config (`lib/agent/openrouter.ts`)
- [ ] **2.2** Write system prompt (general-purpose assistant)
- [ ] **2.3** Create DeepAgent with basic tools (web_search, calculator)
- [ ] **2.4** Test agent via script (`scripts/test-repl.ts`)

### Phase 3: API Routes (Day 3)

- [ ] **3.1** `POST /api/chat` — Send message, get agent response
- [ ] **3.2** `GET /api/sessions` — List sessions
- [ ] **3.3** `POST /api/sessions` — Create a session
- [ ] **3.4** `DELETE /api/sessions/[id]` — Delete a session
- [ ] **3.5** `GET /api/sessions/[id]/messages` — Get message history
- [ ] **3.6** In-memory session store (`lib/session-store.ts`)

### Phase 4: Chat UI (Day 4)

- [ ] **4.1** Chat page layout (`app/page.tsx`)
- [ ] **4.2** Message input with Enter to send
- [ ] **4.3** Chat bubbles (user/assistant styling with Tailwind)
- [ ] **4.4** Typing indicator while waiting
- [ ] **4.5** Model selector dropdown
- [ ] **4.6** Session sidebar (new/switch/delete)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Next.js App                    │
│                                                  │
│  ┌──────────────┐       ┌────────────────────┐  │
│  │   React UI   │       │   API Routes       │  │
│  │              │──────▶│   /api/chat         │  │
│  │  - Chat page │       │   /api/sessions     │  │
│  │  - Sidebar   │       └────────┬───────────┘  │
│  │  - Model     │                │               │
│  │    selector  │                ▼               │
│  └──────────────┘       ┌────────────────────┐  │
│                         │   DeepAgents       │  │
│                         │   (Agent + Tools)  │  │
│                         └────────┬───────────┘  │
│                                  │               │
│                         ┌────────┴───────────┐  │
│                         │  Session Store     │  │
│                         │  (In-memory)       │  │
│                         └────────────────────┘  │
└──────────────────────────┬──────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │   OpenRouter   │
                  │   (LLM API)   │
                  └────────────────┘
```

**Key layers:**
- **React UI** — Chat interface with session management and model selection (Tailwind CSS)
- **API Routes** — Next.js App Router handlers for chat and session CRUD
- **DeepAgents** — LangGraph-based agent with custom tools and system prompt
- **Session Store** — In-memory conversation history per session
- **OpenRouter** — LLM gateway (model configurable via `DEFAULT_MODEL` in .env)

---

## Environment Variables

```env
OPENROUTER_API_KEY=your_openrouter_api_key
DEFAULT_MODEL=moonshotai/kimi-k2
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send a message, get a response |
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions` | Create a new session |
| DELETE | `/api/sessions/[id]` | Delete a session |
| GET | `/api/sessions/[id]/messages` | Get session message history |

### POST /api/chat Request

```json
{
  "message": "Hello, what can you do?",
  "session_id": "optional-session-id",
  "model": "override-model-name (optional, uses DEFAULT_MODEL from .env if omitted)"
}
```

### POST /api/chat Response

```json
{
  "session_id": "abc123",
  "message": "I can help you with...",
  "model": "moonshotai/kimi-k2"
}
```

---

## Verification Criteria

| Phase | Completion Criteria |
|-------|-------------------|
| 1 | Successfully receive a response from OpenRouter via DEFAULT_MODEL |
| 2 | In terminal REPL: ask a question → agent responds coherently |
| 3 | API routes return agent response with session tracking |
| 4 | Next.js UI: chat with the bot, switch sessions, change models |
