import { NextRequest, NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

// Bulk purge jobs by status list
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await orchFetch("/jobs/purge-bulk", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err) {
    const msg = String(err);
    const status = msg.includes("400") ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
