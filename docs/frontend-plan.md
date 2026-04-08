# Frontend Implementation Plan

Generated: 2026-04-08
Source Dev Plan: docs/dev-plan.md
Source UI/UX Plan: docs/ui-ux-plan.md
Architecture: Bulletproof React (potenlab-workflow)
Stack: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui

---

## 1. Component Index Table

| # | Component | File Path | Type | Phase |
|---|-----------|-----------|------|-------|
| 1 | `ChatBubble` | `src/components/chat/chat-bubble.tsx` | Presentational | 3 |
| 2 | `TypingIndicator` | `src/components/common/typing-indicator.tsx` | Presentational | 3 |
| 3 | `ChatInput` | `src/components/chat/chat-input.tsx` | Presentational | 3 |
| 4 | `ChatHeader` | `src/components/chat/chat-header.tsx` | Presentational | 3 |
| 5 | `SessionSidebar` | `src/components/session/session-sidebar.tsx` | Presentational | 3 |
| 6 | `SessionItem` | `src/components/session/session-item.tsx` | Presentational | 3 |
| 7 | `ModelSelector` | `src/components/model/model-selector.tsx` | Presentational | 3 |
| 8 | `EmptyState` | `src/components/common/empty-state.tsx` | Presentational | 3 |
| 9 | `DeleteConfirmDialog` | `src/components/session/delete-confirm-dialog.tsx` | Presentational | 3 |
| 10 | `useSendMessage` | `src/features/chat/api/use-send-message.ts` | Hook (API) | 4 |
| 11 | `useChat` | `src/features/chat/hooks/use-chat.ts` | Hook (Business) | 4 |
| 12 | `useSessions` | `src/features/session/api/use-sessions.ts` | Hook (API) | 4 |
| 13 | `useSessionManager` | `src/features/session/hooks/use-session-manager.ts` | Hook (Business) | 4 |
| 14 | `useMediaQuery` | `src/hooks/use-media-query.ts` | Hook (Shared) | 5 |
| 15 | `RootLayout` | `src/app/layout.tsx` | Layout | 5 |
| 16 | `MainPage` | `src/app/page.tsx` | Page | 5 |

---

## 2. File Path Structure (Bulletproof React)

```
src/
  app/
    layout.tsx                          # Root layout, Inter font, Toaster
    page.tsx                            # Main SPA -- composes all components
    globals.css                         # Tailwind directives, shadcn CSS vars, typing-dot keyframes
    api/                                # Server-only (not in this plan)

  components/
    ui/                                 # shadcn generated primitives (do not edit)
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
    common/                             # Generic reusable presentational
      empty-state.tsx
      typing-indicator.tsx
    chat/                               # Chat-specific presentational
      chat-bubble.tsx
      chat-input.tsx
      chat-header.tsx
    session/                            # Session-specific presentational
      session-sidebar.tsx
      session-item.tsx
      delete-confirm-dialog.tsx
    model/                              # Model-specific presentational
      model-selector.tsx

  features/
    chat/
      api/
        use-send-message.ts            # fetch wrapper for POST /api/chat
      hooks/
        use-chat.ts                    # Orchestrates messages, loading, error
      types/
        index.ts                       # Chat feature types (re-exports/extends)
    session/
      api/
        use-sessions.ts               # fetch wrappers for /api/sessions CRUD
      hooks/
        use-session-manager.ts         # Session CRUD + active tracking
      types/
        index.ts                       # Session feature types (re-exports/extends)

  hooks/
    use-media-query.ts                 # Shared: detect mobile for sidebar

  lib/
    utils.ts                           # cn() helper (clsx + twMerge)
    constants.ts                       # MODEL_LIST, DEFAULT_MODEL

  config/
    env.ts                             # Typed env access (server-only)

  types/
    index.ts                           # Shared types: Session, Message
```

---

## 3. Shared Types

### `src/types/index.ts`

```typescript
export interface Session {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  timestamp: string; // ISO 8601
}

export interface ApiError {
  error: string;
  status: number;
}
```

### `src/features/chat/types/index.ts`

```typescript
export type { Message } from "@/types";

export interface SendMessageRequest {
  message: string;
  session_id?: string;
  model?: string;
}

export interface SendMessageResponse {
  session_id: string;
  message: string;
  model: string;
}
```

### `src/features/session/types/index.ts`

