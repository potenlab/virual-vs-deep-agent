# Backend Plan -- API Routes, Agent, and Session Management

Generated: 2026-04-08
Source PRD: docs/prd.md
Source Dev Plan: docs/dev-plan.md
Source UI/UX: docs/ui-ux-plan.md

---

## 1. In-Memory Data Structures

### 1.1 Session Store

The entire backend state lives in a single `Map` held by a singleton `SessionStore` class. No database, no persistence across server restarts.

```
SessionStore (singleton)
└── store: Map<string, SessionData>
         │
         └── key: session id (UUID v4)
             value: {
               session: Session      // metadata
               messages: Message[]   // ordered by timestamp ascending
             }
```

Module: `src/lib/session-store.ts`

```typescript
// Runtime shape of the Map entry
interface SessionData {
  session: Session;
  messages: Message[];
}

class SessionStore {
  private store: Map<string, SessionData>;

  createSession(): Session;
  getSession(id: string): Session | undefined;
  listSessions(): Session[];               // sorted by createdAt desc
  deleteSession(id: string): boolean;
  addMessage(sessionId: string, msg: Message): void;
  getMessages(sessionId: string): Message[];
  updateSessionTitle(id: string, title: string): void;
}
```

**Singleton export:** Use a module-level variable so the same instance is shared across all API route invocations within the same Next.js process.

```typescript
const globalStore = globalThis as unknown as { __sessionStore?: SessionStore };
export const sessionStore = globalStore.__sessionStore ??= new SessionStore();
```

> Why `globalThis`? In Next.js dev mode, hot-reload re-evaluates modules. Attaching to `globalThis` prevents the store from being wiped on every file change.

### 1.2 Memory Limits

- No hard cap for MVP. Keep in mind: each message averages ~500 bytes, 100 sessions x 50 messages = ~2.5 MB -- negligible.
- If this ever becomes a concern, implement a simple LRU eviction: drop the oldest session when the Map exceeds a configurable `MAX_SESSIONS` (default 200).

---

## 2. TypeScript Interfaces

All shared types live in `src/types/index.ts`.

```typescript
// --- Domain Models ---

export interface Session {
  id: string;          // crypto.randomUUID()
  title: string;       // "New Chat" initially, then first 50 chars of first user message
  createdAt: string;   // ISO 8601 timestamp
}

export interface Message {
  id: string;          // crypto.randomUUID()
  role: "user" | "assistant";
  content: string;
  model?: string;      // OpenRouter model slug used for this response (assistant only)
  timestamp: string;   // ISO 8601 timestamp
}

// --- API Request/Response ---

export interface ChatRequest {
  message: string;          // required, non-empty after trim
  session_id?: string;      // optional; omit to auto-create a new session
  model?: string;           // optional; falls back to DEFAULT_MODEL env var
}

export interface ChatResponse {
  session_id: string;
  message: string;          // assistant response content
  model: string;            // model slug actually used
}

export interface SessionListResponse {
  sessions: Session[];
}

export interface SessionCreateResponse {
  session: Session;
}

export interface SessionDeleteResponse {
  success: boolean;
}

export interface MessageListResponse {
  messages: Message[];
}

export interface ErrorResponse {
  error: string;            // human-readable error message
  code?: string;            // machine-readable error code (optional)
}
```

---

## 3. API Route Specifications

All routes are Next.js App Router Route Handlers (`src/app/api/...`).

### 3.1 POST /api/chat

**File:** `src/app/api/chat/route.ts`

**Purpose:** Accept a user message, run it through the DeepAgent, return the assistant reply.

| Field | Value |
|-------|-------|
| Method | POST |
| Content-Type | application/json |

**Request Body:**

