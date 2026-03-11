This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Mobile-Friendly Overview Dashboard

The main dashboard (`/`) adapts automatically to phone-sized viewports (≤ 768 px) with a purpose-built mobile layout that matches the glass morphism design language used throughout the app.

### How to test on mobile

1. Run the dev server: `npm run dev`
2. Open DevTools → toggle device toolbar (Ctrl/Cmd + Shift + M in Chrome/Firefox)
3. Set the viewport to any width ≤ 768 px (e.g. iPhone 15 Pro, 393 × 852 px)
4. Navigate to `http://localhost:3000` — the mobile layout activates automatically

Alternatively, open the app on a real phone on the same network (use your machine's local IP, e.g. `http://192.168.1.x:3000`).

### Mobile UX changes

| Feature | Mobile (≤ 768 px) | Desktop (> 768 px) |
|---|---|---|
| **Navigation** | Glass bottom tab bar (Overview, Workers, Jobs, Activity, Chat) | Fixed left sidebar |
| **Hero section** | At-a-glance glass card: system status, active workers, running/queued jobs, quick-action buttons | Not shown |
| **Stat grids** | 2-column responsive grid | 4-column grid |
| **Job/Deployment rows** | Short ID hidden; compact spacing | Full row with short ID |
| **Content padding** | 16 px; extra bottom padding for bottom nav | 24 px |
| **Footer** | Hidden (behind bottom nav) | Visible |

### Bottom navigation

A persistent glass nav bar sits at the bottom of every page on mobile, providing one-tap access to Overview, Workers, Jobs, Activity, and Chat. It respects iOS safe-area insets (`env(safe-area-inset-bottom)`) so it clears the iPhone home indicator.

### Hero / at-a-glance section

When the viewport is ≤ 768 px, a glass hero card appears at the top of the overview page showing:
- System health status (operational / degraded / no workers) with an animated indicator
- Active workers, running jobs, and queued jobs in a 3-column mini-grid
- Quick-action buttons: **Chat**, **Jobs**, **Workers**

The hero is hidden on tablet/desktop since the full stat grid + sidebar already surface the same information.

### Notable considerations

- The sidebar is hidden on mobile (`hidden md:flex`) to reclaim horizontal space.
- All stat grids use `grid-cols-2 md:grid-cols-4` so they stay readable at 360 px.
- The `shortId` column in job rows is hidden on mobile (`hidden sm:block`) to prevent crowding.
- Desktop/tablet layouts are pixel-identical to the previous version — the responsive breakpoints only add mobile behaviour.

---

## Mobile Glass Chat UI

The chat interface (`/chat` and the mobile PWA at `/mobile`) uses a layered **glass morphism** aesthetic inspired by iOS/visionOS 2025–2026 design language.

### Visual design

- **Translucent surfaces** — header, composer, and message bubbles use `backdrop-filter: blur()` with semi-transparent backgrounds, creating depth against the dark base.
- **Gradient borders** — every glass surface uses the CSS `padding-box` / `border-box` background technique to produce subtle luminous borders without extra DOM elements.
- **Ambient glow** — user bubbles emit a soft blue `box-shadow` glow; error bubbles glow red. The agent icon pulses a faint blue halo.
- **Spring entrance animations** — new messages animate in with a scale + fade spring (`msg-spring-in` CSS keyframe) for a physical, responsive feel.
- **Glass-loop shimmer** — the message composer gains a slow left-to-right light-sweep (`::after` pseudo-element) whenever the textarea is focused, mimicking a VisionOS glass highlight.

### Haptic feedback (`lib/useHaptics.ts`)

On compatible devices the UI fires tactile vibration via `navigator.vibrate`:

| Event | Pattern |
|---|---|
| Send tap | `[12 ms]` — single crisp pulse |
| Assistant reply arrives | `[10, 50, 10 ms]` — double pulse |
| Error response | `[30, 60, 30 ms]` — heavy triple |

The hook **feature-detects** `navigator.vibrate` and **no-ops silently** when:
- the API is absent (all iOS Safari, Firefox desktop, most desktop Chromium)
- the page/tab is not currently visible (`document.visibilityState !== "visible"`)

**Browsers / devices that can feel haptics:**

| Platform | Support |
|---|---|
| Android Chrome / Samsung Internet | ✅ Full support via `navigator.vibrate` |
| Chrome on Android WebView / TWA | ✅ Supported |
| iOS Safari (all versions) | ❌ `navigator.vibrate` not implemented |
| Desktop Chrome / Firefox / Safari | ❌ Not implemented |
| Firefox Android | ✅ Supported |

Because haptics degrade gracefully, the UI is fully functional everywhere — the vibrations are an optional enhancement layer.

### Responsive scaling

The glass styling scales from 360 px (mobile) through tablet and desktop widths. The desktop `/chat` page uses the same glass tokens but with slightly more relaxed spacing (`md:` Tailwind breakpoints). The mobile PWA (`/mobile`) applies the most aggressive blur and glow effects suitable for a full-screen, touch-primary context.

## Chat Session History

Chat transcripts are persisted server-side in a SQLite database so that conversations survive page reloads and can be resumed later from the history rail.

### Storage location

```
<project-root>/data/chat-sessions.db
```

The `data/` directory is created automatically on first use. The file is a standard SQLite3 database and can be opened with any SQLite tool.

### Schema

| Table | Columns | Notes |
|---|---|---|
| `sessions` | `id`, `title`, `created_at`, `updated_at`, `last_message_preview` | One row per conversation |
| `messages` | `id`, `session_id`, `role`, `content`, `created_at`, `model`, `duration_ms`, `usage_*` | One row per message; FK cascade-deletes when session is removed |

The database uses WAL journal mode for better concurrent read performance.

### Backup

To back up history, copy `data/chat-sessions.db` while the server is not writing (or use SQLite's online-backup API):

```bash
sqlite3 data/chat-sessions.db ".backup data/chat-sessions.bak.db"
```

For automated backups add a cron job that copies the file to a safe location.

### Purging history

Delete all sessions:

```bash
sqlite3 data/chat-sessions.db "DELETE FROM sessions;"
# messages are removed automatically via ON DELETE CASCADE
```

Or delete a single session by ID:

```bash
sqlite3 data/chat-sessions.db "DELETE FROM sessions WHERE id = 'dashboard-XXXXXXXX';"
```

Alternatively use the **Delete** button in the history rail in the UI, or call `DELETE /api/sessions/<id>`.

### Graceful degradation

If the database cannot be opened (e.g. the `data/` directory is read-only), the UI shows a non-blocking amber warning banner. All chat functionality remains available — messages are simply not persisted.

## Streaming Chat (SSE)

The dashboard chat supports real-time streaming responses via Server-Sent Events. When configured, the chat UI calls `/api/chat/stream` instead of the blocking `/api/chat`, and partial text is rendered as it arrives.

### How it works

```
Browser
  └─ POST /api/chat/stream (message + session_id)
       └─ Next.js route (server-side only)
            └─ Gateway /v1/chat/completions  (stream: true)
                 ↓ SSE chunks
            ←── proxied to browser as text/event-stream
```

The dashboard server holds the Gateway credentials — they are **never** sent to the browser.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `GATEWAY_URL` | `http://192.168.1.222:8000` | Base URL of the OpenAI-compatible Gateway (falls back to `ORCH_URL`) |
| `GATEWAY_TOKEN` | _(empty)_ | Bearer token for Gateway auth (falls back to `ORCH_API_KEY`) |

Set these in a `.env.local` file (never committed) or in your hosting environment:

```bash
# .env.local
GATEWAY_URL=http://192.168.1.222:8000
GATEWAY_TOKEN=your-secret-token
```

### Fallback behaviour

If the streaming endpoint is unreachable or returns an error, the frontend automatically falls back to the blocking `POST /api/chat` route so the UI always works. The health-check `GET /api/chat` is unchanged.

### SSE event format

Each `data:` line sent to the browser is a JSON object with a `type` field:

| Type | Payload | Description |
|---|---|---|
| `chunk` | `{ type, text, firstToken? }` | One token or text delta from the model |
| `done` | `{ type, session_id, duration_ms, model?, usage?, db_warning? }` | Stream finished; includes final metadata |
| `error` | `{ type, error }` | Gateway or parse error; stream closes |

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
