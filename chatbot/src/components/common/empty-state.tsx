"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUGGESTED_PROMPTS = [
  "What can you help me with?",
  "Tell me a fun fact",
  "Explain quantum computing simply",
];

interface EmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      {/* Bot icon */}
      <Bot className="h-12 w-12 text-muted-foreground" />

      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Start a conversation</h2>
        <p className="text-sm text-muted-foreground">
          Ask me anything — I&apos;m here to help.
        </p>
      </div>

      {/* Suggested prompt buttons */}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            size="sm"
            onClick={() => onPromptClick(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}
