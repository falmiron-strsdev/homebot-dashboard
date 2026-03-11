"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { fetchJobs, cancelJob, purgeJob, purgeBulk } from "@/lib/api";
import { JobStatusBadge } from "@/components/ui/StatusDot";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import Header from "@/components/layout/Header";
import { relativeTime, repoName, shortId, cn } from "@/lib/utils";
import type { Job, JobStatus } from "@/lib/types";
import { RiSearchLine, RiDeleteBinLine, RiCloseLine, RiAlertLine } from "react-icons/ri";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All",       value: "" },
  { label: "Queued",    value: "queued" },
  { label: "Running",   value: "running" },
  { label: "Assigned",  value: "assigned" },
  { label: "Security",  value: "security_running" },
  { label: "Review",    value: "review" },
  { label: "QA",        value: "qa_running" },
  { label: "Completed", value: "completed" },
  { label: "Failed",    value: "failed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Escalated", value: "escalated" },
];

const STAT_KEYS: { label: string; value: string; color: string }[] = [
  { label: "Queued",    value: "queued",    color: "text-amber-400" },
  { label: "Running",   value: "running",   color: "text-blue-400" },
  { label: "Review",    value: "review",    color: "text-purple-400" },
  { label: "Failed",    value: "failed",    color: "text-red-400" },
  { label: "Completed", value: "completed", color: "text-emerald-400" },
];

