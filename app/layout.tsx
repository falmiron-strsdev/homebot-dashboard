import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "HomeBot Dashboard",
  description: "Distributed AI dev-orchestration control plane",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-48 min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
