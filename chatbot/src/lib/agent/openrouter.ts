import { ChatOpenAI } from "@langchain/openai";
import { getEnv } from "@/config/env";

export function createLLM(model?: string): ChatOpenAI {
  const env = getEnv();

  return new ChatOpenAI({
    model: model ?? env.defaultModel,
    apiKey: env.openRouterApiKey,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0.7,
    maxTokens: 4096,
  });
}
