# Test Plan

## Overview

- **Project:** Simple Chatbot -- a single-page conversational AI interface built with Next.js 15 (App Router), DeepAgents, and OpenRouter
- **Testing approach:** Behavior-driven, using Vitest as the test runner
- **Focus:** API route testing (request/response contracts, validation, error handling) and in-memory session store logic
- **Out of scope:** Purely presentational/CSS components (Phase 3), accessibility audits, and end-to-end browser testing

---

## Test Infrastructure

### Vitest Configuration

- Install: `vitest`, `@vitejs/plugin-react` (if needed for hook tests)
- Config file: `vitest.config.ts` at project root
- Path aliases: mirror `tsconfig.json` paths (`@/` -> `src/`)
- Environment: `node` for API route and store tests
- Test file pattern: `tests/**/*.test.ts`
- Coverage: optional for MVP, but configure `c8` or `v8` provider

### Test Utilities Needed

| Utility | Purpose |
|---------|---------|
| Mock `fetch` | Stub global `fetch` in hook tests (useSendMessage, useSessions) |
| Mock DeepAgent | Replace `createAgent` / `invokeAgent` to avoid real LLM calls |
| Mock `crypto.randomUUID` | Deterministic IDs in session store tests |
| Request/Response helpers | Build `Request` objects for Next.js route handler testing |
| Store reset helper | Clear the singleton `SessionStore` between tests to avoid state leakage |

### Environment Variables for Tests

| Variable | Test Value |
|----------|-----------|
| `OPENROUTER_API_KEY` | `test-api-key-12345` (any non-empty string) |
| `DEFAULT_MODEL` | `moonshotai/kimi-k2` |

Set via `vitest.config.ts` `define` or a `.env.test` file.

---

## Phase-by-Phase Test Scenarios

### Phase 0: Foundation

Phase 0 covers project scaffolding, dependency installation, shadcn init, environment config, design tokens, constants, and shared types. Most tasks are not unit-testable (they are verified by running `npm run dev`). The following are testable:

#### 0.4 Environment Configuration

- Test file: `tests/config/env.test.ts`

- [ ] `env.OPENROUTER_API_KEY` returns the value from `process.env.OPENROUTER_API_KEY`
- [ ] `env.DEFAULT_MODEL` returns the value from `process.env.DEFAULT_MODEL`
- [ ] `env.DEFAULT_MODEL` defaults to `"moonshotai/kimi-k2"` when `process.env.DEFAULT_MODEL` is unset
- [ ] Throws an error when `OPENROUTER_API_KEY` is missing from environment

#### 0.6 Constants

- Test file: `tests/lib/constants.test.ts`

- [ ] `MODEL_LIST` is an array with at least 3 entries
- [ ] `MODEL_LIST` contains `"moonshotai/kimi-k2"`, `"openai/gpt-4o"`, `"anthropic/claude-sonnet-4"`, `"google/gemini-2.0-flash-001"`
- [ ] `DEFAULT_MODEL` equals `"moonshotai/kimi-k2"`
- [ ] `DEFAULT_MODEL` is a member of `MODEL_LIST`

#### 0.7 Shared Types

- Test file: `tests/types/types.test.ts`

- [ ] `Session` interface has required fields: `id`, `title`, `createdAt`
- [ ] `Message` interface has required fields: `id`, `role`, `content`, `timestamp`
- [ ] `Message.role` accepts only `"user"` or `"assistant"` (TypeScript compile check)
- [ ] `Message.model` is optional

---

### Phase 1: Agent Core

#### 1.1 OpenRouter LLM Config

- Test file: `tests/lib/agent/openrouter.test.ts`

- [ ] `createLLM()` returns a `ChatOpenAI` instance
- [ ] `createLLM()` uses `DEFAULT_MODEL` when no model argument is provided
- [ ] `createLLM("openai/gpt-4o")` uses the specified model
- [ ] `createLLM()` sets `baseURL` to `"https://openrouter.ai/api/v1"`
- [ ] `createLLM()` reads the API key from `env.OPENROUTER_API_KEY`

#### 1.2 System Prompt

- Test file: `tests/lib/agent/agent.test.ts`

- [ ] System prompt is a non-empty string
- [ ] System prompt contains keywords like "helpful" or "assistant" (basic content check)

