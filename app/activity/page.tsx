"use client";

import Link from "next/link";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { fetchActivity } from "@/lib/api";
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
  cn,
} from "@/lib/utils";
import type { ActivityItem } from "@/lib/types";
import {
  RiCheckboxCircleLine,
  RiAlertLine,
  RiLoaderLine,
  RiRefreshLine,
  RiEyeLine,
  RiCodeLine,
  RiShieldLine,
  RiGitBranchLine,
  RiGitCommitLine,
  RiTimerLine,
} from "react-icons/ri";

// ── Status → icon / style maps ─────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  completed:        RiCheckboxCircleLine,
  failed:           RiAlertLine,
  running:          RiLoaderLine,
  assigned:         RiTimerLine,
  queued:           RiTimerLine,
  review:           RiEyeLine,
  qa_running:       RiCodeLine,
  security_running: RiShieldLine,
  security_pending: RiShieldLine,
  cancelled:        RiAlertLine,
};

const STATUS_ICON_STYLE: Record<string, React.CSSProperties> = {
  completed:        { color: "#34d399", background: "rgba(52,211,153,0.12)",  border: "1px solid rgba(52,211,153,0.25)" },
  failed:           { color: "#f87171", background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.22)" },
  running:          { color: "#60a5fa", background: "rgba(96,165,250,0.12)",  border: "1px solid rgba(96,165,250,0.25)" },
  assigned:         { color: "#93c5fd", background: "rgba(147,197,253,0.10)", border: "1px solid rgba(147,197,253,0.20)" },
  queued:           { color: "#fbbf24", background: "rgba(251,191,36,0.10)",  border: "1px solid rgba(251,191,36,0.22)" },
  review:           { color: "#c084fc", background: "rgba(192,132,252,0.10)", border: "1px solid rgba(192,132,252,0.22)" },
  qa_running:       { color: "#818cf8", background: "rgba(129,140,248,0.10)", border: "1px solid rgba(129,140,248,0.22)" },
  security_running: { color: "#fbbf24", background: "rgba(251,191,36,0.10)",  border: "1px solid rgba(251,191,36,0.22)" },
  security_pending: { color: "#fde68a", background: "rgba(253,230,138,0.08)", border: "1px solid rgba(253,230,138,0.18)" },
  cancelled:        { color: "#6b7280", background: "rgba(107,114,128,0.10)", border: "1px solid rgba(107,114,128,0.20)" },
};

const DEFAULT_ICON_STYLE: React.CSSProperties = {
  color: "#6b7280",
  background: "rgba(107,114,128,0.10)",
  border: "1px solid rgba(107,114,128,0.20)",
};

// ── Page ───────────────────────────────────────────────────────────────────

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

      <div className="flex-1 p-4 md:p-6 overflow-y-auto pb-24 md:pb-6">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            message="No activity yet"
            detail="Jobs will appear here once queued."
          />
        ) : (
          /* ── Timeline ── */
          <div className="relative">
            {/* Vertical rule — desktop only */}
            <div
              className="hidden sm:block absolute left-[19px] top-3 bottom-3 w-px pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, var(--border) 8%, var(--border) 92%, transparent)",
              }}
            />
            <div className="space-y-2 sm:space-y-3">
              {data.map((item, idx) => (
                <TimelineItem key={item.job.id} item={item} index={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Timeline item ──────────────────────────────────────────────────────────

function TimelineItem({ item, index }: { item: ActivityItem; index: number }) {
  const { job, latest_run, latest_event } = item;
  const status = job.status;
  const Icon = STATUS_ICON[status] ?? RiTimerLine;
  const iconStyle = STATUS_ICON_STYLE[status] ?? DEFAULT_ICON_STYLE;

  const ghBranchUrl = job.work_branch ? githubUrl(job.repo_url, job.work_branch) : null;
  const sha = latest_run?.commit_sha;
  const shaUrl = sha ? commitUrl(job.repo_url, sha) : null;
  const duration = formatDuration(
    durationSeconds(latest_run?.started_at ?? null, latest_run?.finished_at ?? null)
  );

  const runStatusColor =
    latest_run?.status === "completed" ? "text-emerald-400"
    : latest_run?.status === "failed"  ? "text-red-400"
    : latest_run?.status === "running" ? "text-blue-400"
    : "text-gray-500";

  return (
    <div
      className="flex items-start gap-3 sm:gap-4 card-enter"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Icon — sits over the vertical rule on desktop */}
      <div className="shrink-0 relative z-10">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={iconStyle}
        >
          <Icon
            className={cn("w-5 h-5", status === "running" && "animate-spin")}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="flex-1 min-w-0 rounded-2xl p-4 transition-all hover:shadow-md"
        style={{
          background:
            "linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box," +
            "linear-gradient(135deg, var(--glass-border-bright), var(--border)) border-box",
          border: "1px solid transparent",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <Link
              href={`/jobs/${job.id}`}
              className="text-[15px] font-semibold hover:text-blue-300 transition-colors block truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {job.title}
            </Link>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-lg"
                style={iconStyle}
              >
                {status.replace(/_/g, " ")}
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {repoName(job.repo_url)}
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {shortId(job.id)}
              </span>
            </div>
          </div>

          {/* Timestamp — larger on mobile for easy scanning */}
          <div className="shrink-0 text-right">
            <div
              className="text-sm font-medium md:text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {relativeTime(job.updated_at)}
            </div>
            {latest_run && (
              <div className={cn("text-[11px] mt-0.5 font-medium", runStatusColor)}>
                Run #{latest_run.run_number}
              </div>
            )}
          </div>
        </div>

        {/* Branch + commit + duration row */}
        {(job.work_branch || sha || duration !== "—") && (
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {job.work_branch && (
              <div
                className="flex items-center gap-1 text-[11px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                <RiGitBranchLine className="w-3 h-3 shrink-0" />
                {ghBranchUrl ? (
                  <a
                    href={ghBranchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400/70 hover:text-blue-400 hover:underline truncate max-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {job.work_branch}
                  </a>
                ) : (
                  <span className="truncate max-w-[160px]">{job.work_branch}</span>
                )}
              </div>
            )}
            {sha && (
              <div
                className="flex items-center gap-1 text-[11px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                <RiGitCommitLine className="w-3 h-3 shrink-0" />
                {shaUrl ? (
                  <a
                    href={shaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400/70 hover:text-blue-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sha.slice(0, 10)}
                  </a>
                ) : (
                  sha.slice(0, 10)
                )}
              </div>
            )}
            {duration !== "—" && (
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {duration}
                {latest_run?.exit_code !== null &&
                  latest_run?.exit_code !== undefined &&
                  ` · exit ${latest_run.exit_code}`}
              </div>
            )}
          </div>
        )}

        {/* Latest event message */}
        {latest_event?.message && (
          <div
            className="text-[12px] leading-relaxed line-clamp-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {latest_event.message}
          </div>
        )}

        {/* Run summary (only if no event message) */}
        {!latest_event?.message && latest_run?.summary && (
          <div
            className="text-[12px] leading-relaxed line-clamp-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {latest_run.summary}
          </div>
        )}
      </div>
    </div>
  );
}
