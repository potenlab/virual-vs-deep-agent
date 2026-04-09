import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Chat tables
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("New Chat"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    model: text("model"),
    promptTokens: integer("prompt_tokens").default(0),
    completionTokens: integer("completion_tokens").default(0),
    totalTokens: integer("total_tokens").default(0),
    mode: text("mode"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_session_id_idx").on(table.sessionId)],
);

// ---------------------------------------------------------------------------
// Virtual FS + Vector DB
// ---------------------------------------------------------------------------

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: text("path").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'file' | 'directory'
    content: text("content"),
    chunkIndex: integer("chunk_index").default(0),
    sizeBytes: integer("size_bytes").default(0),
    isPublic: boolean("is_public").default(false),
    groups: text("groups").array().default(sql`'{}'`),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    // embedding vector(1536) — managed via raw SQL, not in Drizzle schema
  },
  (table) => [
    uniqueIndex("documents_path_idx").on(table.path),
    index("documents_content_fts_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${table.content}, ''))`,
    ),
  ],
);