```typescript
export type { Session, Message } from "@/types";

export interface SessionsResponse {
  sessions: Session[];
}

export interface SessionResponse {
  session: Session;
}

export interface MessagesResponse {
  messages: Message[];
}
```

---

## 4. shadcn/ui Component Discovery and Mapping

### Install Command

```bash
npx shadcn@latest add button textarea select scroll-area alert-dialog sheet dropdown-menu separator tooltip sonner
```

### Mapping: shadcn Primitive to Business Usage

| shadcn Component | File | Used By | Purpose |
|------------------|------|---------|---------|
| `Button` | `ui/button.tsx` | ChatInput, SessionSidebar, SessionItem, ChatHeader, EmptyState | All interactive buttons |
| `Textarea` | `ui/textarea.tsx` | ChatInput | Chat message input |
| `Select` | `ui/select.tsx` | ModelSelector | Model dropdown |
| `ScrollArea` | `ui/scroll-area.tsx` | SessionSidebar, MainPage (message thread) | Scrollable containers |
| `AlertDialog` | `ui/alert-dialog.tsx` | DeleteConfirmDialog | Session deletion confirmation |
| `Sheet` | `ui/sheet.tsx` | SessionSidebar (mobile) | Mobile sidebar overlay |
| `DropdownMenu` | `ui/dropdown-menu.tsx` | (reserved, not used in MVP) | Alternative model selector |
| `Separator` | `ui/separator.tsx` | SessionSidebar | Visual dividers |
| `Tooltip` | `ui/tooltip.tsx` | ChatHeader (sidebar toggle), SessionItem (delete) | Icon button hints |
| `Sonner/Toaster` | `ui/sonner.tsx` | RootLayout | Toast notifications |

---

## 5. Component Specifications

### 5.1 ChatBubble

**File:** `src/components/chat/chat-bubble.tsx`
**Type:** Presentational (styled)

```typescript
interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  model?: string;       // shown as small label under assistant bubbles (optional)
  timestamp?: string;   // ISO string, not displayed in MVP but available
}
```

**Behavior:**
- User bubble: right-aligned, `bg-primary text-primary-foreground rounded-2xl rounded-br-sm`, `max-w-[80%] md:max-w-[70%]`
- Assistant bubble: left-aligned with `Bot` icon avatar (`w-8 h-8 rounded-full bg-muted`), `bg-muted text-foreground rounded-2xl rounded-bl-sm`, `max-w-[80%] md:max-w-[70%]`
- Fade-in + slide-up animation on mount (200ms ease-out): `animate-in fade-in slide-in-from-bottom-2`
- No shadow on bubbles (flat design)

**Imports:** `Bot` from `lucide-react`, `cn` from `@/lib/utils`

---

### 5.2 TypingIndicator

**File:** `src/components/common/typing-indicator.tsx`
**Type:** Presentational (styled)

```typescript
interface TypingIndicatorProps {
  className?: string;
}
```

**Behavior:**
- Renders in assistant-bubble layout (left-aligned, avatar icon, bubble shape)
- Three dots: `w-2 h-2 bg-muted-foreground/50 rounded-full`
- CSS animation `typing-dot` with staggered `animation-delay` (0ms, 150ms, 300ms)
- 600ms cycle, infinite loop
- Keyframes defined in `globals.css`

**Imports:** `Bot` from `lucide-react`, `cn` from `@/lib/utils`

---

### 5.3 ChatInput

**File:** `src/components/chat/chat-input.tsx`
**Type:** Presentational (styled)

```typescript
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  className?: string;
}
```

**Behavior:**
- Auto-growing `Textarea` (shadcn): min 1 row, max 6 rows (via CSS `min-h` / `max-h` and `overflow-y-auto`)
- Send `Button` with `Send` lucide icon, `variant="default" size="icon"`
- Enter sends (calls `onSend` with trimmed value, clears input); Shift+Enter inserts newline
- Send button disabled when input is empty (trimmed) or `disabled` prop is true
- `aria-label="Type a message"` on textarea
- Placeholder: `"Type a message..."`
- `autoFocus` on mount
- Manages own `inputValue` state internally via `useState`

**Imports:** `Textarea` from `@/components/ui/textarea`, `Button` from `@/components/ui/button`, `Send` from `lucide-react`

**Internal state:**
```typescript
const [inputValue, setInputValue] = useState("");
```

**Key handler:**
```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInputValue("");
    }
  }
};
```

---

### 5.4 ChatHeader

