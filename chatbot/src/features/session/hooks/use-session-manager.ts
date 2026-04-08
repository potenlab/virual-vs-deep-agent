"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Session, Message } from "@/types";
import { useSessions } from "../api/use-sessions";

interface UseSessionManagerCallbacks {
  onMessagesLoaded: (messages: Message[]) => void;
}

interface UseSessionManagerReturn {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  createSession: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useSessionManager(
  callbacks: UseSessionManagerCallbacks
): UseSessionManagerReturn {
  const {
    sessions,
    isLoading,
    fetchSessions,
    createSession: apiCreateSession,
    deleteSession: apiDeleteSession,
    fetchMessages,
  } = useSessions();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Keep a stable reference to the callbacks to avoid stale closures
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // On mount: fetch sessions and select the most recent one
  useEffect(() => {
    const init = async () => {
      await fetchSessions();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After sessions load on mount, select the most recent session
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (sessions.length > 0) {
      hasInitializedRef.current = true;
      const mostRecent = sessions[0];
      setActiveSessionId(mostRecent.id);
      fetchMessages(mostRecent.id).then((messages) => {
        callbacksRef.current.onMessagesLoaded(messages);
      });
    } else if (!isLoading && sessions.length === 0) {
      // Sessions loaded but empty — mark as initialized
      hasInitializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, isLoading]);

  const createSession = useCallback(async () => {
    const newSession = await apiCreateSession();
    if (newSession) {
      setActiveSessionId(newSession.id);
      callbacksRef.current.onMessagesLoaded([]);
    }
  }, [apiCreateSession]);

  const selectSession = useCallback(
    async (id: string) => {
      setActiveSessionId(id);
      const messages = await fetchMessages(id);
      callbacksRef.current.onMessagesLoaded(messages);
    },
    [fetchMessages]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      const success = await apiDeleteSession(id);
      if (!success) return;

      if (activeSessionId === id) {
        // Find the most recent remaining session
        const remaining = sessions.filter((s) => s.id !== id);
        if (remaining.length > 0) {
          const mostRecent = remaining[0];
          setActiveSessionId(mostRecent.id);
          const messages = await fetchMessages(mostRecent.id);
          callbacksRef.current.onMessagesLoaded(messages);
        } else {
          setActiveSessionId(null);
          callbacksRef.current.onMessagesLoaded([]);
        }
      }
    },
    [apiDeleteSession, activeSessionId, sessions, fetchMessages]
  );

  const refreshSessions = useCallback(async () => {
    await fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    activeSessionId,
    isLoading,
    createSession,
    selectSession,
    deleteSession,
    refreshSessions,
    setActiveSessionId,
  };
}
