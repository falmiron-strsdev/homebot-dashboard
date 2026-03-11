import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
}

export function Card({ children, className, noPad }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        !noPad && "p-4",
        className
      )}
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs font-semibold uppercase tracking-wider mb-3"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </div>
  );
}
