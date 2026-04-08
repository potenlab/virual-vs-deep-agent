import { Session, Message } from "@/types";
import { db } from "@/lib/db";
import { sessions, messages } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";

class SessionStore {
  async createSession(title?: string): Promise<Session> {
    const [row] = await db
      .insert(sessions)
      .values({ title: title ?? "New Chat" })
      .returning();

    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getSession(id: string): Promise<Session | null> {
    try {
      const [row] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, id))
        .limit(1);

      if (!row) return null;

      return {
        id: row.id,
        title: row.title,
        createdAt: row.createdAt.toISOString(),
      };
    } catch {
      return null; // invalid UUID format
    }
  }

  async listSessions(): Promise<Session[]> {
    const rows = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(sessions)
        .where(eq(sessions.id, id))
        .returning({ id: sessions.id });

      return result.length > 0;
    } catch {
      return false; // invalid UUID format
    }
  }

  async addMessage(
    sessionId: string,
    message: Omit<Message, "id" | "timestamp">,
  ): Promise<Message> {
    const [row] = await db
      .insert(messages)
      .values({
        sessionId,
        role: message.role,
        content: message.content,
        model: message.model ?? null,
      })
      .returning();

    return {
      id: row.id,
      role: row.role as "user" | "assistant",
      content: row.content,
      model: row.model ?? undefined,
      timestamp: row.timestamp.toISOString(),
    };
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    try {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(asc(messages.timestamp));

      return rows.map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        content: r.content,
        model: r.model ?? undefined,
        timestamp: r.timestamp.toISOString(),
      }));
    } catch {
      return []; // invalid UUID format
    }
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await db
      .update(sessions)
      .set({ title })
      .where(eq(sessions.id, sessionId));
  }
}

// Singleton — same globalThis pattern to survive HMR in dev
const globalStore = globalThis as typeof globalThis & {
  __sessionStore?: SessionStore;
};

export function getStore(): SessionStore {
  if (!globalStore.__sessionStore) {
    globalStore.__sessionStore = new SessionStore();
  }
  return globalStore.__sessionStore;
}

export { SessionStore };
