import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { TreeBuilder } from "./tree-builder";
import { CacheLayer } from "./cache-layer";
import { GrepOptimizer } from "./grep-optimizer";
import { normalizePath, dirname, basename } from "./path-utils";

export class VirtualFs {
  private tree: TreeBuilder;
  private cache: CacheLayer<string>;
  private grepOptimizer: GrepOptimizer;

  constructor(cacheTtlMs = 30_000) {
    this.tree = new TreeBuilder();
    this.cache = new CacheLayer<string>(cacheTtlMs);
    this.grepOptimizer = new GrepOptimizer(this.cache);
  }

  async initialize(): Promise<void> {
    await this.tree.bootstrap();
  }

  async readFile(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const node = this.tree.stat(normalized);
    if (!node) throw new Error(`ENOENT: no such file '${normalized}'`);
    if (node.type === "directory") throw new Error(`EISDIR: '${normalized}'`);

    const cached = this.cache.get(`file:${normalized}`);
    if (cached !== undefined) return cached;

    const rows = await db
      .select({ content: documents.content, chunkIndex: documents.chunkIndex })
      .from(documents)
      .where(eq(documents.path, normalized))
      .orderBy(asc(documents.chunkIndex));

    const content = rows.map((r) => r.content ?? "").join("");
    this.cache.set(`file:${normalized}`, content);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const normalized = normalizePath(path);
    const parentDir = dirname(normalized);
    const fileName = basename(normalized);

    if (!this.tree.exists(parentDir)) {
      await this.mkdir(parentDir, { recursive: true });
    }

    const existing = await db.select({ id: documents.id }).from(documents)
      .where(eq(documents.path, normalized)).limit(1);

    if (existing.length > 0) {
      await db.update(documents)
        .set({ content, sizeBytes: Buffer.byteLength(content, "utf-8"), updatedAt: new Date() })
        .where(eq(documents.path, normalized));
    } else {
      await db.insert(documents).values({
        path: normalized, name: fileName, type: "file",
        content, sizeBytes: Buffer.byteLength(content, "utf-8"),
      });
    }

    this.tree.addOrUpdate({
      path: normalized, name: fileName, type: "file",
      size: Buffer.byteLength(content, "utf-8"), updatedAt: new Date().toISOString(),
    });
    this.cache.set(`file:${normalized}`, content);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const normalized = normalizePath(path);
    if (this.tree.exists(normalized)) return;

    if (options?.recursive) {
      const parts = normalized.split("/").filter(Boolean);
      let current = "";
      for (const part of parts) {
        current += "/" + part;
        if (!this.tree.exists(current)) await this.createDir(current, part);
      }
    } else {
      const parent = dirname(normalized);
      if (!this.tree.exists(parent)) throw new Error(`ENOENT: parent '${parent}' not found`);
      await this.createDir(normalized, basename(normalized));
    }
  }

  async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    const normalized = normalizePath(path);
    const node = this.tree.stat(normalized);
    if (!node) { if (options?.force) return; throw new Error(`ENOENT: '${normalized}' not found`); }
    if (node.type === "directory" && !options?.recursive) throw new Error(`EISDIR: '${normalized}' is a directory`);

    if (node.type === "directory") {
      await db.execute(sql`DELETE FROM documents WHERE path = ${normalized} OR path LIKE ${normalized + "/%"}`);
    } else {
      await db.delete(documents).where(eq(documents.path, normalized));
    }
    this.tree.remove(normalized);
    this.cache.delete(`file:${normalized}`);
  }

  async stat(path: string) {
    const normalized = normalizePath(path);
    const node = this.tree.stat(normalized);
    if (!node) throw new Error(`ENOENT: '${normalized}' not found`);
    const mtime = new Date(node.updatedAt);
    return { isFile: node.type === "file", isDirectory: node.type === "directory", isSymbolicLink: false, size: node.size, mtime, birthtime: mtime };
  }

  async readdir(path: string): Promise<string[]> {
    const normalized = normalizePath(path);
    const node = this.tree.stat(normalized);
    if (!node) throw new Error(`ENOENT: '${normalized}' not found`);
    if (node.type !== "directory") throw new Error(`ENOTDIR: '${normalized}'`);
    return this.tree.readdir(normalized);
  }

  async exists(path: string): Promise<boolean> { return this.tree.exists(normalizePath(path)); }
  async symlink(): Promise<void> { throw new Error("Symlinks not supported"); }
  async readlink(): Promise<string> { throw new Error("Symlinks not supported"); }
  resolvePath(path: string): string { return normalizePath(path); }

  get grep() { return this.grepOptimizer; }
  get treeBuilder() { return this.tree; }
  clearCache() { this.cache.clear(); }

  private async createDir(path: string, name: string): Promise<void> {
    await db.insert(documents).values({ path, name, type: "directory", content: null, sizeBytes: 0 }).onConflictDoNothing();
    this.tree.addOrUpdate({ path, name, type: "directory", size: 0, updatedAt: new Date().toISOString() });
  }
}