**File:** `src/components/chat/chat-header.tsx`
**Type:** Presentational (styled)

```typescript
interface ChatHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}
```

**Behavior:**
- Sticky header: `h-14 sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b`
- Left: sidebar toggle button with `PanelLeftClose` (open) / `PanelLeftOpen` (closed), `variant="ghost" size="icon"`, `aria-label="Toggle sidebar"`
- Right: `ModelSelector` component
- Semantic: `<header role="banner">`

**Imports:** `Button` from `@/components/ui/button`, `PanelLeftClose`, `PanelLeftOpen` from `lucide-react`, `ModelSelector` from `@/components/model/model-selector`

---

### 5.5 SessionSidebar

**File:** `src/components/session/session-sidebar.tsx`
**Type:** Presentational (styled)

```typescript
import type { Session } from "@/types";

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  open: boolean;            // mobile sidebar visibility
  onOpenChange: (open: boolean) => void; // mobile toggle callback
  isMobile: boolean;        // from useMediaQuery
}
```

**Behavior:**
- Desktop (`isMobile=false`): fixed left panel `w-[260px] border-r bg-card`, always visible when `open` is true, hidden when false
- Mobile (`isMobile=true`): rendered inside shadcn `Sheet` (side="left"), triggered by `open` prop
- Top: "New Chat" button with `Plus` icon, `variant="secondary"`, full width
- Body: `ScrollArea` containing `SessionItem` list, sorted by `createdAt` descending
- Semantic: `<aside role="complementary">`

**Imports:** `Button` from `@/components/ui/button`, `ScrollArea` from `@/components/ui/scroll-area`, `Sheet`, `SheetContent` from `@/components/ui/sheet`, `Separator` from `@/components/ui/separator`, `Plus` from `lucide-react`, `SessionItem` from `./session-item`

---

### 5.6 SessionItem

**File:** `src/components/session/session-item.tsx`
**Type:** Presentational (styled)

```typescript
import type { Session } from "@/types";

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}
```

**Behavior:**
- Displays session title (truncated with `truncate`, `text-sm`), `MessageSquare` icon left
- Active state: `bg-accent text-accent-foreground font-medium`
- Inactive state: `hover:bg-accent/50`
- Delete button (`Trash2` icon): `opacity-0 group-hover:opacity-100`, `variant="ghost" size="icon"`, `aria-label="Delete session"`
- Click on row fires `onSelect`; click on delete icon fires `onDelete` (with `e.stopPropagation()`)
- Keyboard: `Enter` or `Space` on focused item triggers `onSelect`
- Container uses `group` class, `tabIndex={0}`, `role="button"`
- Transition: `transition-colors duration-150`

**Imports:** `Button` from `@/components/ui/button`, `MessageSquare`, `Trash2` from `lucide-react`, `cn` from `@/lib/utils`

---

### 5.7 ModelSelector

**File:** `src/components/model/model-selector.tsx`
**Type:** Presentational (styled)

```typescript
interface ModelSelectorProps {
  value: string;
  onValueChange: (model: string) => void;
}
```

**Behavior:**
- Uses shadcn `Select` with `SelectTrigger`, `SelectContent`, `SelectItem`
- Trigger shows current model name, `w-[200px]`, `ChevronDown` indicator (built into Select)
- Items sourced from `MODEL_LIST` constant (`@/lib/constants`)
- Selected item has checkmark (built into shadcn Select)

**Imports:** `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select`, `MODEL_LIST` from `@/lib/constants`

---

### 5.8 EmptyState

**File:** `src/components/common/empty-state.tsx`
**Type:** Presentational (styled)

```typescript
interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}
```

**Behavior:**
- Centered flex column (`flex flex-col items-center justify-center h-full text-center gap-4`)
- `Bot` icon: 48px (`w-12 h-12`), `text-muted-foreground`
- Title: "Start a conversation" (`text-lg font-semibold`)
- Subtitle: "Type a message below to begin." (`text-sm text-muted-foreground`)
- 2-3 suggested prompt buttons: `variant="outline"`, `text-sm`
  - "What can you help me with?"
  - "Tell me a joke"
  - "Explain quantum computing simply"
- Clicking a prompt button calls `onPromptClick(promptText)`

**Imports:** `Button` from `@/components/ui/button`, `Bot` from `lucide-react`

**Suggested prompts constant (local to component):**
```typescript
const SUGGESTED_PROMPTS = [
  "What can you help me with?",
  "Tell me a joke",
  "Explain quantum computing simply",
];
```

