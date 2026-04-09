"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Message } from "@/types";
import { useSendMessage } from "../api/use-send-message";

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  agentStatus: string | null;
  error: string | null;
  sendMessage: (params: {
    message: string;
    sessionId?: string;
    model?: string;
    mode?: "vfs" | "rag";
  }) => Promise<string | null>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
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
      mode?: "vfs" | "rag";
    }): Promise<string | null> => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: params.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setAgentStatus("Thinking...");

      try {
        const response = await sendApiMessage(
          {
            message: params.message,
            session_id: params.sessionId,
            model: params.model,
            mode: params.mode,
          },
          (status) => setAgentStatus(status),
        );

        setAgentStatus(null);

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          model: response.model,
          timestamp: new Date().toISOString(),
          tokenUsage: response.token_usage,
          mode: response.mode,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        return response.session_id;
      } catch (err) {
        setAgentStatus(null);
        const errorMessage = err instanceof Error ? err.message : "Something went wrong";
        toast.error(errorMessage);
        return null;
      }
    },
    [sendApiMessage],
  );

  return { messages, isLoading, agentStatus, error, sendMessage, setMessages };
}
