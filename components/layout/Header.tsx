"use client";

import { RiRefreshLine } from "react-icons/ri";
import NotificationBellWidget from "./NotificationBell";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  lastUpdated?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Header({
  title,
  subtitle,
  actions,
  lastUpdated,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: "var(--border)" }}
    >
      <div>
        <h1
          className="text-base font-semibold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs hidden sm:inline" style={{ color: "var(--text-muted)" }}>
            updated {lastUpdated}
          </span>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
            }}
          >
            <RiRefreshLine className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
        <NotificationBellWidget />
        {actions}
      </div>
    </div>
  );
}