---

### 5.9 DeleteConfirmDialog

**File:** `src/components/session/delete-confirm-dialog.tsx`
**Type:** Presentational (styled)

```typescript
interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}
```

**Behavior:**
- Uses shadcn `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`
- Title: "Delete conversation?"
- Description: "This will permanently delete this conversation and all its messages."
- Cancel button: default (outline style from shadcn)
- Delete button: `variant` passed as `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"`
- Escape closes dialog
- Focus trapped inside dialog while open (built into shadcn AlertDialog)

**Imports:** `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` from `@/components/ui/alert-dialog`

---

## 6. Feature Hooks (Business Logic)

### 6.1 useSendMessage

**File:** `src/features/chat/api/use-send-message.ts`

```typescript
import type { SendMessageRequest, SendMessageResponse } from "../types";

interface UseSendMessageReturn {
  sendMessage: (req: SendMessageRequest) => Promise<SendMessageResponse>;
  isLoading: boolean;
  error: string | null;
}

export function useSendMessage(): UseSendMessageReturn;
```

**Implementation notes:**
- Uses `fetch("POST", "/api/chat")` with JSON body
- Manages `isLoading` and `error` state via `useState`
- On non-200 response: parses error body, sets `error` state
- Returns parsed JSON response on success
- Resets `error` on each new call

---

### 6.2 useChat

**File:** `src/features/chat/hooks/use-chat.ts`

```typescript
import type { Message } from "@/types";

interface UseChatParams {
  sessionId: string | null;
  model: string;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useChat(params: UseChatParams): UseChatReturn;
```

**Implementation notes:**
- Manages `messages` state array via `useState<Message[]>([])`
- Manages `isLoading` and `error` via `useState`
- Uses `useSendMessage` internally
- On `sendMessage(content)`:
  1. Optimistically append user `Message` to `messages` (generate temp `id` with `crypto.randomUUID()`)
  2. Set `isLoading = true`
  3. Call `sendMessage({ message: content, session_id: sessionId, model })`
  4. On success: append assistant `Message` to `messages`, set `isLoading = false`
  5. On error: set `error`, show toast via `toast.error()` from `sonner`, set `isLoading = false`
- Returns `setMessages` so `useSessionManager` can replace messages when switching sessions
- Returns the `sessionId` from the API response (for new sessions created by first message)

**Updated return type (refined):**
```typescript
interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<string | undefined>; // returns session_id
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}
```

---

### 6.3 useSessions

**File:** `src/features/session/api/use-sessions.ts`

```typescript
import type { Session, Message } from "@/types";

interface UseSessionsReturn {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  createSession: () => Promise<Session>;
  deleteSession: (id: string) => Promise<boolean>;
  fetchMessages: (sessionId: string) => Promise<Message[]>;
}

export function useSessions(): UseSessionsReturn;
```

**Implementation notes:**
- All methods use `fetch` to call the corresponding API routes
- `fetchSessions`: `GET /api/sessions` -> sets `sessions` state
- `createSession`: `POST /api/sessions` -> returns new `Session`, prepends to `sessions`
- `deleteSession`: `DELETE /api/sessions/[id]` -> removes from `sessions` state, returns `true` on success
- `fetchMessages`: `GET /api/sessions/[id]/messages` -> returns `Message[]` (does not store internally; passed to `useChat.setMessages`)
- Error handling: non-200 responses set `error` and trigger `toast.error()`

---

### 6.4 useSessionManager

**File:** `src/features/session/hooks/use-session-manager.ts`

```typescript
import type { Session, Message } from "@/types";

interface UseSessionManagerParams {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

interface UseSessionManagerReturn {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  setActiveSessionId: (id: string | null) => void;
  handleNewChat: () => Promise<void>;
  handleSelectSession: (id: string) => Promise<void>;
  handleDeleteSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

export function useSessionManager(
  params: UseSessionManagerParams
): UseSessionManagerReturn;
```

**Implementation notes:**
- Uses `useSessions` internally for API calls
- Tracks `activeSessionId` via `useState<string | null>(null)`
- `handleNewChat`:
  1. Call `createSession()`
  2. Set new session as `activeSessionId`
  3. Call `setMessages([])` to clear chat
- `handleSelectSession(id)`:
  1. Set `activeSessionId` to `id`
  2. Call `fetchMessages(id)`
  3. Call `setMessages(fetchedMessages)`
