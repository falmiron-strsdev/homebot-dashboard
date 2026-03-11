# HomeBot Dashboard — Design System

Typography, spacing, glass effects, and component guidelines for iOS 18-inspired UI.

---

## Font Stack

The dashboard uses an iOS/macOS-style San Francisco font stack. On Apple devices the
system renders native SF Pro Display and SF Pro Text. On other platforms it falls back
to Helvetica Neue and then Arial.

```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display",
  "SF Pro Text", "SF Compact", "Helvetica Neue", Arial, sans-serif;

--font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Fira Code", monospace;
```

`--font-sans` is the default for all body text, headings, buttons, and labels.
`--font-mono` is reserved for code blocks, IDs, commit hashes, and short identifiers.

### Previewing locally

- **macOS / iOS** — SF Pro renders automatically from the system font; no extra setup.
- **Windows / Linux** — Install [Inter](https://rsms.me/inter/) or
  [Geist](https://vercel.com/font) locally and prepend it to `--font-sans` in
  `app/globals.css` for a close approximation during development.

---

## Type Scale

Defined as CSS custom properties in `app/globals.css` under `:root`.

| Token | Size / Weight / Leading | Usage |
|---|---|---|
| `--text-display` | 700 28px / 1.15 | Hero numbers, big stat values, splash headings |
| `--text-title1` | 600 22px / 1.25 | Page section headers (large sections) |
| `--text-title2` | 600 17px / 1.3 | Card titles, modal headers, panel labels |
| `--text-body` | 400 15px / 1.55 | Primary reading text, descriptions, messages |
| `--text-callout` | 500 14px / 1.45 | Navigation labels, form labels, button text |
| `--text-footnote` | 400 12px / 1.4 | Captions, timestamps, badge text |
| `--text-caption` | 400 11px / 1.35 | Micro labels, keyboard shortcuts, unit suffixes |

### Using the scale in components

Apply via Tailwind utilities that map to these sizes, or use `font:` shorthand directly:

```tsx
// Page header title → title2
<h1 className="text-base font-semibold tracking-tight">Title</h1>

// Stat card label → footnote/caption
<div className="text-xs uppercase tracking-wider font-medium">Label</div>

// Stat card value → display
<div className="text-3xl font-semibold tabular-nums">42</div>

// Body paragraph
<p className="text-sm leading-relaxed">Description…</p>

// Timestamp / muted meta
<span className="text-xs" style={{ color: "var(--text-muted)" }}>2 min ago</span>
```

---

## Colour Tokens

All colours are CSS custom properties set in `app/globals.css`.

### Background

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#080c12` | Page background, outermost layer |
| `--bg-surface` | `#0e1420` | Cards, panels, rows |
| `--bg-elevated` | `#161d2e` | Hover state backgrounds, code blocks |
| `--bg-hover` | `#1c2438` | Interactive hover fill |

### Text

| Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#e2e8f0` | Default text |
| `--text-secondary` | `#8b9cb8` | Subdued labels, secondary info |
| `--text-muted` | `#4a5568` | Timestamps, captions, disabled |

### Borders

| Token | Hex | Usage |
|---|---|---|
| `--border` | `#222b3e` | Card borders, dividers |
| `--border-subtle` | `#1a2235` | Table row dividers |

---

## Glass Tokens

Used for frosted-glass panels (mobile hero, chat bubbles, bottom nav).

```css
--glass-bg:            rgba(14, 20, 32, 0.72)   /* primary glass surface */
--glass-bg-elevated:   rgba(22, 29, 46, 0.78)   /* elevated glass */
--glass-bg-heavy:      rgba(8, 12, 18, 0.88)    /* heavy opacity (bottom nav) */
--glass-border:        rgba(255, 255, 255, 0.07) /* subtle highlight border */
--glass-border-bright: rgba(255, 255, 255, 0.13) /* brighter highlight */
--glass-blur:          blur(24px) saturate(190%) /* full glass blur */
--glass-blur-light:    blur(12px) saturate(160%) /* lighter blur variant */
```

### Applying glass

```tsx
<div style={{
  background: "var(--glass-bg)",
  backdropFilter: "var(--glass-blur-light)",
  WebkitBackdropFilter: "var(--glass-blur-light)",
  border: "1px solid var(--glass-border-bright)",
}}>
  …
</div>
```

### Ambient glow

```css
--glow-blue:        rgba(29, 78, 216, 0.22)   /* subtle blue panel glow */
--glow-blue-bright: rgba(59, 130, 246, 0.38)  /* brighter blue (active state) */
--glow-error:       rgba(239, 68, 68, 0.25)   /* red glow for errors */
```

---

## Spacing Tokens

```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-6: 24px
--space-8: 32px
```

Prefer Tailwind's built-in spacing utilities (`p-4`, `gap-3`, etc.) for most layout
work; these tokens are for edge cases in inline styles.

---

## Radius Tokens

```css
--radius-sm: 8px    /* tags, small badges */
--radius-md: 12px   /* standard buttons, inputs */
--radius-lg: 16px   /* cards, panels */
--radius-xl: 20px   /* hero sections, bottom sheet */
```

In Tailwind: `rounded-lg` (8px) and `rounded-xl` (12px) cover the most common cases.

---

## Shadow / Depth Tokens

```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)
--shadow-md:  0 4px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)
--shadow-lg:  0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)
```

---

## Shared Components

### StatCard (`components/overview/StatCard.tsx`)

Displays a single metric with label, large value, and optional sub-label.

```tsx
<StatCard
  label="Active"        // text-xs uppercase caption
  value={42}            // text-3xl bold number
  sub="of 48 total"     // text-xs muted footnote
  accent="text-emerald-400"  // value colour (Tailwind class)
  onClick={() => router.push("/workers")}
/>
```

### Card / CardTitle (`components/ui/Card.tsx`)

Wrapper for content sections.

```tsx
<Card>
  <CardTitle>Section</CardTitle>
  …
</Card>
<Card noPad> {/* removes default p-4 */}
  <table>…</table>
</Card>
```

### Badge (`components/ui/Badge.tsx`)

Inline status/label badge. Style via `className`.

```tsx
<Badge label="Running" className="bg-blue-500/15 text-blue-300" />
```

### EmptyState / ErrorState (`components/ui/EmptyState.tsx`)

Centred empty and error state placeholders.

```tsx
<EmptyState message="No jobs yet" detail="Jobs will appear here once queued." />
<ErrorState error={errorMessage} />
```

### Header (`components/layout/Header.tsx`)

Page-level title bar with optional refresh and actions slot.

```tsx
<Header
  title="Jobs"
  subtitle="12 total"
  lastUpdated={lastUpdated}
  onRefresh={refresh}
  isRefreshing={isRefreshing}
  actions={<SomeButton />}
/>
```

---

## Responsive Breakpoints

| Breakpoint | Width | Behaviour |
|---|---|---|
| default (mobile) | < 640px (`sm`) | Card lists instead of tables; single-column grids; bottom nav; no sidebar |
| `sm` | ≥ 640px | Desktop tables visible; 4-column stat grids; sidebar |
| `md` | ≥ 768px | Full desktop layout; sidebar always visible |

### Key patterns

**Tables → cards on mobile:**

```tsx
{/* Desktop table */}
<div className="hidden sm:block">
  <table>…</table>
</div>

{/* Mobile card list */}
<div className="block sm:hidden space-y-2">
  {items.map(item => <Card key={item.id}>…</Card>)}
</div>
```

**Responsive stat grid:**

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  <StatCard … />
</div>
```

**Bottom padding for mobile nav:**

```tsx
<div className="flex-1 p-4 md:p-6 overflow-y-auto pb-24 md:pb-6">
  …
</div>
```

---

## Animation Utilities

Defined in `app/globals.css`:

| Class | Effect | Used in |
|---|---|---|
| `.animate-pulse-dot` | Opacity pulse (1.5 s) | Worker/job live status dots |
| `.bounce-dot` | Vertical bounce (1.2 s) | Typing indicator |
| `.message-enter` | Fade + slide up (0.18 s) | Chat messages |
| `.msg-spring-in` | Scale + fade spring (0.28 s) | Glass chat bubbles |
| `.glass-shimmer` | Light-sweep on `::after` | Focused composer |
| `.skeleton` | Gradient shimmer | Loading placeholders |
