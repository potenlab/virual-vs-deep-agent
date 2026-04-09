import { getEnv } from "@/config/env";

/**
 * Generate an embedding vector for text using OpenRouter's embedding API.
 * Model: openai/text-embedding-3-small (1536 dimensions)
 */
export async function embedText(text: string): Promise<number[]> {
  const env = getEnv();
  // Clean control characters from PDF-extracted text, then truncate
  const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
  const truncated = cleaned.slice(0, 20_000);

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: truncated,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Embedding failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}
