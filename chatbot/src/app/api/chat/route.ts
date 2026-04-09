import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/session-store";
import { createAgent, invokeAgent } from "@/lib/agent/agent";
import { MODEL_LIST, DEFAULT_MODEL } from "@/lib/constants";
import { getDefaultProjectId } from "@/lib/default-project";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // --- Validation ---
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > 10_000) {
      return NextResponse.json(
        { error: "Message too long (max 10,000 characters)" },
        { status: 400 }
      );
    }

    const validModelIds = MODEL_LIST.map((m) => m.id) as readonly string[];

    if (body.model && !validModelIds.includes(body.model)) {
      return NextResponse.json(
        { error: "Invalid model" },
        { status: 400 }
      );
    }

    const usedModel: string = body.model ?? DEFAULT_MODEL;

    // --- Session logic ---
    const store = getStore();
    let sessionId: string;

    if (body.session_id) {
      const existing = await store.getSession(body.session_id);
      if (!existing) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      sessionId = existing.id;
    } else {
      const newSession = await store.createSession();
      sessionId = newSession.id;
    }

    // --- Check if this is the first message (for auto-title) ---
    const existingMessages = await store.getMessages(sessionId);
    const isFirstMessage = existingMessages.length === 0;

    // --- Add user message to store ---
    await store.addMessage(sessionId, {
      role: "user",
      content: message,
    });

    // --- Get full conversation history ---
    const history = await store.getMessages(sessionId);

    // --- Invoke agent ---
    // Always use VFS mode with default project
    const projectId = await getDefaultProjectId();
    const agent = await createAgent(usedModel, projectId);
    const agentResponse = await invokeAgent(agent, history);

    // --- Add assistant message to store ---
    await store.addMessage(sessionId, {
      role: "assistant",
      content: agentResponse.content,
      model: usedModel,
    });

    // --- Auto-title: set title to first 50 chars of user message ---
    if (isFirstMessage) {
      const title =
        message.length > 50 ? message.slice(0, 50) + "..." : message;
      await store.updateSessionTitle(sessionId, title);
    }

    // --- Return response ---
    return NextResponse.json({
      session_id: sessionId,
      message: agentResponse.content,
      model: usedModel,
      token_usage: agentResponse.tokenUsage,
    });
  } catch (error) {
    console.error("[POST /api/chat]", error);

    if (
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("rate limit"))
    ) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    if (
      error instanceof Error &&
      (error.message.includes("502") ||
        error.message.includes("503") ||
        error.message.includes("upstream"))
    ) {
      return NextResponse.json(
        { error: "LLM service unavailable. Please try again." },
        { status: 502 }
      );
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to generate response", detail: errMsg },
      { status: 500 }
    );
  }
}
