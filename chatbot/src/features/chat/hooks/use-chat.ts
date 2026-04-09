"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Message } from "@/types";
import { useSendMessage } from "../api/use-send-message";

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (params: {
    message: string;
    sessionId?: string;
    model?: string;
    projectId?: string;
  }) => Promise<string | null>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const {
    sendMessage: sendApiMessage,
    isLoading,
    error,
  } = useSendMessage();

  const sendMessage = useCallback(
    async (params: {
      message: string;
      sessionId?: string;
      model?: string;
      projectId?: string;
    }): Promise<string | null> => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: params.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await sendApiMessage({
          message: params.message,
          session_id: params.sessionId,
          model: params.model,
          project_id: params.projectId,
        });

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          model: response.model,
          timestamp: new Date().toISOString(),
          tokenUsage: response.token_usage,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        return response.session_id;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Something went wrong";
        toast.error(errorMessage);
        return null;
      }
    },
    [sendApiMessage],
  );

  return { messages, isLoading, error, sendMessage, setMessages };
}
