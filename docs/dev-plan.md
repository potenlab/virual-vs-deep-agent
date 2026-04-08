# Development Plan -- Single Source of Truth

Generated: 2026-04-08
Source PRD: docs/prd.md
Source UI/UX: docs/ui-ux-plan.md
Architecture: Bulletproof React (potenlab-workflow)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Components | shadcn/ui (Zinc theme, defaults) | latest |
| Agent | DeepAgents (npm) | latest |
| LLM Gateway | OpenRouter (ChatOpenAI wrapper) | -- |
| Icons | lucide-react | latest |
| Toasts | sonner | latest |
| Runtime | Node.js | 20.x |

---

## Project Structure (Bulletproof React)

```
src/
  app/
    layout.tsx              # Root layout, font, ThemeProvider, Toaster
    page.tsx                # Main SPA -- chat interface
    globals.css             # Tailwind imports, shadcn CSS variables, typing-dot keyframes
    api/
      chat/
        route.ts            # POST /api/chat
      sessions/
        route.ts            # GET + POST /api/sessions
        [id]/
          route.ts          # DELETE /api/sessions/[id]
          messages/
            route.ts        # GET /api/sessions/[id]/messages
  components/
    ui/                     # shadcn generated primitives
      button.tsx
      textarea.tsx
      select.tsx
      scroll-area.tsx
      alert-dialog.tsx
      sheet.tsx
      dropdown-menu.tsx
      separator.tsx
      tooltip.tsx
      sonner.tsx
    common/
      empty-state.tsx       # Welcome screen with suggested prompts
      typing-indicator.tsx  # Animated three-dot indicator
    chat/                   # Chat-specific presentational components
      chat-bubble.tsx       # User + assistant message bubbles
      chat-input.tsx        # Auto-growing textarea + send button
      chat-header.tsx       # Header bar (sidebar toggle + model selector)
    session/                # Session-specific presentational components
      session-sidebar.tsx   # Sidebar container with new-chat + list
      session-item.tsx      # Individual session row
    model/
      model-selector.tsx    # Dropdown for model switching
  features/
    chat/
      api/                  # fetch wrappers for /api/chat
        use-send-message.ts
      hooks/
        use-chat.ts         # Orchestrates messages, loading, error state
      types/
        index.ts            # Message type
    session/
      api/                  # fetch wrappers for /api/sessions
        use-sessions.ts
      hooks/
        use-session-manager.ts  # CRUD + active session tracking
      types/
        index.ts            # Session type
  lib/
    agent/
      openrouter.ts         # ChatOpenAI config (baseURL, apiKey, model)
      agent.ts              # DeepAgent creation, system prompt, tools
    session-store.ts        # In-memory Map<string, SessionData>
    utils.ts                # cn() helper (clsx + twMerge)
    constants.ts            # MODEL_LIST, DEFAULT_MODEL fallback
  config/
    env.ts                  # Typed env access (OPENROUTER_API_KEY, DEFAULT_MODEL)
  types/
    index.ts                # Shared types (Session, Message)
  hooks/
    use-media-query.ts      # Detect mobile for sidebar default state
scripts/
  test-repl.ts              # CLI script to test agent outside browser
.env.local                  # OPENROUTER_API_KEY, DEFAULT_MODEL
```

---

## Phase 0 -- Foundation

### 0.1 Initialize Next.js project

- **Output:** Root project scaffolding under repo root (src/ directory with app router)
- **Behavior:** Create Next.js 15 app with TypeScript, Tailwind, App Router, src/ directory. Use `npx create-next-app@latest . --typescript --tailwind --app --src-dir --use-npm`
- **Verify:** `npm run dev` starts on localhost:3000 without errors; page renders default Next.js welcome

### 0.2 Install core dependencies

- **Output:** Updated `package.json` with all runtime deps
- **Behavior:** Install: `deepagents @langchain/openai @langchain/core zod lucide-react sonner`
- **Verify:** `npm ls deepagents @langchain/openai lucide-react sonner` shows all installed, no peer dep errors

### 0.3 Initialize shadcn/ui

