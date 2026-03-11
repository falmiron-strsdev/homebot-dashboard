import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

// Mark all stale workers as offline
export async function POST() {
  try {
    const data = await orchFetch("/workers/sweep-stale", { method: "POST" });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
