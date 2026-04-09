"use client";

import { Bot, Loader2 } from "lucide-react";

interface ActivityIndicatorProps {
  status: string | null;
}

export function ActivityIndicator({ status }: ActivityIndicatorProps) {
  return (
    <div className="flex items-start gap-2 px-4 pb-4 animate-message-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Bot className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-2xl rounded-bl-md">
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {status || "Thinking..."}
        </span>
      </div>
    </div>
  );
}
