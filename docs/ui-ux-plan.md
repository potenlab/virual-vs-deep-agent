# UI/UX Design Plan

Generated: 2026-04-08
Source PRD: docs/prd.md
Design System: Poten Agent Minimal

---

## Executive Summary

This design plan covers the **test web UI** for the Virtual FS + AI Agent project (Phase 5.4 of the PRD). The interface is a simple chat application with session management -- a developer-facing test harness, not a consumer product. The design prioritizes speed to market, clarity, and functional completeness over visual polish. The UI consists of two core surfaces: a **session sidebar** and a **chat panel** with streaming response support. The entire UI targets a single `test-ui/` directory with `index.html` and `app.js` (or a lightweight React setup).

---

## 1. User Research

### 1.1 Problem Statement

**Business Goal:** Validate the Virtual FS + AI Agent engine end-to-end through a web interface before integrating with PotenManager.

**User Need:** Developers need to send chat messages to the agent, observe streaming responses, switch between sessions, and verify that agent actions (task creation, file reads) are reflected in Supabase.

**Design Challenge:** How might we build the simplest possible chat interface that supports session management and streaming responses without slowing down backend development?

### 1.2 User Personas

#### Primary Persona: Solo Developer / Project Author

| Attribute | Details |
|-----------|---------|
| **Demographics** | Developer, high tech-savviness |
| **Goals** | Test agent behavior, verify session persistence, debug tool calls |
| **Pain Points** | Needs fast feedback loop; does not want to fight UI tooling |
| **Behaviors** | Uses browser DevTools alongside the UI; reads raw API responses |
| **Quote** | "I just need to see what the agent returns and confirm sessions work." |

#### Secondary Persona: Technical Reviewer / Collaborator

| Attribute | Details |
|-----------|---------|
| **Demographics** | Developer or PM reviewing the agent capability |
| **Goals** | Quickly understand what the agent can do, test specific prompts |
| **Pain Points** | Needs clear indication of agent status (thinking, streaming, error) |
| **Behaviors** | Tries edge cases, switches sessions to test context retention |
| **Quote** | "Show me it remembers what I said earlier in this session." |

### 1.3 User Journey Map

```
Journey: Test Agent via Chat UI

Stage 1: Open UI
|- Actions: Navigate to localhost or deployed URL
|- Thoughts: "Is it connected? Is the API up?"
|- Emotions: Neutral
|- Opportunities: Show connection status indicator

Stage 2: Start or Select Session
|- Actions: Click "New Session" or select existing session from sidebar
|- Thoughts: "I want a fresh context" or "Let me continue where I left off"
|- Emotions: Neutral
|- Opportunities: Show session list with timestamps, clear active state

Stage 3: Send Message
|- Actions: Type prompt, press Enter or click Send
|- Thoughts: "Will the agent understand this? How long will it take?"
|- Emotions: Expectant
|- Opportunities: Streaming response, typing indicator, clear input affordance

Stage 4: Read Response
|- Actions: Read streamed tokens, scroll, review agent tool usage
|- Thoughts: "Did it use the right tool? Is the answer correct?"
|- Emotions: Positive if correct, frustrated if wrong
|- Opportunities: Show tool calls inline, format markdown, code blocks

Stage 5: Verify / Debug
|- Actions: Switch sessions, check Supabase, open DevTools
|- Thoughts: "Did the task actually get created? Does session B still have its context?"
|- Emotions: Satisfied if data matches
|- Opportunities: Session switching with preserved scroll, clear session boundaries
```

### 1.4 Competitive Analysis

| Reference | Strengths | Weaknesses | Takeaway |
|-----------|-----------|------------|----------|
| ChatGPT Web UI | Clean chat layout, streaming, session sidebar | Heavy, complex feature set | Adopt the 2-panel layout pattern |
| Anthropic Console | Minimal, fast, markdown rendering | No session sidebar | Good reference for token streaming UX |
| OpenRouter Playground | Model switching, raw JSON view | Sparse UX, no persistence | We need session persistence UI |
| LangSmith Playground | Tool call visibility, trace view | Developer-only, complex | Show tool calls inline in chat |

---

## 2. Information Architecture

### 2.1 Sitemap

