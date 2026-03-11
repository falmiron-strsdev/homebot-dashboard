"use client";

import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { StatCard } from "@/components/overview/StatCard";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/EmptyState";
import Header from "@/components/layout/Header";
import { formatDuration, shortId } from "@/lib/utils";
import type { UsageData } from "@/app/api/usage/route";
import { RiAlertLine, RiInformationLine } from "react-icons/ri";

async function fetchUsage(): Promise<UsageData> {
  const res = await fetch("/api/usage", { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export default function UsagePage() {
  const { data, error, isLoading, isRefreshing, lastUpdated, refresh } =
    useAutoRefresh({ fetcher: fetchUsage, intervalMs: 60_000 });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Usage"
        subtitle="Run activity and cost tracking"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data ? null : (
          <>
            {/* What IS available */}
            <section>
              <SectionLabel>Run activity (available now)</SectionLabel>
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="Total jobs" value={data.total_jobs} />
                <StatCard label="Total runs" value={data.total_runs} />
                <StatCard
                  label="Completed"
                  value={data.completed_runs}
                  accent="text-emerald-400"
                />
                <StatCard
                  label="Failed"
                  value={data.failed_runs}
                  accent={data.failed_runs > 0 ? "text-red-400" : undefined}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <StatCard
                  label="Total runtime"
                  value={formatDuration(data.total_runtime_seconds)}
                  sub="across all completed runs"
                />
                <StatCard
                  label="Avg run time"
                  value={formatDuration(data.avg_runtime_seconds)}
                  sub="per completed run"
                />
              </div>
            </section>

            {/* Per-worker breakdown */}
            {data.per_worker.length > 0 && (
              <section>
                <SectionLabel>Per-worker breakdown</SectionLabel>
                <Card noPad>
                  <table className="w-full text-xs">
                    <thead>
                      <tr
                        className="text-[10px] uppercase tracking-widest border-b"
                        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                      >
                        <Th>Worker ID</Th>
                        <Th>Runs</Th>
                        <Th>Completed</Th>
                        <Th>Failed</Th>
                        <Th>Total runtime</Th>
                        <Th>Success rate</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.per_worker.map((w) => {
                        const rate =
                          w.runs > 0 ? Math.round((w.completed / w.runs) * 100) : null;
                        return (
                          <tr
                            key={w.worker_id}
                            className="border-b"
                            style={{ borderColor: "var(--border-subtle)" }}
                          >
                            <Td>
                              <span className="font-mono text-[10px]">
                                {shortId(w.worker_id)}
                              </span>
                            </Td>
                            <Td>{w.runs}</Td>
                            <Td>
                              <span className="text-emerald-400">{w.completed}</span>
                            </Td>
                            <Td>
                              <span className={w.failed > 0 ? "text-red-400" : "text-gray-500"}>
                                {w.failed}
                              </span>
                            </Td>
                            <Td>
                              {formatDuration(w.runtime_seconds)}
                            </Td>
                            <Td>
                              {rate !== null ? (
                                <span className={rate >= 80 ? "text-emerald-400" : "text-amber-400"}>
                                  {rate}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </section>
            )}

            {/* Honest "not yet available" section */}
            <section>
              <SectionLabel className="text-amber-400/60">
                Cost / token tracking — not yet available
              </SectionLabel>
              <Card>
                <div className="flex items-start gap-3">
                  <RiAlertLine className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {data.note}
                  </p>
                </div>
              </Card>
            </section>

            {/* Backend additions required */}
            <section>
              <SectionLabel>Required backend additions for cost tracking</SectionLabel>
              <Card>
                <div className="space-y-4">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    The following minimal changes to the orchestrator{" "}
                    <code className="px-1 rounded text-[11px]" style={{ background: "var(--bg-elevated)" }}>
                      schema.sql
                    </code>{" "}
                    and worker{" "}
                    <code className="px-1 rounded text-[11px]" style={{ background: "var(--bg-elevated)" }}>
                      agent.py
                    </code>{" "}
                    are needed to expose cost data:
                  </p>

                  <div>
                    <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                      1. Add fields to the <code className="font-mono">runs</code> table
                    </div>
                    <pre
                      className="text-[11px] font-mono leading-relaxed p-3 rounded overflow-x-auto"
                      style={{ background: "var(--bg-elevated)", color: "#86efac" }}
                    >
{`ALTER TABLE runs ADD COLUMN model_name TEXT;
ALTER TABLE runs ADD COLUMN tokens_in  INTEGER;
ALTER TABLE runs ADD COLUMN tokens_out INTEGER;
ALTER TABLE runs ADD COLUMN cost_usd   REAL;`}
                    </pre>
                    <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                      These are nullable — old runs stay valid, new ones can be enriched.
                    </p>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                      2. Parse Claude Code output in the worker
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Claude Code CLI writes token counts and model info to stdout/stderr when run with{" "}
                      <code className="font-mono text-[11px] px-1 rounded" style={{ background: "var(--bg-elevated)" }}>
                        --output-format stream-json
                      </code>
                      . The worker should capture this and include it in the{" "}
                      <code className="font-mono text-[11px] px-1 rounded" style={{ background: "var(--bg-elevated)" }}>
                        PATCH /runs/{"{run_id}"}
                      </code>{" "}
                      call when the run finishes.
                    </p>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                      3. Add the fields to RunUpdate model (orchestrator)
                    </div>
                    <pre
                      className="text-[11px] font-mono leading-relaxed p-3 rounded overflow-x-auto"
                      style={{ background: "var(--bg-elevated)", color: "#86efac" }}
                    >
{`class RunUpdate(BaseModel):
    status: str
    exit_code: Optional[int] = None
    log_tail: Optional[str] = None
    branch: Optional[str] = None
    commit_sha: Optional[str] = None
    summary: Optional[str] = None
    model_name: Optional[str] = None   # ← add
    tokens_in: Optional[int] = None    # ← add
    tokens_out: Optional[int] = None   # ← add
    cost_usd: Optional[float] = None   # ← add`}
                    </pre>
                  </div>

                  <div
                    className="text-[11px] px-3 py-2 rounded border"
                    style={{
                      background: "rgba(59,130,246,0.06)",
                      borderColor: "rgba(59,130,246,0.2)",
                      color: "#93c5fd",
                    }}
                  >
                    <span className="font-semibold">Effort estimate:</span> ~1–2 hours.
                    Schema migration is a 4-line ALTER TABLE. Worker changes require parsing
                    Claude output JSON. No new dependencies needed.
                  </div>
                </div>
              </Card>
            </section>

            {/* What can be calculated now */}
            <section>
              <SectionLabel>Currently available proxies</SectionLabel>
              <Card>
                <ul className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <ListItem>
                    <span className="text-emerald-400 font-semibold">Available:</span> Total runs,
                    completed vs failed, per-worker run counts, job success rates.
                  </ListItem>
                  <ListItem>
                    <span className="text-emerald-400 font-semibold">Available:</span> Run duration
                    (wall-clock time from <code className="font-mono text-[10px] px-1 rounded" style={{ background: "var(--bg-elevated)" }}>started_at</code>{" "}
                    to{" "}
                    <code className="font-mono text-[10px] px-1 rounded" style={{ background: "var(--bg-elevated)" }}>finished_at</code>
                    ) as a rough proxy for compute time.
                  </ListItem>
                  <ListItem>
                    <span className="text-amber-400 font-semibold">Not available:</span> Token counts,
                    model name, estimated API cost — not tracked in the current schema.
                  </ListItem>
                  <ListItem>
                    <span className="text-amber-400 font-semibold">Not available:</span> Per-job cost
                    rollup — requires backend instrumentation.
                  </ListItem>
                </ul>
              </Card>
            </section>
          </>
        )}
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

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="shrink-0 mt-1" style={{ color: "var(--text-muted)" }}>·</span>
      <span>{children}</span>
    </li>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 font-medium first:pl-6 last:pr-6">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-3 align-middle first:pl-6 last:pr-6" style={{ color: "var(--text-primary)" }}>
      {children}
    </td>
  );
}
