import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/lib/db";
import { todos, events } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { VirtualFs } from "@/lib/fs/virtual-fs";

export interface ToolContext {
  projectId: string;
  fs: VirtualFs;
}

/**
 * Parse a simple command string into command name and args.
 * Handles quoted strings.
 */
function parseCommand(input: string): { cmd: string; args: string[] } {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  return { cmd: tokens[0] ?? "", args: tokens.slice(1) };
}

export function createTools(ctx: ToolContext) {
  // 1. execute_command — runs virtual FS commands directly (no just-bash)
  const executeCommand = tool(
    async ({ command }) => {
      try {
        const { cmd, args } = parseCommand(command.trim());

        switch (cmd) {
          case "ls": {
            const target = args[0] || "/";
            const entries = await ctx.fs.readdir(target);
            if (entries.length === 0) return "(empty directory)";
            // Show type indicator
            const lines: string[] = [];
            for (const name of entries) {
              const fullPath = target === "/" ? `/${name}` : `${target}/${name}`;
              try {
                const s = await ctx.fs.stat(fullPath);
                lines.push(s.isDirectory ? `${name}/` : name);
              } catch {
                lines.push(name);
              }
            }
            return lines.join("\n");
          }

          case "cat": {
            if (!args[0]) return "Usage: cat <file>";
            const content = await ctx.fs.readFile(args[0]);
            return content || "(empty file)";
          }

          case "find": {
            const basePath = args[0] || "/";
            let pattern = "*";
            const nameIdx = args.indexOf("-name");
            if (nameIdx !== -1 && args[nameIdx + 1]) {
              pattern = args[nameIdx + 1];
            }
            const results = ctx.fs.treeBuilder.find(pattern, basePath);
            return results.length > 0 ? results.join("\n") : "No files found.";
          }

          case "grep": {
            const isRecursive = args.includes("-r") || args.includes("-R");
            const filteredArgs = args.filter((a) => a !== "-r" && a !== "-R");
            const pattern = filteredArgs[0];
            const searchPath = filteredArgs[1] || "/";
            if (!pattern) return "Usage: grep [-r] <pattern> [path]";

            const matches = await ctx.fs.grep.grep(pattern, {
              caseInsensitive: args.includes("-i"),
              filePattern: isRecursive ? undefined : searchPath,
              maxResults: 50,
            });

            if (matches.length === 0) return "No matches found.";
            return matches
              .map((m) => `${m.path}:${m.line}: ${m.content}`)
              .join("\n");
          }

          case "head": {
            if (!args[0]) return "Usage: head <file>";
            const content = await ctx.fs.readFile(args[0]);
            const n = parseInt(args[args.indexOf("-n") + 1]) || 10;
            return content.split("\n").slice(0, n).join("\n");
          }

          case "tail": {
            if (!args[0]) return "Usage: tail <file>";
            const content = await ctx.fs.readFile(args[0]);
            const n = parseInt(args[args.indexOf("-n") + 1]) || 10;
            const lines = content.split("\n");
            return lines.slice(-n).join("\n");
          }

          case "wc": {
            if (!args[0]) return "Usage: wc <file>";
            const content = await ctx.fs.readFile(args[0]);
            const lines = content.split("\n").length;
            const words = content.split(/\s+/).filter(Boolean).length;
            const chars = content.length;
            return `${lines} ${words} ${chars} ${args[0]}`;
          }

          case "tree": {
            const base = args[0] || "/";
            const allFiles = ctx.fs.treeBuilder.find("*", base);
            if (allFiles.length === 0) return "(empty)";
            return allFiles.join("\n");
          }

          case "pwd":
            return "/";

          default:
            return `Unknown command: ${cmd}. Available: ls, cat, find, grep, head, tail, wc, tree, pwd`;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
    {
      name: "execute_command",
      description:
        "Execute a command in the virtual filesystem. Supports: ls, cat, find, grep, head, tail, wc, tree, pwd. Example: ls /docs, cat /docs/README.md, grep -r TODO /src",
      schema: z.object({
        command: z
          .string()
          .describe("The command to execute (e.g., 'ls /docs', 'cat /src/index.ts')"),
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
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignee: z.string().optional(),
        due_date: z.string().optional().describe("ISO 8601 date"),
        tags: z.array(z.string()).optional(),
      }),
    },
  );

  // 3. update_task
  const updateTask = tool(
    async ({ task_id, status, title, description, priority, assignee, due_date }) => {
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
        .where(and(eq(todos.id, task_id), eq(todos.projectId, ctx.projectId)))
        .returning();
      if (!row) return `Task not found: ${task_id}`;
      return `Task updated: "${row.title}" → status: ${row.status}, priority: ${row.priority}`;
    },
    {
      name: "update_task",
      description: "Update an existing task's status, priority, assignee, or due date.",
      schema: z.object({
        task_id: z.string().describe("Task UUID"),
        status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignee: z.string().optional(),
        due_date: z.string().optional(),
      }),
    },
  );

  // 4. create_event
  const createEvent = tool(
    async ({ title, start_time, end_time, location, attendees }) => {
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
      if (!results.rows || results.rows.length === 0) return "No matching documents found.";
      return results.rows
        .map(
          (r: Record<string, unknown>) =>
            `**${r.path}** (rank: ${Number(r.rank).toFixed(3)})\n${r.snippet}`,
        )
        .join("\n\n---\n\n");
    },
    {
      name: "search_docs",
      description: "Full-text search across all project documents. Returns matching files with snippets.",
      schema: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
    },
  );

  return [executeCommand, createTask, updateTask, createEvent, searchDocs];
}
