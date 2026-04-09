"use client";

import { cn } from "@/lib/utils";

interface ModeToggleProps {
  value: "vfs" | "rag";
  onValueChange: (value: "vfs" | "rag") => void;
}

export function ModeToggle({ value, onValueChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
      <button
        className={cn(
          "px-3 py-1 rounded-md text-xs font-medium transition-colors",
          value === "vfs"
            ? "bg-background shadow-sm text-orange-500"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onValueChange("vfs")}
      >
        VFS
      </button>
      <button
        className={cn(
          "px-3 py-1 rounded-md text-xs font-medium transition-colors",
          value === "rag"
            ? "bg-background shadow-sm text-blue-500"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onValueChange("rag")}
      >
        RAG
      </button>
    </div>
  );
}
