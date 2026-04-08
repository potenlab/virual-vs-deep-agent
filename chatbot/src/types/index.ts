export interface Session {
  id: string;
  title: string;
  createdAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  model?: string;
  project_id?: string;
}

export interface ChatResponse {
  session_id: string;
  message: string;
  model: string;
}

export interface SessionsResponse {
  sessions: Session[];
}

export interface MessagesResponse {
  messages: Message[];
}

// === Virtual FS Types ===

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  path: string;
  name: string;
  type: "file" | "directory";
  content: string | null;
  chunkIndex: number;
  sizeBytes: number;
  isPublic: boolean;
  groups: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  projectId: string;
  title: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  attendees: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  path: string;
  name: string;
  snippet: string;
  rank: number;
}

export interface GrepMatch {
  path: string;
  line: number;
  content: string;
}

export interface TreeNode {
  path: string;
  name: string;
  type: "file" | "directory";
  size: number;
  updatedAt: string;
}
