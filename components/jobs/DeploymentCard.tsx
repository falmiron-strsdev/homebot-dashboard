"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchDeployment, triggerVercelFix } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { relativeTime, shortId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Deployment, DeploymentStatus } from "@/lib/types";
import {
  RiLoaderLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiTimeLine,
  RiGitCommitLine,
  RiToolsLine,
  RiArrowRightLine,
} from "react-icons/ri";

const STATUS_CONFIG: Record<
  DeploymentStatus,
  { label: string; color: string; bg: string; border: string; animate?: boolean }
> = {
  QUEUED:   { label: "Queued",   color: "text-slate-400",   bg: "bg-slate-400/10",   border: "border-slate-500/30" },
  BUILDING: { label: "Building", color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-500/30", animate: true },
  READY:    { label: "Live",     color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-500/30" },
  ERROR:    { label: "Failed",   color: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-500/30" },
  CANCELED: { label: "Canceled", color: "text-gray-500",    bg: "bg-gray-500/10",    border: "border-gray-500/30" },
};

interface DeploymentCardProps {
  jobId: string;
}

export function DeploymentCard({ jobId }: DeploymentCardProps) {
  const [deployment, setDeployment] = useState<Deployment | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { deployment: d } = await fetchDeployment(jobId);
      setDeployment(d);
    } catch (err) {
      setError(String(err));
    }
  }, [jobId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh every 8s while actively building/queued
  useEffect(() => {
    if (!deployment) return;
    if (deployment.status !== "QUEUED" && deployment.status !== "BUILDING") return;
    const id = setInterval(refresh, 8_000);
    return () => clearInterval(id);
  }, [deployment, refresh]);

  // Nothing to show if no deployment record exists yet
  if (deployment === undefined) return null;
  if (deployment === null && !error) return null;

  if (error) {
    return null; // Silent fail — Vercel integration is optional
  }

  if (!deployment) return null;

  const cfg = STATUS_CONFIG[deployment.status] ?? STATUS_CONFIG.QUEUED;
  const displayUrl = deployment.alias_url ?? deployment.url;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <CardTitle>Vercel Deployment</CardTitle>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide border",
            cfg.color, cfg.bg, cfg.border
          )}
        >
          {deployment.status === "BUILDING" ? (
            <RiLoaderLine className="w-3 h-3 animate-spin" />
          ) : deployment.status === "READY" ? (
            <RiCheckLine className="w-3 h-3" />
          ) : deployment.status === "ERROR" ? (
            <RiErrorWarningLine className="w-3 h-3" />
          ) : (
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg.color.replace("text-", "bg-"), cfg.animate && "animate-pulse-dot")} />
          )}
          {cfg.label}
        </span>
      </div>

      <div className="space-y-2">
        {/* Live URL */}
        {displayUrl && (
          <div className="flex items-center gap-2">
            <a
              href={displayUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline font-mono truncate"
            >
              {displayUrl.replace("https://", "")}
              <RiExternalLinkLine className="w-3 h-3 shrink-0" />
            </a>
          </div>
        )}

        {/* Preview URL (if different from alias) */}
        {deployment.url && deployment.alias_url && deployment.url !== deployment.alias_url && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide shrink-0" style={{ color: "var(--text-muted)" }}>
              Preview
            </span>
            <a
              href={deployment.url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-blue-400/70 hover:text-blue-400 hover:underline truncate"
            >
              {deployment.url.replace("https://", "")}
            </a>
          </div>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-4 flex-wrap pt-1">
          {deployment.commit_sha && (
            <div className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <RiGitCommitLine className="w-3 h-3" />
              <span className="text-[11px] font-mono">{deployment.commit_sha.slice(0, 10)}</span>
            </div>
          )}
          {deployment.branch && (
            <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              {deployment.branch}
            </span>
          )}
          {deployment.ready_at ? (
            <div className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <RiTimeLine className="w-3 h-3" />
              <span className="text-[11px]">deployed {relativeTime(deployment.ready_at)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <RiTimeLine className="w-3 h-3" />
              <span className="text-[11px]">triggered {relativeTime(deployment.created_at)}</span>
            </div>
          )}
        </div>

        {/* Error message + fix actions */}
        {deployment.status === "ERROR" && (
          <div className="mt-2 space-y-2">
            {deployment.error_message && (
              <div
                className="px-3 py-2 rounded text-[11px] font-mono"
                style={{ background: "rgba(239,68,68,0.06)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {deployment.error_message}
              </div>
            )}

            {/* Fix job already queued */}
            {deployment.vercel_repair_job_id && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded text-[11px]"
                style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", color: "#93c5fd" }}
              >
                <RiToolsLine className="w-3.5 h-3.5 shrink-0" />
                <span>Fix job queued — </span>
                <Link
                  href={`/jobs/${deployment.vercel_repair_job_id}`}
                  className="underline hover:text-blue-300 font-mono"
                >
                  {deployment.vercel_repair_job_id.slice(0, 8)}
                </Link>
                <RiArrowRightLine className="w-3 h-3 ml-auto" />
                <span className="text-[10px] opacity-70">
                  attempt {deployment.vercel_fix_attempts}/{2}
                </span>
              </div>
            )}

            {/* Manual fix trigger if no fix job yet and under cap */}
            {!deployment.vercel_repair_job_id && (deployment.vercel_fix_attempts ?? 0) < 2 && (
              <ConfirmButton
                label="Queue Vercel fix job"
                confirmLabel="Queue a worker to fix the build error?"
                variant="warning"
                size="xs"
                icon={<RiToolsLine className="w-3 h-3" />}
                onConfirm={async () => {
                  await triggerVercelFix(deployment.id);
                  await refresh();
                }}
              />
            )}

            {/* Escalated — max attempts reached */}
            {(deployment.vercel_fix_attempts ?? 0) >= 2 && !deployment.vercel_repair_job_id && (
              <div
                className="px-3 py-1.5 rounded text-[11px]"
                style={{ background: "rgba(239,68,68,0.06)", color: "#f87171" }}
              >
                Max fix attempts reached — manual intervention required.
              </div>
            )}
          </div>
        )}

        {/* Building progress hint */}
        {deployment.status === "BUILDING" && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <RiLoaderLine className="w-3 h-3 animate-spin" />
            Build in progress — refreshing automatically…
          </div>
        )}

        {deployment.status === "QUEUED" && (
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Waiting for Vercel to pick up the deployment…
          </div>
        )}
      </div>
    </Card>
  );
}
