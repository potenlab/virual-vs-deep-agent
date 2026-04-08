"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  className?: string;
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div className={cn("flex items-start gap-3 px-4 py-2", className)}>
      {/* Bot avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Typing bubble */}
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-1">
          <span
            className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50 inline-block"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50 inline-block"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50 inline-block"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