```
Test Chat UI (Single Page Application)
|- Session Sidebar (left panel)
|  |- New Session Button
|  |- Session List
|     |- Session Item (title, timestamp, active indicator)
|     |- Delete Session Action
|- Chat Panel (main area)
|  |- Chat Header (session title, connection status)
|  |- Message List
|  |  |- User Message Bubble
|  |  |- Agent Message Bubble (with markdown/code rendering)
|  |  |- Tool Call Indicator (collapsible)
|  |  |- Loading / Streaming Indicator
|  |- Input Area
|     |- Text Input (multiline)
|     |- Send Button
```

### 2.2 Navigation Structure

**Primary Navigation:** None -- single page app. The sidebar serves as the only navigation.

| Element | Priority | Action |
|---------|----------|--------|
| New Session | High | Creates new session, switches to it |
| Session List Item | High | Switches active session, loads history |
| Delete Session | Low | Removes session with confirmation |

### 2.3 Content Hierarchy

| Area | Primary Content | Secondary Content |
|------|----------------|-------------------|
| Chat Panel | Message stream (user + agent) | Tool call details, timestamps |
| Sidebar | Session list | Session metadata (date, message count) |
| Header | Session title | Connection status |

---

## 3. User Flows

### 3.1 Core Flow: Send a Chat Message

**Goal:** User sends a prompt and receives a streaming response from the agent.
**Entry Point:** Chat input field
**Success Criteria:** Agent response streams in, renders correctly, message is persisted.

```
[User types message in input]
    |
    v
[Press Enter or click Send]
    |
    v
[Input clears, user bubble appears]
    |
    v
[POST /chat with sessionId + message]
    |
    v
[Streaming indicator appears]
    |
    v
[Tokens stream into agent bubble]
    |
    v
[Stream completes, full message rendered]
    |
    v
[Input re-enabled, focus returns]
```

**Edge Cases:**
- Empty input: Send button disabled, Enter does nothing
- Network error mid-stream: Show error banner, preserve partial response with "[Error: Connection lost]" suffix
- Very long response: Auto-scroll follows stream, user can scroll up to break auto-scroll

**Error States:**
- API unreachable: Red banner "Cannot connect to API. Check that the server is running." with retry button
- 500 error: Inline error message in chat "Something went wrong. Try again." with retry action
- Session expired/deleted: Redirect to new session with info toast

### 3.2 Core Flow: Session Management

**Goal:** User creates, switches between, and deletes chat sessions.
**Entry Point:** Session sidebar
**Success Criteria:** Sessions persist across page reloads, switching loads correct history.

```
[New Session]
    |
    v
[POST /sessions → returns sessionId]
    |
    v
[New session appears in sidebar, marked active]
    |
    v
[Chat panel clears, shows empty state]

---

[Switch Session]
    |
    v
[Click session in sidebar]
    |
    v
[GET /sessions/{id}/messages]
    |
    v
[Chat panel loads message history]
    |
    v
[Sidebar highlights active session]

---

[Delete Session]
    |
    v
[Click delete icon on session]
    |
    v
[Confirm dialog: "Delete this session?"]
    |
   / \
 Yes   No
  |     |
  v     v
[DELETE /sessions/{id}]  [Dismiss]
  |
  v
[Session removed from sidebar]
  |
  v
[If active session deleted → switch to most recent or empty state]
```

### 3.3 Core Flow: Tool Call Visibility

**Goal:** User can see when the agent invokes tools (execute_command, create_task, etc.)
**Entry Point:** Agent response stream
**Success Criteria:** Tool calls are visible inline, collapsible, and distinguishable from regular text.

```
[Agent decides to call a tool]
    |
    v
[Tool call indicator appears: "Calling: execute_command(ls /project)"]
    |
    v
[Tool result returns]
    |
    v
[Result shown in collapsible block]
    |
    v
[Agent continues response with tool output context]
```

---

## 4. Design System

### 4.1 Color Palette

Minimal palette. Use system-native colors where possible. Dark mode optional (defer to Phase 2).

#### Brand Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary | #2563EB | rgb(37, 99, 235) | Send button, active session, links |
| Primary Hover | #1D4ED8 | rgb(29, 78, 216) | Hover states |
| Primary Light | #EFF6FF | rgb(239, 246, 255) | Agent message bubble background |

#### Semantic Colors
| Name | Hex | Contrast vs White | Usage |
|------|-----|-------------------|-------|
| Success | #16A34A | 4.5:1 AA | Connected status |
| Warning | #D97706 | 4.5:1 AA | Partial stream, reconnecting |
| Error | #DC2626 | 4.5:1 AA | Error banners, failed messages |
| Info | #2563EB | 4.5:1 AA | Tool call indicators |