#### 1.3 DeepAgent Setup

- Test file: `tests/lib/agent/agent.test.ts`

Agent Tests (with mocked LLM):
- [ ] `createAgent()` returns an agent instance without throwing
- [ ] `createAgent("openai/gpt-4o")` passes the model to the underlying LLM
- [ ] `invokeAgent(agent, messages)` converts `Message[]` to LangChain format and calls agent
- [ ] `invokeAgent` returns a string response from the mocked LLM
- [ ] `invokeAgent` passes the full message history (not just the last message)

Edge Cases:
- [ ] `invokeAgent` with an empty messages array does not throw
- [ ] `createAgent` with an invalid model string still creates an agent (validation happens at OpenRouter, not locally)

---

### Phase 2: API Routes

This is the primary testing focus.

#### 2.1 In-Memory Session Store

- Test file: `tests/lib/session-store.test.ts`

Session CRUD Tests:
- [ ] `createSession()` returns a `Session` with `id`, `title: "New Chat"`, and `createdAt` (ISO string)
- [ ] `createSession()` generates unique IDs across multiple calls
- [ ] `getSession(id)` returns the session when it exists
- [ ] `getSession("nonexistent")` returns `undefined`
- [ ] `listSessions()` returns an empty array when no sessions exist
- [ ] `listSessions()` returns all created sessions
- [ ] `listSessions()` sorts sessions by `createdAt` descending (most recent first)
- [ ] `deleteSession(id)` returns `true` and removes the session
- [ ] `deleteSession(id)` also removes all associated messages
- [ ] `deleteSession("nonexistent")` returns `false`
- [ ] `updateSessionTitle(id, "New Title")` updates the session title
- [ ] `updateSessionTitle("nonexistent", "Title")` does not throw (or handles gracefully)

Message Tests:
- [ ] `addMessage(sessionId, message)` stores the message for that session
- [ ] `getMessages(sessionId)` returns messages in insertion order (chronological)
- [ ] `getMessages(sessionId)` returns an empty array for a session with no messages
- [ ] `getMessages("nonexistent")` returns an empty array (or throws -- verify behavior)
- [ ] Multiple messages added to the same session are all retrievable
- [ ] Messages from different sessions are isolated

Singleton Tests:
- [ ] Importing `sessionStore` from the module returns the same instance across imports
- [ ] Data persists across multiple operations on the same instance

Edge Cases:
- [ ] Creating many sessions (e.g., 100) works without error
- [ ] Adding many messages to a single session (e.g., 50) works without error

#### 2.2 POST /api/chat

- Test file: `tests/api/chat.test.ts`

Happy Path Tests:
- [ ] POST with `{ message: "Hello" }` (no session_id) returns 200 with `{ session_id, message, model }`
- [ ] Response `session_id` is a valid UUID
- [ ] Response `message` is a non-empty string (mocked agent response)
- [ ] Response `model` matches `DEFAULT_MODEL` when no model specified
- [ ] POST with `{ message: "Hello", session_id: "<existing>" }` returns 200 and uses the existing session
- [ ] POST with `{ message: "Hello", model: "openai/gpt-4o" }` returns response with `model: "openai/gpt-4o"`
- [ ] First message in a session updates the session title to first 50 chars of the message
- [ ] Second message in a session does NOT update the session title
- [ ] Messages are persisted in the session store after a successful chat

Validation Error Tests:
- [ ] POST with empty body returns 400 `{ error: "Message is required" }`
- [ ] POST with `{ message: "" }` returns 400 `{ error: "Message is required" }`
- [ ] POST with `{ message: "   " }` (whitespace only) returns 400 `{ error: "Message is required" }`
- [ ] POST with `{ message: "<10001 chars>" }` returns 400 `{ error: "Message too long (max 10,000 characters)" }`
- [ ] POST with `{ message: "Hi", model: "invalid/model" }` returns 400 `{ error: "Invalid model" }`
- [ ] POST with `{ message: "Hi", session_id: "nonexistent-uuid" }` returns 404 `{ error: "Session not found" }`

Agent Failure Tests (with mocked agent that throws):
- [ ] Agent invocation failure returns 500 `{ error: "Failed to generate response" }`
- [ ] OpenRouter rate limit error (429) returns 429 `{ error: "Too many requests. Please wait a moment." }`
- [ ] OpenRouter upstream error (502/503) returns 502 `{ error: "LLM service unavailable. Please try again." }`

