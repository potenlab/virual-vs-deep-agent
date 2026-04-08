# UI/UX Design Plan

Generated: 2026-04-08
Source PRD: docs/prd.md
Design System: shadcn/ui defaults (speed-to-market priority)

---

## Executive Summary

This plan defines the UI/UX for a lightweight chatbot application powered by DeepAgents and OpenRouter, built with Next.js 15 (App Router) and Tailwind CSS. The application is a single-page chat interface with session management (sidebar) and model selection (dropdown). The design strategy prioritizes speed to market by leveraging shadcn/ui defaults with minimal customization, while maintaining WCAG 2.1 AA accessibility compliance.

The core experience is a clean, focused chat interface where users send messages and receive AI-generated responses, organized by sessions, with the ability to switch LLM models on the fly.

---

## 1. User Research

### 1.1 Problem Statement

**Business Goal:** Deliver a functional chatbot interface that demonstrates DeepAgents + OpenRouter integration with minimal development overhead.

**User Need:** Users need a fast, intuitive way to converse with an AI assistant, manage multiple conversation threads, and optionally switch between LLM models.

**Design Challenge:** How might we create a chat experience that feels familiar and responsive while supporting session management and model switching without adding complexity?

### 1.2 User Personas

#### Primary Persona: Dev-Curious User ("Alex")

| Attribute | Details |
|-----------|---------|
| **Demographics** | 25-40, developer or tech-adjacent professional, high tech-savviness |
| **Goals** | Quickly test different LLM models, have productive conversations, organize chats by topic |
| **Pain Points** | Cluttered UIs that get in the way of chatting; slow response feedback; losing conversation context |
| **Behaviors** | Uses ChatGPT/Claude daily; prefers keyboard-first interaction; opens multiple threads for different topics |
| **Quote** | "I just want to type, hit Enter, and get a response. Everything else should stay out of the way." |

#### Secondary Persona: Casual Explorer ("Sam")

| Attribute | Details |
|-----------|---------|
| **Demographics** | 20-35, non-technical user exploring AI tools, moderate tech-savviness |
| **Goals** | Have a conversation with AI, try different models to see differences, keep it simple |
| **Pain Points** | Intimidated by technical configuration; confused by too many options; unsure what "models" mean |
| **Behaviors** | Arrived via link or recommendation; will leave if the first interaction is confusing |
| **Quote** | "I want it to work like texting someone, nothing more complicated." |

### 1.3 User Journey Map

```
Core Journey: Send a message and get a response

Stage 1: Landing
|- Actions: User lands on the app (single page)
|- Thoughts: "Is this ready to go? Where do I type?"
|- Emotions: Neutral / slightly curious
|- Pain Points: Blank screen with no guidance
|- Opportunities: Show a welcoming empty state with suggested prompts

Stage 2: First Message
|- Actions: Types a message in the input, presses Enter
|- Thoughts: "Did it send? Is it thinking?"
|- Emotions: Anticipation
|- Pain Points: No feedback that message was received; unclear loading
|- Opportunities: Instant message bubble + animated typing indicator

Stage 3: Response
|- Actions: Reads the AI response
|- Thoughts: "That was fast / useful. Let me ask a follow-up."
|- Emotions: Satisfaction (if fast and relevant)
|- Pain Points: Slow or stuck responses with no feedback
|- Opportunities: Streaming text or clear "thinking" indicator

Stage 4: Continued Conversation
|- Actions: Sends follow-up messages; scrolls to review history
|- Thoughts: "I want to start a new topic without losing this one."
|- Emotions: Engaged
|- Pain Points: Cannot separate topics; losing context
|- Opportunities: Session sidebar to create/switch conversations

Stage 5: Model Exploration (Power Users)
|- Actions: Opens model selector, switches to a different LLM
|- Thoughts: "Let me see how this model answers differently."
|- Emotions: Curiosity
|- Pain Points: Unclear what models are available or what they do
|- Opportunities: Simple dropdown with model names; optional description tooltip
```

### 1.4 Competitive Analysis

| Competitor | Strengths | Weaknesses | Opportunity |
|------------|-----------|------------|-------------|
| ChatGPT | Polished UI, fast streaming, familiar UX | Closed ecosystem, no model switching | Offer model flexibility with equally clean UX |
| Claude.ai | Clean design, artifact panel, conversation management | No multi-model support | Keep the clean aesthetic, add model switching |
| Poe (Quora) | Multi-model in one place, bot switching | UI can feel cluttered, too many options | Simpler model selector, fewer distractions |
| Open WebUI | Self-hosted, highly customizable | Complex setup, overwhelming settings | Ship a zero-config experience with sane defaults |

---

## 2. Information Architecture

### 2.1 Sitemap

```
Chatbot App (Single Page Application)
|- Main Chat View (app/page.tsx)
|  |- Session Sidebar (left panel)
|  |  |- New Chat button
|  |  |- Session list (scrollable)
|  |  |  |- Session item (title, delete action)
|  |- Chat Area (center)
|  |  |- Header bar
|  |  |  |- Sidebar toggle (mobile)
|  |  |  |- Model selector dropdown
|  |  |- Message thread (scrollable)
|  |  |  |- User message bubble
|  |  |  |- Assistant message bubble
|  |  |  |- Typing indicator
|  |  |  |- Empty state (when no messages)
|  |  |- Input area (bottom, fixed)
|  |  |  |- Text input / textarea
|  |  |  |- Send button
```