```json
{
  "message": "Hello, what can you do?",
  "session_id": "optional-uuid",
  "model": "optional/model-slug"
}
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| `message` | Required. Must be a non-empty string after `.trim()`. Max 10,000 characters. |
| `session_id` | Optional. If provided, must match an existing session in the store. |
| `model` | Optional. If provided, must be a string present in `MODEL_LIST`. Falls back to `DEFAULT_MODEL`. |

**Response (200):**

```json
{
  "session_id": "abc-123",
  "message": "I can help you with...",
  "model": "moonshotai/kimi-k2"
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing or empty `message` | `{ "error": "Message is required" }` |
| 400 | `message` exceeds 10,000 chars | `{ "error": "Message too long (max 10,000 characters)" }` |
| 400 | Invalid `model` not in MODEL_LIST | `{ "error": "Invalid model" }` |
| 404 | `session_id` provided but not found | `{ "error": "Session not found" }` |
| 500 | Agent/LLM invocation failure | `{ "error": "Failed to generate response" }` |
| 502 | OpenRouter upstream error | `{ "error": "LLM service unavailable" }` |

**Internal Logic (pseudocode):**

```
1. Parse and validate request body
2. Resolve model: body.model ?? DEFAULT_MODEL
3. If session_id provided:
     session = store.getSession(session_id)
     if not found → 404
   Else:
     session = store.createSession()
4. Create user Message { id, role: "user", content, timestamp }
5. store.addMessage(session.id, userMessage)
6. history = store.getMessages(session.id)
7. agent = createAgent(model)
8. response = await agent.invoke(history)   // pass full history for context
9. Create assistant Message { id, role: "assistant", content: response, model, timestamp }
10. store.addMessage(session.id, assistantMessage)
11. If this is the first user message in session (history length was 0 before step 5):
      store.updateSessionTitle(session.id, body.message.trim().slice(0, 50))
12. Return { session_id: session.id, message: response, model }
```

---

### 3.2 GET /api/sessions

**File:** `src/app/api/sessions/route.ts`

**Purpose:** List all sessions.

| Field | Value |
|-------|-------|
| Method | GET |
| Content-Type | application/json |

**Request:** No body, no query params.

**Response (200):**

```json
{
  "sessions": [
    { "id": "abc-123", "title": "Tell me about Rust", "createdAt": "2026-04-08T10:00:00.000Z" },
    { "id": "def-456", "title": "New Chat", "createdAt": "2026-04-08T09:30:00.000Z" }
  ]
}
```

Sessions are sorted by `createdAt` descending (most recent first).

---

### 3.3 POST /api/sessions

**File:** `src/app/api/sessions/route.ts` (same file, named export `POST`)

**Purpose:** Create a new empty session.

| Field | Value |
|-------|-------|
| Method | POST |
| Content-Type | application/json |

**Request:** No body required.

**Response (201):**

```json
{
  "session": {
    "id": "ghi-789",
    "title": "New Chat",
    "createdAt": "2026-04-08T11:00:00.000Z"
  }
}
```

---

### 3.4 DELETE /api/sessions/[id]

**File:** `src/app/api/sessions/[id]/route.ts`

**Purpose:** Delete a session and its messages.

| Field | Value |
|-------|-------|
| Method | DELETE |
| Content-Type | application/json |

**Response (200):**

```json
{ "success": true }
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 404 | Session not found | `{ "error": "Session not found" }` |

---

### 3.5 GET /api/sessions/[id]/messages

**File:** `src/app/api/sessions/[id]/messages/route.ts`

**Purpose:** Retrieve all messages for a session.

| Field | Value |
|-------|-------|
| Method | GET |
| Content-Type | application/json |

**Response (200):**

```json
{
  "messages": [
    {
      "id": "msg-001",
      "role": "user",
      "content": "Hello",
      "timestamp": "2026-04-08T10:00:00.000Z"
    },
    {
      "id": "msg-002",
      "role": "assistant",
      "content": "Hi! How can I help?",
      "model": "moonshotai/kimi-k2",
      "timestamp": "2026-04-08T10:00:02.000Z"
    }
  ]
}
```

Messages are sorted by `timestamp` ascending (chronological order).

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 404 | Session not found | `{ "error": "Session not found" }` |

---

## 4. DeepAgent Configuration

### 4.1 LLM Setup

**File:** `src/lib/agent/openrouter.ts`

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { env } from "@/config/env";

export function createLLM(model?: string): ChatOpenAI {
  return new ChatOpenAI({
    modelName: model ?? env.DEFAULT_MODEL,
    openAIApiKey: env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0.7,       // balanced creativity
    maxTokens: 4096,        // reasonable response limit
  });
}
```

Key points:
- `baseURL` points to OpenRouter, which proxies to any supported LLM.
- `modelName` is the OpenRouter model slug (e.g., `moonshotai/kimi-k2`).
- `openAIApiKey` is the OpenRouter API key (not an actual OpenAI key).
- `temperature` and `maxTokens` are sensible defaults; no need to expose to the user for MVP.

### 4.2 Agent Creation

**File:** `src/lib/agent/agent.ts`

```typescript
import { createLLM } from "./openrouter";
import { Message } from "@/types";

const SYSTEM_PROMPT = `You are a helpful, concise AI assistant. You provide clear and accurate answers. When you don't know something, you say so honestly. Keep responses well-structured and to the point.`;

export async function createAgent(model?: string) {
  const llm = createLLM(model);

  // DeepAgent creation with LangGraph
  // The agent wraps the LLM with optional tool usage
  const agent = new DeepAgent({
    llm,
    systemPrompt: SYSTEM_PROMPT,
    tools: [],  // Start with no tools for MVP; add web_search, calculator later
  });

  return agent;
}

export async function invokeAgent(
  agent: DeepAgent,
  messages: Message[]
): Promise<string> {
  // Convert internal Message[] to LangChain message format
  const langchainMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const response = await agent.invoke(langchainMessages);
  return response.content;
}
```

### 4.3 System Prompt

The system prompt is intentionally short and general-purpose:

```
You are a helpful, concise AI assistant. You provide clear and accurate answers.
When you don't know something, you say so honestly. Keep responses well-structured
and to the point.
```

Design decisions:
- No persona or character -- this is a utility assistant.
- "Concise" is explicit to avoid verbose LLM responses.
- Honesty clause prevents hallucination escalation.
- No tool instructions in the prompt for MVP (no tools enabled yet).

### 4.4 Tools (Future)

The DeepAgent framework supports LangGraph tools. For MVP, the tools array is empty. Planned additions:

| Tool | Purpose | Priority |
|------|---------|----------|
| `web_search` | Search the web for current information | P1 (post-MVP) |
| `calculator` | Evaluate math expressions | P2 |

When tools are added, the system prompt should be updated to include tool usage instructions.

### 4.5 Conversation History Handling

The agent receives the full message history for the session on every invocation. This is necessary because the agent is stateless -- each API call creates a fresh agent instance.

```
User sends message →
  API route retrieves all messages for session →
    Appends new user message →
      Passes full history to agent.invoke() →
        Agent returns response with full context
```

History is converted from the internal `Message[]` format to LangChain's expected `{ role, content }[]` format before invocation.

**Context window management:** For MVP, no truncation. If a conversation exceeds the model's context window, the LLM will naturally fail or truncate. A future improvement would be to count tokens and trim older messages when approaching the limit.

---

## 5. Session Management Logic

### 5.1 Create Session

```
Trigger: POST /api/sessions OR first message without session_id
Result:
  1. Generate UUID via crypto.randomUUID()
  2. Create Session { id, title: "New Chat", createdAt: new Date().toISOString() }
  3. Insert into Map with empty messages array
  4. Return session object
```

### 5.2 List Sessions

```
Trigger: GET /api/sessions
Result:
  1. Iterate Map values, extract all session objects
  2. Sort by createdAt descending
  3. Return array
```

### 5.3 Delete Session

```
Trigger: DELETE /api/sessions/[id]
Result:
  1. Check if session exists in Map
  2. If not found → 404
  3. Delete entry from Map (both session metadata and messages)
  4. Return { success: true }
```

### 5.4 Get Messages

```
Trigger: GET /api/sessions/[id]/messages
Result:
  1. Check if session exists
  2. If not found → 404
  3. Return messages array (already stored in chronological order)
```

### 5.5 Auto-Title Logic

Sessions start with the title "New Chat". The title is updated automatically when the first user message is sent:

```
Trigger: POST /api/chat with a session that has zero messages prior to this call
Rule:    title = userMessage.trim().slice(0, 50)
         If result is shorter than original → append "..."
```

This keeps sidebar titles meaningful without requiring a separate LLM call for summarization (which would add latency and cost).

---

## 6. Error Handling Strategy

### 6.1 Error Categories

| Category | HTTP Status | Source | Handling |
|----------|-------------|--------|----------|
| Validation | 400 | Request body parsing | Return specific field error |
| Not Found | 404 | Session lookup miss | Return "Session not found" |
| LLM Failure | 500 | DeepAgent / OpenRouter | Log error, return generic message |
| Upstream Error | 502 | OpenRouter returns non-200 | Log, return "LLM service unavailable" |
| Rate Limit | 429 | OpenRouter 429 response | Forward status, return "Too many requests" |
| Internal | 500 | Unexpected exceptions | Log full stack trace, return generic message |

### 6.2 Error Response Format

All error responses follow a consistent shape:

```typescript
{
  error: string;    // human-readable message safe to display in the UI
  code?: string;    // optional machine-readable code for programmatic handling
}
```

### 6.3 Error Handling Implementation

Every route handler wraps its logic in a try/catch:

```typescript
export async function POST(request: Request) {
  try {
    // ... route logic
  } catch (error) {
    console.error("[POST /api/chat]", error);

    // Detect OpenRouter-specific errors
    if (isOpenRouterRateLimitError(error)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    if (isOpenRouterUpstreamError(error)) {
      return NextResponse.json(
        { error: "LLM service unavailable. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
```

### 6.4 OpenRouter Error Detection

OpenRouter errors come back as standard HTTP errors wrapped in LangChain exceptions. Detect them by inspecting the error object:

```typescript
function isOpenRouterRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("429") || error.message.includes("rate limit"))
  );
}

function isOpenRouterUpstreamError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("502") ||
     error.message.includes("503") ||
     error.message.includes("upstream"))
  );
}
```

### 6.5 Logging Strategy

- Use `console.error` for all caught errors (Next.js captures these in dev and production server logs).
- Include the route path and method in every log for traceability: `[POST /api/chat]`.
- Never log sensitive data (API keys, full request bodies with user content in production).
- For MVP, `console.error` is sufficient. A structured logger (e.g., `pino`) can be added later.

---

## 7. Environment Variables

**File:** `.env.local`

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
DEFAULT_MODEL=moonshotai/kimi-k2
```

**Typed accessor:** `src/config/env.ts`

```typescript
interface Env {
  OPENROUTER_API_KEY: string;
  DEFAULT_MODEL: string;
}

function getEnv(): Env {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? "moonshotai/kimi-k2";

  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "Missing OPENROUTER_API_KEY environment variable. " +
      "Add it to .env.local or set it in your environment."
    );
  }

  return { OPENROUTER_API_KEY, DEFAULT_MODEL };
}

export const env = getEnv();
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | -- | OpenRouter API key for LLM access |
| `DEFAULT_MODEL` | No | `moonshotai/kimi-k2` | Default model slug when client doesn't specify one |

**Security:**
- `.env.local` is gitignored (Next.js convention).
- These variables are server-side only. They are never exposed to the browser because they are only accessed inside `src/app/api/` route handlers and `src/lib/` server modules.
- Never prefix with `NEXT_PUBLIC_` -- that would expose the API key to the client bundle.

---

## 8. Rate Limiting Considerations

### 8.1 MVP Approach: No Server-Side Rate Limiting

For MVP, there is no server-side rate limiter. The primary protection comes from:

1. **OpenRouter's built-in rate limits** -- OpenRouter enforces per-key rate limits. If exceeded, it returns a 429 which the API route forwards to the client.
2. **Client-side UX guardrails** -- The Send button is disabled while `isLoading` is true, preventing accidental rapid-fire requests.

### 8.2 Post-MVP: Simple In-Memory Rate Limiter

If abuse becomes a concern, implement a lightweight token-bucket or sliding-window rate limiter:

```typescript
// src/lib/rate-limiter.ts
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;   // 1 minute window
const MAX_REQUESTS = 20;    // 20 requests per minute per IP

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_REQUESTS;
}
```

Apply it in the chat route:

```typescript
const ip = request.headers.get("x-forwarded-for") ?? "unknown";
if (isRateLimited(ip)) {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment." },
    { status: 429 }
  );
}
```

### 8.3 Rate Limit Headers (Optional)

When rate limiting is active, include standard headers:

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1712577600
```

