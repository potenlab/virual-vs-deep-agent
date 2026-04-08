"use client";

import type { Session } from "@/types";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SessionItem } from "./session-item";

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}

function SidebarContent({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}: Pick<
  SessionSidebarProps,
  | "sessions"
  | "activeSessionId"
  | "onSelectSession"
  | "onDeleteSession"
  | "onNewChat"
>) {
  return (
    <div className="flex flex-col h-full w-[260px]">
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onNewChat}
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              title={session.title}
              isActive={session.id === activeSessionId}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  isOpen,
  onOpenChange,
  isMobile,
}: SessionSidebarProps) {
  const contentProps = {
    sessions,
    activeSessionId,
    onSelectSession,
    onDeleteSession,
    onNewChat,
  };

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetTitle className="sr-only">Chat sessions</SheetTitle>
          <SidebarContent {...contentProps} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      role="complementary"
      className="hidden md:flex border-r bg-card h-full"
    >
      <SidebarContent {...contentProps} />
    </aside>
  );
}
