import { NextRequest } from "next/server";
import { streamChatCompletion, GatewayMessage } from "@/lib/gateway-client";
import {
  appendMessage,
  ensureSession,
  dbStatus,
  getSessionMessages,
} from "@/lib/chat-session-store";

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

  // ── 3. Build message history for context window ────────────────────────────
  // Fetch the last 40 stored messages (20 turns) so the Gateway has context.
  const gatewayMessages: GatewayMessage[] = [];
  try {
    const history = getSessionMessages(sessionId);
    // Include up to the most-recent 40 messages (excluding the one we just stored)
    const contextMessages = history
      .filter((m) => m.role !== "error" && m.id !== userMsgId)
      .slice(-40);
    for (const m of contextMessages) {
      gatewayMessages.push({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      });
    }
  } catch {
    // DB unavailable — send without history
  }
  // Always append the current user turn
  gatewayMessages.push({ role: "user", content: userMessage });

  // ── 4. Create ReadableStream that proxies Gateway SSE ─────────────────────
  const startMs = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: object) {
        controller.enqueue(encoder.encode(sse(data)));
      }

      try {
        const gatewayRes = await streamChatCompletion(gatewayMessages);
        const reader = gatewayRes.body!.getReader();
        const decoder = new TextDecoder();

        let sseBuffer = "";
        let fullText = "";
        let model: string | undefined;
        let usage:
          | { input: number; output: number; total: number; cacheRead?: number }
          | undefined;
        let firstToken = true;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;

            let chunk: {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
              model?: string;
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
                prompt_tokens_details?: { cached_tokens?: number };
              };
            };
            try {
              chunk = JSON.parse(raw);
            } catch {
              continue;
            }

            if (chunk.model) model = chunk.model;

            if (chunk.usage) {
              usage = {
                input: chunk.usage.prompt_tokens ?? 0,
                output: chunk.usage.completion_tokens ?? 0,
                total: chunk.usage.total_tokens ?? 0,
                cacheRead:
                  chunk.usage.prompt_tokens_details?.cached_tokens ?? undefined,
              };
            }

            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              send({ type: "chunk", text: delta, firstToken });
              firstToken = false;
            }
          }
        }

        const duration_ms = Date.now() - startMs;

        // ── 5. Persist assistant reply (best-effort) ─────────────────────────
        try {
          appendMessage(sessionId, {
            id: msgId(),
            role: "assistant",
            content: fullText,
            model,
            duration_ms,
            usage,
          });
        } catch {
          // DB unavailable
        }

        const { ok, error: dbErr } = dbStatus();
        send({
          type: "done",
          session_id: sessionId,
          duration_ms,
          model,
          usage,
          ...(ok ? {} : { db_warning: dbErr }),
        });
      } catch (err) {
        const errMsg = String(err);
        // Persist error (best-effort)
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