#### Neutral Colors
| Name | Hex | Usage |
|------|-----|-------|
| Gray 950 | #0B1120 | -- reserved for dark mode |
| Gray 900 | #111827 | Primary text |
| Gray 700 | #374151 | Secondary text, timestamps |
| Gray 500 | #6B7280 | Placeholder text, icons |
| Gray 300 | #D1D5DB | Borders, dividers |
| Gray 100 | #F3F4F6 | Sidebar background, user bubble bg |
| Gray 50 | #F9FAFB | Chat panel background |
| White | #FFFFFF | Cards, input background |

### 4.2 Typography

Single font family. System fonts for zero load time.

#### Font Family
```css
--font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
```

#### Type Scale
| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| H1 | 20px | 600 | 1.3 | Chat header title |
| H2 | 16px | 600 | 1.4 | Session list section label |
| Body | 15px | 400 | 1.6 | Chat messages |
| Body Small | 13px | 400 | 1.5 | Timestamps, metadata |
| Caption | 12px | 500 | 1.4 | Status indicators, labels |
| Code | 14px | 400 | 1.5 | Code blocks, tool calls (monospace) |

### 4.3 Spacing

Base unit: 4px. Keep it tight -- this is a chat interface, not a marketing page.

```css
--space-1: 4px;    /* Inline padding */
--space-2: 8px;    /* Icon gaps, compact padding */
--space-3: 12px;   /* Message bubble internal padding */
--space-4: 16px;   /* Standard gaps, sidebar padding */
--space-5: 20px;   /* Between message groups */
--space-6: 24px;   /* Section gaps */
--space-8: 32px;   /* Large gaps */
```

### 4.4 Border Radius

```css
--radius-sm: 4px;      /* Inputs, small buttons */
--radius-md: 8px;      /* Cards, session items */
--radius-lg: 16px;     /* Chat bubbles */
--radius-full: 9999px; /* Avatars, pills */
```