const CANCELLABLE: JobStatus[] = ["queued", "assigned"];
const PURGEABLE: JobStatus[]   = [
  "review",
  "security_pending",
  "security_running",
  "qa_running",
  "completed",
  "failed",
  "cancelled",
];

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");

  const { data: allJobs, error, isLoading, isRefreshing, lastUpdated, refresh } =
    useAutoRefresh({ fetcher: fetchJobs, intervalMs: 20_000 });

  const filtered = useMemo(() => {
    if (!allJobs) return [];
    let list = [...allJobs];
    if (statusFilter === "escalated") {
      list = list.filter((j) => j.escalated === 1);
    } else if (statusFilter) {
      list = list.filter((j) => j.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.id.toLowerCase().includes(q) ||
          (j.work_branch ?? "").toLowerCase().includes(q) ||
          j.repo_url.toLowerCase().includes(q)
      );
    }
    return list.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [allJobs, statusFilter, search]);

  const purgeableCount = allJobs
    ? allJobs.filter((j) => PURGEABLE.includes(j.status as JobStatus)).length
    : 0;

  function countFor(val: string) {
    if (!allJobs) return 0;
    if (val === "escalated") return allJobs.filter((j) => j.escalated === 1).length;
    if (!val) return allJobs.length;
    return allJobs.filter((j) => j.status === val).length;
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Jobs"
        subtitle={allJobs ? `${allJobs.length} total` : undefined}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
        actions={
          purgeableCount > 0 ? (
            <ConfirmButton
              label={`Clear ${purgeableCount} finished`}
              confirmLabel={`Delete ${purgeableCount} jobs?`}
              variant="danger"
              size="sm"
              icon={<RiDeleteBinLine className="w-3.5 h-3.5" />}
              onConfirm={async () => {
                await purgeBulk(["review", "completed", "failed", "cancelled"]);
                refresh();
              }}
            />
          ) : undefined
        }
      />

      {/* ── Stats strip ── */}
      {allJobs && (
        <div
          className="flex gap-2 px-4 md:px-6 py-3 overflow-x-auto hide-scrollbar border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          {STAT_KEYS.map((s) => {
            const isActive = statusFilter === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setStatusFilter(isActive ? "" : s.value)}
                className="shrink-0 px-3 pt-2 pb-2.5 rounded-xl text-center min-w-[72px] transition-all"
                style={{
                  background: isActive
                    ? "linear-gradient(rgba(29,78,216,0.14), rgba(29,78,216,0.08)) padding-box," +
                      "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(29,78,216,0.18)) border-box"
                    : "var(--glass-bg)",
                  backdropFilter: "var(--glass-blur-light)",
                  WebkitBackdropFilter: "var(--glass-blur-light)",
                  border: `1px solid ${isActive ? "transparent" : "var(--glass-border-bright)"}`,
                  boxShadow: isActive ? "0 0 10px var(--glow-blue)" : "none",
                }}
              >
                <div className={cn("text-2xl font-semibold tabular-nums leading-none", s.color)}>
                  {countFor(s.value)}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wide mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {s.label}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filter chips + search ── */}
      <div
        className="px-4 md:px-6 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-2.5">
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[36px]"
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(rgba(29,78,216,0.18), rgba(29,78,216,0.10)) padding-box," +
                          "linear-gradient(135deg, rgba(96,165,250,0.40), rgba(29,78,216,0.20)) border-box",
                        border: "1px solid transparent",
                        color: "#93c5fd",
                        boxShadow: "0 0 10px var(--glow-blue)",
                      }
                    : {
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                      }
                }
              >
                {f.label}
                {allJobs && f.value && (
                  <span className="opacity-60 text-[10px]">{countFor(f.value)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <RiSearchLine
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 rounded-xl border text-sm w-full focus:outline-none focus:border-blue-500/60"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState error={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            message={search || statusFilter ? "No matching jobs" : "No jobs yet"}
            detail={
              search || statusFilter
                ? "Try adjusting the filter or search term."
                : "Jobs will appear here once queued."
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-xs uppercase tracking-widest border-b"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    <Th>Status</Th>
                    <Th>Title</Th>
                    <Th>Repo / Branch</Th>
                    <Th>Priority</Th>
                    <Th>Worker</Th>
                    <Th>Updated</Th>
                    <Th>ID</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      onNavigate={() => router.push(`/jobs/${job.id}`)}
                      onMutate={refresh}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile glass cards */}
            <div className="block sm:hidden space-y-2 p-3">
              {filtered.map((job, idx) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={idx}
                  onNavigate={() => router.push(`/jobs/${job.id}`)}
                  onMutate={refresh}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JobRow({
  job,
  onNavigate,
  onMutate,
}: {
  job: Job;
  onNavigate: () => void;
  onMutate: () => void;
}) {
  const status = job.status as JobStatus;
  const canCancel = CANCELLABLE.includes(status);
  const canPurge  = PURGEABLE.includes(status);

  return (
    <tr
      className="border-b transition-colors group"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <Td>
        <div className="cursor-pointer flex items-center gap-1.5 flex-wrap" onClick={onNavigate}>
          <JobStatusBadge status={status} />
          {job.escalated === 1 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-red-400 bg-red-400/10 border border-red-400/20">
              <RiAlertLine className="w-2.5 h-2.5" />
              Escalated
            </span>
          )}
          {job.parent_job_id && !job.escalated && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-400/80 bg-amber-400/8 border border-amber-400/15">
              Repair
            </span>
          )}
        </div>
      </Td>
      <Td>
        <div
          className="font-medium truncate max-w-xs cursor-pointer hover:text-blue-300 transition-colors"
          style={{ color: "var(--text-primary)" }}
          onClick={onNavigate}
        >
          {job.title}
        </div>
      </Td>
      <Td>
        <div
          className="cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
          onClick={onNavigate}
        >
          {repoName(job.repo_url)}
        </div>
        {job.work_branch && (
          <div
            className="text-[10px] font-mono mt-0.5 truncate max-w-[180px]"
            style={{ color: "var(--text-muted)" }}
          >
            {job.work_branch}
          </div>
        )}
      </Td>
      <Td>
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-semibold",
            job.priority <= 2
              ? "bg-red-500/10 text-red-400"
              : job.priority <= 4
              ? "bg-amber-500/10 text-amber-400"
              : "bg-gray-500/10 text-gray-500"
          )}
        >
          P{job.priority}
        </span>
      </Td>
      <Td>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {job.assigned_worker ? shortId(job.assigned_worker) : "—"}
        </span>
      </Td>
      <Td>
        <span style={{ color: "var(--text-muted)" }}>{relativeTime(job.updated_at)}</span>
      </Td>
      <Td>
        <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          {shortId(job.id)}
        </span>
      </Td>
      <Td>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canCancel && (
            <ConfirmButton
              label="Cancel"
              confirmLabel="Cancel job?"
              variant="warning"
              size="xs"
              icon={<RiCloseLine className="w-3 h-3" />}
              onConfirm={async () => {
                await cancelJob(job.id);
                onMutate();
              }}
            />
          )}
          {canPurge && (
            <ConfirmButton
              label="Delete"
              confirmLabel="Delete forever?"
              variant="danger"
              size="xs"
              icon={<RiDeleteBinLine className="w-3 h-3" />}
              onConfirm={async () => {
                await purgeJob(job.id);
                onMutate();
              }}
            />
          )}
        </div>
      </Td>
    </tr>
  );
}

