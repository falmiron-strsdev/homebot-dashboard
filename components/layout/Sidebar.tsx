"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  RiDashboardLine,
  RiServerLine,
  RiBriefcaseLine,
  RiPulseLine,
  RiBarChartBoxLine,
  RiRobotLine,
} from "react-icons/ri";

const NAV = [
  { href: "/",         label: "Overview", Icon: RiDashboardLine, shortcut: "G+O" },
  { href: "/workers",  label: "Workers",  Icon: RiServerLine,    shortcut: "G+W" },
  { href: "/jobs",     label: "Jobs",     Icon: RiBriefcaseLine, shortcut: "G+J" },
  { href: "/activity", label: "Activity", Icon: RiPulseLine,     shortcut: "G+A" },
  { href: "/usage",    label: "Usage",    Icon: RiBarChartBoxLine, shortcut: "G+U" },
  { href: "/chat",     label: "Chat",     Icon: RiRobotLine,     shortcut: "G+C" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed left-0 top-0 h-screen w-48 flex flex-col border-r z-10"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Logo / wordmark */}
      <div
        className="flex items-center gap-2 px-4 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
          style={{ background: "#1d4ed8", color: "#fff" }}
        >
          H
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>
            HomeBot
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Orchestrator
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, Icon, shortcut }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors",
                isActive
                  ? "bg-blue-600/20 border-l-2 border-l-blue-400 pl-[10px]"
                  : "border-l-2 border-l-transparent hover:bg-[var(--bg-hover)]"
              )}
              style={isActive ? { color: "#93c5fd" } : { color: "var(--text-secondary)" }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <span
                className="text-[9px] px-1 py-0.5 rounded"
                style={{
                  background: "var(--bg-hover)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {shortcut}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 border-t text-[10px]"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <div>Pi · 192.168.1.222:8000</div>
        <div className="mt-0.5">v1.1.0</div>
      </div>
    </nav>
  );
}
