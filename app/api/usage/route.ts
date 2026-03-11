import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";
import type { Job, Run } from "@/lib/types";

export interface UsageData {
  total_jobs: number;
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  total_runtime_seconds: number;
  avg_runtime_seconds: number | null;
  per_worker: {
    worker_id: string;
    runs: number;
    completed: number;
    failed: number;
    runtime_seconds: number;
  }[];
  per_status: { status: string; count: number }[];
  has_token_data: false;
  has_cost_data: false;
  note: string;
}

export async function GET() {
  try {
    const jobs = await orchFetch<Job[]>("/jobs?limit=200");

    // Fetch runs for all jobs in parallel (limited to avoid hammering Pi)
    const runResults = await Promise.allSettled(
      jobs.map((j) => orchFetch<Run[]>(`/jobs/${j.id}/runs`))
    );

    const allRuns: Run[] = [];
    for (const r of runResults) {
      if (r.status === "fulfilled") allRuns.push(...r.value);
    }

    // Aggregate runtime
    let totalRuntimeSecs = 0;
    let countedRuns = 0;
    const workerMap: Record<
      string,
      { runs: number; completed: number; failed: number; runtime_seconds: number }
    > = {};

    for (const run of allRuns) {
      if (!workerMap[run.worker_id]) {
        workerMap[run.worker_id] = { runs: 0, completed: 0, failed: 0, runtime_seconds: 0 };
      }
      workerMap[run.worker_id].runs++;
      if (run.status === "completed") workerMap[run.worker_id].completed++;
      if (run.status === "failed") workerMap[run.worker_id].failed++;

      if (run.started_at && run.finished_at) {
        const secs =
          (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000;
        if (secs > 0) {
          totalRuntimeSecs += secs;
          workerMap[run.worker_id].runtime_seconds += secs;
          countedRuns++;
        }
      }
    }

    const statusCounts: Record<string, number> = {};
    for (const j of jobs) {
      statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
    }

    const data: UsageData = {
      total_jobs: jobs.length,
      total_runs: allRuns.length,
      completed_runs: allRuns.filter((r) => r.status === "completed").length,
      failed_runs: allRuns.filter((r) => r.status === "failed").length,
      total_runtime_seconds: Math.round(totalRuntimeSecs),
      avg_runtime_seconds: countedRuns > 0 ? Math.round(totalRuntimeSecs / countedRuns) : null,
      per_worker: Object.entries(workerMap).map(([worker_id, stats]) => ({
        worker_id,
        ...stats,
        runtime_seconds: Math.round(stats.runtime_seconds),
      })),
      per_status: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      has_token_data: false,
      has_cost_data: false,
      note: "Token and cost tracking are not yet instrumented in the orchestrator. See the backend additions section for what is needed.",
    };

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