### 4.5 Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);   /* Session items on hover */
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);    /* Input area */
```

---

## 5. Component Library

### 5.1 Layout Shell

```
+------------------+--------------------------------------------+
|                  |                                            |
|  Session         |  Chat Header                               |
|  Sidebar         |  [Session Title]     [Status: Connected]   |
|  (260px)         |--------------------------------------------|
|                  |                                            |
|  [+ New Session] |  Message List (scrollable)                 |
|                  |                                            |
|  Session Item    |    [User bubble]                           |
|  Session Item *  |    [Agent bubble - streaming...]           |
|  Session Item    |    [Tool call block]                       |
|  Session Item    |    [Agent bubble]                          |
|                  |                                            |
|                  |--------------------------------------------|
|                  |  Input Area                                |
|                  |  [____________________________] [Send]     |
|                  |                                            |
+------------------+--------------------------------------------+
```

- Sidebar: fixed 260px width on desktop, collapsible overlay on mobile (<768px)
- Chat panel: flex-grow, fills remaining width
- Input area: sticky bottom, shadow-md to separate from messages

### 5.2 Session Sidebar

#### Container
| Property | Value |
|----------|-------|
| Width | 260px (desktop), 100% overlay (mobile) |
| Background | Gray 100 (#F3F4F6) |
| Border Right | 1px solid Gray 300 |
| Padding | 16px |
| Overflow-Y | auto (scroll if many sessions) |

#### New Session Button
| Property | Value |
|----------|-------|
| Width | 100% |
| Height | 40px |
| Background | Primary (#2563EB) |
| Text | "New Session", White, 14px, weight 500 |
| Border Radius | radius-sm (4px) |
| Hover | Primary Hover (#1D4ED8) |
| Focus | 2px ring, Primary, 2px offset |
| Icon | Plus icon (16px), left of text |

#### Session List Item
| State | Background | Text Color | Border Left |
|-------|------------|------------|-------------|
| Default | transparent | Gray 900 | none |
| Hover | White | Gray 900 | none |
| Active | White | Primary | 3px solid Primary |
| Focus | White | Gray 900 | 2px ring Primary |

| Property | Value |
|----------|-------|
| Height | auto, min 56px |
| Padding | 12px |
| Border Radius | radius-md (8px) |
| Cursor | pointer |
| Content | Session title (14px, 600), truncated single line |
| Sub-content | Relative timestamp (12px, Gray 500) e.g. "2 hours ago" |
| Delete button | Trash icon (16px), Gray 500, visible on hover, 44x44 touch target |

### 5.3 Chat Header

| Property | Value |
|----------|-------|
| Height | 56px |
| Background | White |
| Border Bottom | 1px solid Gray 300 |
| Padding | 0 16px |
| Display | flex, align-items: center, justify-content: space-between |
| Left content | Session title (20px, weight 600) |
| Right content | Connection status pill |

#### Connection Status Pill
| State | Background | Text | Dot Color |
|-------|------------|------|-----------|
| Connected | Success/10% (#DCFCE7) | "Connected" (12px, Success) | Success |
| Connecting | Warning/10% (#FEF3C7) | "Connecting..." (12px, Warning) | Warning (pulsing) |
| Disconnected | Error/10% (#FEE2E2) | "Disconnected" (12px, Error) | Error |

### 5.4 Message Bubbles

#### User Message
| Property | Value |
|----------|-------|
| Alignment | Right-aligned |
| Max Width | 75% of chat panel |
| Background | Gray 100 (#F3F4F6) |
| Text Color | Gray 900 |
| Font Size | 15px, line-height 1.6 |
| Padding | 12px 16px |
| Border Radius | 16px 16px 4px 16px (tail bottom-right) |
| Margin Bottom | 8px |
| Timestamp | Below bubble, right-aligned, 12px, Gray 500 |

#### Agent Message
| Property | Value |
|----------|-------|
| Alignment | Left-aligned |
| Max Width | 85% of chat panel (agent messages tend to be longer) |
| Background | Primary Light (#EFF6FF) |
| Text Color | Gray 900 |
| Font Size | 15px, line-height 1.6 |
| Padding | 12px 16px |
| Border Radius | 16px 16px 16px 4px (tail bottom-left) |
| Margin Bottom | 8px |
| Timestamp | Below bubble, left-aligned, 12px, Gray 500 |

#### Markdown Rendering inside Agent Bubble
- **Bold**, *italic*, `inline code` supported
- Code blocks: monospace font, Gray 950 background (#0B1120), white text, 14px, 12px padding, radius-sm, horizontal scroll
- Lists: standard indentation, bullet/number
- Links: Primary color, underline on hover

### 5.5 Tool Call Block

Displayed inline in the message stream when the agent invokes a tool.

| Property | Value |
|----------|-------|
| Alignment | Left, full width within agent bubble column |
| Background | #F8FAFC (very light blue-gray) |
| Border | 1px solid Gray 300 |
| Border Left | 3px solid Info (#2563EB) |
| Border Radius | radius-sm (4px) |
| Padding | 8px 12px |
| Margin | 4px 0 |
| Icon | Wrench icon (14px), Info color |
| Title | Tool name + args summary (13px, weight 500, Gray 700) |
| Expand/Collapse | Chevron icon, toggles result visibility |
| Result | Monospace, 13px, max-height 200px with scroll, shown on expand |

**States:**
| State | Indicator |
|-------|-----------|
| Calling | Spinner icon + "Calling: {tool_name}..." |
| Complete | Check icon + tool name + "(click to expand)" |
| Error | X icon, Error color border-left, error message shown |

### 5.6 Chat Input Area

| Property | Value |
|----------|-------|
| Position | Sticky bottom |
| Background | White |
| Border Top | 1px solid Gray 300 |
| Padding | 12px 16px |
| Shadow | shadow-md |
| Display | flex, gap 8px, align-items: flex-end |

#### Text Input
| Property | Value |
|----------|-------|
| Type | textarea (auto-resize, min 1 row, max 6 rows) |
| Background | White |
| Border | 1px solid Gray 300 |
| Border Radius | radius-md (8px) |
| Padding | 10px 12px |
| Font | 15px, font-primary |
| Placeholder | "Type a message..." (Gray 500) |
| Focus | Border Primary, ring 2px Primary/20% |
| Resize | none (auto-grow only) |
| Keyboard | Enter sends (desktop), Shift+Enter new line |

#### Send Button
| Property | Value |
|----------|-------|
| Size | 40x40px (meets 44px touch target with padding) |
| Background | Primary (#2563EB) |
| Icon | Arrow-up / Send icon, White, 20px |
| Border Radius | radius-full (circle) |
| Hover | Primary Hover |
| Disabled | Opacity 0.4, cursor not-allowed (when input empty or streaming) |
| Focus | 2px ring, Primary, 2px offset |
| aria-label | "Send message" |

### 5.7 Empty State (No Messages)

Shown when a session has no messages yet.

| Property | Value |
|----------|-------|
| Display | Centered vertically and horizontally |
| Icon | Chat bubble outline, 48px, Gray 300 |
| Title | "Start a conversation" (16px, 600, Gray 700) |
| Subtitle | "Ask the agent about your project" (14px, Gray 500) |
| Suggested prompts (optional) | 2-3 clickable pills with example queries |

#### Suggested Prompt Pill
| Property | Value |
|----------|-------|
| Background | White |
| Border | 1px solid Gray 300 |
| Border Radius | radius-full |
| Padding | 8px 16px |
| Font | 14px, Gray 700 |
| Hover | Border Primary, text Primary |
| Cursor | pointer |
| On click | Fills input with prompt text |

Example prompts:
- "Show me tasks with upcoming deadlines"
- "List all project documents"
- "Create a new task for the next sprint"

### 5.8 Streaming Indicator

Shown while the agent is generating a response (before first token or between tool calls).

| Property | Value |
|----------|-------|
| Position | Inside agent bubble area, left-aligned |
| Animation | Three dots pulsing (opacity 0.3 to 1, staggered 150ms) |
| Dot size | 8px circles |
| Color | Gray 400 |
| Duration | Visible until first token streams in |

### 5.9 Error Banner

Shown at top of chat panel for connection or API errors.

| Property | Value |
|----------|-------|
| Position | Fixed top of chat panel, below header |
| Background | Error/10% (#FEE2E2) |
| Border | 1px solid Error/30% |
| Text | Error message (14px, Error) |
| Padding | 8px 16px |
| Action | "Retry" link or dismiss X |
| z-index | Above messages |

### 5.10 Mobile Sidebar Toggle

| Property | Value |
|----------|-------|
| Breakpoint | < 768px |
| Trigger | Hamburger icon (24px) in chat header, left side |
| Behavior | Sidebar slides in from left as overlay |
| Backdrop | rgba(0, 0, 0, 0.3), click to close |
| Close | X button inside sidebar header, or backdrop click |
| Touch target | 44x44px minimum |

---

## 6. Page Layouts

### 6.1 Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 768px | Sidebar hidden, hamburger toggle, full-width chat |
| Desktop | >= 768px | Sidebar visible (260px), chat fills remaining |

This is a 2-breakpoint system. No tablet-specific layout needed for a test UI.

---

## 7. Wireframes

### 7.1 Desktop Layout (>= 768px)

```
+---260px---+--------------------flex-grow--------------------+
|            |                                                 |
| [+ New     | Chat Header                                    |
|  Session]  | Poten Agent - Session 3          [* Connected] |
|            |------------------------------------------------|
| Sessions   |                                                 |
|            |                    [User bubble, right]          |
| > Session 3|     How many tasks are overdue?                 |
|   2 min ago|                                                 |
|            |  [Agent bubble, left]                            |
|  Session 2 |  Let me check your tasks...                     |
|  1 hr ago  |                                                 |
|            |  [Tool: execute_command(ls /project/todos)]      |
|  Session 1 |  [v Expand to see result]                       |
|  Yesterday |                                                 |
|            |  [Agent bubble, left]                            |
|            |  You have 3 overdue tasks:                       |
|            |  1. Update API docs (due Apr 5)                  |
|            |  2. Fix login bug (due Apr 3)                    |
|            |  3. Deploy staging (due Apr 1)                   |
|            |                                                 |
|            |                                                 |
|            |                                                 |
|            |------------------------------------------------|
|            | [_Type a message...______________] [>]          |
+------------+-------------------------------------------------+
```

### 7.2 Mobile Layout (< 768px)

#### Default State (sidebar hidden)
```
+----------------------------------------------+
| [=]  Poten Agent - Session 3   [* Connected] |
|----------------------------------------------|
|                                              |
|                  [User bubble, right]         |
|     How many tasks are overdue?              |
|                                              |
| [Agent bubble, left]                          |
| Let me check your tasks...                   |
|                                              |
| [Tool: execute_command(ls /project/todos)]   |
| [v Expand]                                   |
|                                              |
| [Agent bubble, left]                          |
| You have 3 overdue tasks:                    |
| 1. Update API docs (due Apr 5)              |
| 2. Fix login bug (due Apr 3)                |
| 3. Deploy staging (due Apr 1)               |
|                                              |
|----------------------------------------------|
| [_Type a message...__________] [>]           |
+----------------------------------------------+
```

#### Sidebar Open (overlay)
```
+---260px---+------overlay backdrop------+
|            |/////////////////////////////|
| [+ New     |/////////////////////////////|
|  Session]  |/////////////////////////////|
|            |/////////////////////////////|
| Sessions   |/////////////////////////////|
|            |/////////////////////////////|
| > Session 3|////////////////////////////|
|   2 min ago|////////////////////////////|
|            |/////////////////////////////|
|  Session 2 |/////////////////////////////|
|  1 hr ago  |/////////////////////////////|
|            |/////////////////////////////|
|  Session 1 |/////////////////////////////|
|  Yesterday |/////////////////////////////|
|            |/////////////////////////////|
+------------+-----------------------------+
```

### 7.3 Empty State (New Session)

```
+---260px---+--------------------flex-grow--------------------+
|            |                                                 |
| [+ New     | Chat Header                                    |
|  Session]  | Poten Agent - New Session       [* Connected]  |
|            |------------------------------------------------|
| Sessions   |                                                 |
|            |                                                 |
| > New      |                                                 |
|   just now |            (chat bubble icon)                   |
|            |                                                 |
|  Session 2 |        Start a conversation                     |
|  1 hr ago  |   Ask the agent about your project              |
|            |                                                 |
|  Session 1 |  [Show me tasks with deadlines]                 |
|  Yesterday |  [List all project documents]                   |
|            |  [Create a new task]                             |
|            |                                                 |
|            |                                                 |
|            |                                                 |
|            |------------------------------------------------|
|            | [_Type a message...______________] [>]          |
+------------+-------------------------------------------------+
```

### 7.4 Error State

```
+---260px---+--------------------flex-grow--------------------+
|            |                                                 |
| [+ New     | Chat Header                                    |
|  Session]  | Poten Agent - Session 3        [! Disconnected]|
|            |------------------------------------------------|
| Sessions   | [! Cannot connect to API. Check server.] [Retry]|
|            |                                                 |
| > Session 3|                    [User bubble]                |
|            |     Show me the project summary                 |
|            |                                                 |
|            |  [Agent bubble - partial]                        |
|            |  Let me look at your pro...                     |
|            |  [Error: Connection lost]                        |
|            |                                                 |
|            |------------------------------------------------|
|            | [_Type a message...______________] [>]          |
+------------+-------------------------------------------------+
```

---

## 8. Micro-interactions and Animation Guidelines

Keep animations minimal. This is a test UI -- perceived speed matters more than delight.

### 8.1 Animation Tokens

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 100ms | ease-out | Button hover, focus ring |
| Small | 150ms | ease-in-out | Sidebar item hover, pill hover |
| Medium | 200ms | ease-in-out | Sidebar slide (mobile), tool call expand |
| Streaming | continuous | linear | Token append (no animation, instant render) |

### 8.2 Specific Interactions

| Interaction | Behavior |
|-------------|----------|
| **Send message** | Input clears instantly, user bubble appears with no animation, scroll to bottom |
| **Token streaming** | Each token appends to the agent bubble. No per-token animation -- just text insertion. Auto-scroll follows unless user has scrolled up |
| **Auto-scroll break** | If user scrolls up more than 100px from bottom, stop auto-scrolling. Show a "Scroll to bottom" floating button |
| **Tool call expand** | Chevron rotates 180deg (150ms), content slides down (200ms, ease-in-out) |
| **Streaming indicator** | Three dots, opacity pulse (0.3 to 1.0), staggered 150ms per dot, loop |
| **Session switch** | Chat panel cross-fades (150ms) or instantly replaces. No slide animation |
| **Sidebar open (mobile)** | Slide from left (200ms, ease-in-out) + backdrop fade-in |
| **Sidebar close (mobile)** | Slide out left (200ms) + backdrop fade-out |
| **Error banner** | Slide down from top (200ms), red background |
| **Delete confirmation** | Simple browser `confirm()` dialog -- no custom modal needed for test UI |
| **Button press** | Scale 0.97 on active (100ms) |
| **New session appears** | Session item fades in at top of list (150ms) |

### 8.3 Scroll to Bottom Button

| Property | Value |
|----------|-------|
| Position | Floating, bottom-right of message list, 16px from edge |
| Visibility | Only when user has scrolled up > 100px from bottom |
| Background | White |
| Border | 1px solid Gray 300 |
| Shadow | shadow-md |
| Icon | Chevron-down, 20px, Gray 700 |
| Size | 36x36px |
| Border Radius | radius-full |
| On click | Smooth scroll to bottom, then hide |
| aria-label | "Scroll to latest messages" |

---

## 9. Accessibility Checklist

### 9.1 WCAG 2.1 AA Requirements

**Perceivable:**
- [x] Color contrast: all text meets 4.5:1 minimum (Gray 900 on White = 15.4:1, Gray 700 on White = 8.6:1, Gray 500 on White = 5.0:1, Primary on White = 5.2:1)
- [x] Connection status uses color + text label (not color alone)
- [x] Error states use icon + color + text
- [x] Tool call states use icon + text label
- [x] Chat messages have visual grouping (alignment + background) plus `role` attribute for screen readers
- [x] Responsive up to 200% zoom without horizontal scroll

**Operable:**
- [x] All interactive elements keyboard accessible (Tab order: sidebar items, chat input, send button)
- [x] Enter to send message, Shift+Enter for new line (documented in placeholder or tooltip)
- [x] Escape to close mobile sidebar
- [x] Skip link at top: "Skip to chat input" (for keyboard users)
- [x] Focus indicators: 2px ring on all interactive elements
- [x] Touch targets: minimum 44x44px (buttons, session items, send button padded)
- [x] No keyboard traps (sidebar open/close, tool call expand)

**Understandable:**
- [x] `lang="en"` on HTML element
- [x] Input has visible placeholder and associated label (visually hidden if needed)
- [x] Error messages describe the problem and suggest action
- [x] Consistent layout across all sessions

**Robust:**
- [x] Semantic HTML: `<nav>` for sidebar, `<main>` for chat, `<form>` for input area
- [x] ARIA landmarks: `role="complementary"` for sidebar, `role="main"` for chat, `role="log"` for message list
- [x] `aria-live="polite"` on message list for screen reader announcements of new messages
- [x] `aria-label` on icon-only buttons (send, delete, toggle sidebar)
- [x] `aria-expanded` on collapsible tool call blocks
- [x] `aria-current="true"` on active session item

### 9.2 Keyboard Navigation Map

| Key | Context | Action |
|-----|---------|--------|
| Tab | Global | Move focus through interactive elements |
| Enter | Chat input | Send message |
| Shift+Enter | Chat input | New line |
| Enter/Space | Session item | Select session |
| Enter/Space | Tool call header | Toggle expand/collapse |
| Escape | Mobile sidebar open | Close sidebar |
| Escape | Chat input (focused) | No action (do not trap) |

### 9.3 Screen Reader Considerations

- New messages announced via `aria-live="polite"` region
- Agent streaming: announce once when streaming starts ("Agent is typing"), announce once when complete ("Agent response received")
- Tool calls: announce "Agent called tool {name}" when tool call appears
- Session switch: announce "Switched to session {title}" via live region

---

## 10. Implementation Guidelines

### 10.1 Technology Recommendations

Given the PRD specifies `test-ui/index.html` and `test-ui/app.js`, the simplest approach:

| Approach | Recommendation |
|----------|---------------|
| **Option A: Vanilla** | Single HTML file + vanilla JS. Use a CDN-loaded markdown renderer (marked.js). Zero build step. Best for speed to market. |
| **Option B: React** | Lightweight React via CDN (no build) or Vite scaffold. Better for component reuse if UI grows. |

**Recommended: Option A (Vanilla)** for Phase 5.4 speed, with a clear path to migrate to React if needed.

### 10.2 File Structure

```
test-ui/
├── index.html          ← Single page, all layout
├── styles.css          ← All styles (or inline in HTML)
├── app.js              ← Application logic
└── lib/
    └── marked.min.js   ← Markdown rendering (CDN fallback)
