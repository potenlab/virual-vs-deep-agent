/**
 * Path utilities for the virtual filesystem.
 * All paths are absolute and use forward slashes.
 */

export function normalizePath(p: string): string {
  if (!p.startsWith("/")) p = "/" + p;
  const parts = p.split("/").filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") { resolved.pop(); }
    else { resolved.push(part); }
  }
  return "/" + resolved.join("/");
}

export function dirname(p: string): string {
  const normalized = normalizePath(p);
  if (normalized === "/") return "/";
  const idx = normalized.lastIndexOf("/");
  return idx === 0 ? "/" : normalized.slice(0, idx);
}

export function basename(p: string): string {
  const normalized = normalizePath(p);
  if (normalized === "/") return "/";
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function join(...parts: string[]): string {
  return normalizePath(parts.join("/"));
}

export function isDirectChild(parent: string, child: string): boolean {
  return dirname(normalizePath(child)) === normalizePath(parent);
}

export function isDescendant(ancestor: string, descendant: string): boolean {
  const a = normalizePath(ancestor);
  const d = normalizePath(descendant);
  if (a === "/") return d !== "/";
  return d.startsWith(a + "/");
}
