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
    const { Bash } = await import("just-bash");
    const { createTools } = await import("./tools");

    const fs = new VirtualFs(projectId);
    await fs.initialize();

    const bash = new Bash({ fs: fs as any, cwd: "/" });
    const tools = createTools({ projectId, fs, bash });

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

/**
 * Invokes the agent with a conversation history and returns the assistant's response.
 * @param agent - The DeepAgent instance created by createAgent()
 * @param messages - Array of conversation messages in our internal format
 * @returns The assistant's response content as a string
 */
export async function invokeAgent(
  agent: Awaited<ReturnType<typeof createAgent>>,
  messages: Message[]
): Promise<string> {
  // Convert our Message[] type to LangChain message format
  const langchainMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Invoke the agent with the message history
  const result = await agent.invoke({ messages: langchainMessages });

  // Extract the last assistant message content from the result
  const resultMessages = result.messages;

  if (!resultMessages || resultMessages.length === 0) {
    return "No response generated.";
  }

  // Find the last message from the assistant (AIMessage in LangChain)
  // Iterate from the end to find the last non-tool, non-human message
  for (let i = resultMessages.length - 1; i >= 0; i--) {
    const msg = resultMessages[i];

    // LangGraph messages have a _getType() method or a type property
    // AIMessage type is "ai", HumanMessage is "human", ToolMessage is "tool"
    const msgType =
      typeof msg._getType === "function"
        ? msg._getType()
        : (msg as unknown as Record<string, unknown>).type;

    if (msgType === "ai") {
      // Content can be a string or an array of content blocks
      if (typeof msg.content === "string") {
        return msg.content;
      }

      // Handle array content (e.g., multi-part messages with text and tool calls)
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter(
            (part: { type: string; text?: string }) => part.type === "text"
          )
          .map((part: { type: string; text?: string }) => part.text ?? "")
          .join("");
        return textParts || "No response generated.";
      }
    }
  }

  // Fallback: return the content of the very last message
  const lastMsg = resultMessages[resultMessages.length - 1];
  if (typeof lastMsg.content === "string") {
    return lastMsg.content;
  }

  return "No response generated.";
}