Edge Cases:
- [ ] Message with exactly 10,000 characters is accepted
- [ ] Message with special characters (unicode, emojis, newlines) is accepted
- [ ] Rapid sequential requests to the same session maintain message order
- [ ] POST with unexpected extra fields in body does not cause an error (ignored gracefully)

#### 2.3 GET /api/sessions

- Test file: `tests/api/sessions.test.ts`

- [ ] GET returns 200 `{ sessions: [] }` when no sessions exist
- [ ] GET returns 200 with all sessions after creating some via the store
- [ ] Sessions are sorted by `createdAt` descending
- [ ] Each session in the response has `id`, `title`, and `createdAt` fields

#### 2.4 POST /api/sessions

- Test file: `tests/api/sessions.test.ts`

- [ ] POST returns 201 with `{ session: { id, title: "New Chat", createdAt } }`
- [ ] Created session appears in subsequent GET /api/sessions response
- [ ] Multiple POST calls create distinct sessions with unique IDs

#### 2.5 DELETE /api/sessions/[id]

- Test file: `tests/api/sessions-id.test.ts`

- [ ] DELETE with valid session ID returns 200 `{ success: true }`
- [ ] Deleted session no longer appears in GET /api/sessions
- [ ] Deleted session's messages are also removed
- [ ] DELETE with non-existent session ID returns 404 `{ error: "Session not found" }`
- [ ] DELETE same session twice: first returns 200, second returns 404

#### 2.6 GET /api/sessions/[id]/messages

- Test file: `tests/api/sessions-id-messages.test.ts`

- [ ] GET for a session with messages returns 200 `{ messages: [...] }`
- [ ] Messages are sorted by `timestamp` ascending (chronological)
- [ ] Each message has `id`, `role`, `content`, `timestamp` fields
- [ ] Assistant messages include the `model` field
- [ ] GET for a session with no messages returns 200 `{ messages: [] }`
- [ ] GET for a non-existent session ID returns 404 `{ error: "Session not found" }`

---

### Phase 3: Shared UI Components

Phase 3 is entirely presentational/CSS components. **Skipped** -- no backend or logic tests required.

---

### Phase 4: Features (Business Logic)

#### 4.1 useSendMessage Hook

- Test file: `tests/features/chat/use-send-message.test.ts`

- [ ] `sendMessage({ message: "Hello" })` calls `fetch("POST", "/api/chat")` with correct body
- [ ] Returns `{ session_id, message, model }` on success
- [ ] `isLoading` is `true` during the request and `false` after
- [ ] `error` is `null` on success
- [ ] On non-200 response, `error` is set to the error message from the response body
- [ ] `error` resets to `null` on the next call

#### 4.2 useChat Hook

- Test file: `tests/features/chat/use-chat.test.ts`

- [ ] Calling `sendMessage("Hello")` optimistically appends a user message to `messages`
- [ ] After API response, appends an assistant message to `messages`
- [ ] `isLoading` is `true` between send and response, `false` otherwise
- [ ] On API error, `error` is set and toast is triggered
- [ ] User message has `role: "user"` and the provided content
- [ ] Assistant message has `role: "assistant"` and the API response content
- [ ] `setMessages` allows replacing the messages array (used by session switching)
- [ ] `sendMessage` returns the `session_id` from the API response

#### 4.3 useSessions Hook

- Test file: `tests/features/session/use-sessions.test.ts`

- [ ] `fetchSessions()` calls `GET /api/sessions` and populates `sessions` state
- [ ] `createSession()` calls `POST /api/sessions` and prepends the new session to `sessions`
- [ ] `deleteSession(id)` calls `DELETE /api/sessions/[id]` and removes it from `sessions`
- [ ] `fetchMessages(id)` calls `GET /api/sessions/[id]/messages` and returns the messages
- [ ] Error responses set `error` state and trigger toast notifications
- [ ] `isLoading` tracks loading state correctly for each operation

#### 4.4 useSessionManager Hook

- Test file: `tests/features/session/use-session-manager.test.ts`

