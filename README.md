# Life OS

A personal daily command center: goals, habits, mood/sleep/water/weight/steps, workouts, journal, and a Gemini-powered AI coach (Overseer) that sees the whole picture. Single-page mobile-first PWA, dark, premium, fast.

## Stack

- **Next.js 15** App Router + **React 19** + **TypeScript** (strict)
- **Tailwind v4** with CSS-first theme tokens
- **shadcn-style** primitives (inlined, no CLI dep)
- **Zustand** + persist (one slice, typed selectors)
- **Motion** (formerly framer-motion) for spring animations
- **@dnd-kit** for reorder
- **Recharts** for charts
- **lucide-react** for icons
- **date-fns** for dates
- **@google/genai** for the Gemini API (server-side only)
- PWA: web manifest + Apple touch + simple offline service worker
- **localStorage** for everything — no backend, no auth, no DB

## What's in the box

### Today screen
- Date header with editable **day type** pill (presets + custom)
- Animated **score ring** (weighted: goals 40% / habits 30% / journaled 15% / sleep logged 15%)
- **Daily Pulse** horizontal scroller — Sleep, Mood, Energy, Water, Weight, Steps each with 7-day sparkline + tap-to-log modal
- **Goals** with drag-reorder, P1/P2/P3 priority dot, optional emoji + category + time-estimate, long-press to edit, **confetti** on full completion
- **Habits grid** (3-col, up to 12 tiles) with current streak (🔥 ≥3), last-7-day dot row, tap-to-toggle
- **Workouts** logger — type, duration, intensity, optional exercises with sets/reps/weight, notes
- **Plan Tomorrow** / **Wins** / **Struggles** lists (struggles have a "Ask Overseer" inline button)
- **Evening Reflection** card surfaces after 8pm — 5-step guided flow (mood, energy, what went well, what to improve, tomorrow's top 3 → saved as journal entry + plan items)
- **Morning briefing** card — Gemini generates a 4-line briefing on first open after 5am, cached for the day

### Stats screen
- 30/90-day completion heatmap (GitHub-style)
- Mood + Energy line chart
- Sleep area chart with running average
- Weight chart with 7-day moving average
- Workouts donut by type
- Habit completion-rate bars
- Streak leaderboard
- Range toggle: Week / Month / 90d / Year

### Habits screen
- All habits as cards with 60-day calendar grid (tap any cell to toggle that date)
- Per-habit stats: current streak, longest streak, 60-day rate
- Add habit with 10 starter templates or custom name + 14-icon picker
- Drag to reorder

### Journal screen
- Reverse-chronological feed
- New entry with mini-markdown (`**bold**`, `*italic*`, `- lists`)
- Optional mood/energy/tags per entry
- Search + tag filter + reflection-source pill

### Overseer
- Floating violet button bottom-right, slide-up panel
- Streams `gemini-2.5-flash` token-by-token via Next route handler (`/api/overseer`)
- Full dashboard context (today + 7-day rollup + 3 recent journal snippets) injected as system prompt — coach persona, direct, no fluff
- Empty-state quick prompts
- Struggle items in Today can deep-link into the panel with pre-filled text
- Morning briefing route (`/api/overseer/briefing`) — non-streaming, cached
- Evening summary route (`/api/overseer/summary`) — non-streaming
- **No-key graceful state** — floating button still appears, tapping shows a polite "Add `GEMINI_API_KEY`" panel with a link to AI Studio. The rest of the app works unaffected.

### Onboarding
- Welcome → units (lb/kg, oz/ml) → accent color (violet / emerald / rose / amber) → pick 3 starter habits → Today
- Gated by `settings.hasOnboarded`, redirects automatically

### Settings
- Units · accent · water target · day-type management · JSON export/import · **Clear all** (confirm)

### PWA
- `manifest.webmanifest` via Next's metadata API
- Programmatic gradient icon at `/icon` (192×192) and `/apple-icon` (180×180)
- Service worker in `/public/sw.js` — network-first for HTML, stale-while-revalidate for assets, never caches `/api/*`
- Apple touch + viewport-fit cover + theme-color

## Run locally

```bash
# 1. install Node (skip if you have it) — easiest: brew install node
# 2.
npm install
cp .env.local.example .env.local
# paste your Gemini key into .env.local, then:
npm run dev
```

Open <http://localhost:3000>. On your phone hit the same URL on your LAN.

## Get a Gemini key

Visit **<https://aistudio.google.com/apikey>**, sign in with any Google account, click *Create API key*. Free tier is plenty for personal use (~10 req/min, 250/day on `gemini-2.5-flash`).

## Deploy to Vercel

1. Push to GitHub.
2. **vercel.com/new** → Import your repo → it auto-detects Next.js.
3. Add env var: **`GEMINI_API_KEY`** = your key.
4. Deploy.
5. On iPhone Safari, visit the `*.vercel.app` URL → Share → **Add to Home Screen** for the fullscreen app experience.

## Data layout

All data is keyed under `localStorage["life-os:v2"]`. Use Settings → Export JSON for a portable backup. Import merges into defaults so older exports stay compatible.

```
settings · days · goals · habits · workouts · health · journal · plans · wins · struggles
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run start` — production server
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — Next.js lint

## Notes & known caveats

- The morning briefing and evening summary auto-fetch only after 5am / 8pm local. They cache by date in `settings.morningBriefing` / `settings.eveningSummary` so they don't re-call on every reload.
- The service worker only runs in `NODE_ENV=production`. In dev you get plain Next behavior.
- The dragging UX on goals/habits uses `@dnd-kit` pointer sensor — touch reorder requires touching the explicit grip handle to avoid fighting input focus.