- `handleDeleteSession(id)`:
  1. Call `deleteSession(id)`
  2. If deleted session was active: switch to most recent remaining session or set `null`
  3. If switched to new session, fetch its messages; if `null`, clear messages
- On mount (`useEffect`): call `fetchSessions()`, select most recent session if available
- `refreshSessions`: re-fetches session list (called after first message creates a session)

---

### 6.5 useMediaQuery

**File:** `src/hooks/use-media-query.ts`

```typescript
export function useMediaQuery(query: string): boolean;
```

**Implementation notes:**
- Uses `window.matchMedia(query)` with `addEventListener("change", ...)`
- Returns `boolean` (match state)
- Handles SSR by defaulting to `false` (no window on server)
- Cleanup: removes event listener on unmount
- Primary usage: `useMediaQuery("(max-width: 768px)")` for mobile detection

---

## 7. Page Composition

### 7.1 `src/app/layout.tsx`

```typescript
// Props: children
// Responsibilities:
//   - <html lang="en"> with suppressHydrationWarning
//   - Inter font via next/font/google, applied to <body>
//   - <Toaster /> (sonner) for toast notifications
//   - metadata: { title: "Simple Chatbot" }
```

### 7.2 `src/app/page.tsx`

```typescript
// "use client" -- entire page is client-rendered (chat is interactive)
//
// Hooks used:
//   - useChat(sessionId, model) -> messages, isLoading, sendMessage, setMessages
//   - useSessionManager({ setMessages }) -> sessions, activeSessionId, handlers
//   - useMediaQuery("(max-width: 768px)") -> isMobile
//   - useState<string>(DEFAULT_MODEL) -> selectedModel, setSelectedModel
//   - useState<boolean>(true) -> sidebarOpen, setSidebarOpen (default: !isMobile)
//   - useRef<HTMLDivElement>(null) -> messagesEndRef (for auto-scroll)
//
// Layout structure:
//   <div className="flex h-dvh">
//     <SessionSidebar ... />
//     <div className="flex flex-col flex-1 min-w-0">
//       <ChatHeader ... />
//       <main role="main" className="flex-1 overflow-hidden">
//         <ScrollArea className="h-full">
//           <div role="log" aria-live="polite" aria-busy={isLoading}>
//             {messages.length === 0 ? <EmptyState /> : messages.map(...)}
//             {isLoading && <TypingIndicator />}
//             <div ref={messagesEndRef} />  // scroll anchor
//           </div>
//         </ScrollArea>
//       </main>
//       <div className="border-t p-4">
//         <ChatInput onSend={handleSend} disabled={isLoading} />
//       </div>
//     </div>
//   </div>
//
// handleSend flow:
//   1. Call sendMessage(content) from useChat
//   2. If returns a new session_id (first message), call refreshSessions()
//   3. Auto-scroll to messagesEndRef
//
// Auto-scroll logic:
//   - useEffect on messages.length: if user has NOT scrolled up, scrollIntoView
//   - Track "user scrolled up" via IntersectionObserver on messagesEndRef
```

---

## 8. Data Fetching Approach

### Strategy: Plain `fetch` to `/api` Routes

No React Query or SWR. All state is managed via `useState` in custom hooks. This is intentional for MVP simplicity.

### API Contract Summary

| Hook | Method | Endpoint | Request Body | Response Body |
|------|--------|----------|-------------|---------------|
| `useSendMessage` | POST | `/api/chat` | `{ message, session_id?, model? }` | `{ session_id, message, model }` |
| `useSessions.fetchSessions` | GET | `/api/sessions` | -- | `{ sessions: Session[] }` |
| `useSessions.createSession` | POST | `/api/sessions` | -- | `{ session: Session }` |
| `useSessions.deleteSession` | DELETE | `/api/sessions/[id]` | -- | `{ success: boolean }` |
| `useSessions.fetchMessages` | GET | `/api/sessions/[id]/messages` | -- | `{ messages: Message[] }` |

### Fetch Wrapper Pattern

All fetch calls follow this pattern inside each hook:

```typescript
const response = await fetch(url, {
  method,
  headers: { "Content-Type": "application/json" },
  body: body ? JSON.stringify(body) : undefined,
});

if (!response.ok) {
  const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
  throw new Error(errorData.error || `HTTP ${response.status}`);
}

return response.json();
```

