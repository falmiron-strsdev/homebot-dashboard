/**
 * Server-side SQLite store for chat sessions and messages.
 * Database location: <project-root>/data/chat-sessions.db
 *
 * This module is server-only (uses Node.js APIs). Never import it in
 * client components.
 */

import path from "path";
import fs from "fs";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_preview: string | null;
  message_count?: number;
}

export interface StoredMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "error";
  content: string;
  created_at: string;
  model: string | null;
  duration_ms: number | null;
  usage_input: number | null;
  usage_output: number | null;
  usage_total: number | null;
  usage_cache_read: number | null;
}

// ── Singleton DB setup ────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "chat-sessions.db");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _dbError: string | null = null;

function getDb() {
  if (_db) return _db;
  if (_dbError) throw new Error(_dbError);

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    // Dynamic require so this file can be imported without crashing in
    // environments that don't have better-sqlite3 compiled (e.g. edge runtime).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");

    _db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_message_preview TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'error')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        model TEXT,
        duration_ms INTEGER,
        usage_input INTEGER,
        usage_output INTEGER,
        usage_total INTEGER,
        usage_cache_read INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_id
        ON messages(session_id);
    `);

    return _db;
  } catch (err) {
    _dbError = String(err);
    throw err;
  }
}

// ── Helper to safely get DB (returns null on failure) ─────────────────────────

function tryGetDb() {
  try {
    return { db: getDb(), error: null };
  } catch (err) {
    return { db: null, error: String(err) };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns null if the DB cannot be opened (caller should degrade gracefully). */
export function dbStatus(): { ok: boolean; error?: string } {
  const { error } = tryGetDb();
  return error ? { ok: false, error } : { ok: true };
}

/** Ensure a session row exists, creating it if needed. */
export function ensureSession(id: string): void {
  const { db } = tryGetDb();
  if (!db) return;
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id) VALUES (?)`
  ).run(id);
}

/** Set the session title (first user message becomes the title if unset). */
export function setSessionTitle(id: string, title: string): void {
  const { db } = tryGetDb();
  if (!db) return;
  db.prepare(
    `UPDATE sessions SET title = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(title.slice(0, 200), id);
}

/** Append a message to a session. Creates the session row if missing. */
export function appendMessage(
  sessionId: string,
  msg: {
    id: string;
    role: "user" | "assistant" | "error";
    content: string;
    model?: string | null;
    duration_ms?: number | null;
    usage?: { input: number; output: number; total: number; cacheRead?: number } | null;
  }
): void {
  const { db } = tryGetDb();
  if (!db) return;

  ensureSession(sessionId);

  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, model, duration_ms,
       usage_input, usage_output, usage_total, usage_cache_read)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    msg.id,
    sessionId,
    msg.role,
    msg.content,
    msg.model ?? null,
    msg.duration_ms ?? null,
    msg.usage?.input ?? null,
    msg.usage?.output ?? null,
    msg.usage?.total ?? null,
    msg.usage?.cacheRead ?? null
  );

  // Update session metadata
  const preview = msg.content.slice(0, 120).replace(/\n/g, " ");
  db.prepare(
    `UPDATE sessions
     SET last_message_preview = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).run(preview, sessionId);

  // Auto-set title from first user message
  if (msg.role === "user") {
    const session = db
      .prepare(`SELECT title FROM sessions WHERE id = ?`)
      .get(sessionId) as { title: string } | undefined;
    if (session?.title === "New Chat") {
      setSessionTitle(sessionId, msg.content.slice(0, 120));
    }
  }
}

/** List sessions ordered by most-recently-updated. */
export function listSessions(): Session[] {
  const { db } = tryGetDb();
  if (!db) return [];
  return db
    .prepare(
      `SELECT s.id, s.title, s.created_at, s.updated_at, s.last_message_preview,
              COUNT(m.id) AS message_count
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       GROUP BY s.id
       ORDER BY s.updated_at DESC`
    )
    .all() as Session[];
}

/** Get a single session's messages (full transcript). */
export function getSessionMessages(sessionId: string): StoredMessage[] {
  const { db } = tryGetDb();
  if (!db) return [];
  return db
    .prepare(
      `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`
    )
    .all(sessionId) as StoredMessage[];
}

/** Get a single session by id. */
export function getSession(sessionId: string): Session | null {
  const { db } = tryGetDb();
  if (!db) return null;
  return (
    (db
      .prepare(
        `SELECT s.id, s.title, s.created_at, s.updated_at, s.last_message_preview,
                COUNT(m.id) AS message_count
         FROM sessions s
         LEFT JOIN messages m ON m.session_id = s.id
         WHERE s.id = ?
         GROUP BY s.id`
      )
      .get(sessionId) as Session | undefined) ?? null
  );
}

/** Rename a session. Returns false if session not found. */
export function renameSession(sessionId: string, title: string): boolean {
  const { db } = tryGetDb();
  if (!db) return false;
  const result = db
    .prepare(
      `UPDATE sessions
       SET title = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    )
    .run(title.slice(0, 200), sessionId) as { changes: number };
  return result.changes > 0;
}

/** Delete a session and all its messages (CASCADE handles messages). */
export function deleteSession(sessionId: string): boolean {
  const { db } = tryGetDb();
  if (!db) return false;
  const result = db
    .prepare(`DELETE FROM sessions WHERE id = ?`)
    .run(sessionId) as { changes: number };
  return result.changes > 0;
}
