"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type Role = "user" | "assistant" | "error";

interface Message {
  id: string;
  role: Role;
  content: string;
  ts: Date;
  duration_ms?: number;
  model?: string;
}

const QUICK_PROMPTS = [
  "What jobs are running?",
  "Worker status",
  "Last failed job?",
  "How many jobs today?",
  "Queue a test job",
  "Show recent activity",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function MobileChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [orchAvailable, setOrchAvailable] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(`mobile-${Date.now()}`);
  }, []);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setOrchAvailable(d.openclaw_available === true))
      .catch(() => setOrchAvailable(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Expand textarea as user types
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || loading) return;

      const userMsg: Message = { id: uid(), role: "user", content: msg, ts: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, session_id: sessionId }),
        });

        const data = await res.json();

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: "error", content: data.error ?? `Error ${res.status}`, ts: new Date() },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: data.reply,
              ts: new Date(),
              duration_ms: data.duration_ms,
              model: data.model,
            },
          ]);
        }
      } catch (err) {
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
    [loading, sessionId]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function newChat() {
    setMessages([]);
    setSessionId(`mobile-${Date.now()}`);
    setInput("");
    inputRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "var(--bg-base)",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          flexShrink: 0,
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: 12,
          paddingLeft: 20,
          paddingRight: 20,
          background: "rgba(8,12,18,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Bot icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(29,78,216,0.2)",
              border: "1px solid rgba(29,78,216,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="10" rx="3" stroke="#60a5fa" strokeWidth="1.5" />
              <path d="M9 11V8a3 3 0 0 1 6 0v3" stroke="#60a5fa" strokeWidth="1.5" />
              <circle cx="9" cy="16" r="1.5" fill="#60a5fa" />
              <circle cx="15" cy="16" r="1.5" fill="#60a5fa" />
              <path d="M12 4v2" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.2,
              }}
            >
              OpenClaw
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 2,
              }}
            >
              {orchAvailable === true && (
                <>
                  <span
                    className="animate-pulse-dot"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#34d399",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#34d399" }}>Ready</span>
                </>
              )}
              {orchAvailable === false && (
                <>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#f59e0b",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#f59e0b" }}>Offline</span>
                </>
              )}
              {orchAvailable === null && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Connecting…</span>
              )}
            </div>
          </div>
        </div>

        {/* New chat button */}
        <button
          onClick={newChat}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
          title="New chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {/* ── Messages area ── */}
      <div
        ref={messagesRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        {isEmpty && <WelcomeScreen onPrompt={send} available={orchAvailable} />}

        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 12px" }}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {loading && <TypingIndicator />}
        </div>

        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* ── Input area ── */}
      <div
        style={{
          flexShrink: 0,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          paddingTop: 10,
          paddingLeft: 12,
          paddingRight: 12,
          background: "rgba(8,12,18,0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: "8px 8px 8px 16px",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={orchAvailable === false ? "OpenClaw offline" : "Message OpenClaw…"}
            disabled={loading || orchAvailable === false}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: 15,
              lineHeight: 1.45,
              color: "var(--text-primary)",
              minHeight: 24,
              maxHeight: 120,
              fontFamily: "inherit",
              WebkitAppearance: "none",
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim() || orchAvailable === false}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              background:
                input.trim() && !loading && orchAvailable !== false
                  ? "#1d4ed8"
                  : "var(--bg-hover)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: input.trim() && !loading ? "pointer" : "default",
              flexShrink: 0,
              transition: "background 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {loading ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ opacity: 0.5, animation: "spin 1s linear infinite" }}
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function WelcomeScreen({
  onPrompt,
  available,
}: {
  onPrompt: (p: string) => void;
  available: boolean | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 20px 20px",
        textAlign: "center",
      }}
    >
      {/* Large icon */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: "rgba(29,78,216,0.15)",
          border: "1px solid rgba(29,78,216,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="10" rx="3" stroke="#60a5fa" strokeWidth="1.5" />
          <path d="M9 11V8a3 3 0 0 1 6 0v3" stroke="#60a5fa" strokeWidth="1.5" />
          <circle cx="9" cy="16" r="1.5" fill="#60a5fa" />
          <circle cx="15" cy="16" r="1.5" fill="#60a5fa" />
          <path d="M12 4v2" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div
        style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}
      >
        OpenClaw Agent
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.5,
          maxWidth: 280,
          marginBottom: 24,
        }}
      >
        Ask in plain English. Queue jobs, check workers, inspect runs, create repos.
      </div>

      {available === false && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(245,158,11,0.3)",
            background: "rgba(245,158,11,0.06)",
            color: "#f59e0b",
            fontSize: 12,
            marginBottom: 20,
            maxWidth: 280,
            textAlign: "left",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          OpenClaw unavailable — check Pi gateway
        </div>
      )}

      {/* Quick prompt chips */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          width: "100%",
          maxWidth: 340,
        }}
      >
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPrompt(p)}
            disabled={available === false}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 12,
              textAlign: "left",
              cursor: available === false ? "default" : "pointer",
              opacity: available === false ? 0.4 : 1,
              WebkitTapHighlightColor: "transparent",
              lineHeight: 1.3,
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        paddingTop: 4,
        paddingBottom: 4,
        animation: "fadeIn 0.2s ease-out",
      }}
      className="message-enter"
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(29,78,216,0.15)",
          border: "1px solid rgba(29,78,216,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="10" rx="3" stroke="#60a5fa" strokeWidth="1.5" />
          <path d="M9 11V8a3 3 0 0 1 6 0v3" stroke="#60a5fa" strokeWidth="1.5" />
          <circle cx="9" cy="16" r="1.5" fill="#60a5fa" />
          <circle cx="15" cy="16" r="1.5" fill="#60a5fa" />
        </svg>
      </div>
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 18,
          borderBottomLeftRadius: 4,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span className="bounce-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", display: "inline-block" }} />
        <span className="bounce-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", display: "inline-block", animationDelay: "0.15s" }} />
        <span className="bounce-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", display: "inline-block", animationDelay: "0.3s" }} />
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

  const time = message.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="message-enter"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          flexDirection: isUser ? "row-reverse" : "row",
          maxWidth: "85%",
        }}
      >
        {/* Avatar */}
        {!isUser && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              flexShrink: 0,
              background: isError ? "rgba(239,68,68,0.15)" : "rgba(29,78,216,0.15)",
              border: `1px solid ${isError ? "rgba(239,68,68,0.3)" : "rgba(29,78,216,0.3)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "flex-end",
            }}
          >
            {isError ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#f87171">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="10" rx="3" stroke="#60a5fa" strokeWidth="1.5" />
                <path d="M9 11V8a3 3 0 0 1 6 0v3" stroke="#60a5fa" strokeWidth="1.5" />
                <circle cx="9" cy="16" r="1.5" fill="#60a5fa" />
                <circle cx="15" cy="16" r="1.5" fill="#60a5fa" />
              </svg>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 18,
            ...(isUser
              ? { borderBottomRightRadius: 4, background: "#1d4ed8", color: "#dbeafe" }
              : isError
              ? {
                  borderBottomLeftRadius: 4,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#fca5a5",
                }
              : {
                  borderBottomLeftRadius: 4,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }),
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          {isUser ? (
            <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message.content}</span>
          ) : (
            <FormattedResponse content={message.content} isError={isError} />
          )}
        </div>
      </div>

      {/* Meta row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
          paddingLeft: isUser ? 0 : 36,
          paddingRight: isUser ? 0 : 0,
          flexDirection: isUser ? "row-reverse" : "row",
        }}
      >
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{time}</span>
        {message.duration_ms && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.6 }}>
            {(message.duration_ms / 1000).toFixed(1)}s
          </span>
        )}
        {!isUser && !isError && (
          <button
            onClick={copy}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#34d399">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="#34d399" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function FormattedResponse({ content, isError }: { content: string; isError?: boolean }) {
  if (isError) return <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</span>;

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
              style={{
                margin: "8px 0",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                background: "rgba(0,0,0,0.4)",
                color: "#86efac",
                border: "1px solid var(--border-subtle)",
                whiteSpace: "pre",
              }}
            >
              {code}
            </pre>
          );
        }
        return (
          <span key={i} style={{ wordBreak: "break-word" }}>
            {part.split("\n").map((line, j, arr) => {
              const formatted = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, k) => {
                if (chunk.startsWith("**") && chunk.endsWith("**")) {
                  return (
                    <strong key={k} style={{ fontWeight: 600, color: "#e2e8f0" }}>
                      {chunk.slice(2, -2)}
                    </strong>
                  );
                }
                if (chunk.startsWith("`") && chunk.endsWith("`")) {
                  return (
                    <code
                      key={k}
                      style={{
                        fontFamily: "ui-monospace, 'SF Mono', monospace",
                        fontSize: 12,
                        padding: "1px 5px",
                        borderRadius: 5,
                        background: "rgba(0,0,0,0.35)",
                        color: "#93c5fd",
                      }}
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
