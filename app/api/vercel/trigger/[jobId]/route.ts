import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    const data = await orchFetch(`/vercel/trigger/${jobId}`, { method: "POST" });
    return NextResponse.json(data);
  } catch (err) {
    const msg = String(err);
    const status = msg.includes("409") ? 409 : msg.includes("404") ? 404 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
