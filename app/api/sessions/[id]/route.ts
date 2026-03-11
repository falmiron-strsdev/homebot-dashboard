import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  getSessionMessages,
  renameSession,
  deleteSession,
  dbStatus,
} from "@/lib/chat-session-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const { ok, error } = dbStatus();
  if (!ok) {
    return NextResponse.json(
      { error: "Chat history unavailable", detail: error },
      { status: 503 }
    );
  }

  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const messages = getSessionMessages(id);
  return NextResponse.json({ session, messages });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const { ok, error } = dbStatus();
  if (!ok) {
    return NextResponse.json(
      { error: "Chat history unavailable", detail: error },
      { status: 503 }
    );
  }

  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const updated = renameSession(id, body.title.trim());
  if (!updated) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const { ok, error } = dbStatus();
  if (!ok) {
    return NextResponse.json(
      { error: "Chat history unavailable", detail: error },
      { status: 503 }
    );
  }

  const deleted = deleteSession(id);
  if (!deleted) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