```

### 10.3 API Integration

| Endpoint | Method | Purpose | Response Type |
|----------|--------|---------|---------------|
| `/chat` | POST | Send message | Streaming (SSE or chunked) |
| `/sessions` | GET | List sessions | JSON array |
| `/sessions` | POST | Create session | JSON object |
| `/sessions/{id}` | DELETE | Delete session | 204 No Content |
| `/sessions/{id}/messages` | GET | Load session history | JSON array |

#### Streaming Implementation

```javascript
// Use fetch with ReadableStream for Lambda Response Streaming
const response = await fetch('/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId, message })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  appendToAgentBubble(chunk);
}
```

### 10.4 Design-to-Code Token Mapping

| Design Token | CSS Variable | Value |
|--------------|-------------|-------|
| Primary | `--color-primary` | #2563EB |
| Primary Hover | `--color-primary-hover` | #1D4ED8 |
| Primary Light | `--color-primary-light` | #EFF6FF |
| Error | `--color-error` | #DC2626 |
| Success | `--color-success` | #16A34A |
| Warning | `--color-warning` | #D97706 |
| Text Primary | `--color-text` | #111827 |
| Text Secondary | `--color-text-secondary` | #374151 |
| Text Muted | `--color-text-muted` | #6B7280 |
| Border | `--color-border` | #D1D5DB |
| BG Sidebar | `--color-bg-sidebar` | #F3F4F6 |
| BG Chat | `--color-bg-chat` | #F9FAFB |
| BG Surface | `--color-bg-surface` | #FFFFFF |
| Font Primary | `--font-primary` | system-ui, sans-serif |
| Font Mono | `--font-mono` | 'SF Mono', Consolas, monospace |
| Radius SM | `--radius-sm` | 4px |
| Radius MD | `--radius-md` | 8px |
| Radius LG | `--radius-lg` | 16px |
| Radius Full | `--radius-full` | 9999px |
| Shadow SM | `--shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) |
| Shadow MD | `--shadow-md` | 0 2px 8px rgba(0,0,0,0.08) |
| Sidebar Width | `--sidebar-width` | 260px |
| Header Height | `--header-height` | 56px |