---

## 9. Sequence Diagrams

### 9.1 Chat Message Flow (New Session)

```
Client                    POST /api/chat              SessionStore         DeepAgent        OpenRouter
  |                            |                          |                   |                |
  |-- { message: "Hi" } ----->|                          |                   |                |
  |                            |-- createSession() ----->|                   |                |
  |                            |<-- session { id } ------|                   |                |
  |                            |                          |                   |                |
  |                            |-- addMessage(id, user)->|                   |                |
  |                            |-- getMessages(id) ----->|                   |                |
  |                            |<-- [userMsg] ------------|                   |                |
  |                            |                          |                   |                |
  |                            |-- createAgent(model) ------------------>|                |
  |                            |-- invoke([userMsg]) ------------------->|                |
  |                            |                          |                   |-- LLM call ->|
  |                            |                          |                   |<- response --|
  |                            |<-- "Hello! How can I..." ------------------|                |
  |                            |                          |                   |                |
  |                            |-- addMessage(id, asst)->|                   |                |
  |                            |-- updateTitle(id, "Hi")->|                   |                |
  |                            |                          |                   |                |
  |<-- { session_id, message,  |                          |                   |                |
  |      model } --------------|                          |                   |                |
```

### 9.2 Chat Message Flow (Existing Session)

```
Client                    POST /api/chat              SessionStore         DeepAgent        OpenRouter
  |                            |                          |                   |                |
  |-- { message: "Follow up", |                          |                   |                |
  |    session_id: "abc" } -->|                          |                   |                |
  |                            |-- getSession("abc") --->|                   |                |
  |                            |<-- session -------------|                   |                |
  |                            |                          |                   |                |
  |                            |-- addMessage(abc, user)->|                   |                |
  |                            |-- getMessages(abc) ---->|                   |                |
  |                            |<-- [msg1, msg2, msg3] ---|                   |                |
  |                            |                          |                   |                |
  |                            |-- createAgent(model) ------------------>|                |
  |                            |-- invoke([msg1..msg3])----------------->|                |
  |                            |                          |                   |-- LLM call ->|
  |                            |                          |                   |<- response --|
  |                            |<-- "Here's more info..." ------------------|                |
  |                            |                          |                   |                |
  |                            |-- addMessage(abc, asst)->|                   |                |
  |                            |                          |                   |                |
  |<-- { session_id, message,  |                          |                   |                |
  |      model } --------------|                          |                   |                |
```

