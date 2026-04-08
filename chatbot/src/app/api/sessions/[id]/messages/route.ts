import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/session-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getStore();
  const session = await store.getSession(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const messages = await store.getMessages(id);
  return NextResponse.json({ messages });
}