### Error Handling Matrix

| HTTP Status | User-Facing Action | Implementation |
|-------------|-------------------|----------------|
| 200 | Success (no toast) | Process response normally |
| 404 | Toast: "Conversation not found" | `toast.error(...)` from sonner |
| 429 | Toast: "Too many requests. Please wait a moment." | `toast.error(...)` |
| 500 | Toast: "Something went wrong. Please try again." | `toast.error(...)` |
| Network error | Toast: "You appear to be offline." | `catch` block in fetch |

---

## 9. State Management Approach

### Strategy: React `useState` Only

No Zustand, no Context API, no React Query. All state lives in hooks composed at the page level.

### State Ownership Map

| State Variable | Owner Hook/Component | Type | Initial Value |
|---------------|---------------------|------|---------------|
| `messages` | `useChat` | `Message[]` | `[]` |
| `isLoading` (chat) | `useChat` | `boolean` | `false` |
| `error` (chat) | `useChat` | `string \| null` | `null` |
| `sessions` | `useSessions` (via `useSessionManager`) | `Session[]` | `[]` |
| `activeSessionId` | `useSessionManager` | `string \| null` | `null` |
| `isLoading` (sessions) | `useSessions` | `boolean` | `false` |
| `selectedModel` | `page.tsx` (`useState`) | `string` | `DEFAULT_MODEL` |
| `sidebarOpen` | `page.tsx` (`useState`) | `boolean` | `!isMobile` |
| `inputValue` | `ChatInput` (internal) | `string` | `""` |
| `deleteDialogOpen` | `SessionItem` or `SessionSidebar` (internal) | `boolean` | `false` |
| `deleteTargetId` | `SessionSidebar` (internal) | `string \| null` | `null` |

### Data Flow Diagram

```
page.tsx (top-level state: selectedModel, sidebarOpen)
  |
  +-- useSessionManager({ setMessages })
  |     |-- useSessions()          -- owns: sessions, isLoading, error
  |     |-- activeSessionId        -- owned by useSessionManager
  |
  +-- useChat({ sessionId, model })
  |     |-- useSendMessage()       -- owns: isLoading per request
  |     |-- messages               -- owned by useChat
  |     |-- isLoading (chat)       -- owned by useChat
  |
  +-- useMediaQuery("(max-width: 768px)")
        |-- isMobile               -- derived boolean
```

**Prop drilling** is acceptable here due to the shallow component tree (max 2 levels deep from page to leaf). No Context needed.

---

## 10. Business vs Styled Component Separation

### Rule (from Bulletproof React / potenlab-workflow)

- `src/components/{feature}/` = **Styled/presentational** -- concerned with how things look
- `src/features/{feature}/components/` = **Business-purpose** -- concerned with what things do (list, detail, create, edit, delete)

### This Project

For this MVP, there are **no business-purpose components in `features/`**. All visual components are presentational and live in `src/components/`. All business logic lives in hooks (`features/{name}/hooks/` and `features/{name}/api/`).

The page (`src/app/page.tsx`) is the single composition point that wires hooks to presentational components.

**Rationale:** The app is a single page with a flat component tree. Adding a `features/chat/components/` layer would introduce unnecessary indirection. If the app grows (e.g., adding a chat settings panel, message editing), business components should be extracted at that point.

---

## 11. Performance Checklist

| # | Item | Status | Implementation |
|---|------|--------|----------------|
| 1 | No barrel file imports | Required | Import directly: `import { Button } from "@/components/ui/button"` |
| 2 | Font optimization | Required | Inter via `next/font/google` in `layout.tsx` (no FOIT/FOUT) |
| 3 | Icon tree-shaking | Required | Import individual icons: `import { Send } from "lucide-react"` |
| 4 | Auto-scroll guard | Required | Do NOT auto-scroll if user has scrolled up; use `IntersectionObserver` on scroll anchor |
| 5 | `React.memo` on `ChatBubble` | Required | Memoize since it renders in a list and parent re-renders on each message |
| 6 | `React.memo` on `SessionItem` | Required | Memoize since it renders in a list |
| 7 | Functional `setState` | Required | Use `setMessages(prev => [...prev, newMsg])` pattern |
| 8 | No `useEffect` for derived state | Required | Derive `isMobile`, active session title, etc. directly in render |
| 9 | Avoid waterfalls in `useSessionManager` init | Required | `fetchSessions` then `fetchMessages` is sequential but necessary (messages depend on session ID) |
| 10 | Bundle: `next/dynamic` for heavy components | Not needed (MVP) | No heavy components; revisit if adding markdown renderer or code highlighter |
| 11 | Virtualized message list | Not needed (MVP) | Add `react-virtuoso` if sessions exceed ~200 messages |
| 12 | `useRef` for non-render values | Required | Use for `messagesEndRef`, scroll position tracking |
| 13 | `optimizePackageImports` in `next.config.js` | Recommended | Add `lucide-react` to the list |

