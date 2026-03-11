"use client";

import { useState } from "react";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { fetchWorkers, removeWorker, sweepStaleWorkers } from "@/lib/api";
import { WorkerStatusBadge } from "@/components/ui/StatusDot";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import Header from "@/components/layout/Header";
import { relativeTime, shortId, cn } from "@/lib/utils";
import type { Worker, WorkerStatus } from "@/lib/types";
import {
  RiComputerLine,
  RiPrinterLine,
  RiCpuLine,
  RiAlertLine,
  RiDeleteBinLine,
  RiRefreshLine,
} from "react-icons/ri";

const STATUS_ORDER: Record<WorkerStatus, number> = {
  busy: 0,
  idle: 1,
  stale: 2,
  offline: 3,
};

type FilterStatus = "all" | WorkerStatus;

const FILTERS: { label: string; value: FilterStatus; dot?: string }[] = [
  { label: "All",     value: "all" },
  { label: "Busy",    value: "busy",    dot: "bg-blue-400 animate-pulse-dot" },
  { label: "Idle",    value: "idle",    dot: "bg-emerald-400" },
  { label: "Stale",   value: "stale",   dot: "bg-amber-400" },
  { label: "Offline", value: "offline", dot: "bg-gray-500" },
];

export default function WorkersPage() {
  const [filter, setFilter] = useState<FilterStatus>("all");

  const { data: workers, error, isLoading, isRefreshing, lastUpdated, refresh } =
    useAutoRefresh({ fetcher: fetchWorkers, intervalMs: 15_000 });

  const sorted = workers
    ? [...workers].sort(
        (a, b) =>
          (STATUS_ORDER[a.computed_status] ?? 4) -
          (STATUS_ORDER[b.computed_status] ?? 4)
      )
    : [];

  const counts: Record<FilterStatus, number> = {
    all:     sorted.length,
    busy:    sorted.filter((w) => w.computed_status === "busy").length,
    idle:    sorted.filter((w) => w.computed_status === "idle").length,
    stale:   sorted.filter((w) => w.computed_status === "stale").length,
    offline: sorted.filter((w) => w.computed_status === "offline").length,
  };

  const activeCount = counts.busy + counts.idle;
  const unhealthyCount = counts.stale + counts.offline;
  const filtered = filter === "all" ? sorted : sorted.filter((w) => w.computed_status === filter);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Workers"
        subtitle={workers ? `${activeCount} active · ${workers.length} total` : undefined}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
        actions={
          counts.stale > 0 ? (
            <ConfirmButton
              label={`Sweep ${counts.stale} stale`}
              confirmLabel={`Mark ${counts.stale} stale workers offline?`}
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

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {/* ── Stats strip ── */}
        {workers && (
          <div
            className="flex gap-2 px-4 md:px-6 py-3 overflow-x-auto hide-scrollbar border-b shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            {[
              { label: "Active",  value: activeCount,    color: "text-emerald-400" },
              { label: "Busy",    value: counts.busy,    color: "text-blue-400" },
              { label: "Idle",    value: counts.idle,    color: "text-emerald-400" },
              { label: "Stale",   value: counts.stale,   color: "text-amber-400" },
              { label: "Offline", value: counts.offline, color: "text-gray-500" },
            ].map((s) => (
              <div
                key={s.label}
                className="shrink-0 px-3 pt-2 pb-2.5 rounded-xl text-center min-w-[68px]"
                style={{
                  background: "var(--glass-bg)",
                  backdropFilter: "var(--glass-blur-light)",
                  WebkitBackdropFilter: "var(--glass-blur-light)",
                  border: "1px solid var(--glass-border-bright)",
                }}
              >
                <div className={cn("text-2xl font-semibold tabular-nums leading-none", s.color)}>
                  {s.value}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wide mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Health banner ── */}
        {workers && unhealthyCount > 0 && (
          <div
            className="flex items-center gap-2 px-4 md:px-6 py-2.5 text-xs shrink-0"
            style={{
              background: "rgba(239,68,68,0.06)",
              borderBottom: "1px solid rgba(239,68,68,0.12)",
              color: "#f87171",
            }}
          >
            <RiAlertLine className="w-3.5 h-3.5 shrink-0" />
            <span>
              {unhealthyCount} worker{unhealthyCount !== 1 ? "s" : ""} need
              {unhealthyCount === 1 ? "s" : ""} attention
              {counts.stale > 0 && ` · ${counts.stale} stale`}
              {counts.offline > 0 && ` · ${counts.offline} offline`}
            </span>
          </div>
        )}

        {/* ── Filter chips ── */}
        {workers && (
          <div
            className="flex gap-2 px-4 md:px-6 py-3 overflow-x-auto hide-scrollbar border-b shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            {FILTERS.map((chip) => {
              const isActive = filter === chip.value;
              return (
                <button
                  key={chip.value}
                  onClick={() => setFilter(chip.value)}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all min-h-[36px]"
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
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  {chip.dot && (
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", chip.dot)} />
                  )}
                  {chip.label}
                  <span className="ml-0.5 text-[10px] opacity-60">
                    {counts[chip.value]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Cards ── */}
        <div className="p-4 md:p-6">
          {isLoading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState error={error} />
          ) : filtered.length === 0 ? (
            <EmptyState
              message={filter === "all" ? "No workers registered" : `No ${filter} workers`}
              detail={
                filter === "all"
                  ? "Workers register themselves on startup."
                  : "Try a different filter."
              }
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((worker, idx) => (
                <WorkerCard key={worker.id} worker={worker} onRemove={refresh} index={idx} />
              ))}
            </div>
          )}
        </div>
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

function getWorkerIcon(hostname: string) {
  if (hostname.startsWith("dell")) return RiComputerLine;
  if (hostname.startsWith("home")) return RiCpuLine;
  return RiPrinterLine;
}

const STATUS_ACCENT: Record<WorkerStatus, { hex: string; glow: string }> = {
  busy:    { hex: "#60a5fa", glow: "rgba(59,130,246,0.20)" },
  idle:    { hex: "#34d399", glow: "rgba(52,211,153,0.15)" },
  stale:   { hex: "#fbbf24", glow: "rgba(251,191,36,0.15)" },
  offline: { hex: "#6b7280", glow: "transparent" },
};

function WorkerCard({
  worker,
  onRemove,
  index,
}: {
  worker: Worker;
  onRemove: () => void;
  index: number;
}) {
  const caps = parseCaps(worker.capabilities);
  const isUnhealthy =
    worker.computed_status === "offline" || worker.computed_status === "stale";
  const Icon = getWorkerIcon(worker.hostname);
  const accent = STATUS_ACCENT[worker.computed_status] ?? STATUS_ACCENT.offline;

  return (
    <div
      className="rounded-2xl p-4 transition-all card-enter"
      style={{
        animationDelay: `${index * 35}ms`,
        background: isUnhealthy
          ? "linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box," +
            "linear-gradient(135deg, rgba(239,68,68,0.25), var(--border)) border-box"
          : "linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box," +
            "linear-gradient(135deg, var(--glass-border-bright), var(--border)) border-box",
        border: "1px solid transparent",
        boxShadow: isUnhealthy
          ? "0 0 20px rgba(239,68,68,0.06)"
          : `0 0 20px ${accent.glow}`,
      }}
    >
      <div className="flex items-start gap-4">
        {/* Worker icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(${accent.hex}18, ${accent.hex}08) padding-box,` +
              `linear-gradient(135deg, ${accent.hex}45, ${accent.hex}18) border-box`,
            border: "1px solid transparent",
            boxShadow: `0 0 14px ${accent.glow}`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: accent.hex }} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[15px] font-semibold"
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
            <WorkerStatusBadge status={worker.computed_status} />
          </div>

          {/* Capability chips */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {caps.map((cap) => (
              <span
                key={cap}
                className="px-2 py-0.5 rounded-lg text-[11px] font-medium uppercase tracking-wide"
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

        {/* Metadata + remove action */}
        <div className="text-right shrink-0 space-y-1.5">
          <div className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
            {shortId(worker.id)}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            seen {relativeTime(worker.last_seen_at)}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            since {relativeTime(worker.created_at)}
          </div>
          {isUnhealthy && (
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
          className="mt-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2"
          style={{
            background: "rgba(239,68,68,0.07)",
            color: "#f87171",
            border: "1px solid rgba(239,68,68,0.12)",
          }}
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
