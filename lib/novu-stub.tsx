"use client";

/**
 * Local stub for @novu/notification-center.
 * Used because the real package is not available in this environment.
 * Exports NovuProvider and PopoverNotificationCenter with the same API shape.
 */

import React, { createContext, useContext, useState, useCallback } from "react";

interface NovuProviderProps {
  subscriberId: string;
  applicationIdentifier: string;
  children: React.ReactNode;
}

interface Notification {
  id: string;
  content: string;
  seen: boolean;
  createdAt: string;
}

interface NovuContextValue {
  notifications: Notification[];
  unreadCount: number;
}

const NovuContext = createContext<NovuContextValue>({
  notifications: [],
  unreadCount: 0,
});

export function NovuProvider({ children }: NovuProviderProps) {
  // Stub: no real backend connection; provides empty notification state
  return (
    <NovuContext.Provider value={{ notifications: [], unreadCount: 0 }}>
      {children}
    </NovuContext.Provider>
  );
}

interface PopoverNotificationCenterProps {
  colorScheme?: "light" | "dark";
  onNotificationClick?: (notification: Notification) => void;
  children: (props: { unseenCount: number }) => React.ReactNode;
}

export function PopoverNotificationCenter({
  colorScheme = "light",
  children,
}: PopoverNotificationCenterProps) {
  const { notifications, unreadCount } = useContext(NovuContext);
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="relative">
      <div onClick={toggle} style={{ cursor: "pointer" }}>
        {children({ unseenCount: unreadCount })}
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            width: 320,
            background: colorScheme === "dark" ? "#1e1e2e" : "#fff",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              fontSize: 13,
              fontWeight: 600,
              color: colorScheme === "dark" ? "#cdd6f4" : "#1e1e2e",
            }}
          >
            Notifications
          </div>

          {notifications.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              No notifications yet
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12,
                    color: colorScheme === "dark" ? "#cdd6f4" : "#1e1e2e",
                    background: n.seen ? "transparent" : "rgba(139,92,246,0.06)",
                  }}
                >
                  {n.content}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
