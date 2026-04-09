import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getDefaultProjectId } from "@/lib/default-project";

// GET /api/documents — list all documents
export async function GET() {
  const projectId = await getDefaultProjectId();

  const rows = await db
    .select({
      id: documents.id,
      path: documents.path,
      name: documents.name,
      type: documents.type,
      sizeBytes: documents.sizeBytes,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(asc(documents.path));

  return NextResponse.json({ documents: rows });
}

// POST /api/documents — upload a file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const uploadPath = formData.get("path") as string | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    // Max 20MB
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 20MB.` },
        { status: 400 },
      );
    }

    const projectId = await getDefaultProjectId();
    const fileName = file.name;
    let content: string;

    if (fileName.toLowerCase().endsWith(".pdf")) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse-new") as (buf: Buffer) => Promise<{ text: string }>;
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdf = await pdfParse(buffer);
      content = pdf.text;
    } else {
      content = await file.text();
    }

    const filePath = uploadPath
      ? `${uploadPath.replace(/\/$/, "")}/${fileName}`
      : `/uploads/${fileName}`;

    // Ensure parent directories exist
    const parts = filePath.split("/").filter(Boolean);
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += "/" + parts[i];
      const existing = await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.projectId, projectId), eq(documents.path, currentPath)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(documents).values({
          projectId,
          path: currentPath,
          name: parts[i],
          type: "directory",
          content: null,
          sizeBytes: 0,
        }).onConflictDoNothing();
      }
    }

    // Upsert the file
    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.projectId, projectId), eq(documents.path, filePath)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(documents)
        .set({
          content,
          sizeBytes: Buffer.byteLength(content, "utf-8"),
          updatedAt: new Date(),
        })
        .where(and(eq(documents.projectId, projectId), eq(documents.path, filePath)));
    } else {
      await db.insert(documents).values({
        projectId,
        path: filePath,
        name: fileName,
        type: "file",
        content,
        sizeBytes: Buffer.byteLength(content, "utf-8"),
      });
    }

    return NextResponse.json(
      {
        success: true,
        document: {
          path: filePath,
          name: fileName,
          size: Buffer.byteLength(content, "utf-8"),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/documents]", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to upload document", detail },
      { status: 500 },
    );
  }
}
