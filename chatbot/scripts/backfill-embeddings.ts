import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, isNull, sql } from "drizzle-orm";
import { documents } from "../src/lib/db/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function embedText(text: string): Promise<number[]> {
  const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
  const truncated = cleaned.slice(0, 20_000);
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: truncated,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function main() {
  // Find files without embeddings (raw SQL since embedding is a custom column)
  const result = await db.execute(
    sql`SELECT id, path, content FROM documents
        WHERE type = 'file' AND embedding IS NULL AND content IS NOT NULL AND content != ''`,
  );

  const withContent = result.rows as { id: string; path: string; content: string }[];

  console.log(`Found ${withContent.length} files without embeddings.\n`);

  for (const file of withContent) {
    try {
      console.log(`Embedding: ${file.path} (${file.content!.length} chars)...`);
      const embedding = await embedText(file.content!);
      const embeddingStr = `[${embedding.join(",")}]`;

      await db.execute(
        sql`UPDATE documents SET embedding = ${embeddingStr}::vector WHERE id = ${file.id}`,
      );

      console.log(`  Done (${embedding.length} dimensions)\n`);

      // Rate limit: 1 request per second
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  Failed: ${err}\n`);
    }
  }

  console.log("Backfill complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
