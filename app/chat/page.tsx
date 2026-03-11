"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/lib/useHaptics";
import {
  RiSendPlaneLine,
  RiLoaderLine,
  RiAddLine,
  RiRobotLine,
  RiUserLine,
  RiAlertLine,
  RiFileCopyLine,
  RiCheckLine,
  RiHistoryLine,
  RiCloseLine,
  RiEditLine,
  RiDeleteBinLine,
  RiCheckFill,
} from "react-icons/ri";

// ── Types ──────────────────────────────────────────────────────────────────

type Role = "user" | "assistant" | "error";

interface Message {
  id: string;
  role: Role;
  content: string;
  ts: Date;
  duration_ms?: number;
  model?: string;
  usage?: { input: number; output: number; total: number; cacheRead?: number };
  /** true while SSE chunks are still arriving */
  streaming?: boolean;
}

interface SessionMeta {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_preview: string | null;
  message_count: number;
}

const QUICK_PROMPTS = [
  "What jobs are currently running?",
  "Show me worker status",
  "What happened with the last failed job?",
  "Queue a job to update the README in test-repo",
  "Create a new GitHub repo called my-new-project and queue an initial setup job",
  "How many jobs have been completed today?",
];

// ── Session helpers ────────────────────────────────────────────────────────

function newSessionId() {
  return `dashboard-${Date.now()}`;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Glass style helpers ────────────────────────────────────────────────────

const glassBubbleAssistant: React.CSSProperties = {
  background:
    "linear-gradient(var(--glass-bg), var(--glass-bg)) padding-box," +
    "linear-gradient(135deg, var(--glass-border-bright), var(--glass-border)) border-box",
  border: "1px solid transparent",
  backdropFilter: "var(--glass-blur-light)",
  WebkitBackdropFilter: "var(--glass-blur-light)" as React.CSSProperties["backdropFilter"],
  boxShadow: "0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
};

const glassBubbleUser: React.CSSProperties = {
  background:
    "linear-gradient(rgba(29,78,216,0.82), rgba(37,99,235,0.72)) padding-box," +
    "linear-gradient(135deg, rgba(96,165,250,0.55), rgba(29,78,216,0.25)) border-box",
  border: "1px solid transparent",
  backdropFilter: "var(--glass-blur-light)",
  WebkitBackdropFilter: "var(--glass-blur-light)" as React.CSSProperties["backdropFilter"],
  boxShadow: "0 0 20px var(--glow-user), 0 2px 8px rgba(0,0,0,0.25)",
};

const glassBubbleError: React.CSSProperties = {
  background:
    "linear-gradient(rgba(239,68,68,0.08), rgba(239,68,68,0.05)) padding-box," +
    "linear-gradient(135deg, rgba(239,68,68,0.35), rgba(239,68,68,0.15)) border-box",
  border: "1px solid transparent",
  boxShadow: "0 0 16px var(--glow-error)",
};

const glassRail: React.CSSProperties = {
  background: "var(--glass-bg-heavy)",
  backdropFilter: "var(--glass-blur)",
  WebkitBackdropFilter: "var(--glass-blur)" as React.CSSProperties["backdropFilter"],
  borderRight: "1px solid var(--glass-border)",
};

// ── Main component ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [orchAvailable, setOrchAvailable] = useState<boolean | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [dbWarning, setDbWarning] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { fire: haptic } = useHaptics();

  // Initialize session ID on client only to avoid SSR hydration mismatch
  useEffect(() => {
    setSessionId(newSessionId());
  }, []);

  // Check OpenClaw availability on mount
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setOrchAvailable(d.openclaw_available === true))
      .catch(() => setOrchAvailable(false));
  }, []);

  // Load session list
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } else if (res.status === 503) {
        const data = await res.json();
        setDbWarning(data.detail ?? "Chat history unavailable");
      }
    } catch {
      // ignore — history drawer will just be empty
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || loading) return;

      const userMsg: Message = { id: uid(), role: "user", content: msg, ts: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      haptic("send");

      // ── Try streaming first ────────────────────────────────────────────────
      let streamingId: string | null = null;
      let streamSucceeded = false;

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, session_id: sessionId }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Stream unavailable (${res.status})`);
        }

        // Add streaming placeholder bubble
        streamingId = uid();
        const placeholderTs = new Date();
        setMessages((prev) => [
          ...prev,
          { id: streamingId!, role: "assistant", content: "", ts: placeholderTs, streaming: true },
        ]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let firstTokenFired = false;

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const parts = sseBuffer.split("\n\n");
          sseBuffer = parts.pop() ?? "";

          for (const part of parts) {
            const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;

            let payload: {
              type: string;
              text?: string;
              firstToken?: boolean;
              session_id?: string;
              duration_ms?: number;
              model?: string;
              usage?: { input: number; output: number; total: number; cacheRead?: number };
              db_warning?: string;
              error?: string;
            };
            try {
              payload = JSON.parse(dataLine.slice(6));
            } catch {
              continue;
            }

            if (payload.type === "chunk" && payload.text) {
              if (!firstTokenFired) {
                haptic("firstToken");
                firstTokenFired = true;
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingId
                    ? { ...m, content: m.content + payload.text! }
                    : m
                )
              );
            } else if (payload.type === "done") {
              if (payload.db_warning && !dbWarning) setDbWarning(payload.db_warning);
              haptic("reply");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingId
                    ? {
                        ...m,
                        streaming: false,
                        duration_ms: payload.duration_ms,
                        model: payload.model,
                        usage: payload.usage,
                      }
                    : m
                )
              );
              streamSucceeded = true;
              loadSessions();
              break outer;
            } else if (payload.type === "error") {
              haptic("error");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingId
                    ? {
                        ...m,
                        role: "error" as Role,
                        content: payload.error ?? "Stream error",
                        streaming: false,
                      }
                    : m
                )
              );
              streamSucceeded = true; // error was handled — no fallback needed
              break outer;
            }
          }
        }
      } catch {
        // Stream endpoint unavailable — fall back to blocking /api/chat
        if (streamingId) {
          setMessages((prev) => prev.filter((m) => m.id !== streamingId));
          streamingId = null;
        }
      }

      // ── Fallback: blocking /api/chat ───────────────────────────────────────
      if (!streamSucceeded) {
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg, session_id: sessionId }),
          });
          const data = await res.json();
          if (data.db_warning && !dbWarning) setDbWarning(data.db_warning);

          if (!res.ok) {
            haptic("error");
            setMessages((prev) => [
              ...prev,
              {
                id: uid(),
                role: "error",
                content: data.error ?? `Error ${res.status}`,
                ts: new Date(),
              },
            ]);
          } else {
            haptic("reply");
            setMessages((prev) => [
              ...prev,
              {
                id: uid(),
                role: "assistant",
                content: data.reply,
                ts: new Date(),
                duration_ms: data.duration_ms,
                model: data.model,
                usage: data.usage,
              },
            ]);
            loadSessions();
          }
        } catch (err) {
          haptic("error");
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "error",
              content: err instanceof Error ? err.message : "Network error",
              ts: new Date(),
            },
          ]);
        }
      }

      setLoading(false);
      inputRef.current?.focus();
    },
    [loading, sessionId, haptic, dbWarning, loadSessions]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function newChat() {
    setMessages([]);
    setSessionId(newSessionId());
    setInput("");
    setDrawerOpen(false);
    inputRef.current?.focus();
  }

  async function resumeSession(s: SessionMeta) {
    if (s.id === sessionId) {
      setDrawerOpen(false);
      return;
    }
    setLoadingSession(true);
    setDrawerOpen(false);
    try {
      const res = await fetch(`/api/sessions/${s.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const hydrated: Message[] = (data.messages ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => ({
          id: m.id,
          role: m.role as Role,
          content: m.content,
          ts: new Date(m.created_at),
          duration_ms: m.duration_ms ?? undefined,
          model: m.model ?? undefined,
          usage:
            m.usage_input != null
              ? {
                  input: m.usage_input,
                  output: m.usage_output,
                  total: m.usage_total,
                  cacheRead: m.usage_cache_read ?? undefined,
                }
              : undefined,
        })
      );
      setMessages(hydrated);
      setSessionId(s.id);
    } catch {
      // ignore
    } finally {
      setLoadingSession(false);
    }
  }

  function startRename(s: SessionMeta) {
    setEditingId(s.id);
    setEditTitle(s.title);
  }

  async function commitRename(id: string) {
    const title = editTitle.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setEditingId(null);
    loadSessions();
  }

  async function deleteSessionById(id: string) {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (id === sessionId) {
      newChat();
    }
    loadSessions();
  }

  // Gradient border for the composer
  const composerBorder: React.CSSProperties = composerFocused
    ? {
        background:
          "linear-gradient(var(--glass-bg-elevated), var(--glass-bg-elevated)) padding-box," +
          "linear-gradient(135deg, rgba(59,130,246,0.55), rgba(139,92,246,0.30), rgba(59,130,246,0.20)) border-box",
        border: "1px solid transparent",
        boxShadow: "0 0 0 3px rgba(29,78,216,0.12), 0 4px 20px rgba(0,0,0,0.3)",
      }
    : {
        background:
          "linear-gradient(var(--glass-bg-elevated), var(--glass-bg-elevated)) padding-box," +
          "linear-gradient(135deg, var(--glass-border-bright), var(--glass-border), var(--glass-border-bright)) border-box",
        border: "1px solid transparent",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── History Rail ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col w-72 transition-transform duration-300",
          "md:relative md:translate-x-0 md:z-auto md:shrink-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={glassRail}
      >
        {/* Rail header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--glass-border)" }}
        >
          <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            History
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={newChat}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background:
                  "linear-gradient(rgba(29,78,216,0.18), rgba(29,78,216,0.10)) padding-box," +
                  "linear-gradient(135deg, rgba(96,165,250,0.40), rgba(29,78,216,0.20)) border-box",
                border: "1px solid transparent",
                color: "#93c5fd",
                boxShadow: "0 0 10px var(--glow-blue)",
              }}
            >
              <RiAddLine className="w-3 h-3" />
              New
            </button>
            <button
              onClick={() => setDrawerOpen(false)}
              className="md:hidden p-1.5 rounded-lg transition-all"
              style={{ color: "var(--text-muted)" }}
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 && (
            <p
              className="text-center text-[11px] py-8 px-4"
              style={{ color: "var(--text-muted)" }}
            >
              No past sessions yet.
              <br />
              Start a conversation!
            </p>
          )}
          {sessions.map((s) => {
            const isActive = s.id === sessionId;
            return (
              <div
                key={s.id}
                className={cn(
                  "group mx-2 mb-1 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                  isActive && "ring-1"
                )}
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(rgba(29,78,216,0.14), rgba(29,78,216,0.08)) padding-box," +
                          "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(29,78,216,0.15)) border-box",
                        border: "1px solid transparent",
                        boxShadow: "0 0 12px var(--glow-blue)",
                      }
                    : {
                        background:
                          "linear-gradient(var(--glass-bg), var(--glass-bg)) padding-box," +
                          "linear-gradient(135deg, var(--glass-border-bright), var(--glass-border)) border-box",
                        border: "1px solid transparent",
                      }
                }
                onClick={() => resumeSession(s)}
              >
                {editingId === s.id ? (
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={editInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(s.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-transparent text-[11px] focus:outline-none min-w-0"
                      style={{ color: "var(--text-primary)" }}
                    />
                    <button
                      onClick={() => commitRename(s.id)}
                      className="shrink-0 p-0.5"
                      style={{ color: "#34d399" }}
                    >
                      <RiCheckFill className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-1">
                      <p
                        className="text-xs font-medium leading-snug truncate flex-1"
                        style={{ color: isActive ? "#93c5fd" : "var(--text-primary)" }}
                      >
                        {s.title}
                      </p>
                      {/* Actions — visible on hover or active */}
                      <div
                        className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => startRename(s)}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          title="Rename"
                        >
                          <RiEditLine className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteSessionById(s.id)}
                          className="p-1 rounded hover:bg-red-500/20 transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          title="Delete"
                        >
                          <RiDeleteBinLine className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p
                      className="text-[11px] mt-0.5 truncate opacity-60"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {s.last_message_preview ?? "No messages yet"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {relTime(s.updated_at)}
                      </span>
                      {s.message_count > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{
                            background: "var(--bg-elevated)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {s.message_count} msg{s.message_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 shrink-0 sticky top-0 z-10"
          style={{
            background: "var(--glass-bg-heavy)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)" as React.CSSProperties["backdropFilter"],
            borderBottom: "1px solid var(--glass-border)",
            boxShadow: "0 1px 0 var(--glass-border-bright), 0 4px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* History drawer toggle (mobile) */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 rounded-lg transition-all"
              style={{
                background: "var(--glass-bg-elevated)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)",
              }}
              aria-label="Open history"
            >
              <RiHistoryLine className="w-4 h-4" />
            </button>

            {/* Agent icon */}
            <div
              className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  "linear-gradient(rgba(29,78,216,0.18), rgba(29,78,216,0.10)) padding-box," +
                  "linear-gradient(135deg, rgba(96,165,250,0.40), rgba(29,78,216,0.20)) border-box",
                border: "1px solid transparent",
                boxShadow: "0 0 14px var(--glow-blue)",
              }}
            >
              <RiRobotLine className="w-4 h-4 text-blue-400" />
            </div>

            <div>
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>
                OpenClaw
              </h1>
              <p className="text-[11px] mt-0.5 hidden md:block" style={{ color: "var(--text-muted)" }}>
                Natural language orchestrator · session{" "}
                <span className="font-mono">{sessionId.replace("dashboard-", "")}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {orchAvailable === false && (
              <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                <RiAlertLine className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">OpenClaw unavailable</span>
              </div>
            )}
            {orchAvailable === true && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                <span className="hidden sm:inline">Ready</span>
              </div>
            )}
            <button
              onClick={newChat}
              className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background:
                  "linear-gradient(var(--glass-bg-elevated), var(--glass-bg-elevated)) padding-box," +
                  "linear-gradient(135deg, var(--glass-border-bright), var(--glass-border)) border-box",
                border: "1px solid transparent",
                color: "var(--text-secondary)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}
            >
              <RiAddLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          </div>
        </div>

        {/* DB warning banner */}
        {dbWarning && (
          <div
            className="flex items-center gap-2 px-4 py-2 text-xs shrink-0"
            style={{
              background: "rgba(245,158,11,0.08)",
              borderBottom: "1px solid rgba(245,158,11,0.2)",
              color: "#fbbf24",
            }}
          >
            <RiAlertLine className="w-3.5 h-3.5 shrink-0" />
            <span>Chat history unavailable — messages will not be saved. ({dbWarning})</span>
            <button
              onClick={() => setDbWarning(null)}
              className="ml-auto shrink-0"
              style={{ color: "#fbbf24" }}
            >
              <RiCloseLine className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Messages area ── */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-3">
          {loadingSession && (
            <div className="flex items-center justify-center py-12">
              <RiLoaderLine className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          )}
          {!loadingSession && messages.length === 0 && !loading && (
            <WelcomeScreen onPrompt={(p) => send(p)} available={orchAvailable} />
          )}

          {!loadingSession &&
            messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRetry={
                  msg.role === "error"
                    ? () => {
                        // Find the preceding user message to retry
                        const prevUser = [...messages]
                          .slice(0, i)
                          .reverse()
                          .find((m) => m.role === "user");
                        if (prevUser) {
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                          send(prevUser.content);
                        }
                      }
                    : undefined
                }
              />
            ))}

          {/* Show thinking spinner only while waiting for the first SSE chunk */}
          {loading && !messages.some((m) => m.streaming) && <ThinkingBubble />}
          <div ref={bottomRef} />
        </div>

        {/* ── Input area ── */}
        <div
          className="shrink-0 px-3 md:px-6 pb-4 pt-3"
          style={{
            background: "var(--glass-bg-heavy)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)" as React.CSSProperties["backdropFilter"],
            borderTop: "1px solid var(--glass-border)",
            boxShadow: "0 -1px 0 var(--glass-border-bright), 0 -4px 20px rgba(0,0,0,0.2)",
          }}
        >
          {/* Quick prompts — only shown when chat is empty */}
          {messages.length === 0 && !loadingSession && (
            <div className="flex gap-2 flex-wrap mb-3">
              {QUICK_PROMPTS.slice(0, 4).map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-[11px] transition-all disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(var(--glass-bg), var(--glass-bg)) padding-box," +
                      "linear-gradient(135deg, var(--glass-border-bright), var(--glass-border)) border-box",
                    border: "1px solid transparent",
                    color: "var(--text-secondary)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div
            className={cn(
              "flex items-end gap-3 rounded-2xl px-3 py-2 transition-all duration-200",
              composerFocused && "glass-shimmer"
            )}
            style={composerBorder}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              placeholder="Ask OpenClaw anything… (Enter to send, Shift+Enter for newline)"
              disabled={loading || orchAvailable === false}
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed min-h-[22px]"
              style={{ color: "var(--text-primary)" }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim() || orchAvailable === false}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
              style={
                input.trim() && !loading
                  ? {
                      background: "rgba(29,78,216,0.9)",
                      boxShadow: "0 0 16px var(--glow-blue-bright), 0 2px 4px rgba(0,0,0,0.3)",
                    }
                  : {
                      background: "var(--bg-hover)",
                      boxShadow: "none",
                    }
              }
            >
              {loading ? (
                <RiLoaderLine className="w-4 h-4 animate-spin text-gray-400" />
              ) : (
                <RiSendPlaneLine className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
            GPT-5.1-codex via OpenClaw · Pi 192.168.1.222 · responses take 15–60 s
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function WelcomeScreen({
  onPrompt,
  available,
}: {
  onPrompt: (p: string) => void;
  available: boolean | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 md:py-16 text-center">
      {/* Glowing icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background:
            "linear-gradient(rgba(29,78,216,0.18), rgba(29,78,216,0.08)) padding-box," +
            "linear-gradient(135deg, rgba(96,165,250,0.45), rgba(29,78,216,0.20)) border-box",
          border: "1px solid transparent",
          boxShadow: "0 0 32px var(--glow-blue), 0 0 64px rgba(29,78,216,0.10)",
        }}
      >
        <RiRobotLine className="w-7 h-7 text-blue-400" />
      </div>

      <h2 className="text-[17px] font-semibold mb-1.5 tracking-tight" style={{ color: "var(--text-primary)" }}>
        OpenClaw Agent
      </h2>
      <p className="text-sm max-w-xs mb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Ask in plain English. Queue jobs, check workers, inspect runs, create GitHub repos —
        OpenClaw handles it.
      </p>

      {available === false && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-xs text-amber-400 max-w-sm"
          style={{
            background:
              "linear-gradient(rgba(245,158,11,0.07), rgba(245,158,11,0.04)) padding-box," +
              "linear-gradient(135deg, rgba(245,158,11,0.35), rgba(245,158,11,0.15)) border-box",
            border: "1px solid transparent",
          }}
        >
          <RiAlertLine className="w-4 h-4 shrink-0" />
          OpenClaw binary not found on the Pi. Check that the gateway service is running.
        </div>
      )}

      {/* Quick prompt grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full px-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPrompt(p)}
            disabled={available === false}
            className="text-left px-4 py-3 rounded-xl text-xs transition-all disabled:opacity-40"
            style={{
              background:
                "linear-gradient(var(--glass-bg), var(--glass-bg)) padding-box," +
                "linear-gradient(135deg, var(--glass-border-bright), var(--glass-border)) border-box",
              border: "1px solid transparent",
              color: "var(--text-secondary)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-start gap-2.5 msg-spring-in">
      <AgentAvatar />
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm max-w-[85%]"
        style={glassBubbleAssistant}
      >
        <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
          <RiLoaderLine className="w-3.5 h-3.5 animate-spin" />
          OpenClaw is thinking…
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onRetry,
}: {
  message: Message;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const isStreaming = message.streaming === true;

  function copy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const bubbleStyle: React.CSSProperties = isUser
    ? glassBubbleUser
    : isError
    ? glassBubbleError
    : glassBubbleAssistant;

  return (
    <div className={cn("flex items-start gap-2.5 msg-spring-in", isUser && "flex-row-reverse")}>
      {isUser ? <UserAvatar /> : <AgentAvatar error={isError} streaming={isStreaming} />}

      <div className={cn("flex flex-col gap-1 max-w-[85%] min-w-0", isUser && "items-end")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser ? "rounded-tr-sm" : "rounded-tl-sm"
          )}
          style={{
            ...bubbleStyle,
            color: isUser ? "#dbeafe" : isError ? "#fca5a5" : "var(--text-primary)",
          }}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <>
              <FormattedResponse content={message.content} />
              {isStreaming && (
                <span
                  className="inline-block w-[2px] h-[14px] ml-0.5 rounded-sm bg-blue-400 animate-caret align-middle"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </div>

        <div
          className={cn(
            "flex items-center gap-2 flex-wrap text-[10px]",
            isUser && "flex-row-reverse"
          )}
          style={{ color: "var(--text-muted)" }}
        >
          <span>{message.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {message.duration_ms && !isStreaming && (
            <span className="opacity-60">{(message.duration_ms / 1000).toFixed(1)}s</span>
          )}
          {message.model && !isStreaming && (
            <span
              className="font-mono px-1.5 py-0.5 rounded text-[9px]"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              {message.model}
            </span>
          )}
          {message.usage && !isStreaming && (
            <span>
              {message.usage.input.toLocaleString()} in · {message.usage.output.toLocaleString()} out
              {message.usage.cacheRead
                ? ` · ${message.usage.cacheRead.toLocaleString()} cached`
                : ""}
            </span>
          )}
          {isStreaming && (
            <span className="opacity-60 italic">streaming…</span>
          )}
          {!isUser && !isStreaming && (
            <button onClick={copy} className="hover:opacity-100 transition-opacity" title="Copy">
              {copied ? (
                <RiCheckLine className="w-3 h-3 text-emerald-400" />
              ) : (
                <RiFileCopyLine className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              )}
            </button>
          )}
          {isError && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-all"
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#fca5a5",
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormattedResponse({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.slice(3, -3).split("\n");
          const lang = lines[0].trim();
          const code = (lang && !/\s/.test(lang) ? lines.slice(1) : lines).join("\n").trim();
          return (
            <pre
              key={i}
              className="my-2 p-3 rounded-lg text-[11px] font-mono overflow-x-auto"
              style={{
                background: "rgba(0,0,0,0.45)",
                color: "#86efac",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {code}
            </pre>
          );
        }
        return (
          <span key={i}>
            {part.split("\n").map((line, j, arr) => {
              const formatted = line
                .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
                .map((chunk, k) => {
                  if (chunk.startsWith("**") && chunk.endsWith("**")) {
                    return (
                      <strong key={k} className="font-semibold text-gray-100">
                        {chunk.slice(2, -2)}
                      </strong>
                    );
                  }
                  if (chunk.startsWith("`") && chunk.endsWith("`")) {
                    return (
                      <code
                        key={k}
                        className="font-mono text-[11px] px-1 rounded"
                        style={{ background: "rgba(0,0,0,0.35)", color: "#93c5fd" }}
                      >
                        {chunk.slice(1, -1)}
                      </code>
                    );
                  }
                  return <span key={k}>{chunk}</span>;
                });
              return (
                <span key={j}>
                  {formatted}
                  {j < arr.length - 1 && <br />}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

function AgentAvatar({ error, streaming }: { error?: boolean; streaming?: boolean }) {
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-full shrink-0 flex items-center justify-center",
        streaming && "animate-pulse"
      )}
      style={{
        background: error
          ? "linear-gradient(rgba(239,68,68,0.15), rgba(239,68,68,0.08)) padding-box, linear-gradient(135deg, rgba(239,68,68,0.40), rgba(239,68,68,0.15)) border-box"
          : "linear-gradient(rgba(29,78,216,0.18), rgba(29,78,216,0.08)) padding-box, linear-gradient(135deg, rgba(96,165,250,0.40), rgba(29,78,216,0.15)) border-box",
        border: "1px solid transparent",
        boxShadow: error ? "0 0 8px var(--glow-error)" : "0 0 8px var(--glow-blue)",
      }}
    >
      {error ? (
        <RiAlertLine className="w-3.5 h-3.5 text-red-400" />
      ) : (
        <RiRobotLine className="w-3.5 h-3.5 text-blue-400" />
      )}
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
      style={{
        background:
          "linear-gradient(var(--glass-bg-elevated), var(--glass-bg-elevated)) padding-box," +
          "linear-gradient(135deg, var(--glass-border-bright), var(--glass-border)) border-box",
        border: "1px solid transparent",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }}
    >
      <RiUserLine className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
    </div>
  );
}
