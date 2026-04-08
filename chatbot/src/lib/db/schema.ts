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
// Existing tables
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
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_session_id_idx").on(table.sessionId)],
);

// ---------------------------------------------------------------------------
// Virtual FS tables
// ---------------------------------------------------------------------------

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  ownerId: uuid("owner_id").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
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
  },
  (table) => [
    uniqueIndex("documents_project_path_idx").on(table.projectId, table.path),
    index("documents_project_id_idx").on(table.projectId),
    index("documents_content_fts_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${table.content}, ''))`,
    ),
  ],
);

export const todos = pgTable(
  "todos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("todo"), // todo | in_progress | done | cancelled
    priority: text("priority").default("medium"), // low | medium | high | urgent
    assignee: text("assignee"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    tags: text("tags").array().default(sql`'{}'`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("todos_project_id_idx").on(table.projectId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    location: text("location"),
    attendees: text("attendees").array().default(sql`'{}'`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("events_project_id_idx").on(table.projectId)],
);
