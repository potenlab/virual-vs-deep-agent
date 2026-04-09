import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import type { VirtualFs } from "@/lib/fs/virtual-fs";

export interface ToolEvent {
  type: "tool_start" | "tool_end";
  tool: string;
  input?: string;
  output?: string;
}

export interface ToolContext {
  projectId: string;
  fs: VirtualFs;
  onToolCall?: (event: ToolEvent) => void;
}

function parseCommand(input: string): { cmd: string; args: string[] } {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) { tokens.push(current); current = ""; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return { cmd: tokens[0] ?? "", args: tokens.slice(1) };
}

async function runVfsCommand(fs: VirtualFs, command: string): Promise<string> {
  const { cmd, args } = parseCommand(command.trim());
  switch (cmd) {
    case "ls": {
      const target = args[0] || "/";
      console.log(`[ls] target="${target}", treeBuilder.allFiles=`, fs.treeBuilder.allFiles());
      console.log(`[ls] treeBuilder.readdir("${target}")=`, fs.treeBuilder.readdir(target));
      const entries = await fs.readdir(target);
      console.log(`[ls] entries=`, entries);
      if (entries.length === 0) return "(empty directory)";
      const lines: string[] = [];
      for (const name of entries) {
        const fullPath = target === "/" ? `/${name}` : `${target}/${name}`;
        try {
          const s = await fs.stat(fullPath);
          lines.push(s.isDirectory ? `${name}/` : name);
        } catch { lines.push(name); }
      }
      return lines.join("\n");
    }
    case "cat": {
      if (!args[0]) return "Usage: cat <file>";
      return (await fs.readFile(args[0])) || "(empty file)";
    }
    case "find": {
      const basePath = args[0] || "/";
      let pattern = "*";
      const ni = args.indexOf("-name");
      if (ni !== -1 && args[ni + 1]) pattern = args[ni + 1];
      const results = fs.treeBuilder.find(pattern, basePath);
      return results.length > 0 ? results.join("\n") : "No files found.";
    }
    case "grep": {
      const isR = args.includes("-r") || args.includes("-R");
      const filtered = args.filter((a) => a !== "-r" && a !== "-R" && a !== "-i");
      const pattern = filtered[0];
      if (!pattern) return "Usage: grep [-r] <pattern> [path]";
      const matches = await fs.grep.grep(pattern, {
        caseInsensitive: args.includes("-i"),
        filePattern: isR ? undefined : (filtered[1] || "/"),
        maxResults: 50,
      });
      if (matches.length === 0) return "No matches found.";
      return matches.map((m) => `${m.path}:${m.line}: ${m.content}`).join("\n");
    }
    case "head": {
      if (!args[0]) return "Usage: head <file>";
      const content = await fs.readFile(args[0]);
      const n = parseInt(args[args.indexOf("-n") + 1]) || 10;
      return content.split("\n").slice(0, n).join("\n");
    }
    case "tail": {
      if (!args[0]) return "Usage: tail <file>";
      const content = await fs.readFile(args[0]);
      const n = parseInt(args[args.indexOf("-n") + 1]) || 10;
      return content.split("\n").slice(-n).join("\n");
    }
    case "wc": {
      if (!args[0]) return "Usage: wc <file>";
      const content = await fs.readFile(args[0]);
      return `${content.split("\n").length} ${content.split(/\s+/).filter(Boolean).length} ${content.length} ${args[0]}`;
    }
    case "tree": {
      const base = args[0] || "/";
      const all = fs.treeBuilder.find("*", base);
      return all.length > 0 ? all.join("\n") : "(empty)";
    }
    case "pwd":
      return "/";
    default:
      return `Unknown command: ${cmd}. Available: ls, cat, find, grep, head, tail, wc, tree, pwd`;
  }
}

export function createTools(ctx: ToolContext) {
  const emit = ctx.onToolCall ?? (() => {});

  const executeCommand = tool(
    async ({ command }) => {
      emit({ type: "tool_start", tool: "run_vfs", input: command });
      try {
        const result = await runVfsCommand(ctx.fs, command);
        emit({ type: "tool_end", tool: "run_vfs", output: result.slice(0, 100) });
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: "tool_end", tool: "run_vfs", output: `Error: ${msg}` });
        return `Error: ${msg}`;
      }
    },
    {
      name: "run_vfs",
      description: "Run a command in the virtual filesystem to browse and read uploaded documents. Supports: ls, cat, find, grep, head, tail, wc, tree, pwd. Example: ls /uploads, cat /uploads/file.pdf",
      schema: z.object({
        command: z.string().describe("The command to execute"),
      }),
    },
  );

  const searchDocs = tool(
    async ({ query, limit }) => {
      emit({ type: "tool_start", tool: "search_docs", input: query });
      const results = await db.execute(
        sql`SELECT path, name,
              ts_headline('english', coalesce(content, ''), plainto_tsquery('english', ${query}),
                'StartSel=**, StopSel=**, MaxWords=50, MinWords=20') as snippet,
              ts_rank(to_tsvector('english', coalesce(content, '')), plainto_tsquery('english', ${query})) as rank
            FROM documents WHERE type = 'file'
              AND to_tsvector('english', coalesce(content, '')) @@ plainto_tsquery('english', ${query})
            ORDER BY rank DESC LIMIT ${limit ?? 10}`,
      );
      if (!results.rows || results.rows.length === 0) {
        emit({ type: "tool_end", tool: "search_docs", output: "No matches" });
        return "No matching documents found.";
      }
      const output = results.rows
        .map((r: Record<string, unknown>) => `**${r.path}** (rank: ${Number(r.rank).toFixed(3)})\n${r.snippet}`)
        .join("\n\n---\n\n");
      emit({ type: "tool_end", tool: "search_docs", output: `${results.rows.length} results` });
      return output;
    },
    {
      name: "search_docs",
      description: "Full-text search across all documents.",
      schema: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
    },
  );

  return [executeCommand, searchDocs];
}
