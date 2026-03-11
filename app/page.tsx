"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { fetchOverview } from "@/lib/api";
import { StatCard } from "@/components/overview/StatCard";
import { JobStatusBadge, WorkerStatusBadge } from "@/components/ui/StatusDot";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import Header from "@/components/layout/Header";
import { relativeTime, repoName, shortId } from "@/lib/utils";
import type { Job, Deployment } from "@/lib/types";
import { RiExternalLinkLine, RiRefreshLine, RiRobotLine, RiBriefcaseLine, RiServerLine } from "react-icons/ri";

export default function OverviewPage() {
  const router = useRouter();
  const { data, error, isLoading, isRefreshing, lastUpdated, refresh } =
    useAutoRefresh({ fetcher: fetchOverview, intervalMs: 30_000 });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { workers, jobs, deployments, recent_jobs, recent_failures } = data;
  const activeWorkers = workers.idle + workers.busy;
  const systemHealthy = activeWorkers > 0 && workers.offline + workers.stale === 0;
  const systemDegraded = workers.offline + workers.stale > 0;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Overview"
        subtitle="System health at a glance"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto pb-24 md:pb-6">

        {/* ── Mobile hero ────────────────────────────────────────────────── */}
        <section className="md:hidden">
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur-light)",
              WebkitBackdropFilter: "var(--glass-blur-light)",
              border: "1px solid var(--glass-border-bright)",
              boxShadow: systemHealthy
                ? "0 0 24px var(--glow-blue)"
                : systemDegraded
                ? "0 0 24px rgba(245,158,11,0.15)"
                : "none",
            }}
          >
            {/* Status row */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  System Status
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      systemHealthy
                        ? "bg-emerald-400 animate-pulse-dot"
                        : systemDegraded
                        ? "bg-amber-400 animate-pulse-dot"
                        : "bg-gray-500"
                    }`}
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {systemHealthy
                      ? "All systems operational"
                      : systemDegraded
                      ? `${workers.offline + workers.stale} worker(s) offline`
                      : "No active workers"}
                  </span>
                </div>
              </div>
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
              >
                <RiRefreshLine
                  className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                  style={{ color: "var(--text-secondary)" }}
                />
              </button>
            </div>

            {/* At-a-glance stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div
                className="text-center p-2.5 rounded-lg"
                style={{ background: "var(--bg-elevated)" }}
              >
                <div className="text-2xl font-semibold text-emerald-400 tabular-nums">
                  {activeWorkers}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wider mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Workers
                </div>
              </div>
              <div
                className="text-center p-2.5 rounded-lg"
                style={{ background: "var(--bg-elevated)" }}
              >
                <div className="text-2xl font-semibold text-blue-400 tabular-nums">
                  {jobs.running + jobs.assigned}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wider mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Running
                </div>
              </div>
              <div
                className="text-center p-2.5 rounded-lg"
                style={{ background: "var(--bg-elevated)" }}
              >
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    jobs.queued > 0 ? "text-slate-300" : "text-gray-500"
                  }`}
                >
                  {jobs.queued}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wider mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Queued
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <Link
                href="/chat"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "rgba(29,78,216,0.25)",
                  border: "1px solid rgba(59,130,246,0.3)",
                  color: "#93c5fd",
                }}
              >
                <RiRobotLine className="w-4 h-4" />
                Chat
              </Link>
              <Link
                href="/jobs"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <RiBriefcaseLine className="w-4 h-4" />
                Jobs
              </Link>
              <Link
                href="/workers"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <RiServerLine className="w-4 h-4" />
                Workers
              </Link>
            </div>
          </div>
        </section>

        {/* Workers section */}
        <section>
          <SectionLabel>Workers</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Active"
              value={activeWorkers}
              sub={`of ${workers.total} total`}
              accent="text-emerald-400"
              onClick={() => router.push("/workers")}
            />
            <StatCard
              label="Idle"
              value={workers.idle}
              accent="text-emerald-400"
              onClick={() => router.push("/workers")}
            />
            <StatCard
              label="Busy"
              value={workers.busy}
              accent="text-blue-400"
              onClick={() => router.push("/workers")}
            />
            <StatCard
              label="Offline / Stale"
              value={workers.offline + workers.stale}
              accent={
                workers.offline + workers.stale > 0
                  ? "text-amber-400"
                  : "text-gray-500"
              }
              onClick={() => router.push("/workers")}
            />
          </div>
        </section>

        {/* Jobs section */}
        <section>
          <SectionLabel>Jobs</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total" value={jobs.total} onClick={() => router.push("/jobs")} />
            <StatCard
              label="Queued"
              value={jobs.queued}
              accent={jobs.queued > 0 ? "text-slate-300" : undefined}
              onClick={() => router.push("/jobs?status=queued")}
            />
            <StatCard
              label="Running"
              value={jobs.running + jobs.assigned}
              accent={jobs.running + jobs.assigned > 0 ? "text-blue-400" : undefined}
              sub={jobs.assigned > 0 ? `${jobs.assigned} assigned` : undefined}
              onClick={() => router.push("/jobs?status=running")}
            />
            <StatCard
              label="In Review"
              value={jobs.review}
              accent={jobs.review > 0 ? "text-purple-400" : undefined}
              onClick={() => router.push("/jobs?status=review")}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <StatCard
              label="Completed"
              value={jobs.completed}
              accent="text-emerald-400"
              onClick={() => router.push("/jobs?status=completed")}
            />
            <StatCard
              label="Failed"
              value={jobs.failed}
              accent={jobs.failed > 0 ? "text-red-400" : undefined}
              onClick={() => router.push("/jobs?status=failed")}
            />
            <StatCard
              label="Cancelled"
              value={jobs.cancelled}
              accent="text-gray-500"
              onClick={() => router.push("/jobs?status=cancelled")}
            />
          </div>
        </section>

        {/* Vercel Deployments */}
        {deployments && deployments.total > 0 && (
          <section>
            <SectionLabel>Vercel Deployments</SectionLabel>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <StatCard
                label="Live"
                value={deployments.live}
                accent="text-emerald-400"
              />
              <StatCard
                label="Building"
                value={deployments.building}
                accent={deployments.building > 0 ? "text-blue-400" : undefined}
              />
              <StatCard
                label="Failed"
                value={deployments.failed}
                accent={deployments.failed > 0 ? "text-red-400" : undefined}
              />
            </div>
            {deployments.recent.length > 0 && (
              <div
                className="rounded-lg border divide-y overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                {deployments.recent.map((dep) => (
                  <DeploymentRow key={dep.id} deployment={dep} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Recent failures */}
        {recent_failures.length > 0 && (
          <section>
            <SectionLabel className="text-red-400/70">Recent Failures</SectionLabel>
            <div
              className="rounded-lg border divide-y overflow-hidden"
              style={{ borderColor: "var(--border)" }}
            >
              {recent_failures.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          </section>
        )}

        {/* Recent jobs */}
        <section>
          <SectionLabel>Recent Jobs</SectionLabel>
          {recent_jobs.length === 0 ? (
            <EmptyState message="No jobs yet" detail="Jobs will appear here once queued." />
          ) : (
            <div
              className="rounded-lg border divide-y overflow-hidden"
              style={{ borderColor: "var(--border)" }}
            >
              {recent_jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>

        {/* Footer timestamp */}
        <div className="text-[11px] pb-2" style={{ color: "var(--text-muted)" }}>
          Data refreshes every 30 s · last fetched {lastUpdated}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[11px] uppercase tracking-widest font-semibold mb-2 ${className ?? ""}`}
      style={className ? undefined : { color: "var(--text-muted)" }}
    >
      {children}
    </div>
  );
}

function DeploymentRow({ deployment }: { deployment: Deployment }) {
  const STATUS_COLORS: Record<string, string> = {
    READY:    "text-emerald-400",
    BUILDING: "text-blue-400",
    QUEUED:   "text-slate-400",
    ERROR:    "text-red-400",
    CANCELED: "text-gray-500",
  };
  const displayUrl = deployment.alias_url ?? deployment.url;
  const color = STATUS_COLORS[deployment.status] ?? "text-gray-400";
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: "var(--bg-surface)" }}
    >
      <span className={`text-[11px] font-medium uppercase w-16 shrink-0 ${color}`}>
        {deployment.status === "READY" ? "Live" : deployment.status}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
          {deployment.project_name ?? deployment.vercel_project_id}
        </div>
      </div>
      {displayUrl ? (
        <a
          href={displayUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline shrink-0"
        >
          <span className="hidden sm:inline">
            {displayUrl.replace("https://", "").split("/")[0]}
          </span>
          <RiExternalLinkLine className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
          {relativeTime(deployment.created_at)}
        </span>
      )}
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)] group"
      style={{ background: "var(--bg-surface)" }}
    >
      <JobStatusBadge status={job.status} />
      <div className="flex-1 min-w-0">
        <div
          className="text-xs font-medium truncate group-hover:text-blue-300 transition-colors"
          style={{ color: "var(--text-primary)" }}
        >
          {job.title}
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
          {repoName(job.repo_url)}
          {job.work_branch && (
            <span className="ml-2 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              {job.work_branch}
            </span>
          )}
        </div>
      </div>
      <div className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
        {relativeTime(job.updated_at)}
      </div>
      <div className="text-[10px] font-mono shrink-0 hidden sm:block" style={{ color: "var(--text-muted)" }}>
        {shortId(job.id)}
      </div>
    </Link>
  );
}
