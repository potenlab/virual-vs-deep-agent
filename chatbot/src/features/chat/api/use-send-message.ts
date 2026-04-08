"use client";

import { useState, useCallback } from "react";
import type { ChatRequest, ChatResponse } from "@/types";

interface UseSendMessageReturn {
  sendMessage: (params: ChatRequest) => Promise<ChatResponse>;
  isLoading: boolean;
  error: string | null;
}

export function useSendMessage(): UseSendMessageReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (params: ChatRequest): Promise<ChatResponse> => {
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
          }),
        });

        if (!response.ok) {
          switch (response.status) {
            case 400:
              throw new Error("Invalid request");
            case 429:
              throw new Error("Rate limited — please wait");
            case 500:
            case 502:
              throw new Error("Server error — try again");
            default:
              throw new Error(`HTTP ${response.status}`);
          }
        }

        const data: ChatResponse = await response.json();
        return data;
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
