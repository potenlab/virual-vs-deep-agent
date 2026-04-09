"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokenUsage } from "@/types";

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  tokenUsage?: TokenUsage;
  mode?: "vfs" | "rag";
}

function ChatBubbleComponent({ role, content, tokenUsage, mode }: ChatBubbleProps) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-message-fade-in">
        <div
          className={cn(
            "max-w-[80%] px-4 py-2.5",
            "bg-primary text-primary-foreground",
            "rounded-2xl rounded-br-md"
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 animate-message-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Bot className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="max-w-[80%] flex flex-col gap-1">
        <div
          className={cn(
            "px-4 py-2.5",
            "bg-muted text-foreground",
            "rounded-2xl rounded-bl-md",
            "prose prose-sm dark:prose-invert max-w-none",
            "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5",
            "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm",
            "[&_pre]:bg-background/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto",
            "[&_code]:bg-background/50 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
            "[&_table]:w-full [&_table]:text-xs [&_table]:border-collapse",
            "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-background/50 [&_th]:text-left [&_th]:font-semibold",
            "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
            "[&_thead]:bg-background/30",
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        {tokenUsage && tokenUsage.totalTokens > 0 && (
          <div className="flex items-center gap-2 px-2 text-[10px] text-muted-foreground/60">
            {mode && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
                  mode === "rag"
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-orange-500/10 text-orange-500",
                )}
              >
                {mode}
              </span>
            )}
            <span>{fmtTokens(tokenUsage.promptTokens)} in</span>
            <span className="text-muted-foreground/30">|</span>
            <span>{fmtTokens(tokenUsage.completionTokens)} out</span>
            <span className="text-muted-foreground/30">|</span>
            <span>{fmtTokens(tokenUsage.totalTokens)} total</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const ChatBubble = memo(ChatBubbleComponent);
