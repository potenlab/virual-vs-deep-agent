import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/session-store";

export async function GET() {
  const store = getStore();
  const sessions = await store.listSessions();
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const store = getStore();
  const body = await request.json().catch(() => ({}));
  const title = body.title || undefined;
  const session = await store.createSession(title);
  return NextResponse.json({ session }, { status: 201 });
}
