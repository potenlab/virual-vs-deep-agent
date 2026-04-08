export const MODEL_LIST = [
  { id: "moonshotai/kimi-k2", label: "Kimi K2" },
  { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
  { id: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash" },
] as const;

export const DEFAULT_MODEL = "moonshotai/kimi-k2";

export type ModelId = (typeof MODEL_LIST)[number]["id"];
