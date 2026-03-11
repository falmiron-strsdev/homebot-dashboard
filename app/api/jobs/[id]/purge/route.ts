import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

// Hard-delete a job (terminal states only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const data = await orchFetch(`/jobs/${id}/purge`, { method: "DELETE" });
    return NextResponse.json(data);
  } catch (err) {
    const msg = String(err);
    const status = msg.includes("409") ? 409 : msg.includes("404") ? 404 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
