import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string; // Tailwind color class for value text
  onClick?: () => void;
}

export function StatCard({ label, value, sub, accent, onClick }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex flex-col gap-1",
        onClick && "cursor-pointer transition-colors hover:border-blue-500/40"
      )}
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
      onClick={onClick}
    >
      <div className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className={cn("text-3xl font-semibold tabular-nums leading-tight", accent ?? "text-gray-100")}>
        {value}
      </div>
      {sub && (
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
