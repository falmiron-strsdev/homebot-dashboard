import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "OpenClaw",
  description: "AI orchestrator — natural language interface",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OpenClaw",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--bg-base)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
