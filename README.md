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

## Vitality modules

A "best of Vitality" layer built on the v2 Neon/Drizzle/Auth.js/SWR stack.
Reachable from the nav (Mentor + Vitality on desktop top-nav; the sparkle +
activity icons in the mobile top bar).

- **Shared infra**
  - `lib/user-context.ts` — `getUserContext(userId)`: one server-side snapshot
    (recovery, sleep, HRV, workouts, nutrition, hydration, caffeine,
    supplements, weight, goals, memories) + `renderUserContext()` for prompt
    injection. Reused by the Mentor and the energy curve.
  - `components/ui/progress-ring.tsx` — `<ProgressRing>`, the WHOOP-style
    glowing teal ring (reuses the `--mc-peak` token). Used for the energy
    "now" score, supplement taken/total, and hydration bottles.
- **`/mentor`** — streaming AI chat (`api/mentor`) that already knows your data,
  plus "the void": a `memories` table + quick capture injected into context.
- **`/vitality`** — hub page:
  - **Energy forecast** — `lib/energy-curve.ts` `predictEnergyCurve()`: a
    circadian template modulated by recovery/sleep, with decaying caffeine
    bumps. Area chart + ProgressRing "now" marker. **Now learns your real
    peak hours** — see "Intelligence layer" below.
  - **Mood check-ins** (`energy_checkins`) for predicted-vs-actual.
  - **Hydration** — `lib/hydration.ts` `computeHydrationTarget()` with an
    itemized "show your math" breakdown; reuses the existing `water_logs`.
  - **Caffeine tracker** (`caffeine_logs`) — zone bar + thresholds, feeds the
    energy curve.
  - **Supplement stack** (`supplements` / `supplement_logs`) + AI
    "recommended for you" suggestions.
  - **NL day planner** (`plan_blocks`) — Gemini parses plain text into time
    blocks and flags hard work landing in a predicted energy dip.
- **DB**: new tables are in `schema.ts`; apply with `npm run db:push` (or the
  idempotent `src/lib/db/migrations/vitality.sql` via the Neon SQL console).
- Vitality settings (caffeine thresholds/presets, supplement reset hour,
  hydration ratios/modifiers) live under `userSettings.settings.vitality`
  (`lib/vitality.ts`).

## Mind modules

- **`/mind`** — hub linking the three sections below; all feed `getUserContext`.
- **`/mind/ideas`** — a real idea board (`ideas` table): quick-add, status
  (spark/exploring/parked/shipped) + tag filters, inline status cycling, edit,
  delete. The mentor's "idea" quick-capture writes here; existing `kind='idea'`
  memories are swept onto the board lazily on first load (also in `mind.sql`).
- **`/mind/quotes`** — "smartest thing I heard" (`quotes` table): capture text +
  who said it + context, search, edit, delete.
- **`/mind/made`** — "how it's made", one ordinary thing explained, fresh daily
  (`daily_learnings` table, UNIQUE(date)). `lib/daily-learning.ts`
  `getTodaysLearning()` lazily generates + persists today's entry once via
  Gemini (avoiding the last ~60 subjects), with a browsable archive and a
  manual regenerate. An optional `0 5 * * *` cron
  (`/api/cron/daily-learning`) pre-warms today + tomorrow.
- New Mind tables apply via `npm run db:push` or the idempotent
  `src/lib/db/migrations/mind.sql`.

## Intelligence layer

The cross-domain smarts that turn logged data into honest, personal coaching.
**All additive — no schema migrations; reuses existing tables.**

### The Insight Engine (`lib/insight-engine.ts`)

A real **statistics** engine (not an LLM) that mines your own history for
cross-domain links and surfaces only what clears both a sample-size and an
effect-size bar — so a thin, noisy edge stays quiet instead of masquerading as
a finding. Every card shows the real numbers: effect size, `n` per arm, an
honest confidence label, and a two-sided Welch's t-test p-value.

- **Method** — for each curated hypothesis it splits the predictor into a high
  arm and a low arm (top vs bottom tercile for numbers; true/false for
  booleans) and compares the outcome means with **Welch's t-test** (Student-t
  CDF via the regularized incomplete beta) and **Cohen's d**. Nothing surfaces
  below `MIN_ARM` samples per arm, `|d| ≥ 0.3`, and `p ≤ 0.2`.
- **~20 hypotheses across every domain** — sleep→readiness/mood, sleep
  quality→felt energy, late caffeine (past your cutoff hour)→that night's sleep
  score, total/late caffeine→sleep, hydration→energy/mood, supplement
  adherence→energy/readiness, training→sleep/recovery, steps→mood/sleep,
  alcohol/stress/pre-bed screens/late meals→sleep, protein→next-day readiness.
- **Data** — `lib/data/insight-series.ts` aligns every domain into per-date
  tracks over a 90-day window. Caffeine timing is resolved to your **local**
  clock via a tz offset the client passes (the server runs UTC). Sparse
  predictors (caffeine, supplements, protein, water) only count on days you
  actually logged them, keeping the low arm honest.
- **Where it shows** — `GET /api/insights/engine` computes, filters anything
  you've dismissed (shared `dismissed_patterns` fingerprint list), and persists
  the snapshot into the previously-unused `insights` table. The dashboard
  **Insight-engine card** (`components/today/insights-card.tsx`) renders the top
  findings with confidence badges + `n`; the **Mentor** reads the same
  correlations server-side (`user-context.ts`) and is told to cite them rather
  than invent numbers.

### Energy curve that learns your peak hours

The forecast used to be a fixed template that only moved amplitude. Now
`learnHourlyProfile()` buckets your felt-energy check-ins by the local hour they
were logged and `personalizeBase()` blends that profile into the template
**shape-preservingly** (rescaled to the template's level so amplitude still
comes from readiness, then mixed per hour by a confidence weight `n/(n+K)`) — so
the peak *hour* shifts as data accrues. The Vitality **Energy forecast** card
overlays your **actual** check-ins as dots against the predicted line (closing
the predicted-vs-actual loop the `energy_checkins` schema always anticipated)
and labels itself "learned from N check-ins" once personalized.

### Your day at a glance (`components/today/morning-glance.tsx`)

A forward-looking start-the-day strip promoted directly under the readiness
hero, showing what the hero doesn't: your **sharpest window** (from the learned
curve), **hydration pace** (ahead/behind a linear target for the time of day,
with the oz gap), and **supplements due** in the current window. Each tile
self-hides when its data isn't there yet.

### Export your data (`GET /api/data/export`, Settings → "Export your data")

Own your data: a server-side export of every user-scoped table from Neon (not
just the local snapshot the "Backup" card serializes). `?format=json` is the
full archive (~50 content tables); `?format=csv` is a spreadsheet-friendly
daily rollup (one row per date: sleep, readiness, strain, mood, steps, weight,
water, HRV, resting HR, calories, protein). OAuth tokens are **redacted** and
auth/credential tables excluded; on-device photo/audio blobs stay on-device.
