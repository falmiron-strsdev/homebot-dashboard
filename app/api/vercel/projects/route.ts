import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

export async function GET() {
  try {
    const data = await orchFetch("/vercel/projects");
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
