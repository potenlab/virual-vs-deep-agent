import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Use globalThis to survive Next.js HMR in development
const globalDb = globalThis as typeof globalThis & {
  __dbPool?: Pool;
};

if (!globalDb.__dbPool) {
  globalDb.__dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const db = drizzle(globalDb.__dbPool, { schema });
export const pool = globalDb.__dbPool;
