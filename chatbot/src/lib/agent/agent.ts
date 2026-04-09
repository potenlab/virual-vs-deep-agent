import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { createLLM } from "./openrouter";
import { buildSystemPrompt, buildRagSystemPrompt } from "./system-prompt";
import type { Message } from "@/types";
import type { ToolEvent } from "./tools";

export async function createAgent(
  model?: string,
  mode: "vfs" | "rag" = "vfs",
  ragContext?: string,
  onToolCall?: (event: ToolEvent) => void,
) {
  const llm = createLLM(model);

  if (mode === "rag" && ragContext) {
    console.log(`[RAG] Context injected`);
    return createReactAgent({
      llm,
      tools: [],
      prompt: buildRagSystemPrompt("Project", ragContext),
    });
  }

  const { VirtualFs } = await import("@/lib/fs/virtual-fs");
  const { createTools } = await import("./tools");

  const fs = new VirtualFs();
  await fs.initialize();

  const allFiles = fs.treeBuilder.allFiles();
  console.log(`[VFS] Initialized, ${allFiles.length} files:`, allFiles);

  const tools = createTools({ projectId: "", fs, onToolCall });

  return createReactAgent({
    llm,
    tools,
    prompt: buildSystemPrompt("Project"),
  });
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AgentResponse {
  content: string;
  tokenUsage: TokenUsage;
}

export async function invokeAgent(
  agent: Awaited<ReturnType<typeof createAgent>>,
  messages: Message[],
): Promise<AgentResponse> {
  const langchainMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const result = await agent.invoke({ messages: langchainMessages });
  const resultMessages = result.messages;

  let promptTokens = 0;
  let completionTokens = 0;
  let content = "No response generated.";

  if (resultMessages && resultMessages.length > 0) {
    for (let i = resultMessages.length - 1; i >= 0; i--) {
      const msg = resultMessages[i];
      const msgType =
        typeof msg._getType === "function"
          ? msg._getType()
          : (msg as unknown as Record<string, unknown>).type;

      if (msgType === "ai") {
        const usage =
          (msg as unknown as Record<string, unknown>).usage_metadata as Record<string, number> | undefined;
        if (usage) {
          promptTokens += usage.input_tokens ?? 0;
          completionTokens += usage.output_tokens ?? 0;
        }
      }
    }

    for (let i = resultMessages.length - 1; i >= 0; i--) {
      const msg = resultMessages[i];
      const msgType =
        typeof msg._getType === "function"
          ? msg._getType()
          : (msg as unknown as Record<string, unknown>).type;

      if (msgType === "ai") {
        if (typeof msg.content === "string" && msg.content) {
          content = msg.content;
          break;
        }
        if (Array.isArray(msg.content)) {
          const textParts = msg.content
            .filter((part: { type: string; text?: string }) => part.type === "text")
            .map((part: { type: string; text?: string }) => part.text ?? "")
            .join("");
          if (textParts) { content = textParts; break; }
        }
      }
    }
  }

  return {
    content,
    tokenUsage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
  };
}