### 2.2 Navigation Structure

**Primary Navigation:** Session Sidebar

| Item | Priority | Icon | Action |
|------|----------|------|--------|
| New Chat | High | `Plus` (lucide) | Creates a new session via POST /api/sessions |
| Session List | High | `MessageSquare` (lucide) | Switches active session, loads message history |

**Secondary Navigation:** Header Bar

| Item | Priority | Icon | Action |
|------|----------|------|--------|
| Sidebar Toggle | Medium | `PanelLeftClose` / `PanelLeftOpen` (lucide) | Toggles sidebar visibility (especially mobile) |
| Model Selector | Medium | `ChevronDown` (lucide) | Dropdown to switch LLM model |

### 2.3 Content Hierarchy

| Area | Primary Content | Secondary Content | Tertiary |
|------|----------------|-------------------|----------|
| Chat Area | Message thread | Typing indicator | Empty state / welcome |
| Sidebar | Session list | New Chat button | Session delete action |
| Header | Model selector | Sidebar toggle | App title (optional) |
| Input Bar | Text input | Send button | Character hint (optional) |

---

## 3. User Flows

### 3.1 Core Flow: Send a Message

**Goal:** User sends a text message and receives an AI response
**Entry Point:** Chat input field (focused by default)
**Success Criteria:** User sees their message in the thread followed by an AI response

```
[User lands on page]
        |
        v
[Input field is auto-focused]
        |
        v
[User types message]
        |
        v
[User presses Enter or clicks Send]
        |
        v
[Message appears in thread as user bubble]
[Input clears, typing indicator shows]
        |
        v
[POST /api/chat with message + session_id + model]
        |
       / \
    200    Error
     |       |
     v       v
[Assistant bubble     [Error toast:
 appears with         "Failed to send.
 response]            Try again."]
     |
     v
[Chat scrolls to bottom]
[Input re-focuses]
```

**Edge Cases:**
- Empty message: Disable Send button when input is empty
- Long message: Allow multi-line input (Shift+Enter for newline, Enter to send)
- Network error: Show error toast with retry option
- Slow response: Typing indicator persists; consider a timeout message after 30s

**Error States:**
- API 500: "Something went wrong. Please try again." (toast notification)
- API 429: "Too many requests. Please wait a moment." (toast notification)
- Network offline: "You appear to be offline. Check your connection." (inline banner)

### 3.2 Session Management Flow

**Goal:** User creates, switches, and deletes conversation sessions
**Entry Point:** Session sidebar
**Success Criteria:** User can organize conversations into separate threads

```
[User clicks "New Chat"]
        |
        v
[POST /api/sessions]
        |
        v
[New session appears in sidebar, becomes active]
[Chat area clears, shows empty state]
        |
        v
[User starts chatting in new session]

--- Switch Session ---

[User clicks a session in sidebar]
        |
        v
[GET /api/sessions/[id]/messages]
        |
        v
[Chat area loads message history for that session]
[Active session highlighted in sidebar]

--- Delete Session ---

[User clicks delete icon on session]
        |
        v
[Confirmation dialog: "Delete this conversation?"]
       / \
    Yes    No
     |      |
     v      v
[DELETE     [Dialog closes,
 /api/      no action]
 sessions/
 [id]]
     |
     v
[Session removed from sidebar]
[If was active: switch to most recent or show empty state]
```

### 3.3 Model Selection Flow

**Goal:** User changes the LLM model used for responses
**Entry Point:** Model selector dropdown in header
**Success Criteria:** Subsequent messages use the selected model

```
[User clicks model selector in header]
        |
        v
[Dropdown opens showing available models]
        |
        v
[User selects a model]
        |
        v
[Dropdown closes]
[Selected model name shown in selector]
[Next POST /api/chat includes model parameter]
```

**Edge Cases:**
- Model list is hardcoded client-side (no API needed for MVP)
- Currently selected model shown with checkmark
- Default model from env shown as "Default" label or pre-selected

---

## 4. Design System

### 4.1 Color Palette

Using shadcn/ui default theme (Zinc-based neutral palette) for speed to market. These map directly to CSS variables set by shadcn's theme system.

