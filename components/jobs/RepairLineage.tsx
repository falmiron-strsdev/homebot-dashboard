"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchJobLineage } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { JobStatusBadge } from "@/components/ui/StatusDot";
import { relativeTime, shortId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { LineageJob, LineageResponse, JobStatus } from "@/lib/types";
import {
  RiAlertLine,
  RiArrowRightLine,
  RiRefreshLine,
  RiShieldLine,
} from "react-icons/ri";

const STEP_LABELS: Record<string, string> = {
  clone_failed:       "Git clone",
  checkout_failed:    "Branch checkout",
  claude_failed:      "Claude Code",
  timeout:            "Timeout",
  build_failed:       "Build",
  test_failed:        "Tests",
  commit_failed:      "Git commit",
  push_failed:        "Git push",
  orchestrator_error: "Orchestrator",
  unknown:            "Unknown",
};

interface RepairLineageProps {
  jobId: string;
}

export function RepairLineage({ jobId }: RepairLineageProps) {
  const [data, setData] = useState<LineageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchJobLineage(jobId);
      setData(d);
    } catch (err) {
      setError(String(err));
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  if (error || !data) return null;
  // Only render if there's actual repair activity (more than 1 job or escalation)
  const hasRepairs = data.chain.length > 1 || data.chain.some((j) => j.escalated);
  if (!hasRepairs) return null;

  const root = data.chain[0];
  const repairs = data.chain.slice(1);
  const isEscalated = data.chain.some((j) => j.escalated);
  const escalationReason = data.chain.findLast?.((j) => j.escalation_reason)?.escalation_reason;

  return (
    <Card noPad>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <RiShieldLine className="w-3.5 h-3.5" />
            Repair history
          </span>
        </CardTitle>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {data.chain.length} attempt{data.chain.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Escalation banner */}
      {isEscalated && escalationReason && (
        <div
          className="mx-4 mb-3 px-3 py-2.5 rounded border text-xs flex items-start gap-2"
          style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.25)", color: "#f87171" }}
        >
          <RiAlertLine className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Escalated — needs human review</div>
            <div className="text-[11px] opacity-80">{escalationReason}</div>
          </div>
        </div>
      )}

      {/* Chain */}
      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {data.chain.map((job, i) => (
          <LineageRow
            key={job.id}
            job={job}
            index={i}
            isCurrentJob={job.id === jobId}
            totalChain={data.chain.length}
          />
        ))}
      </div>
    </Card>
  );
}

function LineageRow({
  job,
  index,
  isCurrentJob,
  totalChain,
}: {
  job: LineageJob;
  index: number;
  isCurrentJob: boolean;
  totalChain: number;
}) {
  const run = job.latest_run;
  const failedStep = run?.failed_step || run?.failure_type;
  const stepLabel = failedStep ? (STEP_LABELS[failedStep] ?? failedStep) : null;
  const isRepair = index > 0;

  return (
    <div
      className={cn(
        "px-4 py-3 flex items-start gap-3",
        isCurrentJob && "bg-blue-500/5"
      )}
    >
      {/* Indent indicator for repair jobs */}
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        {isRepair && (
          <div className="flex items-center gap-0.5" style={{ color: "var(--text-muted)" }}>
            <div className="w-3 h-px" style={{ background: "var(--border)" }} />
            <RiArrowRightLine className="w-3 h-3" />
          </div>
        )}
        {!isRepair && <div className="w-5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <JobStatusBadge status={job.status as JobStatus} />
          {job.escalated === 1 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide text-red-400 bg-red-400/10 border border-red-400/20">
              <RiAlertLine className="w-2.5 h-2.5" />
              Escalated
            </span>
          )}
          {isCurrentJob && (
            <span className="text-[10px] text-blue-400 font-medium">(this job)</span>
          )}
        </div>

        <div className="mt-1">
          {isCurrentJob ? (
            <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {job.title}
            </span>
          ) : (
            <Link
              href={`/jobs/${job.id}`}
              className="text-xs font-medium hover:text-blue-300 transition-colors"
              style={{ color: "var(--text-primary)" }}
            >
              {job.title}
            </Link>
          )}
        </div>

        <div className="mt-1 flex items-center gap-3 flex-wrap">
          {isRepair && (
            <span className="text-[10px] font-medium text-amber-400/80">
              Attempt {job.attempt_count}/{job.max_fix_attempts}
            </span>
          )}
          {stepLabel && (
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              failed at: <span className="font-mono">{stepLabel}</span>
            </span>
          )}
          {run?.retryable === 0 && failedStep && (
            <span className="text-[10px] text-red-400/70">non-retryable</span>
          )}
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            {shortId(job.id)}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {relativeTime(job.updated_at)}
          </span>
        </div>

        {run?.repair_strategy && isRepair && (
          <div
            className="mt-1.5 text-[11px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {run.repair_strategy}
          </div>
        )}
      </div>
    </div>
  );
}
