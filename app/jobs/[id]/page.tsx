"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJob, fetchJobEvents, fetchJobRuns, fetchWorker, cancelJob, purgeJob, completeJob, triggerVercelDeploy } from "@/lib/api";
import { DeploymentCard } from "@/components/jobs/DeploymentCard";
import { RepairLineage } from "@/components/jobs/RepairLineage";
import { JobStatusBadge } from "@/components/ui/StatusDot";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { JobTimeline } from "@/components/jobs/JobTimeline";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/EmptyState";
import Header from "@/components/layout/Header";
import {
  relativeTime,
  repoName,
  shortId,
  formatDuration,
  durationSeconds,
  githubUrl,
  commitUrl,
} from "@/lib/utils";
import type { Job, JobEvent, Run, Worker, JobStatus } from "@/lib/types";
import { RiCloseLine, RiDeleteBinLine, RiCheckDoubleLine, RiRocketLine, RiAlertLine, RiShieldCheckLine, RiShieldLine, RiShieldUserLine, RiFileCopyLine, RiCheckLine } from "react-icons/ri";

const CANCELLABLE:  JobStatus[] = ["queued", "assigned"];
const COMPLETABLE:  JobStatus[] = ["review", "qa_running", "security_pending", "security_running"];
const DEPLOYABLE:   JobStatus[] = ["review", "qa_running", "security_pending", "security_running", "completed"];
const PURGEABLE:    JobStatus[] = ["review", "security_pending", "security_running", "qa_running", "completed", "failed", "cancelled"];

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(
    async (initial = false) => {
      if (!initial) setIsRefreshing(true);
      try {
        const [j, ev, ru] = await Promise.all([
          fetchJob(id),
          fetchJobEvents(id),
          fetchJobRuns(id),
        ]);
        setJob(j);
        setEvents(ev);
        setRuns(ru);
        setLastUpdated(relativeTime(new Date().toISOString()));

        if (j.assigned_worker) {
          fetchWorker(j.assigned_worker)
            .then(setWorker)
            .catch(() => null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 20_000);
    return () => clearInterval(interval);
  }, [load]);

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} />;
  if (!job) return null;

  const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
  const ghBranchUrl = job.work_branch ? githubUrl(job.repo_url, job.work_branch) : null;
  const ghRepoUrl = githubUrl(job.repo_url);

  return (
    <div className="flex flex-col h-full">
      <Header
        title={job.title}
        subtitle={`Job ${shortId(job.id)} · ${repoName(job.repo_url)}`}
        lastUpdated={lastUpdated}
        onRefresh={() => load(false)}
        isRefreshing={isRefreshing}
        actions={
          <div className="flex items-center gap-2">
            {DEPLOYABLE.includes(job.status as JobStatus) && (
              <ConfirmButton
                label="Deploy to Vercel"
                confirmLabel="Trigger Vercel deploy?"
                variant="ghost"
                size="sm"
                icon={<RiRocketLine className="w-3.5 h-3.5" />}
                onConfirm={async () => {
                  await triggerVercelDeploy(job.id);
                  // Give the background thread a moment then reload the deployment card
                  await new Promise((r) => setTimeout(r, 3000));
                  await load(false);
                }}
              />
            )}
            {COMPLETABLE.includes(job.status as JobStatus) && (
              <ConfirmButton
                label="Mark Completed"
                confirmLabel="Mark as completed?"
                variant="ghost"
                size="sm"
                icon={<RiCheckDoubleLine className="w-3.5 h-3.5" />}
                onConfirm={async () => {
                  await completeJob(job.id);
                  await load(false);
                }}
              />
            )}
            {CANCELLABLE.includes(job.status as JobStatus) && (
              <ConfirmButton
                label="Cancel Job"
                confirmLabel="Cancel this job?"
                variant="warning"
                size="sm"
                icon={<RiCloseLine className="w-3.5 h-3.5" />}
                onConfirm={async () => {
                  await cancelJob(job.id);
                  await load(false);
                }}
              />
            )}
            {PURGEABLE.includes(job.status as JobStatus) && (
              <ConfirmButton
                label="Delete Job"
                confirmLabel="Delete forever?"
                variant="danger"
                size="sm"
                icon={<RiDeleteBinLine className="w-3.5 h-3.5" />}
                onConfirm={async () => {
                  await purgeJob(job.id);
                  router.push("/jobs");
                }}
              />
            )}
            <Link
              href="/jobs"
              className="text-xs px-3 py-1.5 rounded border transition-colors"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                background: "var(--bg-elevated)",
              }}
            >
              ← All jobs
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {/* Escalated banner */}
        {job.escalated === 1 && job.escalation_reason && (
          <div
            className="px-4 py-3 rounded-lg border flex items-start gap-3"
            style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.3)" }}
          >
            <RiAlertLine className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-400">Escalated — needs human review</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {job.escalation_reason}
              </div>
            </div>
          </div>
        )}

        {/* Security running banner */}
        {(job.status === "security_running" || job.status === "security_pending") && (
          <div
            className="px-4 py-3 rounded-lg border flex items-center gap-3"
            style={{ background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.3)" }}
          >
            <RiShieldUserLine className="w-5 h-5 text-orange-400 shrink-0 animate-pulse" />
            <div>
              <div className="text-sm font-semibold text-orange-400">Security Audit in progress</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Claude is auditing the code for vulnerabilities. High/critical issues will block merge.
              </div>
            </div>
          </div>
        )}

        {/* QA running banner */}
        {job.status === "qa_running" && (
          <div
            className="px-4 py-3 rounded-lg border flex items-center gap-3"
            style={{ background: "rgba(34,211,238,0.06)", borderColor: "rgba(34,211,238,0.3)" }}
          >
            <RiShieldCheckLine className="w-5 h-5 text-cyan-400 shrink-0 animate-pulse" />
            <div>
              <div className="text-sm font-semibold text-cyan-400">QA Validation in progress</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                The QA worker is running <code className="font-mono">npm install &amp;&amp; npm run build</code>. If the build passes, the PR will be auto-merged.
              </div>
            </div>
          </div>
        )}

        {/* QA passed banner */}
        {job.qa_passed === 1 && job.status !== "qa_running" && (
          <div
            className="px-4 py-2.5 rounded-lg border flex items-center gap-2 text-xs"
            style={{ background: "rgba(52,211,153,0.06)", borderColor: "rgba(52,211,153,0.3)" }}
          >
            <RiShieldCheckLine className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-medium">QA Passed</span>
            <span style={{ color: "var(--text-muted)" }}>— build validated, PR auto-merged</span>
          </div>
        )}

        {/* QA failed banner with analysis */}
        {job.qa_passed === 0 && job.qa_analysis && (
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "rgba(239,68,68,0.3)" }}
          >
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: "rgba(239,68,68,0.08)" }}
            >
              <RiShieldLine className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm font-semibold text-red-400">QA Failed — Claude Analysis</span>
            </div>
            <pre
              className="px-4 py-3 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap"
              style={{ color: "#fca5a5", background: "rgba(239,68,68,0.04)" }}
            >
              {job.qa_analysis}
            </pre>
          </div>
        )}

        {/* Repair job banner (this job is a repair of a parent) */}
        {job.parent_job_id && (
          <div
            className="px-4 py-2.5 rounded-lg border flex items-center gap-2 text-xs"
            style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.3)", color: "#fbbf24" }}
          >
            <RiRocketLine className="w-4 h-4 shrink-0" />
            <span>
              Repair attempt {job.attempt_count}/{job.max_fix_attempts} —{" "}
              <Link href={`/jobs/${job.parent_job_id}`} className="underline hover:text-amber-300">
                view parent job
              </Link>
            </span>
          </div>
        )}

        {/* Status + Timeline */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <JobStatusBadge status={job.status} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                updated {relativeTime(job.updated_at)}
              </span>
            </div>
            <span
              className="text-[11px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              Priority P{job.priority}
            </span>
          </div>
          <JobTimeline currentStatus={job.status} events={events} />
        </Card>

        {/* Repair lineage — only renders when repair history exists */}
        <RepairLineage jobId={job.id} />

        {/* Two-column layout */}
        <div className="grid grid-cols-2 gap-5">
          {/* Left: details */}
          <div className="space-y-5">
            {/* Job metadata */}
            <Card>
              <CardTitle>Job details</CardTitle>
              <dl className="space-y-2.5">
                <MetaRow label="ID">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px]">{job.id}</span>
                    <CopyButton text={job.id} />
                  </span>
                </MetaRow>
                <MetaRow label="Repo">
                  {ghRepoUrl ? (
                    <a
                      href={ghRepoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline text-[11px]"
                    >
                      {repoName(job.repo_url)}
                    </a>
                  ) : (
                    <span className="text-[11px]">{repoName(job.repo_url)}</span>
                  )}
                </MetaRow>
                {job.work_branch && (
                  <MetaRow label="Branch">
                    {ghBranchUrl ? (
                      <a
                        href={ghBranchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline font-mono text-[11px]"
                      >
                        {job.work_branch}
                      </a>
                    ) : (
                      <span className="font-mono text-[11px]">{job.work_branch}</span>
                    )}
                  </MetaRow>
                )}
                <MetaRow label="Base branch">
                  <span className="font-mono text-[11px]">{job.base_branch}</span>
                </MetaRow>
                {worker && (
                  <MetaRow label="Worker">
                    <span className="text-[11px]">{worker.label}</span>
                    <span
                      className="ml-2 text-[10px] font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {worker.hostname}
                    </span>
                  </MetaRow>
                )}
                {!worker && job.assigned_worker && (
                  <MetaRow label="Worker">
                    <span className="font-mono text-[11px]">{shortId(job.assigned_worker)}</span>
                  </MetaRow>
                )}
                <MetaRow label="Created">
                  <span className="text-[11px]">{relativeTime(job.created_at)}</span>
                </MetaRow>
                {job.site_id && (
                  <MetaRow label="Site">
                    <span className="text-[11px]">{job.site_id}</span>
                  </MetaRow>
                )}
              </dl>
            </Card>

            {/* Summary */}
            {job.summary && (
              <Card>
                <CardTitle>Summary</CardTitle>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {job.summary}
                </p>
              </Card>
            )}

            {/* Acceptance criteria */}
            {job.acceptance_criteria && (
              <Card>
                <CardTitle>Acceptance criteria</CardTitle>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {job.acceptance_criteria}
                </p>
              </Card>
            )}

            {/* Constraints */}
            {job.constraints && (
              <Card>
                <CardTitle>Constraints</CardTitle>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {job.constraints}
                </p>
              </Card>
            )}
          </div>

          {/* Right: deployment + runs + events */}
          <div className="space-y-5">
            {/* Vercel deployment — shown for completed/review/qa_running jobs */}
            {(job.status === "completed" || job.status === "review" || job.status === "qa_running") && (
              <DeploymentCard jobId={job.id} />
            )}

            {/* Runs */}
            <Card noPad>
              <div className="px-4 pt-4 pb-2">
                <CardTitle>Runs ({runs.length})</CardTitle>
              </div>
              {runs.length === 0 ? (
                <div className="px-4 pb-4 text-xs" style={{ color: "var(--text-muted)" }}>
                  No runs yet.
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                  {[...runs].reverse().map((run) => (
                    <RunRow key={run.id} run={run} repoUrl={job.repo_url} />
                  ))}
                </div>
              )}
            </Card>

            {/* Latest run summary */}
            {latestRun?.summary && (
              <Card>
                <CardTitle>Run summary</CardTitle>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {latestRun.summary}
                </p>
              </Card>
            )}

            {/* Latest run log tail */}
            {latestRun?.log_tail && (
              <Card noPad>
                <div className="px-4 pt-4 pb-2">
                  <CardTitle>Log tail (last run)</CardTitle>
                </div>
                <pre
                  className="px-4 pb-4 text-[11px] font-mono leading-relaxed overflow-x-auto"
                  style={{ color: "#86efac" }}
                >
                  {latestRun.log_tail}
                </pre>
              </Card>
            )}

            {/* Events */}
            <Card noPad>
              <div className="px-4 pt-4 pb-2">
                <CardTitle>Events ({events.length})</CardTitle>
              </div>
              {events.length === 0 ? (
                <div className="px-4 pb-4 text-xs" style={{ color: "var(--text-muted)" }}>
                  No events.
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                  {[...events].reverse().map((evt) => (
                    <EventRow key={evt.id} event={evt} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="opacity-50 hover:opacity-100 transition-opacity"
      style={{ color: "var(--text-muted)", lineHeight: 1 }}
      title="Copy to clipboard"
    >
      {copied ? <RiCheckLine className="w-3 h-3 text-emerald-400" /> : <RiFileCopyLine className="w-3 h-3" />}
    </button>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt
        className="text-[11px] w-24 shrink-0 pt-px"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </dt>
      <dd className="text-[11px] flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>
        {children}
      </dd>
    </div>
  );
}

function RunRow({ run, repoUrl }: { run: Run; repoUrl: string }) {
  const duration = formatDuration(durationSeconds(run.started_at, run.finished_at));
  const sha = run.commit_sha;
  const shaUrl = sha ? commitUrl(repoUrl, sha) : null;

  const statusColor =
    run.status === "completed"
      ? "text-emerald-400"
      : run.status === "failed"
      ? "text-red-400"
      : run.status === "running"
      ? "text-blue-400"
      : "text-gray-500";

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
          >
            #{run.run_number}
          </span>
          <span className={`text-[11px] font-medium uppercase ${statusColor}`}>
            {run.status}
          </span>
          {run.exit_code !== null && (
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              exit {run.exit_code}
            </span>
          )}
        </div>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {duration}
        </span>
      </div>

      {run.branch && (
        <div
          className="mt-1 text-[10px] font-mono truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {run.branch}
        </div>
      )}

      {sha && (
        <div className="mt-0.5 text-[10px] font-mono">
          {shaUrl ? (
            <a
              href={shaUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline"
            >
              {sha.slice(0, 12)}
            </a>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>{sha.slice(0, 12)}</span>
          )}
        </div>
      )}

      {run.started_at && (
        <div
          className="mt-0.5 text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          started {relativeTime(run.started_at)}
        </div>
      )}
    </div>
  );
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  created:            "text-gray-400",
  assigned:           "text-indigo-400",
  security_claimed:   "text-orange-400",
  security_started:   "text-orange-400",
  security_auditing:  "text-orange-300",
  security_passed:    "text-emerald-400",
  security_failed:    "text-red-400",
  security_report:    "text-orange-300",
  security_warnings:  "text-amber-400",
  security_no_branch: "text-gray-400",
  security_error:     "text-amber-400",
  status_change: "text-blue-400",
  cancelled:     "text-gray-500",
  error:         "text-red-400",
  warning:       "text-amber-400",
  qa_claimed:    "text-cyan-400",
  qa_started:    "text-cyan-400",
  qa_install:    "text-cyan-300",
  qa_build:      "text-cyan-300",
  qa_passed:     "text-emerald-400",
  qa_merged:     "text-emerald-400",
  qa_failed:     "text-red-400",
  qa_analyzing:  "text-amber-400",
  qa_skipped:    "text-gray-400",
  qa_no_build:   "text-gray-400",
  qa_merge_failed: "text-amber-400",
};

function EventRow({ event }: { event: JobEvent }) {
  const color = EVENT_TYPE_COLORS[event.event_type] ?? "text-gray-400";
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            className={`text-[10px] font-medium uppercase shrink-0 mt-px ${color}`}
          >
            {event.event_type.replace("_", " ")}
          </span>
          {event.message && (
            <span
              className="text-[11px] leading-snug"
              style={{ color: "var(--text-secondary)" }}
            >
              {event.message}
            </span>
          )}
        </div>
        <span
          className="text-[10px] shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {relativeTime(event.created_at)}
        </span>
      </div>
    </div>
  );
}