#### Theme Colors (shadcn/ui CSS Variables)

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--background` | `hsl(0 0% 100%)` | `hsl(240 10% 3.9%)` | Page background |
| `--foreground` | `hsl(240 10% 3.9%)` | `hsl(0 0% 98%)` | Primary text |
| `--card` | `hsl(0 0% 100%)` | `hsl(240 10% 3.9%)` | Card/surface background |
| `--card-foreground` | `hsl(240 10% 3.9%)` | `hsl(0 0% 98%)` | Card text |
| `--primary` | `hsl(240 5.9% 10%)` | `hsl(0 0% 98%)` | Primary buttons, links |
| `--primary-foreground` | `hsl(0 0% 98%)` | `hsl(240 5.9% 10%)` | Text on primary |
| `--secondary` | `hsl(240 4.8% 95.9%)` | `hsl(240 3.7% 15.9%)` | Secondary buttons |
| `--secondary-foreground` | `hsl(240 5.9% 10%)` | `hsl(0 0% 98%)` | Text on secondary |
| `--muted` | `hsl(240 4.8% 95.9%)` | `hsl(240 3.7% 15.9%)` | Muted backgrounds |
| `--muted-foreground` | `hsl(240 3.8% 46.1%)` | `hsl(240 5% 64.9%)` | Secondary/muted text |
| `--accent` | `hsl(240 4.8% 95.9%)` | `hsl(240 3.7% 15.9%)` | Hover states, accents |
| `--accent-foreground` | `hsl(240 5.9% 10%)` | `hsl(0 0% 98%)` | Text on accent |
| `--destructive` | `hsl(0 84.2% 60.2%)` | `hsl(0 62.8% 30.6%)` | Delete actions, errors |
| `--border` | `hsl(240 5.9% 90%)` | `hsl(240 3.7% 15.9%)` | Borders |
| `--input` | `hsl(240 5.9% 90%)` | `hsl(240 3.7% 15.9%)` | Input borders |
| `--ring` | `hsl(240 5.9% 10%)` | `hsl(240 4.9% 83.9%)` | Focus rings |

#### Semantic Colors (Application-Specific)

| Name | Value | Usage |
|------|-------|-------|
| User Bubble BG | `--primary` | User message background |
| User Bubble Text | `--primary-foreground` | User message text |
| Assistant Bubble BG | `--muted` | Assistant message background |
| Assistant Bubble Text | `--foreground` | Assistant message text |
| Sidebar BG | `--card` or `--muted` | Sidebar background |
| Active Session | `--accent` | Highlighted active session |

#### Contrast Compliance

| Pair | Ratio (Light) | WCAG Level |
|------|---------------|------------|
| foreground on background | ~19.6:1 | AAA |
| primary-foreground on primary | ~19.6:1 | AAA |
| muted-foreground on background | ~5.2:1 | AA |
| destructive on background | ~4.6:1 | AA |

### 4.2 Typography

Using shadcn/ui default: Inter via `font-sans` with system font fallback.

#### Font Family

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
  Arial, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular,
  'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
```

#### Type Scale

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| H1 | 36px / 2.25rem | 700 (bold) | 1.2 | Not used (single page app) |
| H2 | 24px / 1.5rem | 600 (semibold) | 1.3 | Sidebar title (if shown) |
| H3 | 20px / 1.25rem | 600 (semibold) | 1.35 | Section labels |
| Body | 16px / 1rem | 400 (normal) | 1.5 | Chat messages, default text |
| Body Small | 14px / 0.875rem | 400 (normal) | 1.5 | Session names, timestamps, model name |
| Caption | 12px / 0.75rem | 500 (medium) | 1.4 | Labels, metadata, "Typing..." |
| Code | 14px / 0.875rem | 400 (normal) | 1.6 | Code blocks in messages (font-mono) |

### 4.3 Spacing

Using Tailwind CSS default spacing scale (base unit: 4px). All values from Tailwind utility classes.

```css
/* Key spacing tokens used in the app */
--space-1: 0.25rem;  /* 4px  - Inline element gaps */
--space-2: 0.5rem;   /* 8px  - Icon + text gap, tight padding */
--space-3: 0.75rem;  /* 12px - Input padding, list item gap */
--space-4: 1rem;     /* 16px - Standard padding, card padding */
--space-5: 1.25rem;  /* 20px - Comfortable spacing */
--space-6: 1.5rem;   /* 24px - Section padding */
--space-8: 2rem;     /* 32px - Large gaps */
--space-12: 3rem;    /* 48px - Page section gaps */
--space-16: 4rem;    /* 64px - Hero/major section gaps */
```

### 4.4 Border Radius

Using shadcn/ui default radius variable:

```css
--radius: 0.5rem; /* 8px - shadcn default */

/* Derived values */
--radius-sm: calc(var(--radius) - 4px);   /* 4px */
--radius-md: calc(var(--radius) - 2px);   /* 6px */
--radius-lg: var(--radius);               /* 8px */
--radius-xl: calc(var(--radius) + 4px);   /* 12px */
--radius-full: 9999px;                    /* Pills, avatars */
```

**Component-specific radius:**
- Chat bubbles: `rounded-2xl` (16px) for a friendly, conversational feel
- Buttons: `rounded-md` (6px, shadcn default)
- Input fields: `rounded-md` (6px)
- Cards/sidebar: `rounded-lg` (8px)
- Avatars/icons: `rounded-full` (circle)

### 4.5 Shadows

Using shadcn/ui and Tailwind defaults:

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1),
             0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1),
             0 4px 6px -4px rgb(0 0 0 / 0.1);
