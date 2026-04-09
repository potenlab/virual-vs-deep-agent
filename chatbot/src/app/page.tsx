"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@/features/chat/hooks/use-chat";
import { useSessionManager } from "@/features/session/hooks/use-session-manager";
import { useDocuments } from "@/features/documents/api/use-documents";
import { useMediaQuery } from "@/hooks/use-media-query";
import { DEFAULT_MODEL } from "@/lib/constants";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { SessionSidebar } from "@/components/session/session-sidebar";
import { DeleteConfirmDialog } from "@/components/session/delete-confirm-dialog";
import { ActivityIndicator } from "@/components/common/activity-indicator";
import { EmptyState } from "@/components/common/empty-state";

export default function Home() {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [selectedMode, setSelectedMode] = useState<"vfs" | "rag">("vfs");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const { messages, isLoading, agentStatus, sendMessage, setMessages } = useChat();

  const {
    sessions,
    activeSessionId,
    createSession,
    selectSession,
    deleteSession,
    refreshSessions,
    setActiveSessionId,
  } = useSessionManager({ onMessagesLoaded: setMessages });

  const {
    documents,
    isLoading: documentsLoading,
    fetchDocuments,
  } = useDocuments();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Default sidebar closed on mobile, open on desktop
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleSend = useCallback(
    async (message: string) => {
      const sessionId = await sendMessage({
        message,
        sessionId: activeSessionId ?? undefined,
        model: selectedModel,
        mode: selectedMode,
      });

      if (sessionId && !activeSessionId) {
        setActiveSessionId(sessionId);
        await refreshSessions();
      }
    },
    [sendMessage, activeSessionId, selectedModel, selectedMode, setActiveSessionId, refreshSessions],
  );

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteTarget) {
      await deleteSession(deleteTarget);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteSession]);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
  }, [setActiveSessionId, setMessages]);

  return (
    <div className="flex h-dvh">
      <a
        href="#chat-input"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-background focus:text-foreground"
      >
        Skip to chat
      </a>

      {/* Sidebar */}
      {(isMobile || sidebarOpen) && (
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectSession}
          onDeleteSession={handleDeleteRequest}
          onNewChat={handleNewChat}
          isOpen={sidebarOpen}
          onOpenChange={setSidebarOpen}
          isMobile={isMobile}
          documents={documents}
          documentsLoading={documentsLoading}
          onDocumentUploadComplete={fetchDocuments}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          selectedMode={selectedMode}
          onModeChange={setSelectedMode}
        />

        <main role="main" className="flex-1 overflow-hidden">
          <div
            role="log"
            aria-live="polite"
            aria-busy={isLoading}
            className="h-full overflow-y-auto scroll-smooth"
          >
            {messages.length === 0 ? (
              <EmptyState onPromptClick={handleSend} />
            ) : (
              <div className="flex flex-col gap-4 p-4">
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    tokenUsage={msg.tokenUsage}
                    mode={msg.mode}
                  />
                ))}
              </div>
            )}

            {isLoading && <ActivityIndicator status={agentStatus} />}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <div id="chat-input" className="border-t p-4">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
