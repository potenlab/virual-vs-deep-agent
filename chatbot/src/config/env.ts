export function getEnv() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const defaultModel = process.env.DEFAULT_MODEL ?? "moonshotai/kimi-k2";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  return {
    openRouterApiKey: apiKey,
    defaultModel,
  } as const;
}
