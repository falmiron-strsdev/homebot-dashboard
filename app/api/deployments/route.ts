import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";
import type { Deployment } from "./[jobId]/route";

export async function GET() {
  try {
    const data = await orchFetch<Deployment[]>("/vercel/deployments?limit=20");
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json([], { status: 200 }); // degrade gracefully
  }
}