### 9.3 Session Lifecycle

```
Client                    API Routes                  SessionStore
  |                            |                          |
  |=== CREATE ==============================================================|
  |-- POST /api/sessions ----->|                          |                  |
  |                            |-- createSession() ----->|                  |
  |                            |<-- session { id, title: "New Chat" } ------|
  |<-- { session } ------------|                          |                  |
  |                                                                          |
  |=== LIST ================================================================|
  |-- GET /api/sessions ------>|                          |                  |
  |                            |-- listSessions() ------>|                  |
  |                            |<-- Session[] (desc) ----|                  |
  |<-- { sessions } ----------|                          |                  |
  |                                                                          |
  |=== LOAD MESSAGES =======================================================|
  |-- GET /sessions/abc/messages ->|                     |                  |
  |                            |-- getMessages("abc") -->|                  |
  |                            |<-- Message[] ------------|                  |
  |<-- { messages } ----------|                          |                  |
  |                                                                          |
  |=== DELETE ==============================================================|
  |-- DELETE /sessions/abc --->|                          |                  |
  |                            |-- deleteSession("abc")->|                  |
  |                            |<-- true -----------------|                  |
  |<-- { success: true } -----|                          |                  |
```

### 9.4 Error Flow (LLM Failure)

```
Client                    POST /api/chat              DeepAgent            OpenRouter
  |                            |                          |                   |
  |-- { message: "Hi" } ----->|                          |                   |
  |                            |-- invoke(history) ----->|                   |
  |                            |                          |-- LLM call ----->|
  |                            |                          |<-- 500 error ----|
  |                            |<-- throws Error ---------|                   |
  |                            |                          |                   |
  |                            |-- catch(error)           |                   |
  |                            |-- console.error(...)     |                   |
  |                            |                          |                   |
  |<-- 500 { error: "Failed   |                          |                   |
  |    to generate response" } |                          |                   |
```

