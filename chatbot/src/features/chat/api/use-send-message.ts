"use client";

import { useState, useCallback } from "react";
import type { ChatRequest, ChatResponse } from "@/types";

interface UseSendMessageReturn {
  sendMessage: (params: ChatRequest, onStatus?: (text: string) => void) => Promise<ChatResponse>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Parse SSE events from a ReadableStream.
 * Returns the final ChatResponse from the "done" event.
 */
async function consumeSSE(
  response: Response,
  onStatus?: (text: string) => void,
): Promise<ChatResponse> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse complete SSE events from the buffer
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? ""; // Keep incomplete event in buffer

    for (const eventStr of events) {
      if (!eventStr.trim()) continue;

      const lines = eventStr.split("\n");
      let eventType = "";
      let eventData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        else if (line.startsWith("data: ")) eventData = line.slice(6);
      }

      if (!eventType || !eventData) continue;

      try {
        const data = JSON.parse(eventData);

        switch (eventType) {
          case "status":
            onStatus?.(data.text);
            break;
          case "tool_start":
            onStatus?.(`Running: ${data.input ?? data.tool}`);
            break;
          case "tool_end":
            onStatus?.(data.output ? `Done: ${data.output.slice(0, 60)}` : `Done: ${data.tool}`);
            break;
          case "done":
            result = data as ChatResponse;
            break;
          case "error":
            throw new Error(data.detail || data.error || "Server error");
        }
      } catch (err) {
        if (err instanceof Error && err.message !== "Server error") throw err;
      }
    }
  }

  if (!result) throw new Error("No response received");
  return result;
}

export function useSendMessage(): UseSendMessageReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (params: ChatRequest, onStatus?: (text: string) => void): Promise<ChatResponse> => {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: params.message,
            session_id: params.session_id,
            model: params.model,
            mode: params.mode,
          }),
        });

        if (!response.ok) {
          switch (response.status) {
            case 400: throw new Error("Invalid request");
            case 429: throw new Error("Rate limited — please wait");
            case 500:
            case 502: throw new Error("Server error — try again");
            default: throw new Error(`HTTP ${response.status}`);
          }
        }

        return await consumeSSE(response, onStatus);
      } catch (err) {
        const message =
          err instanceof TypeError
            ? "Connection failed"
            : err instanceof Error
              ? err.message
              : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { sendMessage, isLoading, error };
}