- **Output:** `components.json`, `src/lib/utils.ts` (cn helper), CSS variables in `globals.css`
- **Behavior:** Run `npx shadcn@latest init` -- select Zinc theme (default), CSS variables yes, src/ alias. Then install required components: `npx shadcn@latest add button textarea select scroll-area alert-dialog sheet dropdown-menu separator tooltip sonner`
- **Verify:** `src/components/ui/button.tsx` exists; import `{ Button }` in page.tsx renders a button with correct styling

### 0.4 Environment configuration

- **Output:** `.env.local`, `src/config/env.ts`
- **Behavior:** Create `.env.local` with `OPENROUTER_API_KEY` and `DEFAULT_MODEL=moonshotai/kimi-k2`. Create typed env accessor in `src/config/env.ts` that reads and validates these values. Add `.env.local` to `.gitignore`.
- **Verify:** Import env config in a test file; values are accessible and typed

### 0.5 Design tokens and global styles

- **Output:** `src/app/globals.css` with shadcn CSS variables + typing-dot keyframes
- **Behavior:** Ensure globals.css contains shadcn theme variables (light + dark), Tailwind directives, and the `@keyframes typing-dot` animation from ui-ux-plan section 8.2. Add Inter font via `next/font/google` in `layout.tsx`.
- **Verify:** Page renders with Inter font; dark mode toggle via `class="dark"` on html changes theme colors

### 0.6 Constants file

- **Output:** `src/lib/constants.ts`
- **Behavior:** Export `MODEL_LIST` array of available model strings (hardcoded for MVP: `["moonshotai/kimi-k2", "openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-2.0-flash-001"]`) and `DEFAULT_MODEL` fallback string.
- **Verify:** File imports cleanly; MODEL_LIST has at least 3 entries

### 0.7 Shared types

- **Output:** `src/types/index.ts`
- **Behavior:** Define and export `Session` (`id`, `title`, `createdAt`) and `Message` (`id`, `role: "user" | "assistant"`, `content`, `model?`, `timestamp`) interfaces per ui-ux-plan section 10.5.
- **Verify:** Types import without error in a scratch file

---

## Phase 1 -- Agent Core

### 1.1 OpenRouter LLM config

- **Output:** `src/lib/agent/openrouter.ts`
- **Behavior:** Export a `createLLM(model?: string)` function that returns a `ChatOpenAI` instance configured with `baseURL: "https://openrouter.ai/api/v1"`, `openAIApiKey` from env, and `modelName` defaulting to `DEFAULT_MODEL`. Uses `src/config/env.ts`.
- **Verify:** Import `createLLM()` in a test script; call `.invoke("Hello")` and receive a string response from OpenRouter

### 1.2 System prompt

- **Output:** System prompt string defined in `src/lib/agent/agent.ts`
- **Behavior:** Write a general-purpose assistant system prompt. Keep it short: identity, capabilities, tone (helpful, concise). Store as a const string.
- **Verify:** Prompt is a non-empty string; reads naturally as an assistant introduction

### 1.3 DeepAgent setup with tools

- **Output:** `src/lib/agent/agent.ts`
- **Behavior:** Export a `createAgent(model?: string)` function that creates a DeepAgent instance with the OpenRouter LLM, system prompt, and basic tools (web_search, calculator or equivalent available in deepagents). The agent must accept a message string and return a response string. Conversation history is passed in as parameter (array of messages).
- **Verify:** Import and call `createAgent()` then invoke with a test message; agent returns a coherent response

### 1.4 REPL test script

- **Output:** `scripts/test-repl.ts`
- **Behavior:** A runnable Node.js script (`npx tsx scripts/test-repl.ts`) that creates an agent, sends a hardcoded question, prints the response, then optionally enters a readline loop for interactive testing.
- **Verify:** Run the script; see a printed response from the agent. Ask a follow-up; context is maintained.

---

## Phase 2 -- API Routes

### 2.1 In-memory session store

