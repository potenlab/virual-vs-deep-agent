import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { documents } from "../src/lib/db/schema";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Seeding demo documents...");

  const docs = [
    { path: "/", name: "/", type: "directory" as const, content: null, sizeBytes: 0 },
    { path: "/docs", name: "docs", type: "directory" as const, content: null, sizeBytes: 0 },
    {
      path: "/docs/README.md",
      name: "README.md",
      type: "file" as const,
      content: `# Demo Project\n\nThis is a demo project for testing the Virtual FS + AI Agent.\n\n## Features\n- Document upload and reading\n- AI-powered search\n- Virtual filesystem browsing`,
    },
    {
      path: "/docs/architecture.md",
      name: "architecture.md",
      type: "file" as const,
      content: `# Architecture\n\n## Stack\n- Frontend: Next.js + Tailwind\n- Backend: Next.js API Routes\n- AI: DeepAgents + OpenRouter\n- DB: PostgreSQL + pgvector\n\n## Virtual FS\nFiles are stored in PostgreSQL. The agent browses them via ls, cat, grep commands.`,
    },
  ];

  for (const doc of docs) {
    await db.insert(documents).values({
      path: doc.path,
      name: doc.name,
      type: doc.type,
      content: doc.content,
      sizeBytes: doc.content?.length ?? 0,
    }).onConflictDoNothing();
  }

  console.log(`  Documents: ${docs.length} entries`);
  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
