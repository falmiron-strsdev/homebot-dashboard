"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { fetchJobs, cancelJob, purgeJob, purgeBulk } from "@/lib/api";
import { JobStatusBadge } from "@/components/ui/StatusDot";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import Header from "@/components/layout/Header";
import { relativeTime, repoName, shortId } from "@/lib/utils";
import type { Job, JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RiSearchLine, RiDeleteBinLine, RiCloseLine, RiAlertLine } from "react-icons/ri";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All",        value: "" },
  { label: "Queued",     value: "queued" },
  { label: "Running",    value: "running" },
  { label: "Assigned",   value: "assigned" },
  { label: "Security",   value: "security_running" },
  { label: "Review",     value: "review" },
  { label: "QA",         value: "qa_running" },
  { label: "Completed",  value: "completed" },
  { label: "Failed",     value: "failed" },
  { label: "Cancelled",  value: "cancelled" },
  { label: "Escalated",  value: "escalated" },
];

const CANCELLABLE: JobStatus[] = ["queued", "assigned"];
const PURGEABLE:   JobStatus[] = ["review", "security_pending", "security_running", "qa_running", "completed", "failed", "cancelled"];

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const initialStatus = searchParams.get("status") ?? "";
  const [statusFilter, setStatusFilter] = useState(initialStatus);

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

  // Count purgeable jobs for the bulk action
  const purgeableCount = allJobs
    ? allJobs.filter((j) => PURGEABLE.includes(j.status as JobStatus)).length
    : 0;

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

      {/* Filters bar */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium uppercase tracking-wide border transition-colors",
                statusFilter === f.value
                  ? "border-blue-500/60 bg-blue-500/15 text-blue-300"
                  : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-[var(--bg-elevated)]"
              )}
            >
              {f.label}
              {allJobs && f.value && (
                <span className="ml-1 opacity-60">
                  {f.value === "escalated"
                    ? allJobs.filter((j) => j.escalated === 1).length
                    : allJobs.filter((j) => j.status === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-auto sm:ml-auto">
          <RiSearchLine
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg border text-sm w-full sm:w-56 focus:outline-none focus:border-blue-500/60"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
            {/* Desktop table — hidden on small screens */}
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

            {/* Mobile cards — shown only on small screens */}
            <div
              className="block sm:hidden divide-y"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {filtered.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
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

/** Mobile card view for a single job. */
function JobCard({
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
    <div
      className="px-4 py-4"
      style={{ background: "var(--bg-surface)" }}
    >
      {/* Top row: status + time */}
      <div className="flex items-center justify-between mb-2">
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
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          {relativeTime(job.updated_at)}
        </span>
      </div>

      {/* Title */}
      <div
        className="text-sm font-medium leading-snug mb-1 cursor-pointer hover:text-blue-300 transition-colors"
        style={{ color: "var(--text-primary)" }}
        onClick={onNavigate}
      >
        {job.title}
      </div>

      {/* Repo + branch */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {repoName(job.repo_url)}
        </span>
        {job.work_branch && (
          <span className="text-xs font-mono truncate max-w-[180px]" style={{ color: "var(--text-muted)" }}>
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
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
    <td className="px-4 py-3 align-middle first:pl-6 last:pr-6">
      {children}
    </td>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <JobsContent />
    </Suspense>
  );
}