- **Output:** `src/lib/session-store.ts`
- **Behavior:** Export a singleton `SessionStore` class using a `Map<string, { session: Session; messages: Message[] }>`. Methods: `createSession(): Session`, `getSession(id): Session | undefined`, `listSessions(): Session[]`, `deleteSession(id): boolean`, `addMessage(sessionId, message): void`, `getMessages(sessionId): Message[]`. Generate UUIDs with `crypto.randomUUID()`. Auto-title sessions as "New Chat" initially.
- **Verify:** Instantiate store; create a session; add a message; retrieve it; delete it. All operations return expected data.

### 2.2 POST /api/chat route

- **Output:** `src/app/api/chat/route.ts`
- **Behavior:** Accept JSON body `{ message: string, session_id?: string, model?: string }`. If no `session_id`, create a new session. Add user message to store. Call `createAgent(model)` with the session's message history. Add assistant response to store. If this is the first user message, update session title to first 50 chars of user message. Return `{ session_id, message: assistantResponse, model }`.
- **Verify:** `curl -X POST localhost:3000/api/chat -H 'Content-Type: application/json' -d '{"message":"Hello"}'` returns JSON with `session_id`, `message`, and `model`

### 2.3 GET /api/sessions route

- **Output:** `src/app/api/sessions/route.ts` (GET handler)
- **Behavior:** Return `{ sessions: Session[] }` from the session store, sorted by `createdAt` descending.
- **Verify:** `curl localhost:3000/api/sessions` returns `{ sessions: [] }` initially; after creating sessions via /api/chat, returns populated list

### 2.4 POST /api/sessions route

- **Output:** `src/app/api/sessions/route.ts` (POST handler, same file as 2.3)
- **Behavior:** Create a new empty session in the store. Return `{ session: Session }`.
- **Verify:** `curl -X POST localhost:3000/api/sessions` returns a new session object with `id`, `title: "New Chat"`, `createdAt`

### 2.5 DELETE /api/sessions/[id] route

- **Output:** `src/app/api/sessions/[id]/route.ts`
- **Behavior:** Delete the session with the given `id` from the store. Return `{ success: true }` or 404 if not found.
- **Verify:** Create a session, delete it by id, verify GET /api/sessions no longer includes it

### 2.6 GET /api/sessions/[id]/messages route

- **Output:** `src/app/api/sessions/[id]/messages/route.ts`
- **Behavior:** Return `{ messages: Message[] }` for the given session, ordered by timestamp ascending. Return 404 if session not found.
- **Verify:** Send a chat message, then `curl localhost:3000/api/sessions/{id}/messages` returns the user + assistant messages

---

## Phase 3 -- Shared UI Components

### 3.1 ChatBubble component

- **Output:** `src/components/chat/chat-bubble.tsx`
- **Behavior:** Accepts `role: "user" | "assistant"` and `content: string`. User bubble: `bg-primary text-primary-foreground rounded-2xl rounded-br-sm`, right-aligned, `max-w-[80%] md:max-w-[70%]`. Assistant bubble: `bg-muted text-foreground rounded-2xl rounded-bl-sm`, left-aligned with a `Bot` icon avatar (w-8 h-8, rounded-full, bg-muted). Fade-in + slide-up animation on mount (200ms).
- **Verify:** Render both variants in page.tsx; user bubble is right-aligned with primary colors; assistant bubble is left-aligned with muted colors and avatar icon

### 3.2 TypingIndicator component

- **Output:** `src/components/common/typing-indicator.tsx`
- **Behavior:** Renders three dots in an assistant-style bubble layout. Uses CSS `@keyframes typing-dot` with staggered `animation-delay` (0ms, 150ms, 300ms). Dots are `w-2 h-2 bg-muted-foreground/50 rounded-full`. 600ms cycle, infinite.
- **Verify:** Render the component; three dots bounce with visible stagger; looks like an assistant bubble

### 3.3 ChatInput component

- **Output:** `src/components/chat/chat-input.tsx`
- **Behavior:** Auto-growing `textarea` (min 1 row, max 6 rows) with a Send `Button` (icon-only, `Send` lucide icon). Enter sends (calls `onSend` prop with trimmed value and clears input); Shift+Enter inserts newline. Send button disabled when input is empty (trimmed). `aria-label="Type a message"` on textarea. Placeholder: "Type a message...". Input receives focus on mount via `autoFocus`.
- **Verify:** Type text, press Enter -- `onSend` fires with the text, input clears. Shift+Enter adds a newline. Empty input disables Send button. Button has `aria-label`.

