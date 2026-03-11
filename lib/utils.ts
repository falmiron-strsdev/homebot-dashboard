import { formatDistanceToNow, parseISO, differenceInSeconds } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import type { JobStatus, WorkerStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// ── Time ──────────────────────────────────────────────────────────────────────

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function durationSeconds(
  start: string | null,
  end: string | null
): number | null {
  if (!start) return null;
  try {
    const s = parseISO(start);
    const e = end ? parseISO(end) : new Date();
    return differenceInSeconds(e, s);
  } catch {
    return null;
  }
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ── Workers ───────────────────────────────────────────────────────────────────

export const WORKER_STATUS_COLORS: Record<WorkerStatus, string> = {
  idle: "text-emerald-400 bg-emerald-400/10",
  busy: "text-blue-400 bg-blue-400/10",
  offline: "text-gray-500 bg-gray-500/10",
  stale: "text-amber-400 bg-amber-400/10",
};

export const WORKER_DOT_COLORS: Record<WorkerStatus, string> = {
  idle: "bg-emerald-400",
  busy: "bg-blue-400",
  offline: "bg-gray-500",
  stale: "bg-amber-400",
};

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  queued:     "text-slate-300 bg-slate-500/15",
  assigned:   "text-indigo-400 bg-indigo-400/10",
  running:    "text-blue-400 bg-blue-400/10",
  review:     "text-purple-400 bg-purple-400/10",
  qa_running: "text-cyan-400 bg-cyan-400/10",
  completed:  "text-emerald-400 bg-emerald-400/10",
  failed:     "text-red-400 bg-red-400/10",
  cancelled:  "text-gray-500 bg-gray-500/10",
};

export const JOB_DOT_COLORS: Record<JobStatus, string> = {
  queued:     "bg-slate-400",
  assigned:   "bg-indigo-400",
  running:    "bg-blue-400",
  review:     "bg-purple-400",
  qa_running: "bg-cyan-400",
  completed:  "bg-emerald-400",
  failed:     "bg-red-400",
  cancelled:  "bg-gray-500",
};

export const JOB_STATUS_ORDER: JobStatus[] = [
  "queued",
  "assigned",
  "running",
  "review",
  "qa_running",
  "completed",
  "failed",
  "cancelled",
];

// ── Strings ───────────────────────────────────────────────────────────────────

export function parseCapabilities(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function repoName(repoUrl: string): string {
  // git@github.com:org/repo.git → org/repo
  const match = repoUrl.match(/[:/]([^/]+\/[^/]+?)(\.git)?$/);
  return match ? match[1] : repoUrl;
}

export function githubUrl(repoUrl: string, branch?: string | null): string | null {
  const match = repoUrl.match(/github\.com[:/](.+?)(\.git)?$/);
  if (!match) return null;
  const path = match[1];
  if (branch) return `https://github.com/${path}/tree/${branch}`;
  return `https://github.com/${path}`;
}

export function commitUrl(repoUrl: string, sha: string): string | null {
  const match = repoUrl.match(/github\.com[:/](.+?)(\.git)?$/);
  if (!match) return null;
  return `https://github.com/${match[1]}/commit/${sha}`;
}