- [ ] On mount, fetches sessions and selects the most recent one as active
- [ ] `handleNewChat()` creates a session, sets it as active, and clears messages
- [ ] `handleSelectSession(id)` sets active session and fetches its messages
- [ ] `handleDeleteSession(id)` deletes the session; if it was active, switches to the next most recent
- [ ] `handleDeleteSession(id)` on the last remaining session sets `activeSessionId` to `null` and clears messages
- [ ] `refreshSessions()` re-fetches the session list from the API

---

### Phase 5: Integration and Polish

Most Phase 5 tasks are UI assembly, CSS, and manual verification. The following have testable logic:

#### 5.3 API Wiring and Error Handling

- Test file: `tests/integration/error-handling.test.ts`

- [ ] 404 responses from session endpoints surface as "Session not found" errors
- [ ] 429 responses surface as "Too many requests" messages
- [ ] 500 responses surface as "Something went wrong" messages
- [ ] Network failures (fetch throws) surface as offline/error states

#### 5.7 useMediaQuery Hook

- Test file: `tests/hooks/use-media-query.test.ts`

- [ ] Returns `false` by default in a non-browser (SSR) environment
- [ ] Returns `true` when `window.matchMedia` matches the query
- [ ] Returns `false` when `window.matchMedia` does not match
- [ ] Updates when the media query match state changes
- [ ] Cleans up event listener on unmount

---

## Test Priority Matrix

| Priority | Category | Test File | Scenario Count | Rationale |
|----------|----------|-----------|---------------|-----------|
| P0 (Critical) | Session Store | `tests/lib/session-store.test.ts` | 18 | Core data layer; all routes depend on it |
| P0 (Critical) | POST /api/chat | `tests/api/chat.test.ts` | 19 | Primary user-facing endpoint; validation + agent integration |
| P1 (High) | GET /api/sessions | `tests/api/sessions.test.ts` | 4 | Session listing for sidebar |
| P1 (High) | POST /api/sessions | `tests/api/sessions.test.ts` | 3 | Session creation flow |
| P1 (High) | DELETE /api/sessions/[id] | `tests/api/sessions-id.test.ts` | 5 | Session deletion with cascading message cleanup |
| P1 (High) | GET /api/sessions/[id]/messages | `tests/api/sessions-id-messages.test.ts` | 6 | Message retrieval for session switching |
| P2 (Medium) | Agent setup | `tests/lib/agent/agent.test.ts` | 7 | Agent creation and invocation with mocked LLM |
| P2 (Medium) | OpenRouter config | `tests/lib/agent/openrouter.test.ts` | 5 | LLM configuration correctness |
| P2 (Medium) | useSendMessage | `tests/features/chat/use-send-message.test.ts` | 6 | Fetch wrapper for chat API |
| P2 (Medium) | useChat | `tests/features/chat/use-chat.test.ts` | 8 | Chat orchestration logic |
| P2 (Medium) | useSessions | `tests/features/session/use-sessions.test.ts` | 6 | Session API wrapper |
| P2 (Medium) | useSessionManager | `tests/features/session/use-session-manager.test.ts` | 6 | Session orchestration logic |
| P3 (Low) | Env config | `tests/config/env.test.ts` | 4 | Environment variable access |
| P3 (Low) | Constants | `tests/lib/constants.test.ts` | 4 | Static value verification |
| P3 (Low) | Shared types | `tests/types/types.test.ts` | 4 | Type compile checks |
| P3 (Low) | Error handling integration | `tests/integration/error-handling.test.ts` | 4 | Cross-cutting error handling |
| P3 (Low) | useMediaQuery | `tests/hooks/use-media-query.test.ts` | 5 | Responsive behavior hook |

---

## Summary

| Metric | Count |
|--------|-------|
| Phases with testable backend/logic | 5 (Phase 0, 1, 2, 4, 5) |
| Phases skipped (presentational only) | 1 (Phase 3) |
| Total test files | 17 |
| Total test scenarios | ~124 |
| P0 (Critical) scenarios | 37 |
| P1 (High) scenarios | 18 |
| P2 (Medium) scenarios | 38 |
| P3 (Low) scenarios | 21 |
| Primary testing target | API routes (POST /api/chat, sessions CRUD) + SessionStore |
| Mock dependencies | DeepAgent/LLM (always mocked), fetch (in hook tests), crypto.randomUUID (optional) |