```

**Usage:**
- Sidebar: No shadow (border-right separator) or `shadow-sm`
- Dropdown menus: `shadow-md`
- Modals/dialogs: `shadow-lg`
- Chat bubbles: No shadow (flat design, differentiated by background color)

---

## 5. Component Library

All components below map to shadcn/ui primitives. Install with `npx shadcn@latest add <component>`.

### 5.1 Buttons

**shadcn component:** `button`

| Variant | Usage | Tailwind / shadcn Variant |
|---------|-------|---------------------------|
| Primary (default) | Send message button | `variant="default"` |
| Secondary | New Chat button in sidebar | `variant="secondary"` |
| Ghost | Session list items, sidebar toggle | `variant="ghost"` |
| Outline | Model selector trigger | `variant="outline"` |
| Destructive | Delete session confirmation | `variant="destructive"` |
| Icon | Send icon button, delete icon, sidebar toggle | `variant="ghost" size="icon"` |

**States for all variants:**
- Default: Standard appearance
- Hover: Slight background shift (shadcn handles this)
- Active/Pressed: Slightly darker
- Disabled: 50% opacity, `cursor-not-allowed`
- Loading: Spinner icon replaces content or appears alongside
- Focus: `ring-2 ring-ring ring-offset-2` (shadcn default focus ring)

**Accessibility:**
- Minimum touch target: 44x44px (use `size="default"` or larger)
- Icon-only buttons MUST have `aria-label`
- Focus ring visible on keyboard navigation

### 5.2 Form Elements

#### Chat Input

**Component:** Custom `textarea` or shadcn `textarea`

| State | Border | Background | Text |
|-------|--------|------------|------|
| Default | `border-input` | `bg-background` | `text-foreground` |
| Focus | `ring-2 ring-ring` | `bg-background` | `text-foreground` |
| Disabled | `border-input opacity-50` | `bg-muted` | `text-muted-foreground` |

**Behavior:**
- Auto-grows vertically (min 1 row, max 6 rows)
- Enter sends message; Shift+Enter adds newline
- Placeholder: "Type a message..." (text-muted-foreground)
- Send button enabled only when input is non-empty (trimmed)

#### Model Selector

**shadcn component:** `select` (or `dropdown-menu` / `popover` + `command`)

| Property | Value |
|----------|-------|
| Trigger | Outline button showing current model name |
| Items | List of model strings (hardcoded for MVP) |
| Selected | Checkmark icon next to active model |
| Width | `w-[200px]` or auto |

### 5.3 Chat Bubbles (Custom Component)

Not a shadcn primitive; built with Tailwind.

#### User Message Bubble

```
Container: flex justify-end
Bubble:    bg-primary text-primary-foreground rounded-2xl rounded-br-sm
           px-4 py-2.5 max-w-[80%] md:max-w-[70%]
```

#### Assistant Message Bubble

```
Container: flex justify-start gap-3
Avatar:    w-8 h-8 rounded-full bg-muted flex items-center justify-center
Bubble:    bg-muted text-foreground rounded-2xl rounded-bl-sm
           px-4 py-2.5 max-w-[80%] md:max-w-[70%]
```

**States:**
- Default: Fully rendered message
- Loading (assistant only): Animated dots ("...") or pulsing skeleton
- Error: Red border or inline error text with retry

### 5.4 Session Sidebar

**Layout:** Fixed-width left panel, collapsible on mobile.

| Property | Desktop | Mobile |
|----------|---------|--------|
| Width | 260px (`w-[260px]`) | Full screen overlay or slide-in |
| Visibility | Always visible | Hidden by default, toggled via hamburger |
| Background | `bg-card` or `bg-muted/50` | Same |
| Border | `border-r` | None (overlay) |

**Session List Item:**

```
Container: flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
           hover:bg-accent text-sm truncate
Active:    bg-accent text-accent-foreground font-medium
Delete:    opacity-0 group-hover:opacity-100 (icon button, right side)
```

### 5.5 Navigation Components

#### Header Bar

| Property | Value |
|----------|-------|
| Height | 56px (`h-14`) |
| Position | Sticky top (`sticky top-0 z-10`) |
| Background | `bg-background/80 backdrop-blur-sm` (frosted glass) |
| Border | `border-b` |
| Content | Sidebar toggle (left), App title center (optional), Model selector (right) |

### 5.6 Empty State (No Messages)

Shown when a session has no messages yet.

```
Container: flex flex-col items-center justify-center h-full text-center
Icon:      Bot icon or waving hand, 48px, text-muted-foreground
Title:     "Start a conversation" (text-lg font-semibold)
Subtitle:  "Type a message below to begin." (text-sm text-muted-foreground)
Optional:  2-3 suggested prompt buttons (variant="outline", clickable)
```

### 5.7 Typing Indicator

Three animated dots inside an assistant-style bubble.

```
Container: flex justify-start gap-3 (same as assistant bubble)
Bubble:    bg-muted rounded-2xl rounded-bl-sm px-4 py-3
Dots:      3x w-2 h-2 bg-muted-foreground/50 rounded-full
           animate with staggered bounce (150ms delay between each)