---

## 10. Anti-Patterns to Avoid

### 10.1 Do NOT Expose Secrets to the Client

```
BAD:  NEXT_PUBLIC_OPENROUTER_API_KEY=sk-or-...   // exposed in browser bundle
GOOD: OPENROUTER_API_KEY=sk-or-...               // server-side only
```

Never prefix server secrets with `NEXT_PUBLIC_`. The OpenRouter key must only be accessed in API route handlers and server-side `lib/` modules.

### 10.2 Do NOT Create a New Store Instance Per Request

```
BAD:
export async function POST(req: Request) {
  const store = new SessionStore();  // fresh store every request -- all data lost
}

GOOD:
import { sessionStore } from "@/lib/session-store";  // singleton
export async function POST(req: Request) {
  const session = sessionStore.createSession();
}
```

The store must be a singleton. Use the `globalThis` pattern to survive Next.js hot-reload in dev.

### 10.3 Do NOT Block on Synchronous Operations

```
BAD:  const data = fs.readFileSync(...)   // blocks the event loop
GOOD: const data = await fs.promises.readFile(...)
```

All I/O must be async. The in-memory store is synchronous by nature (Map operations), which is fine -- it is the LLM call that must always be awaited.

### 10.4 Do NOT Swallow Errors Silently

```
BAD:
try { await agent.invoke(messages); }
catch (e) { /* nothing */ }

GOOD:
try { await agent.invoke(messages); }
catch (error) {
  console.error("[POST /api/chat] Agent invocation failed:", error);
  return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
}
```

