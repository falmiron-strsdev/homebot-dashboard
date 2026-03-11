import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const data = await orchFetch(`/workers/${id}`);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

// Mark a worker offline first, then hard-delete the registration
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Step 1: mark offline (idempotent — already offline workers are fine)
    await orchFetch(`/workers/${id}`, { method: "DELETE" }).catch(() => null);
    // Step 2: hard-delete the row
    const data = await orchFetch(`/workers/${id}/purge`, { method: "DELETE" });
    return NextResponse.json(data);
  } catch (err) {
    const msg = String(err);
    const status = msg.includes("409") ? 409 : msg.includes("404") ? 404 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