```

### 5.8 Dialogs and Toasts

**Delete Confirmation Dialog:**
- shadcn component: `alert-dialog`
- Title: "Delete conversation?"
- Description: "This will permanently delete this conversation and all its messages."
- Actions: "Cancel" (outline), "Delete" (destructive)

**Error Toast:**
- shadcn component: `sonner` (recommended) or `toast`
- Position: Bottom-right (`bottom-right`)
- Auto-dismiss: 5 seconds
- Variants: error (destructive), success, info

### 5.9 Scroll Area

**shadcn component:** `scroll-area`

Used for:
- Message thread (main chat area): Vertical scroll, auto-scroll to bottom on new messages
- Session sidebar list: Vertical scroll when sessions exceed viewport

---

## 6. Page Layouts

### 6.1 Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 768px | Sidebar hidden (overlay on toggle), full-width chat, input at bottom |
| Tablet | 768-1024px | Sidebar collapsible, chat takes remaining width |
| Desktop | > 1024px | Sidebar always visible (260px), chat fills remaining space |

### 6.2 Desktop Layout (>1024px)

```
+------------------------------------------------------------------+
| [=] Sidebar Toggle   Simple Chatbot          [Model Selector v]  |
+------------------------------------------------------------------+
|          |                                                        |
| SIDEBAR  |  CHAT AREA                                            |
| 260px    |                                                        |
|          |                                                        |
| [+ New]  |     (empty state or message thread)                   |
|          |                                                        |
| Session1 |   [User bubble aligned right]                         |
| Session2*|                                                        |
| Session3 |   [Assistant bubble aligned left with avatar]          |
|          |                                                        |
|          |   [User bubble]                                        |
|          |                                                        |
|          |   [Assistant bubble]                                   |
|          |                                                        |
|          |   [Typing indicator...]                                |
|          |                                                        |
|          +--------------------------------------------------------+
|          | [  Type a message...                        ] [Send ->]|
+------------------------------------------------------------------+
```

### 6.3 Mobile Layout (<768px)

```
+--------------------------------+
| [=]  Simple Chatbot   [Model v]|
+--------------------------------+
|                                |
|  CHAT AREA (full width)       |
|                                |
|        [User bubble]          |
|                                |
|  [Assistant bubble]           |
|                                |
|        [User bubble]          |
|                                |
|  [Typing...]                  |
|                                |
+--------------------------------+
| [Type a message...   ] [Send] |
+--------------------------------+

--- When sidebar toggled open ---

