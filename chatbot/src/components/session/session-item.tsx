"use client";

import React from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SessionItemProps {
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export const SessionItem = React.memo(function SessionItem({
  title,
  isActive,
  onSelect,
  onDelete,
}: SessionItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "hover:bg-accent/50"
      )}
    >
      <MessageSquare className="size-4 shrink-0" />
      <span className="truncate text-sm flex-1">{title}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={handleDelete}
        aria-label="Delete session"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
});
