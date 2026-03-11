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
import { RiExternalLinkLine } from "react-icons/ri";

export default function OverviewPage() {
  const router = useRouter();
  const { data, error, isLoading, isRefreshing, lastUpdated, refresh } =
    useAutoRefresh({ fetcher: fetchOverview, intervalMs: 30_000 });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { workers, jobs, deployments, recent_jobs, recent_failures } = data;
  const activeWorkers = workers.idle + workers.busy;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Overview"
        subtitle="System health at a glance"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Workers section */}
        <section>
          <SectionLabel>Workers</SectionLabel>
          <div className="grid grid-cols-4 gap-3">
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
          <div className="grid grid-cols-4 gap-3">
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
      className="flex items-center gap-4 px-4 py-3"
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
          {displayUrl.replace("https://", "").split("/")[0]}
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
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)] group"
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
      <div className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
        {shortId(job.id)}
      </div>
    </Link>
  );
}
