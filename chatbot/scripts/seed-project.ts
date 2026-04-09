import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import {
  projects,
  documents,
  todos,
  events,
} from "../src/lib/db/schema";

const OWNER_ID = "00000000-0000-0000-0000-000000000001";
const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const db = drizzle(pool);

  console.log("Seeding demo project...");

  // ── 1. Project ──────────────────────────────────────────────────────
  const [project] = await db
    .insert(projects)
    .values({
      id: PROJECT_ID,
      name: "PotenLab MVP",
      slug: "potenlab-mvp",
      description: "Project management tool with AI assistant",
      ownerId: OWNER_ID,
    })
    .onConflictDoNothing()
    .returning();

  // If the project already existed, fetch it
  const proj =
    project ??
    (
      await db
        .select()
        .from(projects)
        .where(
          // slug is unique, safe to use for lookup
          eq(projects.slug, "potenlab-mvp"),
        )
    )[0];

  const projectId = proj.id;
  console.log(`  Project: ${proj.name} (${projectId})`);

  // ── 2. Documents (virtual filesystem) ───────────────────────────────
  const docs = [
    { path: "/", name: "/", type: "directory" as const, content: null },
    { path: "/docs", name: "docs", type: "directory" as const, content: null },
    { path: "/src", name: "src", type: "directory" as const, content: null },
    {
      path: "/src/components",
      name: "components",
      type: "directory" as const,
      content: null,
    },
    {
      path: "/docs/README.md",
      name: "README.md",
      type: "file" as const,
      content: `# PotenLab MVP

A project management tool powered by an AI assistant.

## Getting Started

1. Install dependencies: \`pnpm install\`
2. Run migrations: \`pnpm db:migrate\`
3. Start dev server: \`pnpm dev\`

## Features

- Virtual filesystem for project documents
- AI-powered chat assistant
- Todo tracking with priorities & due dates
- Calendar events
`,
    },
    {
      path: "/docs/architecture.md",
      name: "architecture.md",
      type: "file" as const,
      content: `# Architecture

## Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: LangChain with Anthropic & OpenAI providers
- **Styling**: Tailwind CSS + shadcn/ui

## Key Modules

| Module | Description |
|--------|-------------|
| Virtual FS | Tree-structured document store |
| DeepAgents | Autonomous AI agent orchestration |
| Chat UI | Real-time streaming chat interface |
`,
    },
    {
      path: "/src/index.ts",
      name: "index.ts",
      type: "file" as const,
      content: `export { db } from "./lib/db";
export { projects, documents, todos, events } from "./lib/db/schema";
`,
    },
    {
      path: "/src/components/TaskList.tsx",
      name: "TaskList.tsx",
      type: "file" as const,
      content: `"use client";

import { useState } from "react";

interface Task {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-2">
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All</option>
        <option value="todo">Todo</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>
      <ul>
        {filtered.map((t) => (
          <li key={t.id}>
            [{t.priority}] {t.title} — {t.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
`,
    },
  ];

  for (const doc of docs) {
    await db
      .insert(documents)
      .values({
        projectId,
        path: doc.path,
        name: doc.name,
        type: doc.type,
        content: doc.content,
        sizeBytes: doc.content ? Buffer.byteLength(doc.content, "utf8") : 0,
      })
      .onConflictDoNothing();
  }
  console.log(`  Documents: ${docs.length} entries`);

  // ── 3. Todos ────────────────────────────────────────────────────────
  const todoItems = [
    {
      title: "Set up database schema",
      status: "done",
      priority: "high",
      dueDate: null,
    },
    {
      title: "Implement Virtual FS",
      status: "in_progress",
      priority: "high",
      dueDate: new Date("2026-04-10T00:00:00Z"),
    },
    {
      title: "Connect DeepAgents",
      status: "todo",
      priority: "high",
      dueDate: new Date("2026-04-13T00:00:00Z"),
    },
    {
      title: "Build chat UI",
      status: "todo",
      priority: "medium",
      dueDate: new Date("2026-04-18T00:00:00Z"),
    },
    {
      title: "Write integration tests",
      status: "todo",
      priority: "medium",
      dueDate: new Date("2026-04-20T00:00:00Z"),
    },
  ];

  for (const item of todoItems) {
    await db
      .insert(todos)
      .values({
        projectId,
        title: item.title,
        status: item.status,
        priority: item.priority,
        dueDate: item.dueDate,
      })
      .onConflictDoNothing();
  }
  console.log(`  Todos: ${todoItems.length} entries`);

  // ── 4. Events ───────────────────────────────────────────────────────
  const eventItems = [
    {
      title: "Sprint Planning",
      startTime: new Date("2026-04-09T09:00:00Z"),
      endTime: new Date("2026-04-09T10:00:00Z"),
      location: null,
    },
    {
      title: "MVP Demo",
      startTime: new Date("2026-04-22T14:00:00Z"),
      endTime: new Date("2026-04-22T15:00:00Z"),
      location: "Zoom",
    },
  ];

  for (const ev of eventItems) {
    await db
      .insert(events)
      .values({
        projectId,
        title: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
        location: ev.location,
      })
      .onConflictDoNothing();
  }
  console.log(`  Events: ${eventItems.length} entries`);

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
