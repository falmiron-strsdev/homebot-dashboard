import { NextRequest } from "next/server";
import { orchFetch } from "@/lib/orch-client";
import {
  appendMessage,
  ensureSession,
  dbStatus,
  getSessionMessages,
} from "@/lib/chat-session-store";

interface OrchChatResponse {
  reply: string;
  session_id: string;
  duration_ms: number;
  model?: string;
  usage?: { input: number; output: number; total: number; cacheRead?: number };
}

function msgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * POST /api/chat/stream
 *
 * Accepts { message, session_id } and streams the Gateway's SSE response
 * back to the browser as a text/event-stream. Credentials are kept
 * server-side only — the browser never sees GATEWAY_TOKEN.
 *
 * Event types emitted to the client:
 *   { type: "chunk",  text: string, firstToken?: boolean }
 *   { type: "done",   session_id, duration_ms, model?, usage?, db_warning? }
 *   { type: "error",  error: string }
 */
export async function POST(req: NextRequest) {
  // ── 1. Parse request ───────────────────────────────────────────────────────
  let userMessage = "";
  let sessionId = "dashboard-chat";

  try {
    const body = await req.json();
    userMessage = (body.message ?? "").trim();
    if (!userMessage) {
      return new Response(sse({ type: "error", error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    sessionId = body.session_id ?? "dashboard-chat";
  } catch {
    return new Response(sse({ type: "error", error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // ── 2. Persist user message (best-effort) ──────────────────────────────────
  const userMsgId = msgId();
  try {
    ensureSession(sessionId);
    appendMessage(sessionId, { id: userMsgId, role: "user", content: userMessage });
  } catch {
    // DB unavailable — proceed without persistence
  }

  // ── 3. Unused history reference kept for potential future use ─────────────
  try { getSessionMessages(sessionId); } catch { /* DB unavailable */ }

  // ── 4. Call orchestrator /chat (blocking) then simulate SSE word-by-word ──
  const startMs = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: object) {
        controller.enqueue(encoder.encode(sse(data)));
      }

      try {
        const data = await orchFetch<OrchChatResponse>("/chat", {
          method: "POST",
          body: JSON.stringify({ message: userMessage, session_id: sessionId }),
        });

        const fullText = data.reply ?? "";
        const duration_ms = Date.now() - startMs;

        // Emit word-by-word to give a streaming feel
        const words = fullText.split(/(\s+)/);
        let firstToken = true;
        for (const word of words) {
          if (word) {
            send({ type: "chunk", text: word, firstToken });
            firstToken = false;
            await new Promise((r) => setTimeout(r, 12));
          }
        }

        // ── 5. Persist assistant reply (best-effort) ───────────────────────
        try {
          appendMessage(sessionId, {
            id: msgId(),
            role: "assistant",
            content: fullText,
            model: data.model,
            duration_ms,
            usage: data.usage,
          });
        } catch {
          // DB unavailable
        }

        const { ok, error: dbErr } = dbStatus();
        send({
          type: "done",
          session_id: sessionId,
          duration_ms,
          model: data.model,
          usage: data.usage,
          ...(ok ? {} : { db_warning: dbErr }),
        });
      } catch (err) {
        const errMsg = String(err);
        try {
          appendMessage(sessionId, { id: msgId(), role: "error", content: errMsg });
        } catch {
          // DB unavailable
        }
        send({ type: "error", error: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx, etc.) so chunks reach the browser immediately
      "X-Accel-Buffering": "no",
    },
  });
}
