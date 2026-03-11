"use client";

import { NovuProvider, PopoverNotificationCenter } from "@novu/notification-center";
import { RiBellLine } from "react-icons/ri";

const SUBSCRIBER_ID = "homebot-user";
const APP_ID =
  process.env.NEXT_PUBLIC_NOVU_APP_IDENTIFIER ?? "homebot-dashboard";

export default function NotificationBell() {
  return (
    <NovuProvider subscriberId={SUBSCRIBER_ID} applicationIdentifier={APP_ID}>
      <PopoverNotificationCenter colorScheme="dark">
        {({ unseenCount }) => (
          <button
            aria-label="Notifications"
            className="relative flex items-center justify-center w-8 h-8 rounded transition-colors"
            style={{
              color: "var(--text-secondary)",
              background: "transparent",
            }}
          >
            <RiBellLine
              className={`w-4 h-4 ${unseenCount > 0 ? "animate-[wiggle_1s_ease-in-out_infinite]" : ""}`}
            />
            {unseenCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 flex items-center justify-center rounded-full text-[9px] font-bold leading-none"
                style={{
                  minWidth: 14,
                  height: 14,
                  padding: "0 3px",
                  background: "#ef4444",
                  color: "#fff",
                }}
              >
                {unseenCount > 99 ? "99+" : unseenCount}
              </span>
            )}
          </button>
        )}
      </PopoverNotificationCenter>
    </NovuProvider>
  );
}