### 10.5 CSS Architecture

Use CSS custom properties for all tokens. Organize styles by component:

```css
/* Structure: */
/* 1. Reset / Base */
/* 2. CSS Variables (tokens) */
/* 3. Layout (shell, sidebar, chat panel) */
/* 4. Components (buttons, inputs, bubbles, tool calls) */
/* 5. States (hover, focus, active, disabled) */
/* 6. Responsive (@media queries) */
/* 7. Animations (@keyframes) */
```

Total estimated CSS: ~300 lines. No preprocessor needed.

### 10.6 Key Implementation Notes

1. **Auto-resize textarea**: Use a hidden div mirror or `scrollHeight` adjustment on input event. Cap at 6 lines (~144px).

2. **Markdown rendering**: Use marked.js with `sanitize: true`. Apply styles to rendered HTML inside agent bubbles. Ensure code blocks get monospace + dark background.

3. **Streaming auto-scroll**: Track `isUserScrolledUp` state. On scroll event, check if `scrollTop + clientHeight >= scrollHeight - 100`. If true, re-enable auto-scroll.

4. **Session persistence**: Store `activeSessionId` in `localStorage` so page reload returns to the same session.

5. **Optimistic UI**: When sending a message, immediately show user bubble and streaming indicator before API responds. If API fails, show error state on the message.