+--------------------------------+
| SIDEBAR OVERLAY (full screen)  |
|                                |
| [X Close]                      |
|                                |
| [+ New Chat]                   |
|                                |
| Session 1                      |
| Session 2 *active*             |
| Session 3                      |
|                                |
+--------------------------------+
```

---

## 7. Wireframes

### 7.1 Main Chat Page -- Desktop

```
+------------------------------------------------------------------------+
|  HEADER (h-14, sticky, border-b, backdrop-blur)                        |
|  +----+  +---------------------------+       +---------------------+   |
|  | := |  | Simple Chatbot            |       | moonshotai/kimi-k2 v|   |
|  +----+  +---------------------------+       +---------------------+   |
+------------------------------------------------------------------------+
|         |                                                              |
| SIDEBAR |  MESSAGE AREA (flex-1, overflow-y-auto, scroll-area)         |
| w-[260] |                                                              |
| border-r|       +--------------------------------------------------+  |
|         |       |                                                  |  |
| +-----+ |       |                  [Bot Icon]                      |  |
| |+ New| |       |           Start a conversation                   |  |
| |Chat | |       |       Type a message below to begin.             |  |
| +-----+ |       |                                                  |  |
|         |       |  [What can you help me with?]  [Tell me a joke]  |  |
| +-----+ |       |                                                  |  |
| |Sess1| |       +--------------------------------------------------+  |
| +-----+ |                                                              |
| +-----+ |                                                              |
| |Sess2| |                                                              |
| |*act*| |                                                              |
| +-----+ |                                                              |
| +-----+ |                                                              |
| |Sess3| |                                                              |
| +-----+ |                                                              |
|         |                                                              |
|         +--------------------------------------------------------------+
|         |  INPUT BAR (sticky bottom, border-t, p-4)                    |
|         |  +--------------------------------------------------+ +----+ |
|         |  | Type a message...                                | | -> | |
|         |  +--------------------------------------------------+ +----+ |
+------------------------------------------------------------------------+
```

### 7.2 Chat with Messages -- Desktop

```
+------------------------------------------------------------------------+
|  [=]   Simple Chatbot                          [moonshotai/kimi-k2 v]  |
+------------------------------------------------------------------------+
|         |                                                              |
| SIDEBAR |                                                              |
| w-[260] |                              +----------------------------+  |
|         |                              | What is the weather today? |  |
| [+New]  |                              +----------------------------+  |
|         |                                                              |
| Sess 1  |  +--+  +------------------------------------------------+  |
| *Sess2* |  |AI|  | I don't have real-time weather access, but I   |  |
| Sess 3  |  +--+  | can help you find weather info. Which city     |  |
|         |        | are you interested in?                          |  |
|         |        +------------------------------------------------+  |
|         |                                                              |
|         |                              +----------------------------+  |
|         |                              | San Francisco              |  |
|         |                              +----------------------------+  |
|         |                                                              |
|         |  +--+  +------+                                              |
|         |  |AI|  | o o o|  <-- typing indicator (3 animated dots)      |
|         |  +--+  +------+                                              |
|         |                                                              |
|         +--------------------------------------------------------------+
|         |  +--------------------------------------------------+ +----+ |
|         |  | Type a message...                                | | -> | |
|         |  +--------------------------------------------------+ +----+ |
+------------------------------------------------------------------------+
```

### 7.3 Mobile -- Sidebar Closed

```
+------------------------------------+
|  [=]  Simple Chatbot    [Model v]  |
+------------------------------------+
|                                    |
|          [User message bubble]     |
|                                    |
|  [AI] [Assistant message bubble ]  |
|       [continues here...        ]  |
|                                    |
|          [User message bubble]     |
|                                    |
|  [AI] [o o o]                      |
|                                    |
+------------------------------------+
| [Type a message...         ] [->]  |
+------------------------------------+
```

### 7.4 Mobile -- Sidebar Open (Overlay)

```
+------------------------------------+
|  SIDEBAR OVERLAY                   |
|  bg-background, z-50, inset-0     |
|                                    |
|  +-----+                    +---+  |
|  | App |                    | X |  |
|  +-----+                    +---+  |
|                                    |
|  +------------------------------+  |
|  | + New Chat                   |  |
|  +------------------------------+  |
|                                    |
|  +------------------------------+  |
|  | Session 1            [trash] |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  | Session 2 *active*   [trash] |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  | Session 3            [trash] |  |
|  +------------------------------+  |
|                                    |
+------------------------------------+
```

### 7.5 Delete Confirmation Dialog

```
+--------------------------------------+
|                                      |
|   Delete conversation?               |
|                                      |
|   This will permanently delete this  |
|   conversation and all its messages. |
|                                      |
|           [Cancel]  [Delete]         |
|                                      |
+--------------------------------------+
```

---

## 8. Micro-interactions & Animation Guidelines

### 8.1 Animation Timing

| Type | Duration | Easing | CSS |
|------|----------|--------|-----|
| Micro (hover, focus) | 150ms | ease-out | `transition-colors duration-150` |
| Small (button press, toggle) | 200ms | ease-in-out | `transition-all duration-200` |
| Medium (sidebar slide, dropdown) | 300ms | ease-in-out | `transition-transform duration-300` |
| Large (page/overlay transitions) | 300-400ms | ease-in-out | Custom with Tailwind or Framer Motion |

### 8.2 Specific Micro-interactions

#### Message Appearance
- **Trigger:** New message added to thread
- **Animation:** Fade in + slide up (translateY: 8px to 0, opacity: 0 to 1)
- **Duration:** 200ms ease-out
- **Implementation:** CSS transition or `animate-in fade-in slide-in-from-bottom-2` (Tailwind animate)

#### Typing Indicator Dots
- **Trigger:** Waiting for AI response
- **Animation:** Three dots with staggered bounce (scale 1 to 1.4, translateY: 0 to -4px)
- **Duration:** 600ms per cycle, infinite loop
- **Stagger:** 150ms delay between each dot
- **Implementation:** CSS `@keyframes` with `animation-delay`

```css
@keyframes typing-dot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
.typing-dot:nth-child(1) { animation-delay: 0ms; }
.typing-dot:nth-child(2) { animation-delay: 150ms; }
.typing-dot:nth-child(3) { animation-delay: 300ms; }
```

#### Sidebar Toggle (Mobile)
- **Trigger:** User taps sidebar toggle button
- **Animation:** Slide in from left (translateX: -100% to 0) with backdrop fade
- **Duration:** 300ms ease-in-out
- **Implementation:** shadcn `Sheet` component (side="left") handles this natively

#### Button Hover
- **Trigger:** Mouse enters button
- **Animation:** Background color transition
- **Duration:** 150ms ease-out
- **Implementation:** Built into shadcn `Button` via Tailwind `transition-colors`

#### Send Button State
- **Trigger:** Input becomes non-empty / empty
- **Animation:** Opacity 0.5 to 1 (or vice versa), slight scale pulse on send
- **Duration:** 150ms
- **Implementation:** Conditional `opacity-50 cursor-not-allowed` class

#### Session Active Highlight
- **Trigger:** User switches session
- **Animation:** Background color transition to accent
- **Duration:** 150ms
- **Implementation:** `transition-colors duration-150`

#### Auto-scroll to Bottom
- **Trigger:** New message appears in thread
- **Behavior:** Smooth scroll to bottom of message area
- **Implementation:** `element.scrollIntoView({ behavior: 'smooth', block: 'end' })`
- **Exception:** Do NOT auto-scroll if user has manually scrolled up (preserve scroll position)

#### Toast Notification
- **Trigger:** Error or success event
- **Animation:** Slide in from right + fade, auto-dismiss with progress bar
- **Duration:** Enter 300ms, exit 200ms, dismiss after 5000ms
- **Implementation:** `sonner` library (shadcn-recommended toast)

---

## 9. Accessibility Checklist

### 9.1 WCAG 2.1 AA Requirements

#### Perceivable

- [ ] All images and icons have appropriate `alt` text or `aria-label`
- [ ] Bot avatar has `alt="AI Assistant"`
- [ ] Color contrast meets 4.5:1 minimum for normal text (verified with shadcn defaults)
- [ ] Color contrast meets 3:1 minimum for large text and UI components
- [ ] Information is not conveyed by color alone (icons + text for states)
- [ ] Content is responsive and usable at 200% zoom
- [ ] Text can be resized up to 200% without loss of functionality
- [ ] No content requires horizontal scrolling at 320px viewport width

#### Operable

- [ ] All interactive elements are keyboard accessible (Tab, Enter, Escape, Arrow keys)
- [ ] No keyboard traps (Escape closes modals/dropdowns/sidebar overlay)
- [ ] Skip link provided: "Skip to chat" jumps to message input
- [ ] Focus indicators are visible on all interactive elements (shadcn ring-2)
- [ ] Touch targets are minimum 44x44px on mobile
- [ ] Focus order follows logical reading order (sidebar, header, messages, input)
- [ ] Chat input receives focus on page load and after sending a message
- [ ] Sidebar sessions navigable with arrow keys
- [ ] Enter key sends message; Shift+Enter inserts newline (documented in placeholder or tooltip)

#### Understandable

- [ ] `<html lang="en">` specified
- [ ] Form labels are clear: input has visible placeholder + `aria-label="Type a message"`
- [ ] Error messages are descriptive and suggest remediation
- [ ] Navigation is consistent across all states
- [ ] Confirm before destructive actions (delete session dialog)
- [ ] Empty state provides clear guidance on what to do next

#### Robust

- [ ] Valid, semantic HTML markup (`<main>`, `<nav>`, `<aside>`, `<header>`)
- [ ] ARIA landmarks: `role="main"` for chat, `role="complementary"` for sidebar, `role="banner"` for header
- [ ] `aria-live="polite"` on the message thread container (announces new messages to screen readers)
- [ ] `aria-busy="true"` on message area while AI is responding
- [ ] `role="log"` on the message thread for assistive technology
- [ ] All shadcn components include proper ARIA attributes by default
- [ ] Works with screen readers (VoiceOver, NVDA)

### 9.2 Keyboard Navigation Map

| Key | Context | Action |
|-----|---------|--------|
| `Tab` | Global | Move focus to next interactive element |
| `Shift+Tab` | Global | Move focus to previous interactive element |
| `Enter` | Chat input | Send message |
| `Shift+Enter` | Chat input | Insert newline |
| `Enter` | Session item (focused) | Switch to that session |
| `Escape` | Sidebar overlay (mobile) | Close sidebar |
| `Escape` | Dialog open | Close dialog |
| `Escape` | Dropdown open | Close dropdown |
| `Arrow Up/Down` | Session list | Navigate between sessions |
| `Arrow Up/Down` | Model selector (open) | Navigate between models |

### 9.3 Screen Reader Announcements

| Event | Announcement (`aria-live`) |
|-------|---------------------------|
| User sends message | "Message sent" (assertive) |
| AI response received | "[Assistant]: [first 100 chars of response]" (polite) |
| AI is typing | "Assistant is typing" (polite) |
| Session created | "New conversation created" (polite) |
| Session deleted | "Conversation deleted" (polite) |
| Session switched | "Switched to [session name]" (polite) |
| Error occurred | "[Error message]" (assertive) |

---

## 10. Implementation Guidelines

### 10.1 Design-to-Code Mapping

| Design Token | CSS Variable / Tailwind | Notes |
|--------------|-------------------------|-------|
| Primary BG | `bg-primary` | User bubble, primary buttons |
| Primary Text | `text-primary-foreground` | Text on primary |
| Muted BG | `bg-muted` | Assistant bubble, sidebar |
| Muted Text | `text-muted-foreground` | Secondary text |
| Border | `border` | Dividers, input borders |
| Focus Ring | `ring-2 ring-ring ring-offset-2` | Focus states |
| Radius | `rounded-md` (buttons), `rounded-2xl` (bubbles) | Component-specific |
| Shadow (dropdown) | `shadow-md` | Dropdowns, popovers |

### 10.2 Required shadcn/ui Components

Install these components for the MVP:

```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add select
npx shadcn@latest add scroll-area
npx shadcn@latest add alert-dialog
npx shadcn@latest add sheet          # Mobile sidebar overlay
npx shadcn@latest add dropdown-menu  # Model selector alternative
npx shadcn@latest add separator
npx shadcn@latest add tooltip
npx shadcn@latest add sonner         # Toast notifications
```

### 10.3 Custom Components to Build

| Component | File | Description |
|-----------|------|-------------|
| `ChatBubble` | `components/chat-bubble.tsx` | User and assistant message bubbles |
| `TypingIndicator` | `components/typing-indicator.tsx` | Animated three-dot indicator |
| `ChatInput` | `components/chat-input.tsx` | Auto-growing textarea + send button |
| `SessionSidebar` | `components/session-sidebar.tsx` | Session list with CRUD |
| `SessionItem` | `components/session-item.tsx` | Individual session row |
| `ModelSelector` | `components/model-selector.tsx` | Dropdown for model switching |
| `EmptyState` | `components/empty-state.tsx` | Welcome screen with suggested prompts |
| `ChatHeader` | `components/chat-header.tsx` | Top bar with toggle + model selector |

### 10.4 File Structure

```
app/
  layout.tsx          # Root layout, font loading, ThemeProvider
  page.tsx            # Main (and only) page -- chat interface
  globals.css         # Tailwind imports, shadcn CSS variables
  api/
    chat/route.ts     # POST /api/chat
    sessions/
      route.ts        # GET, POST /api/sessions
      [id]/
        route.ts      # DELETE /api/sessions/[id]
        messages/
          route.ts    # GET /api/sessions/[id]/messages

