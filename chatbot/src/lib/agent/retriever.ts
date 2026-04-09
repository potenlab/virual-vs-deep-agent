import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface RetrievedDocument {
  path: string;
  name: string;
  content: string;
  similarity: number;
}

export async function retrieveDocuments(
  queryEmbedding: number[],
  queryText: string,
  topK: number = 5,
): Promise<RetrievedDocument[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const vectorResults = await db.execute(sql`
    SELECT path, name,
           LEFT(content, 2000) as content,
           1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM documents
    WHERE type = 'file' AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  if (vectorResults.rows && vectorResults.rows.length > 0) {
    return vectorResults.rows as unknown as RetrievedDocument[];
  }

  const ftsResults = await db.execute(sql`
    SELECT path, name,
           LEFT(content, 2000) as content,
           ts_rank(to_tsvector('english', coalesce(content, '')),
                   plainto_tsquery('english', ${queryText})) as similarity
    FROM documents
    WHERE type = 'file'
      AND to_tsvector('english', coalesce(content, '')) @@ plainto_tsquery('english', ${queryText})
    ORDER BY similarity DESC
    LIMIT ${topK}
  `);

  return (ftsResults.rows ?? []) as unknown as RetrievedDocument[];
}
