"use client";

import { BiBell } from "react-icons/bi";

export default function NotificationBellWidget() {
  return (
    <button
      className="relative p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
      aria-label="Notifications"
    >
      <BiBell size={18} />
    </button>
  );
}
