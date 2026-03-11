import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full min-h-screen gap-6 text-center px-4"
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="text-[96px] font-bold leading-none tracking-tight"
        style={{ color: "var(--border)" }}
      >
        404
      </div>
      <div>
        <p
          className="text-lg font-semibold mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Page not found
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="text-sm px-4 py-2 rounded-md border transition-colors hover:bg-[var(--bg-elevated)]"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        Back to overview
      </Link>
    </div>
  );
}
