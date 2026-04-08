import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { TreeBuilder } from "./tree-builder";
import { CacheLayer } from "./cache-layer";
import { GrepOptimizer } from "./grep-optimizer";
import { normalizePath, dirname, basename } from "./path-utils";

export class VirtualFs {
  private tree: TreeBuilder;
  private cache: CacheLayer<string>;
  private grepOptimizer: GrepOptimizer;

  constructor(
    private projectId: string,
    cacheTtlMs = 30_000,
  ) {
    this.tree = new TreeBuilder(projectId);
    this.cache = new CacheLayer<string>(cacheTtlMs);
    this.grepOptimizer = new GrepOptimizer(projectId, this.cache);
  }

  async initialize(): Promise<void> {
    await this.tree.bootstrap();
  }

  // --- IFileSystem methods ---

  async readFile(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const node = this.tree.stat(normalized);
    if (!node) throw new Error(`ENOENT: no such file '${normalized}'`);
    if (node.type === "directory") throw new Error(`EISDIR: '${normalized}'`);

    // Check cache
    const cached = this.cache.get(`file:${normalized}`);
    if (cached !== undefined) return cached;

    // Fetch from DB (with chunk reassembly F2)
    const rows = await db
      .select({
        content: documents.content,
        chunkIndex: documents.chunkIndex,
      })
      .from(documents)
      .where(
        and(
          eq(documents.projectId, this.projectId),
          eq(documents.path, normalized),
        ),
      )
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

    // Upsert document
    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.projectId, this.projectId),
          eq(documents.path, normalized),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(documents)
        .set({
          content,
          sizeBytes: Buffer.byteLength(content, "utf-8"),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(documents.projectId, this.projectId),
            eq(documents.path, normalized),
          ),
        );
    } else {
      await db.insert(documents).values({
        projectId: this.projectId,
        path: normalized,
        name: fileName,
        type: "file",
        content,
        sizeBytes: Buffer.byteLength(content, "utf-8"),
      });
    }

    // Update tree and cache
    this.tree.addOrUpdate({
      path: normalized,
      name: fileName,
      type: "file",
      size: Buffer.byteLength(content, "utf-8"),
      updatedAt: new Date().toISOString(),
    });
    this.cache.set(`file:${normalized}`, content);
  }

  async mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const normalized = normalizePath(path);
    if (this.tree.exists(normalized)) return;

    if (options?.recursive) {
      const parts = normalized.split("/").filter(Boolean);
      let current = "";
      for (const part of parts) {
        current += "/" + part;
        if (!this.tree.exists(current)) {
          await this.createDir(current, part);
        }
      }
    } else {
      const parent = dirname(normalized);
      if (!this.tree.exists(parent))
        throw new Error(`ENOENT: parent '${parent}' not found`);
      await this.createDir(normalized, basename(normalized));
    }
  }

  async rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void> {
    const normalized = normalizePath(path);
    const node = this.tree.stat(normalized);
    if (!node) {
      if (options?.force) return;
      throw new Error(`ENOENT: '${normalized}' not found`);
    }
    if (node.type === "directory" && !options?.recursive) {
      throw new Error(`EISDIR: '${normalized}' is a directory`);
    }

    if (node.type === "directory") {
      // Delete the directory itself and all descendants using LIKE
      await db.execute(
        sql`DELETE FROM documents WHERE project_id = ${this.projectId} AND (path = ${normalized} OR path LIKE ${normalized + "/%"})`,
      );
    } else {
      await db
        .delete(documents)
        .where(
          and(
            eq(documents.projectId, this.projectId),
            eq(documents.path, normalized),
          ),
        );
    }

    this.tree.remove(normalized);
    this.cache.delete(`file:${normalized}`);
  }

  async stat(
    path: string,
  ): Promise<{
    isFile: boolean;
    isDirectory: boolean;
    size: number;
    mtime: Date;
  }> {
    const normalized = normalizePath(path);
    const node = this.tree.stat(normalized);
    if (!node) throw new Error(`ENOENT: '${normalized}' not found`);
    const mtime = new Date(node.updatedAt);
    return {
      isFile: node.type === "file",
      isDirectory: node.type === "directory",
      size: node.size,
      mtime,
    };
  }

  async readdir(path: string): Promise<string[]> {
    const normalized = normalizePath(path);
    const node = this.tree.stat(normalized);
    if (!node) throw new Error(`ENOENT: '${normalized}' not found`);
    if (node.type !== "directory") throw new Error(`ENOTDIR: '${normalized}'`);
    return this.tree.readdir(normalized);
  }

  async exists(path: string): Promise<boolean> {
    return this.tree.exists(normalizePath(path));
  }

  async symlink(): Promise<void> {
    throw new Error("Symlinks not supported");
  }

  async readlink(): Promise<void> {
    throw new Error("Symlinks not supported");
  }

  resolvePath(path: string): string {
    return normalizePath(path);
  }

  // --- Extended ---
  get grep() {
    return this.grepOptimizer;
  }

  get treeBuilder() {
    return this.tree;
  }

  clearCache() {
    this.cache.clear();
  }

  // --- Helpers ---
  private async createDir(path: string, name: string): Promise<void> {
    await db
      .insert(documents)
      .values({
        projectId: this.projectId,
        path,
        name,
        type: "directory",
        content: null,
        sizeBytes: 0,
      })
      .onConflictDoNothing();

    this.tree.addOrUpdate({
      path,
      name,
      type: "directory",
      size: 0,
      updatedAt: new Date().toISOString(),
    });
  }
}