### 3.4 SessionSidebar component

- **Output:** `src/components/session/session-sidebar.tsx`
- **Behavior:** Fixed-width left panel (`w-[260px]`). Contains a "New Chat" button (`Plus` icon, `variant="secondary"`) at top, then a `ScrollArea` with `SessionItem` list. On mobile (<768px), rendered inside a shadcn `Sheet` (side="left") triggered by the header toggle. Desktop: always visible with `border-r`. Props: `sessions`, `activeSessionId`, `onNewChat`, `onSelectSession`, `onDeleteSession`, `open` (mobile), `onOpenChange` (mobile). Semantic: `<aside role="complementary">`.
- **Verify:** Desktop: sidebar renders at 260px with border-right. Mobile (resize to <768px): sidebar hidden; toggle opens Sheet overlay. New Chat button calls onNewChat. Clicking a session calls onSelectSession.

### 3.5 SessionItem component

- **Output:** `src/components/session/session-item.tsx`
- **Behavior:** Displays session title (truncated, `text-sm`), `MessageSquare` icon. Active state: `bg-accent text-accent-foreground font-medium`. Delete button (`Trash2` icon): `opacity-0 group-hover:opacity-100`. Clicking the item calls `onSelect`; clicking delete calls `onDelete`. Keyboard: Enter on focused item triggers onSelect.
- **Verify:** Render with active and inactive props; active has accent background. Hover reveals delete icon. Click fires correct callback.

### 3.6 ModelSelector component

- **Output:** `src/components/model/model-selector.tsx`
- **Behavior:** shadcn `Select` (or `DropdownMenu`) with outline trigger showing current model name. Items from `MODEL_LIST` constant. Selected item has checkmark. Props: `value`, `onValueChange`. Width: `w-[200px]`. `ChevronDown` indicator.
- **Verify:** Renders with default model shown. Open dropdown; see all models from MODEL_LIST. Select a different model; `onValueChange` fires.

### 3.7 ChatHeader component

- **Output:** `src/components/chat/chat-header.tsx`
- **Behavior:** Sticky header (`h-14 sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b`). Left: sidebar toggle button (`PanelLeftClose`/`PanelLeftOpen` icon, `variant="ghost" size="icon"`). Center: app title "Simple Chatbot" (optional, can omit for minimal). Right: `ModelSelector`. Semantic: `<header role="banner">`.
- **Verify:** Header sticks to top on scroll. Toggle button fires `onToggleSidebar`. Model selector is positioned right.

### 3.8 EmptyState component

- **Output:** `src/components/common/empty-state.tsx`
- **Behavior:** Centered flex column. `Bot` icon (48px, `text-muted-foreground`). Title: "Start a conversation" (`text-lg font-semibold`). Subtitle: "Type a message below to begin." (`text-sm text-muted-foreground`). Optional: 2-3 suggested prompt buttons (`variant="outline"`) that call `onPromptClick(text)`.
- **Verify:** Renders centered content. Clicking a suggested prompt fires the callback with the prompt text.

### 3.9 DeleteConfirmDialog component

- **Output:** Built into `SessionItem` or a separate `src/components/session/delete-confirm-dialog.tsx`
- **Behavior:** shadcn `AlertDialog`. Title: "Delete conversation?". Description: "This will permanently delete this conversation and all its messages." Actions: Cancel (outline) and Delete (destructive). Props: `open`, `onOpenChange`, `onConfirm`.
- **Verify:** Open dialog; Cancel closes without action. Delete calls onConfirm and closes.

---

## Phase 4 -- Features (Business Logic)

### 4.1 Chat feature -- useSendMessage hook

