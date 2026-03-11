import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";
import type { Worker, Job, OverviewStats, Deployment } from "@/lib/types";

export async function GET() {
  try {
    const [workers, jobs, deploymentsRaw] = await Promise.all([
      orchFetch<Worker[]>("/workers"),
      orchFetch<Job[]>("/jobs?limit=200"),
      orchFetch<Deployment[]>("/vercel/deployments?limit=50").catch(() => [] as Deployment[]),
    ]);

    const workerStats = {
      total: workers.length,
      idle: workers.filter((w) => w.computed_status === "idle").length,
      busy: workers.filter((w) => w.computed_status === "busy").length,
      offline: workers.filter((w) => w.computed_status === "offline").length,
      stale: workers.filter((w) => w.computed_status === "stale").length,
    };

    const jobCounts = {
      total: jobs.length,
      queued: 0,
      assigned: 0,
      running: 0,
      review: 0,
      qa_running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const j of jobs) {
      if (j.status in jobCounts) {
        (jobCounts as Record<string, number>)[j.status]++;
      }
    }

    // Most recently updated jobs
    const sorted = [...jobs].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const recent_jobs = sorted.slice(0, 8);
    const recent_failures = sorted
      .filter((j) => j.status === "failed")
      .slice(0, 5);

    const deploymentStats = {
      total: deploymentsRaw.length,
      live: deploymentsRaw.filter((d) => d.status === "READY").length,
      building: deploymentsRaw.filter((d) => d.status === "BUILDING" || d.status === "QUEUED").length,
      failed: deploymentsRaw.filter((d) => d.status === "ERROR").length,
      recent: deploymentsRaw.slice(0, 5),
    };

    const stats: OverviewStats = {
      workers: workerStats,
      jobs: jobCounts,
      deployments: deploymentStats,
      recent_jobs,
      recent_failures,
      fetched_at: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