function JobCard({
  job,
  onNavigate,
  onMutate,
  index,
}: {
  job: Job;
  onNavigate: () => void;
  onMutate: () => void;
  index: number;
}) {
  const status = job.status as JobStatus;
  const canCancel = CANCELLABLE.includes(status);
  const canPurge  = PURGEABLE.includes(status);

  return (
    <div
      className="rounded-2xl p-4 card-enter cursor-pointer active:scale-[0.99] transition-transform"
      style={{
        animationDelay: `${index * 30}ms`,
        background:
          "linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box," +
          "linear-gradient(135deg, var(--glass-border-bright), var(--border)) border-box",
        border: "1px solid transparent",
        boxShadow: "var(--shadow-sm)",
      }}
      onClick={onNavigate}
    >
      {/* Status + time */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <JobStatusBadge status={status} />
          {job.escalated === 1 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20">
              <RiAlertLine className="w-3 h-3" />
              Escalated
            </span>
          )}
          {job.parent_job_id && !job.escalated && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium text-amber-400/80 bg-amber-400/8 border border-amber-400/15">
              Repair
            </span>
          )}
        </div>
        <span className="text-xs shrink-0 ml-2" style={{ color: "var(--text-muted)" }}>
          {relativeTime(job.updated_at)}
        </span>
      </div>

      {/* Title */}
      <div
        className="text-[15px] font-semibold leading-snug mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        {job.title}
      </div>

      {/* Repo + branch + priority */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {repoName(job.repo_url)}
        </span>
        {job.work_branch && (
          <span
            className="text-xs font-mono truncate max-w-[180px]"
            style={{ color: "var(--text-muted)" }}
          >
            {job.work_branch}
          </span>
        )}
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-xs font-semibold",
            job.priority <= 2
              ? "bg-red-500/10 text-red-400"
              : job.priority <= 4
              ? "bg-amber-500/10 text-amber-400"
              : "bg-gray-500/10 text-gray-500"
          )}
        >
          P{job.priority}
        </span>
      </div>

      {/* Actions */}
      {(canCancel || canPurge) && (
        <div
          className="flex items-center gap-2 mt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {canCancel && (
            <ConfirmButton
              label="Cancel"
              confirmLabel="Cancel job?"
              variant="warning"
              size="xs"
              icon={<RiCloseLine className="w-3 h-3" />}
              onConfirm={async () => {
                await cancelJob(job.id);
                onMutate();
              }}
            />
          )}
          {canPurge && (
            <ConfirmButton
              label="Delete"
              confirmLabel="Delete forever?"
              variant="danger"
              size="xs"
              icon={<RiDeleteBinLine className="w-3 h-3" />}
              onConfirm={async () => {
                await purgeJob(job.id);
                onMutate();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 font-medium first:pl-6 last:pr-6 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-3 align-middle first:pl-6 last:pr-6">{children}</td>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <JobsContent />
    </Suspense>
  );
}
