"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { fetchOverview } from "@/lib/api";
import { StatCard } from "@/components/overview/StatCard";
import { JobStatusBadge } from "@/components/ui/StatusDot";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import Header from "@/components/layout/Header";
import { useHaptics } from "@/lib/useHaptics";
import { relativeTime, repoName, shortId } from "@/lib/utils";
import type { Job, Deployment } from "@/lib/types";
import {
  RiExternalLinkLine,
  RiRefreshLine,
  RiRobotLine,
  RiServerLine,
  RiFlashlightLine,
  RiCheckboxCircleLine,
  RiAddCircleLine,
  RiCloudLine,
} from "react-icons/ri";

// ── Time-of-day helpers ────────────────────────────────────────────────────────

type TimePeriod = "morning" | "afternoon" | "evening" | "night";

function getTimeGreeting(): { greeting: string; period: TimePeriod } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { greeting: "Good morning", period: "morning" };
  if (h >= 12 && h < 17) return { greeting: "Good afternoon", period: "afternoon" };
  if (h >= 17 && h < 22) return { greeting: "Good evening", period: "evening" };
  return { greeting: "Working late", period: "night" };
}

const PERIOD_GRADIENT: Record<TimePeriod, string> = {
  morning:
    "radial-gradient(ellipse 90% 55% at 25% -5%, rgba(251,146,60,0.18) 0%, transparent 65%), radial-gradient(ellipse 60% 45% at 80% 20%, rgba(59,130,246,0.14) 0%, transparent 65%)",
  afternoon:
    "radial-gradient(ellipse 90% 55% at 20% -5%, rgba(59,130,246,0.20) 0%, transparent 65%), radial-gradient(ellipse 60% 45% at 85% 25%, rgba(99,102,241,0.12) 0%, transparent 65%)",
  evening:
    "radial-gradient(ellipse 90% 55% at 35% -5%, rgba(139,92,246,0.20) 0%, transparent 65%), radial-gradient(ellipse 60% 45% at 75% 20%, rgba(59,130,246,0.14) 0%, transparent 65%)",
  night:
    "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(99,102,241,0.14) 0%, transparent 65%), radial-gradient(ellipse 60% 45% at 20% 30%, rgba(29,78,216,0.10) 0%, transparent 65%)",
};

// ── Mini sparkline bar chart ───────────────────────────────────────────────────

function makeSparkBars(value: number, count = 7): number[] {
  if (value <= 0) return [2, 3, 2, 4, 3, 3, 2];
  const SHAPE = [0.35, 0.55, 0.42, 0.78, 0.62, 0.88, 1.0];
  return SHAPE.map((s) => Math.max(1, Math.round(s * value)));
}