Always log errors and return a meaningful HTTP response.

### 10.5 Do NOT Trust Client Input

```
BAD:
const { message } = await request.json();
// immediately use message without validation

GOOD:
const body = await request.json();
const message = body?.message?.trim();
if (!message) {
  return NextResponse.json({ error: "Message is required" }, { status: 400 });
}
if (message.length > 10_000) {
  return NextResponse.json({ error: "Message too long" }, { status: 400 });
}
```

Validate every field: presence, type, length, and allowed values (e.g., model must be in `MODEL_LIST`).

### 10.6 Do NOT Store LLM Instances Across Requests

```
BAD:
const globalAgent = createAgent();  // stale config, memory leak

GOOD:
// Create a fresh agent per request
const agent = createAgent(model);
const response = await invokeAgent(agent, messages);
```

The LLM instance is cheap to create. A fresh instance per request ensures the correct model is used and avoids memory leaks from accumulated LangGraph state.

### 10.7 Do NOT Return Internal Error Details to the Client

```
BAD:
return NextResponse.json({
  error: error.message,       // might contain API keys, stack traces, internal URLs
  stack: error.stack,
}, { status: 500 });

GOOD:
console.error("[POST /api/chat]", error);  // full details in server logs only
return NextResponse.json(
  { error: "Something went wrong. Please try again." },
  { status: 500 }
);
```

Log everything server-side; return sanitized messages to the client.

### 10.8 Do NOT Forget to Handle the Missing Session Case in Chat

```
BAD:
// Assume session_id is always valid
const messages = sessionStore.getMessages(body.session_id);

GOOD:
if (body.session_id) {
  const session = sessionStore.getSession(body.session_id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
```

The client may send a stale `session_id` if the session was deleted from another tab or after a server restart.

### 10.9 Do NOT Use `fetch` for Server-to-Server LLM Calls

```
BAD:
// Inside an API route, calling your own API
const res = await fetch("http://localhost:3000/api/chat", ...);

GOOD:
// Call the agent directly
const response = await invokeAgent(agent, messages);
```

API routes should call the agent layer directly, not loop back through HTTP.

### 10.10 Do NOT Mutate Messages Array Directly

```
BAD:
const data = store.get(sessionId);
data.messages.push(newMessage);   // direct mutation, no validation

GOOD:
sessionStore.addMessage(sessionId, newMessage);  // encapsulated, validated
```

All store mutations go through `SessionStore` methods to maintain invariants (e.g., validating session exists before adding a message).
