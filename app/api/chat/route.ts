import { NextRequest, NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

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

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const data = await orchFetch<ChatApiResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({
        message: body.message,
        session_id: body.session_id ?? "dashboard-chat",
      }),
    });

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
