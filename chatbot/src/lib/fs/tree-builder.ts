import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { normalizePath, dirname } from "./path-utils";
import type { TreeNode } from "@/types";

export class TreeBuilder {
  /** path → TreeNode */
  private nodes = new Map<string, TreeNode>();
  /** parent path → Set of child paths */
  private children = new Map<string, Set<string>>();
  private initialized = false;

  constructor(private projectId: string) {}

  async bootstrap(): Promise<void> {
    const rows = await db
      .select({
        path: documents.path,
        name: documents.name,
        type: documents.type,
        sizeBytes: documents.sizeBytes,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.projectId, this.projectId))
      .orderBy(asc(documents.path));

    this.nodes.clear();
    this.children.clear();

    // Ensure root exists
    this.addNode({
      path: "/",
      name: "/",
      type: "directory",
      size: 0,
      updatedAt: new Date().toISOString(),
    });

    for (const row of rows) {
      this.addNode({
        path: normalizePath(row.path),
        name: row.name,
        type: row.type as "file" | "directory",
        size: row.sizeBytes ?? 0,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      });
    }

    this.initialized = true;
  }

  private addNode(node: TreeNode): void {
    this.nodes.set(node.path, node);
    const parent = dirname(node.path);
    if (parent !== node.path) {
      let childSet = this.children.get(parent);
      if (!childSet) {
        childSet = new Set();
        this.children.set(parent, childSet);
      }
      childSet.add(node.path);
    }
  }

  private ensureInit(): void {
    if (!this.initialized)
      throw new Error(
        "TreeBuilder not initialized. Call bootstrap() first.",
      );
  }

  readdir(dirPath: string): string[] {
    this.ensureInit();
    const childSet = this.children.get(normalizePath(dirPath));
    if (!childSet) return [];
    return Array.from(childSet).map((p) => {
      const node = this.nodes.get(p);
      return node?.name ?? p.split("/").pop()!;
    });
  }

  exists(path: string): boolean {
    this.ensureInit();
    return this.nodes.has(normalizePath(path));
  }

  stat(path: string): TreeNode | undefined {
    this.ensureInit();
    return this.nodes.get(normalizePath(path));
  }

  find(pattern: string, basePath: string = "/"): string[] {
    this.ensureInit();
    const base = normalizePath(basePath);
    const regex = globToRegex(pattern);
    const results: string[] = [];
    for (const [path, node] of this.nodes) {
      if (path === "/") continue;
      if (
        path.startsWith(base === "/" ? "/" : base + "/") ||
        path === base
      ) {
        if (regex.test(node.name) || regex.test(path)) {
          results.push(path);
        }
      }
    }
    return results.sort();
  }

  allFiles(): string[] {
    this.ensureInit();
    const files: string[] = [];
    for (const [path, node] of this.nodes) {
      if (node.type === "file") files.push(path);
    }
    return files;
  }

  addOrUpdate(node: TreeNode): void {
    this.addNode(node);
  }

  remove(path: string): void {
    const normalized = normalizePath(path);
    this.nodes.delete(normalized);
    const parent = dirname(normalized);
    this.children.get(parent)?.delete(normalized);
    this.children.delete(normalized);
  }
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(escaped, "i");
}