components/
  ui/                 # shadcn/ui generated components
    button.tsx
    input.tsx
    textarea.tsx
    select.tsx
    scroll-area.tsx
    alert-dialog.tsx
    sheet.tsx
    dropdown-menu.tsx
    separator.tsx
    tooltip.tsx
    sonner.tsx
  chat-bubble.tsx
  typing-indicator.tsx
  chat-input.tsx
  session-sidebar.tsx
  session-item.tsx
  model-selector.tsx
  empty-state.tsx
  chat-header.tsx

lib/
  agent/
    openrouter.ts     # LLM configuration
  session-store.ts    # In-memory session management
  utils.ts            # cn() helper (shadcn)
  constants.ts        # Model list, default values
```

### 10.5 State Management

Client-side state (React `useState` / `useReducer`):

| State | Type | Initial Value | Description |
|-------|------|---------------|-------------|
| `sessions` | `Session[]` | `[]` | List of all sessions |
| `activeSessionId` | `string \| null` | `null` | Currently active session |
| `messages` | `Message[]` | `[]` | Messages for active session |
| `inputValue` | `string` | `""` | Current chat input text |
| `isLoading` | `boolean` | `false` | Whether AI is responding |
| `selectedModel` | `string` | `DEFAULT_MODEL` | Currently selected model |
| `sidebarOpen` | `boolean` | `true` (desktop) / `false` (mobile) | Sidebar visibility |

**Types:**

```typescript
interface Session {
  id: string;
  title: string;       // Auto-generated from first message or "New Chat"
  createdAt: string;    // ISO timestamp
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;       // Model used for this response
  timestamp: string;    // ISO timestamp
}
```

### 10.6 Asset Exports

| Asset Type | Format | Sizes | Notes |
|------------|--------|-------|-------|
| Icons | Lucide React (SVG) | 16, 20, 24px | Use `lucide-react` package |
| Favicon | .ico + .svg | 16, 32, 180px | Simple bot icon |
| OG Image | .png | 1200x630 | For link sharing (optional for MVP) |

**Key Icons (lucide-react):**

| Icon | Component | Usage |
|------|-----------|-------|
| `Send` | `<Send />` | Send button |
| `Plus` | `<Plus />` | New chat |
| `MessageSquare` | `<MessageSquare />` | Session icon |
| `Trash2` | `<Trash2 />` | Delete session |
| `PanelLeftClose` | `<PanelLeftClose />` | Close sidebar |
| `PanelLeftOpen` | `<PanelLeftOpen />` | Open sidebar |
| `Bot` | `<Bot />` | Assistant avatar, empty state |
| `User` | `<User />` | User avatar (optional) |
| `ChevronDown` | `<ChevronDown />` | Dropdown indicator |
| `Loader2` | `<Loader2 />` | Spinner (with `animate-spin`) |
| `AlertCircle` | `<AlertCircle />` | Error states |
| `X` | `<X />` | Close sidebar (mobile) |

### 10.7 Performance Considerations

- **Message rendering:** Virtualize long message lists if sessions exceed ~200 messages (use `react-virtuoso` or similar). For MVP, not needed.
- **Auto-scroll:** Use `useRef` + `scrollIntoView` with `IntersectionObserver` to detect when user scrolls up.
- **Debounce:** No debounce needed on Enter-to-send. If adding search/filter later, debounce at 300ms.
- **Bundle size:** shadcn/ui components are copy-pasted (not a dependency), so tree-shaking is not an issue. Lucide icons are individually imported.
- **Fonts:** Load Inter via `next/font/google` for automatic optimization and no layout shift.

---

## 11. Design Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Single-page chat layout | PRD specifies one main page; chat apps are inherently single-page experiences | Multi-page with separate settings page -- unnecessary complexity for MVP |
| shadcn/ui defaults with no custom theme | Speed to market priority; shadcn Zinc palette is neutral and professional | Custom brand colors -- adds design time with no user benefit for MVP |
| Chat bubbles with rounded corners (2xl) | Creates a conversational, friendly feel familiar from messaging apps | Flat messages without bubbles (like Slack) -- less visually distinct |
| Sidebar for sessions (not tabs/dropdown) | Familiar pattern from ChatGPT/Claude; allows easy session switching | Tabs above chat -- limited horizontal space; Dropdown -- hides session list |
| Enter to send, Shift+Enter for newline | Industry standard for chat applications; matches user expectations | Send button only -- slower for keyboard users |
| Mobile sidebar as overlay (Sheet) | Preserves full chat width on mobile; clean transition | Persistent mini sidebar -- takes too much mobile screen space |
| In-memory sessions (no persistence) | PRD specifies in-memory; simplest implementation for MVP | LocalStorage -- adds complexity; Database -- overkill for MVP |
| Hardcoded model list | MVP scope; no API endpoint for model discovery | Fetch from OpenRouter API -- adds complexity, rate limits, loading state |
| Toast for errors (not inline) | Errors are transient; toast doesn't break layout | Inline error banners -- persistent, takes space; Modal -- too disruptive |
| No dark mode toggle for MVP | Speed to market; shadcn supports it but adds UI surface area | Include toggle -- can be added in Phase 2 with minimal effort |

---

## 12. Next Steps

1. [ ] Initialize Next.js 15 project with Tailwind CSS and shadcn/ui
2. [ ] Install required shadcn/ui components (button, textarea, select, scroll-area, alert-dialog, sheet, sonner)
3. [ ] Build layout structure (sidebar + chat area + input bar)
4. [ ] Implement ChatBubble and TypingIndicator components
5. [ ] Wire up ChatInput with Enter/Shift+Enter behavior
6. [ ] Connect to API routes for session CRUD and chat
7. [ ] Add ModelSelector dropdown
8. [ ] Implement mobile responsive layout with Sheet sidebar
9. [ ] Add empty state and suggested prompts
10. [ ] Run accessibility audit (keyboard navigation, screen reader, contrast)
11. [ ] Test across breakpoints (mobile, tablet, desktop)
12. [ ] Optional Phase 2: Dark mode toggle, message streaming, markdown rendering

---

## References

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/icons)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Sonner Toast Library](https://sonner.emilkowal.dev/)
