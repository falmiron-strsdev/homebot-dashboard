"use client";

import {
  NovuProvider,
  PopoverNotificationCenter,
  NotificationBell,
} from "@novu/notification-center";

const APP_IDENTIFIER =
  process.env.NEXT_PUBLIC_NOVU_APP_IDENTIFIER ?? "homebot-dashboard";
const SUBSCRIBER_ID =
  process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID ?? "anonymous";

export default function NotificationBellWidget() {
  return (
    <NovuProvider
      subscriberId={SUBSCRIBER_ID}
      applicationIdentifier={APP_IDENTIFIER}
    >
      <PopoverNotificationCenter colorScheme="dark">
        {({ unseenCount }) => <NotificationBell unseenCount={unseenCount} />}
      </PopoverNotificationCenter>
    </NovuProvider>
  );
}
