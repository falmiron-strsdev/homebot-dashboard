import { RiInformationLine, RiAlertLine } from "react-icons/ri";

interface EmptyStateProps {
  message: string;
  detail?: string;
}

export function EmptyState({ message, detail }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center mb-3"
        style={{ background: "var(--bg-elevated)" }}
      >
        <RiInformationLine className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
        {message}
      </p>
      {detail && (
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {detail}
        </p>
      )}
    </div>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-9 h-9 rounded-full flex items-center justify-center mb-3 bg-red-500/10">
        <RiAlertLine className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm font-semibold text-red-400">Failed to load</p>
      <p className="text-xs mt-1.5 max-w-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {error}
      </p>
    </div>
  );
}
