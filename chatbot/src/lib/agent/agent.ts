import { createDeepAgent } from "deepagents";
import { createLLM } from "./openrouter";
import { buildSystemPrompt } from "./system-prompt";
import type { Message } from "@/types";

/**
 * Creates a DeepAgent instance configured with the OpenRouter LLM and system prompt.
 * When projectId is provided, initializes VirtualFs and wires up all tools (VFS mode).
 * When no projectId, runs as a generic assistant with no tools.
 * @param model - Optional OpenRouter model slug (e.g., "moonshotai/kimi-k2")
 * @param projectId - Optional project UUID to enable VFS mode with tools
 * @returns A DeepAgent instance ready for invocation
 */
export async function createAgent(model?: string, projectId?: string) {
  const llm = createLLM(model);

  if (projectId) {
    // VFS mode: initialize filesystem and tools
    const { VirtualFs } = await import("@/lib/fs/virtual-fs");
    const { createTools } = await import("./tools");

    const fs = new VirtualFs(projectId);
    await fs.initialize();

    console.log(`[VFS] Initialized for project ${projectId}, ${fs.treeBuilder.allFiles().length} files`);

    const tools = createTools({ projectId, fs });

    // Get project name from DB
    const { db } = await import("@/lib/db");
    const { projects } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [project] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    const projectName = project?.name ?? "Project";

    return createDeepAgent({
      model: llm,
      systemPrompt: buildSystemPrompt(projectName),
      tools,
    });
  }

  // Generic mode: no tools
  return createDeepAgent({
    model: llm,
    systemPrompt: buildSystemPrompt("Assistant"),
    tools: [],
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

/**
 * Invokes the agent with a conversation history and returns the response + token usage.
 */
export async function invokeAgent(
  agent: Awaited<ReturnType<typeof createAgent>>,
  messages: Message[]
): Promise<AgentResponse> {
  const langchainMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const result = await agent.invoke({ messages: langchainMessages });
  const resultMessages = result.messages;

  // Aggregate token usage from ALL AI messages (including tool-call steps)
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

      // Collect token usage from every AI message
      if (msgType === "ai") {
        const usage =
          (msg as unknown as Record<string, unknown>).usage_metadata as Record<string, number> | undefined;
        if (usage) {
          promptTokens += usage.input_tokens ?? 0;
          completionTokens += usage.output_tokens ?? 0;
        }
      }
    }

    // Extract text content from the last AI message
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
          if (textParts) {
            content = textParts;
            break;
          }
        }
      }
    }
  }

  return {
    content,
    tokenUsage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}
