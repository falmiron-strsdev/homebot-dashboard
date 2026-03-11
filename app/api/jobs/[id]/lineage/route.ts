import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";

export interface RepairRun {
  run_number: number;
  status: string;
  exit_code: number | null;
  failed_step: string | null;
  failure_type: string | null;
  retryable: number;
  repair_strategy: string | null;
}

export interface LineageJob {
  id: string;
  title: string;
  status: string;
  attempt_count: number;
  max_fix_attempts: number;
  parent_job_id: string | null;
  escalated: number;
  escalation_reason: string | null;
  work_branch: string | null;
  created_at: string;
  updated_at: string;
  latest_run: RepairRun | null;
}

export interface LineageResponse {
  root_job_id: string;
  depth: number;
  chain: LineageJob[];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const data = await orchFetch<LineageResponse>(`/jobs/${id}/lineage`);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
