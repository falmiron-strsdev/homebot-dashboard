// Client-side API helpers — all calls go to /api/* Next.js routes,
// which proxy to the Pi orchestrator server-side (keeps the API key private).

import type {
  Worker,
  Job,
  JobEvent,
  Run,
  OverviewStats,
  ActivityItem,
} from "./types";

const BASE = "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

async function mutate<T>(
  path: string,
  method: "DELETE" | "POST" | "PATCH",
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const msg = json?.detail ?? json?.error ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Workers ───────────────────────────────────────────────────────────────────

export const fetchWorkers = () => get<Worker[]>("/api/workers");
export const fetchWorker = (id: string) => get<Worker>(`/api/workers/${id}`);

export const removeWorker = (id: string) =>
  mutate<{ ok: boolean }>(`/api/workers/${id}`, "DELETE");

export const sweepStaleWorkers = () =>
  mutate<{ swept: number }>("/api/workers/sweep-stale", "POST");

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const fetchJobs = (status?: string) =>
  get<Job[]>(`/api/jobs${status ? `?status=${status}` : ""}`);

export const fetchJob = (id: string) => get<Job>(`/api/jobs/${id}`);
export const fetchJobEvents = (id: string) => get<JobEvent[]>(`/api/jobs/${id}/events`);
export const fetchJobRuns = (id: string) => get<Run[]>(`/api/jobs/${id}/runs`);

export const cancelJob = (id: string) =>
  mutate<{ ok: boolean; status: string }>(`/api/jobs/${id}`, "DELETE");

export const completeJob = (id: string) =>
  mutate<{ status: string }>(`/api/jobs/${id}/status`, "PATCH", { status: "completed" });

export const purgeJob = (id: string) =>
  mutate<{ ok: boolean; purged: boolean }>(`/api/jobs/${id}/purge`, "DELETE");

export const purgeBulk = (statuses: string[]) =>
  mutate<{ ok: boolean; deleted: number; statuses: string[] }>(
    "/api/jobs/purge-bulk",
    "POST",
    { statuses }
  );

// ── Runs ──────────────────────────────────────────────────────────────────────

export const fetchRun = (id: string) => get<Run>(`/api/runs/${id}`);

// ── Aggregated ────────────────────────────────────────────────────────────────

export const fetchOverview = () => get<OverviewStats>("/api/overview");
export const fetchActivity = () => get<ActivityItem[]>("/api/activity");

// ── Vercel ────────────────────────────────────────────────────────────────────

export const fetchJobLineage = (id: string) =>
  get<import("./types").LineageResponse>(`/api/jobs/${id}/lineage`);

export const fetchDeployment = (jobId: string) =>
  get<{ deployment: import("./types").Deployment | null }>(`/api/deployments/${jobId}`);

export const triggerVercelDeploy = (jobId: string) =>
  mutate<{ ok: boolean; message: string }>(`/api/vercel/trigger/${jobId}`, "POST");

export const triggerVercelFix = (deploymentId: string) =>
  mutate<{ ok: boolean; fix_job_id: string; attempt: number }>(
    `/api/vercel/deployments/${deploymentId}/fix`,
    "POST"
  );

export const fetchRecentDeployments = () =>
  get<import("./types").Deployment[]>("/api/deployments");

export const fetchVercelProjects = () =>
  get<import("./types").VercelProject[]>("/api/vercel/projects");
