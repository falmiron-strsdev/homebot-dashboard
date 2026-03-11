import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

export interface Deployment {
  id: string;
  job_id: string | null;
  vercel_project_id: string | null;
  status: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  url: string | null;
  alias_url: string | null;
  branch: string | null;
  commit_sha: string | null;
  error_message: string | null;
  created_at: string;
  ready_at: string | null;
  project_name?: string;
}

export interface DeploymentResponse {
  deployment: Deployment | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    const data = await orchFetch<DeploymentResponse>(`/vercel/deployments/${jobId}`);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ deployment: null, error: String(err) }, { status: 502 });
  }
}
