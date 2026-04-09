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
import { DocumentList } from "./document-list";

interface DocumentEntry {
  id: string;
  path: string;
  name: string;
  type: string;
  sizeBytes: number | null;
}

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  // Document props
  documents: DocumentEntry[];
  documentsLoading: boolean;
  onDocumentUploadComplete: () => void;
}

function SidebarContent({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  documents,
  documentsLoading,
  onDocumentUploadComplete,
}: Omit<SessionSidebarProps, "isOpen" | "onOpenChange" | "isMobile">) {
  return (
    <div className="flex flex-col h-full w-[260px]">
      {/* New Chat Button */}
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

      {/* Chat Sessions */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Chats
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 px-2 pb-2">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No conversations yet
              </p>
            ) : (
              sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  title={session.title}
                  isActive={session.id === activeSessionId}
                  onSelect={() => onSelectSession(session.id)}
                  onDelete={() => onDeleteSession(session.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      {/* Documents Section */}
      <div className="flex-1 min-h-0">
        <DocumentList
          documents={documents}
          isLoading={documentsLoading}
          onUploadComplete={onDocumentUploadComplete}
        />
      </div>
    </div>
  );
}

export function SessionSidebar(props: SessionSidebarProps) {
  const {
    isOpen,
    onOpenChange,
    isMobile,
    ...contentProps
  } = props;

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetTitle className="sr-only">Chat sessions & Documents</SheetTitle>
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