- **Output:** `src/features/chat/api/use-send-message.ts`
- **Behavior:** Export a `useSendMessage()` hook that calls `POST /api/chat` with `{ message, session_id, model }`. Returns `{ sendMessage, isLoading, error }`. Uses `fetch` directly (no React Query needed for MVP).
- **Verify:** Call `sendMessage("Hello")` from a component; network tab shows POST to /api/chat; response data is returned.

### 4.2 Chat feature -- useChat hook

- **Output:** `src/features/chat/hooks/use-chat.ts`
- **Behavior:** Orchestrates the chat experience. Manages `messages` state array, `isLoading` boolean, `error` state. On send: optimistically appends user message to messages, sets isLoading true, calls `useSendMessage`, appends assistant response, sets isLoading false. On error: sets error state, shows toast via `sonner`. Accepts `sessionId` and `model` as parameters.
- **Verify:** Use in page.tsx; send a message; user bubble appears immediately; typing indicator shows; assistant bubble appears after response.

### 4.3 Session feature -- useSessions hook

- **Output:** `src/features/session/api/use-sessions.ts`
- **Behavior:** Export `useSessions()` hook. Methods: `fetchSessions()` (GET /api/sessions), `createSession()` (POST /api/sessions), `deleteSession(id)` (DELETE /api/sessions/[id]), `fetchMessages(id)` (GET /api/sessions/[id]/messages). Returns `{ sessions, isLoading, error, fetchSessions, createSession, deleteSession, fetchMessages }`.
- **Verify:** Call `fetchSessions()` from a component; sessions state populates. Create and delete sessions successfully.

### 4.4 Session feature -- useSessionManager hook

- **Output:** `src/features/session/hooks/use-session-manager.ts`
- **Behavior:** Orchestrates session management. Tracks `activeSessionId`. On createSession: calls API, sets new session as active, clears messages. On selectSession: sets active, fetches messages for that session. On deleteSession: shows confirm dialog, calls API, if deleted session was active switches to most recent or null. On app init: fetches sessions, selects most recent.
- **Verify:** Create a session; it becomes active. Switch sessions; messages load. Delete active session; app switches to another or shows empty state.

### 4.5 Feature types

- **Output:** `src/features/chat/types/index.ts`, `src/features/session/types/index.ts`
- **Behavior:** Re-export or extend shared types from `src/types/` as needed by each feature.
- **Verify:** Types import cleanly from feature directories.

---

## Phase 5 -- Integration & Polish

### 5.1 Main page assembly

- **Output:** `src/app/page.tsx`
- **Behavior:** Composes the full chat interface. Layout: `SessionSidebar` (left) + main area (header + message thread + input). Uses `useSessionManager` for session state and `useChat` for message state. Passes callbacks down to presentational components. Semantic structure: `<main role="main">` wrapping chat area. `aria-live="polite"` on message thread container. `role="log"` on message list.
- **Verify:** Full app renders: sidebar with sessions, header with model selector, chat area with messages or empty state, input bar at bottom. All interactions work end-to-end.

### 5.2 Root layout and providers

- **Output:** `src/app/layout.tsx`
- **Behavior:** Sets `<html lang="en">` with Inter font via `next/font/google`. Includes `<Toaster />` (sonner) for toast notifications. Sets metadata title "Simple Chatbot". Dark mode support via class-based toggling (add `dark` class to `<html>` via `suppressHydrationWarning`).
- **Verify:** Page has correct `lang` attribute. Toast notifications render when triggered. Font is Inter.

### 5.3 API wiring and error handling

- **Output:** All feature hooks connected to API routes
- **Behavior:** Ensure all API calls handle: 200 (success), 404 (session not found), 429 (rate limit -- toast "Too many requests"), 500 (server error -- toast "Something went wrong"). Network offline detection shows inline banner. Loading states show typing indicator for chat, skeleton or spinner for session list.
- **Verify:** Kill the dev server and try to send a message; error toast appears. Send rapid requests; 429 handling works if OpenRouter rate-limits.

### 5.4 Accessibility implementation

