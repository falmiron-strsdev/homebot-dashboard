"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useHaptics } from "@/lib/useHaptics";

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

// ── Apple system colors ────────────────────────────────────────────────────

const colors = {
  bg: "#000000",
  bgSecondary: "#1C1C1E",
  bgTertiary: "#2C2C2E",
  bgQuaternary: "#3A3A3C",
  separator: "rgba(84,84,88,0.65)",
  separatorOpaque: "#38383A",
  blue: "#007AFF",
  green: "#30D158",
  red: "#FF453A",
  orange: "#FF9F0A",
  labelPrimary: "#FFFFFF",
  labelSecondary: "rgba(235,235,245,0.6)",
  labelTertiary: "rgba(235,235,245,0.3)",
  labelQuaternary: "rgba(235,235,245,0.18)",
};

// ── Main Component ──────────────────────────────────────────────────────────

export default function MobileChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [orchAvailable, setOrchAvailable] = useState<boolean | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { fire: haptic } = useHaptics();

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
            { id: uid(), role: "error", content: data.error ?? `Error ${res.status}`, ts: new Date() },
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
    setSessionId(`mobile-${Date.now()}`);
    setInput("");
    inputRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !loading;
  const canSend = input.trim() && !loading && orchAvailable !== false;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: colors.bg,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ── Navigation Bar ── */}
      <header
        style={{
          flexShrink: 0,
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          background: "rgba(28,28,30,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: `0.5px solid ${colors.separator}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Left: avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: colors.blue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill="white" />
              <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>

          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: colors.labelPrimary,
                lineHeight: 1.2,
                letterSpacing: -0.3,
              }}
            >
              OpenClaw
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              {orchAvailable === true && (
                <>
                  <span
                    className="animate-pulse-dot"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: colors.green,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 11, color: colors.green, fontWeight: 500 }}>Active</span>
                </>
              )}
              {orchAvailable === false && (
                <>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: colors.orange,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 11, color: colors.orange, fontWeight: 500 }}>Offline</span>
                </>
              )}
              {orchAvailable === null && (
                <span style={{ fontSize: 11, color: colors.labelTertiary }}>Connecting…</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: new chat */}
        <button
          onClick={newChat}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: colors.bgTertiary,
            border: "none",
            color: colors.blue,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
          title="New chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {/* ── Messages area ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        {isEmpty && <WelcomeScreen onPrompt={send} available={orchAvailable} />}

        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const showAvatar = !prev || prev.role !== msg.role;
            return <MessageBubble key={msg.id} message={msg} showAvatar={showAvatar} />;
          })}
          {loading && <TypingIndicator />}
        </div>

        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* ── Input area ── */}
      <div
        style={{
          flexShrink: 0,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          paddingTop: 8,
          paddingLeft: 12,
          paddingRight: 12,
          background: "rgba(28,28,30,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: `0.5px solid ${colors.separator}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {/* Text input */}
          <div
            style={{
              flex: 1,
              background: colors.bgSecondary,
              borderRadius: 20,
              border: composerFocused
                ? `1.5px solid ${colors.blue}`
                : `1px solid ${colors.separatorOpaque}`,
              padding: "8px 14px",
              transition: "border-color 0.15s ease",
              minHeight: 38,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              placeholder={orchAvailable === false ? "OpenClaw offline" : "iMessage"}
              disabled={loading || orchAvailable === false}
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: 16,
                lineHeight: 1.4,
                color: colors.labelPrimary,
                minHeight: 22,
                maxHeight: 120,
                fontFamily: "inherit",
                WebkitAppearance: "none",
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={() => send(input)}
            disabled={!canSend}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              background: canSend ? colors.blue : colors.bgTertiary,
              color: canSend ? "white" : colors.labelQuaternary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canSend ? "pointer" : "default",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {loading ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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

// ── Welcome Screen ──────────────────────────────────────────────────────────

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
        padding: "40px 20px 24px",
        textAlign: "center",
      }}
    >
      {/* App icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: `linear-gradient(145deg, #1a7aff, #0055cc)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          boxShadow: "0 4px 24px rgba(0,122,255,0.4)",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" fill="white" />
          <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: colors.labelPrimary,
          marginBottom: 6,
          letterSpacing: -0.5,
        }}
      >
        OpenClaw
      </div>
      <div
        style={{
          fontSize: 14,
          color: colors.labelSecondary,
          lineHeight: 1.5,
          maxWidth: 260,
          marginBottom: 32,
        }}
      >
        Your AI orchestrator. Queue jobs, check workers, inspect runs.
      </div>

      {available === false && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 12,
            background: "rgba(255,159,10,0.12)",
            border: `1px solid rgba(255,159,10,0.3)`,
            color: colors.orange,
            fontSize: 13,
            marginBottom: 24,
            maxWidth: 290,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          OpenClaw unavailable — check Pi gateway
        </div>
      )}

      {/* Quick prompt grid */}
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
              padding: "12px 14px",
              borderRadius: 12,
              background: colors.bgSecondary,
              border: `1px solid ${colors.separatorOpaque}`,
              color: colors.labelPrimary,
              fontSize: 13,
              textAlign: "left",
              cursor: available === false ? "default" : "pointer",
              opacity: available === false ? 0.35 : 1,
              WebkitTapHighlightColor: "transparent",
              lineHeight: 1.35,
              fontFamily: "inherit",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 8,
      }}
      className="msg-spring-in"
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: colors.bgTertiary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" fill={colors.blue} />
          <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={colors.blue} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderRadius: 18,
          borderBottomLeftRadius: 4,
          background: colors.bgSecondary,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span
          className="bounce-dot"
          style={{ width: 7, height: 7, borderRadius: "50%", background: colors.labelTertiary, display: "inline-block" }}
        />
        <span
          className="bounce-dot"
          style={{ width: 7, height: 7, borderRadius: "50%", background: colors.labelTertiary, display: "inline-block", animationDelay: "0.15s" }}
        />
        <span
          className="bounce-dot"
          style={{ width: 7, height: 7, borderRadius: "50%", background: colors.labelTertiary, display: "inline-block", animationDelay: "0.30s" }}
        />
      </div>
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message, showAvatar }: { message: Message; showAvatar: boolean }) {
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

  const bubbleBg = isUser
    ? colors.blue
    : isError
    ? "rgba(255,69,58,0.15)"
    : colors.bgSecondary;

  const bubbleBorder = isError ? `1px solid rgba(255,69,58,0.3)` : "none";
  const textColor = isUser ? "#ffffff" : isError ? colors.red : colors.labelPrimary;

  return (
    <div
      className="msg-spring-in"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 2,
        paddingLeft: isUser ? 0 : 4,
        paddingRight: isUser ? 4 : 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          flexDirection: isUser ? "row-reverse" : "row",
          maxWidth: "82%",
        }}
      >
        {/* Avatar (assistant only, when first in sequence) */}
        {!isUser && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: isError ? "rgba(255,69,58,0.2)" : colors.bgTertiary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              alignSelf: "flex-end",
              opacity: showAvatar ? 1 : 0,
            }}
          >
            {isError ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill={colors.red}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" fill={colors.blue} />
                <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={colors.blue} strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 18,
            ...(isUser ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: showAvatar ? 4 : 18 }),
            background: bubbleBg,
            border: bubbleBorder,
            fontSize: 15,
            lineHeight: 1.45,
            color: textColor,
            wordBreak: "break-word",
          }}
        >
          {isUser ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>
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
          gap: 6,
          marginTop: 3,
          paddingLeft: isUser ? 0 : 34,
          paddingRight: isUser ? 4 : 0,
          flexDirection: isUser ? "row-reverse" : "row",
        }}
      >
        <span style={{ fontSize: 10, color: colors.labelTertiary }}>{time}</span>
        {message.duration_ms && (
          <span style={{ fontSize: 10, color: colors.labelTertiary }}>
            {(message.duration_ms / 1000).toFixed(1)}s
          </span>
        )}
        {!isUser && !isError && (
          <button
            onClick={copy}
            style={{
              background: "none",
              border: "none",
              padding: 2,
              cursor: "pointer",
              color: colors.labelTertiary,
              display: "flex",
              alignItems: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill={colors.green}>
                <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke={colors.green} strokeWidth="2" fill="none" strokeLinecap="round" />
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

// ── Formatted Response ──────────────────────────────────────────────────────

function FormattedResponse({ content, isError }: { content: string; isError?: boolean }) {
  if (isError) return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;

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
                fontFamily: "'SF Mono', ui-monospace, 'Cascadia Code', monospace",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                background: "rgba(0,0,0,0.5)",
                color: "#98e6a8",
                border: `1px solid ${colors.separatorOpaque}`,
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
                    <strong key={k} style={{ fontWeight: 600 }}>
                      {chunk.slice(2, -2)}
                    </strong>
                  );
                }
                if (chunk.startsWith("`") && chunk.endsWith("`")) {
                  return (
                    <code
                      key={k}
                      style={{
                        fontFamily: "'SF Mono', ui-monospace, monospace",
                        fontSize: 13,
                        padding: "1px 5px",
                        borderRadius: 5,
                        background: "rgba(0,0,0,0.35)",
                        color: "#6ac4ff",
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
