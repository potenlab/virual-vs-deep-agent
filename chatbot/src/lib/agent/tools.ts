import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Bash } from "just-bash";
import { db } from "@/lib/db";
import { documents, todos, events } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { VirtualFs } from "@/lib/fs/virtual-fs";

export interface ToolContext {
  projectId: string;
  fs: VirtualFs;
  bash: Bash;
}

export function createTools(ctx: ToolContext) {
  // 1. execute_command — run bash commands in the virtual FS
  const executeCommand = tool(
    async ({ command }) => {
      try {
        const result = await ctx.bash.exec(command);
        if (result.exitCode !== 0) {
          return `Error (exit ${result.exitCode}):\n${result.stderr || result.stdout}`;
        }
        return result.stdout || "(no output)";
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        return `Command failed: ${message}`;
      }
    },
    {
      name: "execute_command",
      description:
        "Execute a bash command in the virtual filesystem. Supports ls, cat, find, grep, head, tail, wc.",
      schema: z.object({
        command: z.string().describe("The bash command to execute"),
      }),
    },
  );

  // 2. create_task
  const createTask = tool(
    async ({ title, description, priority, assignee, due_date, tags }) => {
      const [row] = await db
        .insert(todos)
        .values({
          projectId: ctx.projectId,
          title,
          description: description ?? null,
          priority: priority ?? "medium",
          assignee: assignee ?? null,
          dueDate: due_date ? new Date(due_date) : null,
          tags: tags ?? [],
        })
        .returning();
      return `Task created: "${row.title}" (ID: ${row.id}, Priority: ${row.priority})`;
    },
    {
      name: "create_task",
      description: "Create a new task/todo in the project.",
      schema: z.object({
        title: z.string().describe("Task title"),
        description: z.string().optional().describe("Task description"),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .optional(),
        assignee: z.string().optional(),
        due_date: z.string().optional().describe("ISO 8601 date"),
        tags: z.array(z.string()).optional(),
      }),
    },
  );

  // 3. update_task
  const updateTask = tool(
    async ({
      task_id,
      status,
      title,
      description,
      priority,
      assignee,
      due_date,
    }) => {
      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (title) updates.title = title;
      if (description) updates.description = description;
      if (priority) updates.priority = priority;
      if (assignee) updates.assignee = assignee;
      if (due_date) updates.dueDate = new Date(due_date);
      if (Object.keys(updates).length === 0) return "No updates provided.";

      const [row] = await db
        .update(todos)
        .set(updates)
        .where(
          and(eq(todos.id, task_id), eq(todos.projectId, ctx.projectId)),
        )
        .returning();
      if (!row)
        return `Task not found: ${task_id}`;
      return `Task updated: "${row.title}" → status: ${row.status}, priority: ${row.priority}`;
    },
    {
      name: "update_task",
      description:
        "Update an existing task's status, priority, assignee, or due date.",
      schema: z.object({
        task_id: z.string().describe("Task UUID"),
        status: z
          .enum(["todo", "in_progress", "done", "cancelled"])
          .optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .optional(),
        assignee: z.string().optional(),
        due_date: z.string().optional(),
      }),
    },
  );

  // 4. create_event
  const createEvent = tool(
    async ({
      title,
      description: _description,
      start_time,
      end_time,
      location,
      attendees,
    }) => {
      const [row] = await db
        .insert(events)
        .values({
          projectId: ctx.projectId,
          title,
          startTime: new Date(start_time),
          endTime: end_time ? new Date(end_time) : null,
          location: location ?? null,
          attendees: attendees ?? [],
        })
        .returning();
      return `Event created: "${row.title}" on ${row.startTime.toISOString()}`;
    },
    {
      name: "create_event",
      description: "Create a new calendar event.",
      schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        start_time: z.string().describe("ISO 8601"),
        end_time: z.string().optional(),
        location: z.string().optional(),
        attendees: z.array(z.string()).optional(),
      }),
    },
  );

  // 5. search_docs — PostgreSQL full-text search
  const searchDocs = tool(
    async ({ query, limit }) => {
      const results = await db.execute(
        sql`SELECT path, name,
              ts_headline('english', coalesce(content, ''), plainto_tsquery('english', ${query}),
                'StartSel=**, StopSel=**, MaxWords=50, MinWords=20') as snippet,
              ts_rank(to_tsvector('english', coalesce(content, '')), plainto_tsquery('english', ${query})) as rank
            FROM documents
            WHERE project_id = ${ctx.projectId}
              AND type = 'file'
              AND to_tsvector('english', coalesce(content, '')) @@ plainto_tsquery('english', ${query})
            ORDER BY rank DESC
            LIMIT ${limit ?? 10}`,
      );
      if (
        !results.rows ||
        results.rows.length === 0
      )
        return "No matching documents found.";
      return results.rows
        .map(
          (r: Record<string, unknown>) =>
            `**${r.path}** (rank: ${Number(r.rank).toFixed(3)})\n${r.snippet}`,
        )
        .join("\n\n---\n\n");
    },
    {
      name: "search_docs",
      description:
        "Full-text search across all project documents. Returns matching files with snippets.",
      schema: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
    },
  );

  return [executeCommand, createTask, updateTask, createEvent, searchDocs];
}