- **Output:** Updated components with ARIA attributes
- **Behavior:** Add skip link "Skip to chat" at top of page (visually hidden, visible on focus) jumping to chat input. Ensure all icon-only buttons have `aria-label`. `aria-live="polite"` on message thread. `aria-busy="true"` on message area while loading. `role="log"` on message container. Focus returns to input after sending. Escape closes mobile sidebar, dialogs, and dropdowns. Tab order: sidebar toggle -> sidebar content -> header -> messages -> input.
- **Verify:** Navigate entire app with keyboard only (Tab, Enter, Escape, Arrow keys). Run axe DevTools or Lighthouse accessibility audit; score >= 90. Screen reader announces new messages.

### 5.5 Animations and micro-interactions

- **Output:** CSS transitions and keyframes in components + globals.css
- **Behavior:** Message fade-in + slide-up (200ms ease-out). Typing indicator dot bounce (600ms, staggered). Sidebar slide-in on mobile (300ms, handled by shadcn Sheet). Button hover transitions (150ms). Session active highlight transition (150ms). Auto-scroll to bottom on new message (`scrollIntoView({ behavior: 'smooth', block: 'end' })`). Do NOT auto-scroll if user has scrolled up.
- **Verify:** Send a message; bubble fades in smoothly. Typing dots bounce visibly. Mobile sidebar slides in. Scroll up, receive a message; scroll position preserved.

### 5.6 Dark mode

- **Output:** Dark mode support via shadcn CSS variables
- **Behavior:** shadcn's Zinc theme includes dark mode variables out of the box. Add a dark mode toggle (optional for MVP -- can default to system preference via `prefers-color-scheme`). All components use CSS variable-based colors, so dark mode works automatically.
- **Verify:** Set system to dark mode (or add `class="dark"` to html); entire app switches to dark theme. All text remains readable; contrast ratios maintained.

### 5.7 useMediaQuery hook

- **Output:** `src/hooks/use-media-query.ts`
- **Behavior:** Custom hook that returns `boolean` for a given media query string. Used to detect mobile (`max-width: 768px`) for sidebar default state.
- **Verify:** On desktop, `useMediaQuery("(max-width: 768px)")` returns false. On mobile viewport, returns true.

### 5.8 Final integration test (manual)

- **Output:** Fully working application
- **Behavior:** End-to-end manual test covering all user flows from ui-ux-plan sections 3.1-3.3.
- **Verify:**
  1. Land on app -- empty state with suggested prompts visible
  2. Click a suggested prompt -- message sends, assistant responds
  3. Send a follow-up -- conversation maintains context
  4. Create a new session -- sidebar shows new entry, chat clears
  5. Switch back to first session -- messages reload
  6. Delete a session -- confirm dialog appears, session removed
  7. Change model in selector -- next message uses new model (visible in response metadata)
  8. Resize to mobile -- sidebar collapses, toggle opens Sheet overlay
  9. Keyboard-only navigation works for all interactions
  10. Dark mode renders correctly

---

## Dependency Graph

```
Phase 0 (Foundation)
  |
  v
Phase 1 (Agent Core) --- depends on 0.2, 0.4
  |
  v
Phase 2 (API Routes) --- depends on 1.1, 1.3, 0.7
  |
  v
Phase 3 (Shared UI) --- depends on 0.3, 0.5, 0.6
  |
  v
Phase 4 (Features) --- depends on 2.x (API routes), 3.x (UI components)
  |
  v
Phase 5 (Integration) --- depends on 3.x, 4.x
```

Note: Phase 3 can be developed in parallel with Phases 1 and 2 since UI components are presentational and do not depend on the API layer.

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 0 | 0.1 -- 0.7 | Project init, deps, shadcn, env, tokens, constants, types |
| 1 | 1.1 -- 1.4 | OpenRouter config, system prompt, DeepAgent, REPL test |
| 2 | 2.1 -- 2.6 | Session store, 5 API route handlers |
| 3 | 3.1 -- 3.9 | 9 UI components (bubbles, input, sidebar, header, etc.) |
| 4 | 4.1 -- 4.5 | 4 hooks + feature types (chat + session business logic) |
| 5 | 5.1 -- 5.8 | Page assembly, providers, a11y, animations, dark mode, final test |
| **Total** | **39 tasks** | |
