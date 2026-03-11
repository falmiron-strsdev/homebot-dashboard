import type { JobStatus, JobEvent } from "@/lib/types";
import { JOB_DOT_COLORS } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { RiCheckLine, RiCloseLine } from "react-icons/ri";

const STAGES: { status: JobStatus; label: string }[] = [
  { status: "queued",    label: "Queued" },
  { status: "assigned",  label: "Assigned" },
  { status: "running",   label: "Running" },
  { status: "review",    label: "Review" },
  { status: "completed", label: "Done" },
];

const STATUS_ORDER: Record<JobStatus, number> = {
  queued:    0,
  assigned:  1,
  running:   2,
  review:    3,
  completed: 4,
  failed:    3,
  cancelled: 1,
};

interface JobTimelineProps {
  currentStatus: JobStatus;
  events: JobEvent[];
}

export function JobTimeline({ currentStatus, events }: JobTimelineProps) {
  const isFailed    = currentStatus === "failed";
  const isCancelled = currentStatus === "cancelled";
  const currentOrder = STATUS_ORDER[currentStatus] ?? 0;

  const statusTimestamps: Partial<Record<JobStatus, string>> = {};
  for (const evt of events) {
    if (evt.event_type === "status_change" && evt.message) {
      const match = evt.message.match(/Status → (\w+)/);
      if (match) {
        const s = match[1] as JobStatus;
        if (!statusTimestamps[s]) statusTimestamps[s] = evt.created_at;
      }
    }
    if (evt.event_type === "created" && !statusTimestamps["queued"]) {
      statusTimestamps["queued"] = evt.created_at;
    }
  }

  return (
    <div className="flex items-start gap-0">
      {STAGES.map((stage, i) => {
        const stageOrder      = STATUS_ORDER[stage.status];
        const isPast          = stageOrder < currentOrder;
        const isCurrent       = stageOrder === currentOrder && !isFailed && !isCancelled;
        const isFailedHere    = isFailed    && stageOrder === currentOrder;
        const isCancelledHere = isCancelled && stageOrder <= currentOrder;
        const ts              = statusTimestamps[stage.status];
        const dotColor        = isFailed && isFailedHere ? "bg-red-400"
                              : isCancelledHere           ? "bg-gray-500"
                              : isPast || isCurrent       ? JOB_DOT_COLORS[stage.status] ?? "bg-gray-500"
                              :                             "bg-gray-700";
        const lineColor = isPast ? "bg-blue-500/40" : "bg-gray-700/50";

        return (
          <div key={stage.status} className="flex items-start flex-1">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors",
                  isPast          ? "border-blue-500/60 bg-blue-500/10"
                  : isCurrent     ? "border-blue-400 bg-blue-400/15"
                  : isFailedHere  ? "border-red-400 bg-red-400/10"
                  : isCancelledHere ? "border-gray-500 bg-gray-500/10"
                  :                   "border-gray-700 bg-transparent"
                )}
              >
                {isPast ? (
                  <RiCheckLine className="w-3.5 h-3.5 text-blue-400" />
                ) : isFailedHere ? (
                  <RiCloseLine className="w-3.5 h-3.5 text-red-400" />
                ) : isCurrent ? (
                  <span className={cn("w-2 h-2 rounded-full animate-pulse-dot", dotColor)} />
                ) : (
                  <span className={cn("w-2 h-2 rounded-full", dotColor)} />
                )}
              </div>
              <div className="mt-1.5 text-center">
                <div
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wide",
                    isPast || isCurrent ? "text-blue-300"
                    : isFailedHere      ? "text-red-400"
                    : isCancelledHere   ? "text-gray-500"
                    :                     "text-gray-600"
                  )}
                >
                  {isFailedHere ? "Failed" : stage.label}
                </div>
                {ts && (
                  <div className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {relativeTime(ts)}
                  </div>
                )}
              </div>
            </div>
            {i < STAGES.length - 1 && (
              <div className={cn("h-[2px] flex-1 mt-3.5 mx-1 rounded", lineColor)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
