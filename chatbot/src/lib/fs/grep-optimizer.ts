/**
 * GrepOptimizer (F3) — Optimized Search
 *
 * 1. Coarse filter: PostgreSQL ILIKE on documents.content to find candidate files
 * 2. Cache: Bulk prefetch matched file contents into CacheLayer
 * 3. Fine filter: In-memory regex for precise line-level matches
 */

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
  constructor(
    private projectId: string,
    private cache: CacheLayer<string>,
  ) {}

  async grep(pattern: string, options: GrepOptions = {}): Promise<GrepMatch[]> {
    const { caseInsensitive = false, maxResults = 100, filePattern } = options;

    // Step 1: Coarse filter — PostgreSQL ILIKE
    const candidates = await this.coarseFilter(pattern, filePattern);

    // Step 2: Bulk prefetch into cache
    await this.prefetchContent(candidates.map((c) => c.path));

    // Step 3: Fine filter — in-memory regex
    const regex = new RegExp(pattern, caseInsensitive ? "gi" : "g");
    const results: GrepMatch[] = [];

    for (const candidate of candidates) {
      const content = this.cache.get(`file:${candidate.path}`);
      if (!content) continue;

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push({
            path: candidate.path,
            line: i + 1,
            content: lines[i],
          });
          if (results.length >= maxResults) return results;
        }
        // Reset lastIndex for stateful regexes (global flag)
        regex.lastIndex = 0;
      }
    }

    return results;
  }

  private async coarseFilter(pattern: string, filePattern?: string) {
    const searchTerm = this.extractLiteral(pattern);

    const conditions = [
      eq(documents.projectId, this.projectId),
      eq(documents.type, "file"),
      ilike(documents.content, `%${searchTerm}%`),
    ];

    if (filePattern) {
      const sqlPattern = filePattern.replace(/\*/g, "%").replace(/\?/g, "_");
      conditions.push(ilike(documents.name, sqlPattern));
    }

    const rows = await db
      .select({ id: documents.id, path: documents.path })
      .from(documents)
      .where(and(...conditions))
      .limit(200);

    return rows;
  }

  private async prefetchContent(paths: string[]) {
    const uncached = paths.filter((p) => !this.cache.has(`file:${p}`));
    if (uncached.length === 0) return;

    // Batch fetch all uncached files in a single query
    const rows = await db
      .select({ path: documents.path, content: documents.content })
      .from(documents)
      .where(
        and(
          eq(documents.projectId, this.projectId),
          inArray(documents.path, uncached),
        ),
      );

    for (const row of rows) {
      if (row.content) {
        this.cache.set(`file:${row.path}`, row.content);
      }
    }
  }

  /**
   * Extract the longest literal substring from a regex pattern.
   * Used as the ILIKE search term for the coarse DB filter.
   */
  private extractLiteral(pattern: string): string {
    const cleaned = pattern
      .replace(/[\\^$.*+?()[\]{}|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const longest = cleaned
      .split(" ")
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];

    return longest ?? pattern;
  }
}
