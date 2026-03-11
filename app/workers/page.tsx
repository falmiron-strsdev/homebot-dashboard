"use client";

import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { fetchWorkers, removeWorker, sweepStaleWorkers } from "@/lib/api";
import { WorkerStatusBadge } from "@/components/ui/StatusDot";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import Header from "@/components/layout/Header";
import { relativeTime, shortId } from "@/lib/utils";
import type { Worker, WorkerStatus } from "@/lib/types";
import { RiComputerLine, RiPrinterLine, RiCpuLine, RiAlertLine, RiDeleteBinLine, RiRefreshLine } from "react-icons/ri";

const STATUS_ORDER: Record<WorkerStatus, number> = {
  busy: 0,
  idle: 1,
  stale: 2,
  offline: 3,
};

export default function WorkersPage() {
  const { data: workers, error, isLoading, isRefreshing, lastUpdated, refresh } =
    useAutoRefresh({ fetcher: fetchWorkers, intervalMs: 15_000 });

  const sorted = workers
    ? [...workers].sort(
        (a, b) =>
          (STATUS_ORDER[a.computed_status] ?? 4) -
          (STATUS_ORDER[b.computed_status] ?? 4)
      )
    : [];

  const activeCount = sorted.filter(
    (w) => w.computed_status === "idle" || w.computed_status === "busy"
  ).length;
  const staleCount = sorted.filter((w) => w.computed_status === "stale").length;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Workers"
        subtitle={
          workers
            ? `${activeCount} active · ${workers.length} total`
            : undefined
        }
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
        actions={
          staleCount > 0 ? (
            <ConfirmButton
              label={`Sweep ${staleCount} stale`}
              confirmLabel={`Mark ${staleCount} stale workers offline?`}
              variant="warning"
              size="sm"
              icon={<RiRefreshLine className="w-3.5 h-3.5" />}
              onConfirm={async () => {
                await sweepStaleWorkers();
                refresh();
              }}
            />
          ) : undefined
        }
      />

      <div className="flex-1 p-4 md:p-6 overflow-y-auto pb-24 md:pb-6">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState error={error} />
        ) : sorted.length === 0 ? (
          <EmptyState message="No workers registered" detail="Workers register themselves on startup." />
        ) : (
          <div className="space-y-2">
            {sorted.map((worker) => (
              <WorkerRow key={worker.id} worker={worker} onRemove={refresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function parseCaps(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not JSON — try comma-separated
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function WorkerRow({ worker, onRemove }: { worker: Worker; onRemove: () => void }) {
  const caps = parseCaps(worker.capabilities);
  const isUnhealthy =
    worker.computed_status === "offline" || worker.computed_status === "stale";

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: "var(--bg-surface)",
        borderColor: isUnhealthy ? "rgba(239,68,68,0.15)" : "var(--border)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Left: machine icon + status */}
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--bg-elevated)" }}
          >
            {worker.hostname.startsWith("dell") ? (
              <RiComputerLine className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
            ) : worker.hostname.startsWith("home") ? (
              <RiCpuLine className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
            ) : (
              <RiPrinterLine className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
            )}
          </div>
          <WorkerStatusBadge status={worker.computed_status} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {worker.label}
            </span>
            <span
              className="text-xs font-mono"
              style={{ color: "var(--text-secondary)" }}
            >
              {worker.hostname}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {caps.map((cap) => (
              <span
                key={cap}
                className="px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {cap}
              </span>
            ))}
          </div>
        </div>

        {/* Right: metadata */}
        <div className="text-right shrink-0 space-y-1.5">
          <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            {shortId(worker.id)}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            seen {relativeTime(worker.last_seen_at)}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            registered {relativeTime(worker.created_at)}
          </div>
          {(worker.computed_status === "offline" || worker.computed_status === "stale") && (
            <div className="flex justify-end">
              <ConfirmButton
                label="Remove"
                confirmLabel="Remove this worker?"
                variant="danger"
                size="xs"
                icon={<RiDeleteBinLine className="w-3 h-3" />}
                onConfirm={async () => {
                  await removeWorker(worker.id);
                  onRemove();
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stale / offline warning */}
      {isUnhealthy && (
        <div
          className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
          style={{ background: "rgba(239,68,68,0.06)", color: "#f87171" }}
        >
          <RiAlertLine className="w-3.5 h-3.5 shrink-0" />
          {worker.computed_status === "stale"
            ? `Missed heartbeat — last seen ${relativeTime(worker.last_seen_at)}. Worker may be down.`
            : `Offline — registered ${relativeTime(worker.created_at)}, last seen ${relativeTime(worker.last_seen_at)}.`}
        </div>
      )}
    </div>
  );
}
