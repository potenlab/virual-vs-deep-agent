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
  tokenUsage?: TokenUsage;
  mode?: "vfs" | "rag";
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  model?: string;
  project_id?: string;
  mode?: "vfs" | "rag";
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  session_id: string;
  message: string;
  model: string;
  mode?: "vfs" | "rag";
  token_usage?: TokenUsage;
}

export interface SessionsResponse {
  sessions: Session[];
}

export interface MessagesResponse {
  messages: Message[];
}

// === Virtual FS Types ===

export interface Document {
  id: string;
  path: string;
  name: string;
  type: "file" | "directory";
  content: string | null;
  sizeBytes: number;
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