---

## 12. Accessibility Checklist

| # | Item | WCAG Criterion | Implementation |
|---|------|---------------|----------------|
| 1 | `<html lang="en">` | 3.1.1 | Set in `layout.tsx` |
| 2 | Skip link "Skip to chat" | 2.4.1 | Visually hidden link at top of `page.tsx`, targets chat input `id="chat-input"` |
| 3 | Semantic landmarks | 1.3.1, 4.1.2 | `<header role="banner">`, `<aside role="complementary">`, `<main role="main">` |
| 4 | `aria-live="polite"` on message thread | 4.1.3 | On the `div` wrapping the message list |
| 5 | `aria-busy="true"` while loading | 4.1.3 | On the message thread container when `isLoading` |
| 6 | `role="log"` on message container | 4.1.2 | On the `div` wrapping the message list |
| 7 | All icon-only buttons have `aria-label` | 1.1.1 | Send: "Send message", Toggle: "Toggle sidebar", Delete: "Delete session" |
| 8 | Focus returns to input after send | 2.4.3 | `inputRef.current?.focus()` after `sendMessage` |
| 9 | Escape closes overlays | 2.1.2 | Mobile sidebar (Sheet), delete dialog (AlertDialog), model dropdown (Select) -- all handled by shadcn |
| 10 | Keyboard navigation for sessions | 2.1.1 | `tabIndex={0}`, `onKeyDown` for Enter/Space on `SessionItem` |
| 11 | Color contrast AA | 1.4.3 | shadcn Zinc theme meets AA by default (verified in UI/UX plan) |
| 12 | 44px minimum touch targets | 2.5.5 | Use `size="default"` or larger for all buttons; icon buttons use `size="icon"` (40px, acceptable with padding) |
| 13 | No horizontal scroll at 320px | 1.4.10 | Chat bubbles use `max-w-[80%]`; sidebar is overlay on mobile |
| 14 | Confirm before destructive actions | 3.3.4 | `DeleteConfirmDialog` before session deletion |
| 15 | Focus visible indicator | 2.4.7 | shadcn default `ring-2 ring-ring ring-offset-2` on all interactive elements |

---

## 13. Constants

### `src/lib/constants.ts`

```typescript
export const MODEL_LIST = [
  "moonshotai/kimi-k2",
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4",
  "google/gemini-2.0-flash-001",
] as const;

export type ModelId = (typeof MODEL_LIST)[number];

export const DEFAULT_MODEL: ModelId = "moonshotai/kimi-k2";
```

---

## 14. CSS Additions to `globals.css`

The following custom keyframes must be added alongside shadcn's generated CSS variables:

```css
@keyframes typing-dot {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
```

Usage in `TypingIndicator`:
```tsx
<span
  className="typing-dot w-2 h-2 bg-muted-foreground/50 rounded-full inline-block"
  style={{ animation: "typing-dot 600ms infinite", animationDelay: "0ms" }}
/>
```

---

## 15. Import Rules

Following Bulletproof React and potenlab-workflow:

1. **No barrel files** -- import directly from source:
   ```typescript
   // Correct
   import { Button } from "@/components/ui/button";
   // Wrong
   import { Button } from "@/components/ui";
   ```

2. **No cross-feature imports** -- features never import from each other:
   ```typescript
   // Correct: compose at page level
   // page.tsx imports from both features/chat and features/session

   // Wrong: features/chat imports from features/session
   ```

3. **Unidirectional flow** -- shared -> features -> app:
   ```
   @/types          -> used everywhere
   @/lib            -> used everywhere
   @/components/ui  -> used by @/components/{feature}
   @/components     -> used by @/app/page.tsx
   @/features       -> used by @/app/page.tsx
   ```

4. **Lucide icons** -- individual imports only:
   ```typescript
   import { Send, Plus, Bot } from "lucide-react"; // fine, tree-shakes correctly
   ```
