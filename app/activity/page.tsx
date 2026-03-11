"use client";

import Link from "next/link";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { fetchActivity } from "@/lib/api";
import { JobStatusBadge } from "@/components/ui/StatusDot";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import Header from "@/components/layout/Header";
import {
  relativeTime,
  repoName,
  shortId,
  formatDuration,
  durationSeconds,
  commitUrl,
  githubUrl,
} from "@/lib/utils";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ActivityPage() {
  const { data, error, isLoading, isRefreshing, lastUpdated, refresh } =
    useAutoRefresh({ fetcher: fetchActivity, intervalMs: 30_000 });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Activity"
        subtitle="Recent job runs across all workers"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 p-6 overflow-y-auto">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState message="No activity yet" detail="Jobs will appear here once queued." />
        ) : (
          <div className="space-y-2">
            {data.map((item) => (
              <ActivityRow key={item.job.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { job, latest_run, latest_event } = item;
  const ghBranchUrl = job.work_branch ? githubUrl(job.repo_url, job.work_branch) : null;
  const sha = latest_run?.commit_sha;
  const shaUrl = sha ? commitUrl(job.repo_url, sha) : null;
  const duration = formatDuration(
    durationSeconds(latest_run?.started_at ?? null, latest_run?.finished_at ?? null)
  );

  return (
    <div
      className="rounded-lg border p-4 transition-colors hover:border-blue-500/30"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start gap-4">
        {/* Status */}
        <div className="pt-0.5 shrink-0">
          <JobStatusBadge status={job.status} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/jobs/${job.id}`}
              className="text-sm font-medium hover:text-blue-300 transition-colors truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {job.title}
            </Link>
            <span
              className="text-[11px] shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {repoName(job.repo_url)}
            </span>
          </div>

          {/* Branch + commit */}
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            {job.work_branch && (
              <div
                className="text-[11px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {ghBranchUrl ? (
                  <a
                    href={ghBranchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400/70 hover:text-blue-400 hover:underline"
                  >
                    {job.work_branch}
                  </a>
                ) : (
                  job.work_branch
                )}
              </div>
            )}
            {sha && (
              <div className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                {shaUrl ? (
                  <a
                    href={shaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400/70 hover:text-blue-400 hover:underline"
                  >
                    {sha.slice(0, 10)}
                  </a>
                ) : (
                  sha.slice(0, 10)
                )}
              </div>
            )}
          </div>

          {/* Latest event message */}
          {latest_event?.message && (
            <div
              className="mt-1.5 text-[11px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {latest_event.message}
            </div>
          )}

          {/* Latest run summary (truncated) */}
          {latest_run?.summary && (
            <div
              className="mt-1.5 text-[11px] leading-relaxed line-clamp-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {latest_run.summary}
            </div>
          )}
        </div>

        {/* Right metadata */}
        <div className="text-right shrink-0 space-y-1.5">
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {relativeTime(job.updated_at)}
          </div>

          {/* Run stats */}
          {latest_run && (
            <div className="space-y-0.5">
              <div
                className={cn(
                  "text-[11px] font-medium uppercase",
                  latest_run.status === "completed"
                    ? "text-emerald-400"
                    : latest_run.status === "failed"
                    ? "text-red-400"
                    : latest_run.status === "running"
                    ? "text-blue-400"
                    : "text-gray-500"
                )}
              >
                Run #{latest_run.run_number} · {latest_run.status}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {duration !== "—" && `${duration} · `}
                {latest_run.exit_code !== null && `exit ${latest_run.exit_code}`}
              </div>
            </div>
          )}

          <div
            className="text-[10px] font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {shortId(job.id)}
          </div>
        </div>
      </div>
    </div>
  );
}
