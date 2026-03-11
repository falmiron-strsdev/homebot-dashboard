import { cn } from "@/lib/utils";
import {
  WORKER_STATUS_COLORS,
  WORKER_DOT_COLORS,
  JOB_STATUS_COLORS,
  JOB_DOT_COLORS,
} from "@/lib/utils";
import type { WorkerStatus, JobStatus } from "@/lib/types";

interface WorkerStatusBadgeProps {
  status: WorkerStatus;
}

export function WorkerStatusBadge({ status }: WorkerStatusBadgeProps) {
  const colorClass = WORKER_STATUS_COLORS[status] ?? "text-gray-500 bg-gray-500/10";
  const dotClass = WORKER_DOT_COLORS[status] ?? "bg-gray-500";
  const isAnimated = status === "busy";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide",
        colorClass
      )}
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotClass, isAnimated && "animate-pulse-dot")}
      />
      {status}
    </span>
  );
}

interface JobStatusBadgeProps {
  status: JobStatus;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const colorClass = JOB_STATUS_COLORS[status] ?? "text-gray-500 bg-gray-500/10";
  const dotClass = JOB_DOT_COLORS[status] ?? "bg-gray-500";
  const isAnimated = status === "running" || status === "qa_running";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide",
        colorClass
      )}
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotClass, isAnimated && "animate-pulse-dot")}
      />
      {status}
    </span>
  );
}
