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

// ── Gradient border helper (padding-box / border-box technique) ────────────

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

// ── Main component ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [orchAvailable, setOrchAvailable] = useState<boolean | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || loading) return;

      const userMsg: Message = { id: uid(), role: "user", content: msg, ts: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      haptic("send");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, session_id: sessionId }),
        });

        const data = await res.json();

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
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [loading, sessionId, haptic]
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
    inputRef.current?.focus();
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
    <div className="flex flex-col h-screen">
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
            <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              OpenClaw
            </h1>
            <p className="text-[10px] mt-0.5 hidden md:block" style={{ color: "var(--text-muted)" }}>
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

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-3">
        {messages.length === 0 && !loading && (
          <WelcomeScreen onPrompt={(p) => send(p)} available={orchAvailable} />
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {loading && <ThinkingBubble />}
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
        {messages.length === 0 && (
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
            className="flex-1 bg-transparent text-xs resize-none focus:outline-none leading-relaxed min-h-[22px]"
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

      <h2 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
        OpenClaw Agent
      </h2>
      <p className="text-xs max-w-xs mb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
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
        className="px-4 py-3 rounded-2xl rounded-tl-sm text-xs max-w-[85%]"
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

function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isError = message.role === "error";

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
      {isUser ? <UserAvatar /> : <AgentAvatar error={isError} />}

      <div className={cn("flex flex-col gap-1 max-w-[85%] min-w-0", isUser && "items-end")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-xs leading-relaxed",
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
            <FormattedResponse content={message.content} />
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
          {message.duration_ms && (
            <span className="opacity-60">{(message.duration_ms / 1000).toFixed(1)}s</span>
          )}
          {message.model && (
            <span
              className="font-mono px-1.5 py-0.5 rounded text-[9px]"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              {message.model}
            </span>
          )}
          {message.usage && (
            <span>
              {message.usage.input.toLocaleString()} in · {message.usage.output.toLocaleString()} out
              {message.usage.cacheRead
                ? ` · ${message.usage.cacheRead.toLocaleString()} cached`
                : ""}
            </span>
          )}
          {!isUser && (
            <button onClick={copy} className="hover:opacity-100 transition-opacity" title="Copy">
              {copied ? (
                <RiCheckLine className="w-3 h-3 text-emerald-400" />
              ) : (
                <RiFileCopyLine className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              )}
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

function AgentAvatar({ error }: { error?: boolean }) {
  return (
    <div
      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
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
