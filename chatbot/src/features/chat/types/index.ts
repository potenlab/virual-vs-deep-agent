import type { ChatRequest, ChatResponse } from "@/types";

export type SendMessageRequest = ChatRequest;
export type SendMessageResponse = ChatResponse;

export interface UseSendMessageReturn {
  sendMessage: (params: { message: string; sessionId?: string; model?: string }) => Promise<SendMessageResponse | null>;
  isLoading: boolean;
  error: string | null;
}
