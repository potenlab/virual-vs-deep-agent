"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Session, Message } from "@/types";

interface UseSessionsReturn {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<Session | null>;
  deleteSession: (id: string) => Promise<boolean>;
  fetchMessages: (sessionId: string) => Promise<Message[]>;
}

function getHttpErrorMessage(status: number): string {
  switch (status) {
    case 404:
      return "Session not found";
    case 429:
      return "Rate limited — please wait";
    case 500:
    case 502:
      return "Server error — try again";
    default:
      return `HTTP ${status}`;
  }
}

function resolveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof TypeError) {
    return "Connection failed";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status));
      }

      const data = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      const message = resolveErrorMessage(err, "Failed to fetch sessions");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const createSession = async (
    title?: string
  ): Promise<Session | null> => {
    setError(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status));
      }

      const data = await response.json();
      const newSession: Session = data.session;
      setSessions((prev) => [newSession, ...prev]);
      return newSession;
    } catch (err) {
      const message = resolveErrorMessage(err, "Failed to create session");
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const deleteSession = async (id: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status));
      }

      setSessions((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err) {
      const message = resolveErrorMessage(err, "Failed to delete session");
      setError(message);
      toast.error(message);
      return false;
    }
  };

  const fetchMessages = async (sessionId: string): Promise<Message[]> => {
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status));
      }

      const data = await response.json();
      return data.messages;
    } catch (err) {
      const message = resolveErrorMessage(err, "Failed to fetch messages");
      setError(message);
      toast.error(message);
      return [];
    }
  };

  return {
    sessions,
    isLoading,
    error,
    fetchSessions,
    createSession,
    deleteSession,
    fetchMessages,
  };
}
