import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <h1 className="text-8xl font-bold" style={{ color: "var(--text-muted)" }}>
        404
      </h1>
      <p className="text-xl" style={{ color: "var(--text-secondary)" }}>
        Page not found
      </p>
      <p style={{ color: "var(--text-muted)" }}>
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded border text-sm hover:bg-bg-hover transition-colors"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        Back to overview
      </Link>
    </div>
  );
}
