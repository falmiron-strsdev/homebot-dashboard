This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
