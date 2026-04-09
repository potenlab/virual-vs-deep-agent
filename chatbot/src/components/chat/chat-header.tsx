"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/components/model/model-selector";
import { ModeToggle } from "./mode-toggle";

interface ChatHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  selectedMode: "vfs" | "rag";
  onModeChange: (mode: "vfs" | "rag") => void;
}

export function ChatHeader({
  isSidebarOpen,
  onToggleSidebar,
  selectedModel,
  onModelChange,
  selectedMode,
  onModeChange,
}: ChatHeaderProps) {
  return (
    <header
      role="banner"
      className="h-14 sticky top-0 z-10 backdrop-blur-sm bg-background/80 border-b"
    >
      <div className="flex justify-between items-center h-full px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="size-5" />
            ) : (
              <PanelLeftOpen className="size-5" />
            )}
          </Button>
          <ModeToggle value={selectedMode} onValueChange={onModeChange} />
        </div>

        <ModelSelector value={selectedModel} onValueChange={onModelChange} />
      </div>
    </header>
  );
}
