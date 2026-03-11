"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiDashboardLine,
  RiServerLine,
  RiBriefcaseLine,
  RiPulseLine,
  RiRobotLine,
} from "react-icons/ri";

const NAV = [
  { href: "/",         label: "Overview", Icon: RiDashboardLine },
  { href: "/workers",  label: "Workers",  Icon: RiServerLine },
  { href: "/jobs",     label: "Jobs",     Icon: RiBriefcaseLine },
  { href: "/activity", label: "Activity", Icon: RiPulseLine },
  { href: "/chat",     label: "Chat",     Icon: RiRobotLine },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: "var(--glass-bg-heavy)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderTop: "1px solid var(--glass-border-bright)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around px-1 pt-1.5 pb-1">
        {NAV.map(({ href, label, Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-1 rounded-xl transition-colors"
              style={{
                color: isActive ? "#93c5fd" : "var(--text-muted)",
              }}
            >
              <Icon className="w-5 h-5" />
              <span
                className="text-[9px] font-medium tracking-wide uppercase"
                style={{ color: isActive ? "#93c5fd" : "var(--text-muted)" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
