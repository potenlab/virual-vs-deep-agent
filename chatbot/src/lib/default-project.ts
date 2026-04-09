import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_PROJECT_ID = "11111111-1111-1111-1111-111111111111";

/**
 * Returns the default project ID, auto-creating it if it doesn't exist.
 * This removes the need for users to manage projects — documents just work.
 */
export async function getDefaultProjectId(): Promise<string> {
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, DEFAULT_PROJECT_ID))
    .limit(1);

  if (existing) return existing.id;

  await db
    .insert(projects)
    .values({
      id: DEFAULT_PROJECT_ID,
      name: "Default",
      slug: "default",
      description: "Default project",
      ownerId: "00000000-0000-0000-0000-000000000001",
    })
    .onConflictDoNothing();

  return DEFAULT_PROJECT_ID;
}
