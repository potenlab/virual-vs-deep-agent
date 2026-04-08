import type { Session, Message } from "@/types";

export interface SessionsResponse {
  sessions: Session[];
}

export interface SessionResponse {
  session: Session;
}

export interface MessagesResponse {
  messages: Message[];
}

export interface UseSessionsReturn {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<Session | null>;
  deleteSession: (id: string) => Promise<boolean>;
  fetchMessages: (sessionId: string) => Promise<Message[]>;
}
