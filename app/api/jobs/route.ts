import { NextRequest, NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const limit = req.nextUrl.searchParams.get("limit") ?? "200";
  const qs = new URLSearchParams({ limit });
  if (status) qs.set("status", status);
  try {
    const data = await orchFetch(`/jobs?${qs}`);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
