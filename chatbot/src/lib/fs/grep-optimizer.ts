import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, ilike, and, inArray } from "drizzle-orm";
import { CacheLayer } from "./cache-layer";
import type { GrepMatch } from "@/types";

export interface GrepOptions {
  caseInsensitive?: boolean;
  maxResults?: number;
  filePattern?: string;
}

export class GrepOptimizer {
  constructor(private cache: CacheLayer<string>) {}

  async grep(pattern: string, options: GrepOptions = {}): Promise<GrepMatch[]> {
    const { caseInsensitive = false, maxResults = 100, filePattern } = options;

    const candidates = await this.coarseFilter(pattern, filePattern);
    await this.prefetchContent(candidates.map((c) => c.path));

    const regex = new RegExp(pattern, caseInsensitive ? "gi" : "g");
    const results: GrepMatch[] = [];

    for (const candidate of candidates) {
      const content = this.cache.get(`file:${candidate.path}`);
      if (!content) continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push({ path: candidate.path, line: i + 1, content: lines[i] });
          if (results.length >= maxResults) return results;
        }
        regex.lastIndex = 0;
      }
    }
    return results;
  }

  private async coarseFilter(pattern: string, filePattern?: string) {
    const searchTerm = this.extractLiteral(pattern);
    const conditions = [
      eq(documents.type, "file"),
      ilike(documents.content, `%${searchTerm}%`),
    ];
    if (filePattern) {
      conditions.push(ilike(documents.name, filePattern.replace(/\*/g, "%").replace(/\?/g, "_")));
    }
    return await db.select({ id: documents.id, path: documents.path })
      .from(documents).where(and(...conditions)).limit(200);
  }

  private async prefetchContent(paths: string[]) {
    const uncached = paths.filter((p) => !this.cache.has(`file:${p}`));
    if (uncached.length === 0) return;
    const rows = await db.select({ path: documents.path, content: documents.content })
      .from(documents).where(inArray(documents.path, uncached));
    for (const row of rows) {
      if (row.content) this.cache.set(`file:${row.path}`, row.content);
    }
  }

  private extractLiteral(pattern: string): string {
    return pattern.replace(/[\\^$.*+?()[\]{}|]/g, " ").replace(/\s+/g, " ").trim()
      .split(" ").filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? pattern;
  }
}
