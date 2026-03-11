import { NextRequest, NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";
import {
  appendMessage,
  ensureSession,
  dbStatus,
} from "@/lib/chat-session-store";

export interface ChatRequest {
  message: string;
  session_id: string;
}

export interface ChatApiResponse {
  reply: string;
  session_id: string;
  duration_ms: number;
  model?: string;
  usage?: { input: number; output: number; total: number; cacheRead?: number };
}

function msgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const sessionId = body.session_id ?? "dashboard-chat";

    // Persist user message (best-effort — never blocks the response)
    try {
      ensureSession(sessionId);
      appendMessage(sessionId, {
        id: msgId(),
        role: "user",
        content: body.message,
      });
    } catch {
      // DB unavailable — proceed without persistence
    }

    let data: ChatApiResponse;
    try {
      data = await orchFetch<ChatApiResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: body.message,
          session_id: sessionId,
        }),
      });
    } catch (err) {
      // Persist error message so history captures failures too
      try {
        appendMessage(sessionId, {
          id: msgId(),
          role: "error",
          content: String(err),
        });
      } catch {
        // DB unavailable
      }

      const msg = String(err);
      const status = msg.includes("504") ? 504 : msg.includes("503") ? 503 : 502;
      return NextResponse.json({ error: msg }, { status });
    }

    // Persist assistant reply
    try {
      appendMessage(sessionId, {
        id: msgId(),
        role: "assistant",
        content: data.reply,
        model: data.model,
        duration_ms: data.duration_ms,
        usage: data.usage,
      });
    } catch {
      // DB unavailable
    }

    // Attach db_warning if persistence is broken
    const { ok, error: dbErr } = dbStatus();
    if (!ok) {
      return NextResponse.json({ ...data, db_warning: dbErr });
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = String(err);
    const status = msg.includes("504") ? 504 : msg.includes("503") ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function GET() {
  try {
    const data = await orchFetch("/chat/health");
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
