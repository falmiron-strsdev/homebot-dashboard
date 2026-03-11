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
        <footer style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: "0.7rem",
          padding: "4px",
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}>
          v1.0.0 &mdash; &copy; {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