function Sparkline({ bars, colorClass }: { bars: number[]; colorClass: string }) {
  const max = Math.max(...bars, 1);
  return (
    <div className="flex items-end gap-[2px] h-7">
      {bars.map((v, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full ${colorClass}`}
          style={{
            height: `${Math.max(15, Math.round((v / max) * 100))}%`,
            opacity: 0.45 + (i / (bars.length - 1)) * 0.55,
          }}
        />
      ))}
    </div>
  );
}

// ── Status chip ────────────────────────────────────────────────────────────────

function StatusChip({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur-light)",
        WebkitBackdropFilter: "var(--glass-blur-light)",
        border: "1px solid var(--glass-border-bright)",
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

// ── Swipeable glass panel card ─────────────────────────────────────────────────

interface GlassPanelProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  sub: string;
  accentClass: string;
  sparkColorClass: string;
  onClick?: () => void;
}

function GlassPanel({
  icon: Icon,
  title,
  value,
  sub,
  accentClass,
  sparkColorClass,
  onClick,
}: GlassPanelProps) {
  const bars = makeSparkBars(value);
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 snap-start rounded-2xl p-4 flex flex-col text-left active:scale-[0.97] transition-transform"
      style={{
        width: "clamp(160px, 52vw, 220px)",
        background: "var(--glass-bg-elevated)",
        backdropFilter: "var(--glass-blur-light)",
        WebkitBackdropFilter: "var(--glass-blur-light)",
        border: "1px solid var(--glass-border-bright)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--bg-hover)" }}
        >
          <Icon className={`w-4 h-4 ${accentClass}`} />
        </div>
        <span
          className="text-[10px] uppercase tracking-[0.12em] font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </span>
      </div>
      <div className={`text-4xl font-bold tabular-nums tracking-tight mb-0.5 leading-none ${accentClass}`}>
        {value}
      </div>
      <div className="text-[11px] mb-3 leading-tight" style={{ color: "var(--text-muted)" }}>
        {sub}
      </div>
      <Sparkline bars={bars} colorClass={sparkColorClass} />
    </button>
  );
}

// ── Activity pill tile ─────────────────────────────────────────────────────────

function ActivityPill({ job }: { job: Job }) {
  const STATUS_MAP: Record<string, { dotClass: string; labelClass: string }> = {
    completed: { dotClass: "bg-emerald-400 animate-pulse-dot", labelClass: "text-emerald-400" },
    running:   { dotClass: "bg-blue-400 animate-pulse-dot",    labelClass: "text-blue-400"    },
    assigned:  { dotClass: "bg-blue-400 animate-pulse-dot",    labelClass: "text-blue-400"    },
    queued:    { dotClass: "bg-slate-400",                     labelClass: "text-slate-400"   },
    failed:    { dotClass: "bg-red-400",                       labelClass: "text-red-400"     },
    review:    { dotClass: "bg-purple-400 animate-pulse-dot",  labelClass: "text-purple-400"  },
    cancelled: { dotClass: "bg-gray-500",                      labelClass: "text-gray-500"    },
  };
  const s = STATUS_MAP[job.status] ?? { dotClass: "bg-gray-400", labelClass: "text-gray-400" };

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex-shrink-0 snap-start w-48 rounded-2xl p-3 flex flex-col gap-1.5 active:scale-[0.96] transition-transform"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur-light)",
        WebkitBackdropFilter: "var(--glass-blur-light)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dotClass}`} />
        <span className={`text-[10px] uppercase tracking-wider font-semibold ${s.labelClass}`}>
          {job.status}
        </span>
      </div>
      <div
        className="text-xs font-medium leading-snug"
        style={{
          color: "var(--text-primary)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {job.title}
      </div>
      <div className="flex items-center gap-1.5 mt-auto pt-0.5">
        <RiServerLine className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
        <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
          {relativeTime(job.updated_at)}
        </span>
      </div>
    </Link>
  );
}

// ── Floating quick-action dock ─────────────────────────────────────────────────

function FloatingDock({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const { fire: haptic } = useHaptics();

  return (
    <div
      className="md:hidden fixed inset-x-0 z-40 flex justify-center pointer-events-none dock-rise"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 68px)" }}
    >
      <div
        className="pointer-events-auto flex items-center gap-2 px-3 py-2.5 rounded-full"
        style={{
          background: "var(--glass-bg-heavy)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-border-bright)",
          boxShadow: "var(--shadow-lg), 0 0 24px rgba(0,0,0,0.45)",
        }}
      >
        {/* Chat */}
        <Link
          href="/chat"
          onClick={() => haptic("send")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-transform active:scale-95"
          style={{
            background: "rgba(29,78,216,0.35)",
            border: "1px solid rgba(59,130,246,0.35)",
            color: "#93c5fd",
          }}
        >
          <RiRobotLine className="w-4 h-4" />
          Chat
        </Link>

        {/* Jobs */}
        <Link
          href="/jobs"
          onClick={() => haptic("send")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-transform active:scale-95"
          style={{
            background: "rgba(5,150,105,0.22)",
            border: "1px solid rgba(16,185,129,0.28)",
            color: "#6ee7b7",
          }}
        >
          <RiAddCircleLine className="w-4 h-4" />
          Jobs
        </Link>

        {/* Refresh */}
        <button
          onClick={() => {
            haptic("reply");
            onRefresh();
          }}
          disabled={isRefreshing}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
          style={{
            background: "var(--bg-hover)",
            border: "1px solid var(--glass-border-bright)",
          }}
        >
          <RiRefreshLine
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            style={{ color: "var(--text-secondary)" }}
          />
        </button>
      </div>
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────────

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

// ── Deployment row (desktop) ───────────────────────────────────────────────────

function DeploymentRow({ deployment }: { deployment: Deployment }) {
  const STATUS_COLORS: Record<string, string> = {
    READY:    "text-emerald-400",
    BUILDING: "text-blue-400",
    QUEUED:   "text-slate-400",
    ERROR:    "text-red-400",
    CANCELED: "text-gray-500",
  };
  const displayUrl = deployment.alias_url ?? deployment.url;
  const color = STATUS_COLORS[deployment.status] ?? "text-gray-400";
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: "var(--bg-surface)" }}
    >
      <span className={`text-[11px] font-medium uppercase w-16 shrink-0 ${color}`}>
        {deployment.status === "READY" ? "Live" : deployment.status}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
          {deployment.project_name ?? deployment.vercel_project_id}
        </div>
      </div>
      {displayUrl ? (
        <a
          href={displayUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline shrink-0"
        >
          <span className="hidden sm:inline">
            {displayUrl.replace("https://", "").split("/")[0]}
          </span>
          <RiExternalLinkLine className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
          {relativeTime(deployment.created_at)}
        </span>
      )}
    </div>
  );
}

// ── Job row (desktop) ──────────────────────────────────────────────────────────

function JobRow({ job }: { job: Job }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)] group"
      style={{ background: "var(--bg-surface)" }}
    >
      <JobStatusBadge status={job.status} />
      <div className="flex-1 min-w-0">
        <div
          className="text-xs font-medium truncate group-hover:text-blue-300 transition-colors"
          style={{ color: "var(--text-primary)" }}
        >
          {job.title}
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
          {repoName(job.repo_url)}
          {job.work_branch && (
            <span className="ml-2 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              {job.work_branch}
            </span>
          )}
        </div>
      </div>
      <div className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
        {relativeTime(job.updated_at)}
      </div>
      <div
        className="text-[10px] font-mono shrink-0 hidden sm:block"
        style={{ color: "var(--text-muted)" }}
      >
        {shortId(job.id)}
      </div>
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router = useRouter();
  const { data, error, isLoading, isRefreshing, lastUpdated, refresh } =
    useAutoRefresh({ fetcher: fetchOverview, intervalMs: 30_000 });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { workers, jobs, deployments, recent_jobs, recent_failures } = data;
  const activeWorkers = workers.idle + workers.busy;
  const systemHealthy = activeWorkers > 0 && workers.offline + workers.stale === 0;
  const systemDegraded = workers.offline + workers.stale > 0;

  const { greeting, period } = getTimeGreeting();

  // Merge + dedupe activity feed (failures first, then recent jobs)
  const activityItems = [...recent_failures, ...recent_jobs]
    .filter((j, i, arr) => arr.findIndex((x) => x.id === j.id) === i)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 12);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Overview"
        subtitle="System health at a glance"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 overflow-y-auto">

        {/* ════════════════════════════════════════════════════════════════════
            MOBILE: Native immersive layout (hidden on md+)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="md:hidden">

          {/* ── Hero section ──────────────────────────────────────────────── */}
          <section className="relative px-4 pt-5 pb-5 overflow-hidden">
            {/* Background ambient layer */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div
                className="absolute inset-0"
                style={{ background: PERIOD_GRADIENT[period] }}
              />
              {/* Animated glow orb */}
              <div
                className="hero-glow absolute -top-8 left-1/3 w-56 h-56 rounded-full"
                style={{
                  background: systemHealthy
                    ? "radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)"
                    : systemDegraded
                    ? "radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)"
                    : "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)",
                }}
              />
              {/* Secondary orb */}
              <div
                className="hero-glow-slow absolute top-4 right-0 w-40 h-40 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)",
                }}
              />
            </div>

            {/* Greeting */}
            <div
              className="relative text-[11px] font-semibold uppercase tracking-[0.15em] mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              {greeting}
            </div>

            {/* Big headline */}
            <h1
              className="relative font-bold tracking-tight leading-tight mb-3"
              style={{
                font: "var(--text-display)",
                color: "var(--text-primary)",
                fontSize: "28px",
              }}
            >
              {systemHealthy
                ? "All Systems Go"
                : systemDegraded
                ? "Degraded"
                : "No Workers"}
            </h1>

            {/* Status chips */}
            <div className="relative flex flex-wrap items-center gap-2">
              <StatusChip
                dotClass={
                  systemHealthy
                    ? "bg-emerald-400 animate-pulse-dot"
                    : systemDegraded
                    ? "bg-amber-400 animate-pulse-dot"
                    : "bg-gray-500"
                }
                label={`${activeWorkers} worker${activeWorkers !== 1 ? "s" : ""} online`}
              />
              {jobs.running + jobs.assigned > 0 && (
                <StatusChip
                  dotClass="bg-blue-400 animate-pulse-dot"
                  label={`${jobs.running + jobs.assigned} running`}
                />
              )}
              {jobs.failed > 0 && (
                <StatusChip
                  dotClass="bg-red-400"
                  label={`${jobs.failed} failure${jobs.failed !== 1 ? "s" : ""}`}
                />
              )}
              {jobs.queued > 0 && (
                <StatusChip dotClass="bg-slate-400" label={`${jobs.queued} queued`} />
              )}
            </div>
          </section>

          {/* ── Swipeable glass panels ─────────────────────────────────────── */}
          <section className="mb-5">
            <div className="px-4 mb-2">
              <SectionLabel>System</SectionLabel>
            </div>
            <div
              className="overflow-x-auto hide-scrollbar snap-x snap-mandatory"
              style={{ overscrollBehaviorX: "contain" }}
            >
              <div className="flex gap-3 px-4 pb-1" style={{ width: "max-content" }}>
                <GlassPanel
                  icon={RiServerLine}
                  title="Workers"
                  value={activeWorkers}
                  sub={`of ${workers.total} total · ${workers.busy} busy`}
                  accentClass="text-emerald-400"
                  sparkColorClass="bg-emerald-400"
                  onClick={() => router.push("/workers")}
                />
                <GlassPanel
                  icon={RiFlashlightLine}
                  title="Running"
                  value={jobs.running + jobs.assigned}
                  sub={`${jobs.queued} queued · ${jobs.review} in review`}
                  accentClass="text-blue-400"
                  sparkColorClass="bg-blue-400"
                  onClick={() => router.push("/jobs?status=running")}
                />
                <GlassPanel
                  icon={RiCheckboxCircleLine}
                  title="Done"
                  value={jobs.completed}
                  sub={`${jobs.failed > 0 ? `${jobs.failed} failed · ` : ""}${jobs.cancelled} cancelled`}
                  accentClass={jobs.failed > 0 ? "text-amber-400" : "text-emerald-400"}
                  sparkColorClass={jobs.failed > 0 ? "bg-amber-400" : "bg-emerald-400"}
                  onClick={() => router.push("/jobs?status=completed")}
                />
                {deployments && deployments.total > 0 && (
                  <GlassPanel
                    icon={RiCloudLine}
                    title="Deploy"
                    value={deployments.live}
                    sub={`${deployments.building} building · ${deployments.failed} failed`}
                    accentClass="text-purple-400"
                    sparkColorClass="bg-purple-400"
                    onClick={() => router.push("/deployments")}
                  />
                )}
              </div>
            </div>
          </section>

          {/* ── Activity feed ──────────────────────────────────────────────── */}
          {activityItems.length > 0 && (
            <section className="mb-5">
              <div className="px-4 mb-2">
                <SectionLabel>Recent Activity</SectionLabel>
              </div>
              <div
                className="overflow-x-auto hide-scrollbar snap-x snap-mandatory"
                style={{ overscrollBehaviorX: "contain" }}
              >
                <div className="flex gap-2 px-4 pb-1" style={{ width: "max-content" }}>
                  {activityItems.map((job) => (
                    <ActivityPill key={job.id} job={job} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Spacer for floating dock + bottom nav */}
          <div className="h-36" />
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            DESKTOP: Multi-column stat layout (hidden on mobile)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="hidden md:block p-6 space-y-6 pb-6">

          {/* Workers */}
          <section>
            <SectionLabel>Workers</SectionLabel>
            <div className="grid grid-cols-4 gap-3">
              <StatCard
                label="Active"
                value={activeWorkers}
                sub={`of ${workers.total} total`}
                accent="text-emerald-400"
                onClick={() => router.push("/workers")}
              />
              <StatCard
                label="Idle"
                value={workers.idle}
                accent="text-emerald-400"
                onClick={() => router.push("/workers")}
              />
              <StatCard
                label="Busy"
                value={workers.busy}
                accent="text-blue-400"
                onClick={() => router.push("/workers")}
              />
              <StatCard
                label="Offline / Stale"
                value={workers.offline + workers.stale}
                accent={
                  workers.offline + workers.stale > 0 ? "text-amber-400" : "text-gray-500"
                }
                onClick={() => router.push("/workers")}
              />
            </div>
          </section>

          {/* Jobs */}
          <section>
            <SectionLabel>Jobs</SectionLabel>
            <div className="grid grid-cols-4 gap-3">
              <StatCard
                label="Total"
                value={jobs.total}
                onClick={() => router.push("/jobs")}
              />
              <StatCard
                label="Queued"
                value={jobs.queued}
                accent={jobs.queued > 0 ? "text-slate-300" : undefined}
                onClick={() => router.push("/jobs?status=queued")}
              />
              <StatCard
                label="Running"
                value={jobs.running + jobs.assigned}
                accent={jobs.running + jobs.assigned > 0 ? "text-blue-400" : undefined}
                sub={jobs.assigned > 0 ? `${jobs.assigned} assigned` : undefined}
                onClick={() => router.push("/jobs?status=running")}
              />
              <StatCard
                label="In Review"
                value={jobs.review}
                accent={jobs.review > 0 ? "text-purple-400" : undefined}
                onClick={() => router.push("/jobs?status=review")}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <StatCard
                label="Completed"
                value={jobs.completed}
                accent="text-emerald-400"
                onClick={() => router.push("/jobs?status=completed")}
              />
              <StatCard
                label="Failed"
                value={jobs.failed}
                accent={jobs.failed > 0 ? "text-red-400" : undefined}
                onClick={() => router.push("/jobs?status=failed")}
              />
              <StatCard
                label="Cancelled"
                value={jobs.cancelled}
                accent="text-gray-500"
                onClick={() => router.push("/jobs?status=cancelled")}
              />
            </div>
          </section>

          {/* Vercel Deployments */}
          {deployments && deployments.total > 0 && (
            <section>
              <SectionLabel>Vercel Deployments</SectionLabel>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <StatCard label="Live" value={deployments.live} accent="text-emerald-400" />
                <StatCard
                  label="Building"
                  value={deployments.building}
                  accent={deployments.building > 0 ? "text-blue-400" : undefined}
                />
                <StatCard
                  label="Failed"
                  value={deployments.failed}
                  accent={deployments.failed > 0 ? "text-red-400" : undefined}
                />
              </div>
              {deployments.recent.length > 0 && (
                <div
                  className="rounded-lg border divide-y overflow-hidden"
                  style={{ borderColor: "var(--border)" }}
                >
                  {deployments.recent.map((dep) => (
                    <DeploymentRow key={dep.id} deployment={dep} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Recent failures */}
          {recent_failures.length > 0 && (
            <section>
              <SectionLabel className="text-red-400/70">Recent Failures</SectionLabel>
              <div
                className="rounded-lg border divide-y overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                {recent_failures.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            </section>
          )}

          {/* Recent jobs */}
          <section>
            <SectionLabel>Recent Jobs</SectionLabel>
            {recent_jobs.length === 0 ? (
              <EmptyState message="No jobs yet" detail="Jobs will appear here once queued." />
            ) : (
              <div
                className="rounded-lg border divide-y overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                {recent_jobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </section>

          {/* Footer timestamp */}
          <div className="text-[11px] pb-2" style={{ color: "var(--text-muted)" }}>
            Data refreshes every 30 s · last fetched {lastUpdated}
          </div>
        </div>
      </div>

      {/* Floating quick-action dock (mobile only, fixed above bottom nav) */}
      <FloatingDock onRefresh={refresh} isRefreshing={isRefreshing} />
    </div>
  );
}
