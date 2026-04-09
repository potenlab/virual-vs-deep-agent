import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/session-store";
import { createAgent, invokeAgent } from "@/lib/agent/agent";
import { MODEL_LIST, DEFAULT_MODEL } from "@/lib/constants";
import type { ToolEvent } from "@/lib/agent/tools";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (message.length > 10_000) return NextResponse.json({ error: "Message too long" }, { status: 400 });

  const validModelIds = MODEL_LIST.map((m) => m.id) as readonly string[];
  if (body.model && !validModelIds.includes(body.model)) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  const usedModel: string = body.model ?? DEFAULT_MODEL;
  const mode = body.mode === "rag" ? "rag" : "vfs";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const store = getStore();
        let sessionId: string;

        if (body.session_id) {
          const existing = await store.getSession(body.session_id);
          if (!existing) { send("error", { error: "Session not found" }); controller.close(); return; }
          sessionId = existing.id;
        } else {
          const newSession = await store.createSession();
          sessionId = newSession.id;
        }

        const existingMessages = await store.getMessages(sessionId);
        const isFirstMessage = existingMessages.length === 0;

        await store.addMessage(sessionId, { role: "user", content: message });
        const history = await store.getMessages(sessionId);

        const onToolCall = (event: ToolEvent) => send(event.type, event);

        let agent;
        if (mode === "rag") {
          send("status", { text: "Embedding query..." });
          const { embedText } = await import("@/lib/agent/embeddings");
          const { retrieveDocuments } = await import("@/lib/agent/retriever");

          const queryEmbedding = await embedText(message);
          send("status", { text: "Retrieving documents..." });

          const retrieved = await retrieveDocuments(queryEmbedding, message, 5);
          send("status", { text: `Found ${retrieved.length} relevant documents` });

          const ragContext = retrieved.length > 0
            ? retrieved.map((doc) => `### ${doc.path} (similarity: ${Number(doc.similarity).toFixed(3)})\n\`\`\`\n${doc.content}\n\`\`\``).join("\n\n")
            : "(No relevant documents found)";

          agent = await createAgent(usedModel, "rag", ragContext, onToolCall);
        } else {
          send("status", { text: "Initializing Virtual FS..." });
          agent = await createAgent(usedModel, "vfs", undefined, onToolCall);
        }

        send("status", { text: "Thinking..." });
        const agentResponse = await invokeAgent(agent, history);

        await store.addMessage(sessionId, {
          role: "assistant", content: agentResponse.content,
          model: usedModel, tokenUsage: agentResponse.tokenUsage, mode,
        });

        if (isFirstMessage) {
          const title = message.length > 50 ? message.slice(0, 50) + "..." : message;
          await store.updateSessionTitle(sessionId, title);
        }

        send("done", {
          session_id: sessionId, message: agentResponse.content,
          model: usedModel, mode, token_usage: agentResponse.tokenUsage,
        });
      } catch (error) {
        console.error("[POST /api/chat]", error);
        const errMsg = error instanceof Error ? error.message : String(error);
        send("error", { error: "Failed to generate response", detail: errMsg });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
