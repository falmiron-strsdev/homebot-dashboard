import { NextResponse } from "next/server";
import { listSessions, dbStatus } from "@/lib/chat-session-store";

export async function GET() {
  const { ok, error } = dbStatus();
  if (!ok) {
    return NextResponse.json(
      { error: "Chat history unavailable", detail: error },
      { status: 503 }
    );
  }

  const sessions = listSessions();
  return NextResponse.json({ sessions });
}
