// Server-side client for the OpenAI-compatible Gateway endpoint.
// Used ONLY in API routes — never imported by client components.
// GATEWAY_TOKEN and GATEWAY_URL stay server-side and are never sent to the browser.

const GATEWAY_URL =
  process.env.GATEWAY_URL ?? process.env.ORCH_URL ?? "http://192.168.1.222:8000";
const GATEWAY_TOKEN =
  process.env.GATEWAY_TOKEN ?? process.env.ORCH_API_KEY ?? "";

export interface GatewayMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Stream a chat completion from the Gateway's OpenAI-compatible endpoint.
 * Returns the raw fetch Response so the caller can pipe the SSE body.
 * Throws on non-2xx status.
 */
export async function streamChatCompletion(
  messages: GatewayMessage[],
  options?: { model?: string; signal?: AbortSignal }
): Promise<Response> {
  const url = `${GATEWAY_URL}/v1/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (GATEWAY_TOKEN) {
    headers["Authorization"] = `Bearer ${GATEWAY_TOKEN}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: options?.model ?? "default",
      messages,
      stream: true,
    }),
    cache: "no-store",
    signal: options?.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gateway ${res.status} ${res.statusText} [/v1/chat/completions]${body ? `: ${body}` : ""}`
    );
  }

  return res;
}

/** Whether the Gateway is explicitly configured via env vars. */
export function isGatewayConfigured(): boolean {
  return !!(process.env.GATEWAY_URL || process.env.GATEWAY_TOKEN);
}