6. **Mobile sidebar**: Use CSS `transform: translateX(-100%)` for hidden state, `translateX(0)` for visible. Backdrop is a separate div with pointer-events.

---

## 11. Design Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| System fonts over web fonts | Zero load time, this is a test UI | Inter via Google Fonts (adds ~100ms) |
| Vanilla JS over React | Matches PRD file structure (index.html + app.js), zero build step | React via CDN, Vite scaffold |
| 2 breakpoints only (mobile/desktop) | Test UI does not need tablet-specific layout | 3 breakpoints with tablet |
| No dark mode in v1 | Speed to market; can add with CSS variables later | Ship with dark mode toggle |
| Browser confirm() for delete | Fastest to implement, adequate for test UI | Custom modal component |
| Right-aligned user bubbles | Universal chat convention, instant recognition | Same-side alignment |
| Streaming via ReadableStream | Matches Lambda Response Streaming (PRD 5.3) | SSE, WebSocket |
| No avatar icons | Unnecessary for 2-party dev chat | User/Bot avatars |
| Tool calls inline (not sidebar) | Keeps context in flow, developer can see cause and effect | Separate tool call panel |
| Suggested prompts in empty state | Helps testers know what to try without reading docs | Blank empty state |

---

## 12. Next Steps

1. [ ] Review and approve this design plan
2. [ ] Implement HTML structure (`test-ui/index.html`)
3. [ ] Implement CSS with design tokens (`test-ui/styles.css`)
4. [ ] Implement chat logic and streaming (`test-ui/app.js`)
5. [ ] Integrate with Lambda API endpoints (Phase 5.1-5.3)
6. [ ] Test session switching and persistence
7. [ ] Verify accessibility with keyboard navigation
8. [ ] Test on mobile viewport
9. [ ] Iterate based on agent testing feedback

---

## References

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN: ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [marked.js](https://marked.js.org/) - Markdown renderer
- PRD: Virtual FS + AI Agent Implementation Plan v2
