// ── Orchestrator API Types ────────────────────────────────────────────────────
// These match the FastAPI + SQLite schema on the Pi orchestrator exactly.

export type WorkerStatus = "idle" | "busy" | "offline" | "stale";
export type JobStatus =
  | "queued"
  | "assigned"
  | "running"
  | "security_pending"
  | "security_running"
  | "review"
  | "qa_running"
  | "completed"
  | "failed"
  | "cancelled";
export type RunStatus = "pending" | "running" | "completed" | "failed";

export interface Worker {
  id: string;
  hostname: string;
  label: string;
  capabilities: string; // JSON array string e.g. '["python","git"]'
  status: "idle" | "busy" | "offline";
  computed_status: WorkerStatus; // includes "stale" derived from last_seen_at
  last_seen_at: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  site_id: string | null;
  repo_url: string;
  base_branch: string;
  work_branch: string | null;
  title: string;
  summary: string | null;
  acceptance_criteria: string | null;
  constraints: string | null;
  assigned_worker: string | null;
  status: JobStatus;
  priority: number;
  attempt_count: number;
  max_fix_attempts: number;
  parent_job_id: string | null;
  escalated: number;
  escalation_reason: string | null;
  qa_passed: number | null;
  qa_analysis: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobEvent {
  id: number;
  job_id: string;
  worker_id: string | null;
  event_type: string;
  message: string | null;
  payload: string | null; // JSON blob
  created_at: string;
}

export interface Run {
  id: string;
  job_id: string;
  worker_id: string;
  run_number: number;
  status: RunStatus;
  branch: string | null;
  commit_sha: string | null;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  log_tail: string | null;
  summary: string | null;
  created_at: string;
}

// ── Dashboard-specific aggregated types ──────────────────────────────────────

export interface OverviewStats {
  workers: {
    total: number;
    idle: number;
    busy: number;
    offline: number;
    stale: number;
  };
  jobs: {
    total: number;
    queued: number;
    assigned: number;
    running: number;
    security_pending: number;
    security_running: number;
    review: number;
    qa_running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  deployments?: {
    total: number;
    live: number;
    building: number;
    failed: number;
    recent: Deployment[];
  };
  recent_jobs: Job[];
  recent_failures: Job[];
  fetched_at: string;
}

export interface JobDetail extends Job {
  events: JobEvent[];
  runs: Run[];
}

export interface ActivityItem {
  job: Job;
  latest_run: Run | null;
  latest_event: JobEvent | null;
}

// ── Self-healing repair types ─────────────────────────────────────────────────

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
  latest_run: {
    run_number: number;
    status: string;
    exit_code: number | null;
    failed_step: string | null;
    failure_type: string | null;
    retryable: number;
    repair_strategy: string | null;
  } | null;
}

export interface LineageResponse {
  root_job_id: string;
  depth: number;
  chain: LineageJob[];
}

// ── Vercel deployment types ───────────────────────────────────────────────────

export type DeploymentStatus = "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";

export interface Deployment {
  id: string;
  job_id: string | null;
  vercel_project_id: string | null;
  status: DeploymentStatus;
  url: string | null;
  alias_url: string | null;
  branch: string | null;
  commit_sha: string | null;
  error_message: string | null;
  created_at: string;
  ready_at: string | null;
  vercel_fix_attempts: number;
  vercel_repair_job_id: string | null;
  project_name?: string;
}

export interface VercelProject {
  id: string;
  name: string;
  repo_url: string;
  framework: string | null;
  created_at: string;
}
