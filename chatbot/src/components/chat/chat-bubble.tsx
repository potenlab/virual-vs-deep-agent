"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
}

function ChatBubbleComponent({ role, content }: ChatBubbleProps) {
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
      <div
        className={cn(
          "max-w-[80%] px-4 py-2.5",
          "bg-muted text-foreground",
          "rounded-2xl rounded-bl-md",
          "prose prose-sm dark:prose-invert max-w-none",
          "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5",
          "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm",
          "[&_pre]:bg-background/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs",
          "[&_code]:bg-background/50 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
        )}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

export const ChatBubble = memo(ChatBubbleComponent);
