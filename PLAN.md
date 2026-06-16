# Vitality — plan

Adding the best of "Vitality" to Life-OS v2 (Next.js App Router + Neon +
Drizzle + Auth.js v5 + SWR). Everything below reuses the existing
infrastructure: `withUser`/`withUserRequest` (`lib/api-helpers.ts`),
`requireUser` (`lib/auth-server.ts`), the Drizzle client (`lib/db`), the
SWR-hook + `/api/data/*` REST pattern (canonical example: `behaviors`),
the Gemini client (`resolveGeminiApiKey` + `@google/genai` +
`withGeminiRetry`, exactly as `api/overseer/route.ts` uses it), and the
existing design tokens in `globals.css`.

## Naming collisions resolved (reuse, don't reinvent)

- **`water_logs`** already exists as a daily-singleton (`userId,date,oz`)
  with `getWater`/`addWater` in `lib/data/metrics.ts`. Phase 5 reuses it
  rather than adding a parallel per-entry ml table.
- **`mood_logs`** already exists (daily 1–10 mood). Phase 2's felt-state
  check-ins go to a new **`energy_checkins`** table so the existing mood
  metric is untouched.
- **`behaviors.caffeineMg`** is a daily aggregate. Phase 3's per-drink
  log is a new **`caffeine_logs`** table (the source of truth for the
  tracker + the energy curve's caffeine bumps). Peak State's gather layer
  doesn't read caffeine, so there's no double-count.

## Shared infrastructure

- **`getUserContext(userId)`** — `src/lib/user-context.ts`. One server-side
  function returning a typed `UserContext`: profile/goals (from
  `userSettings` + today's `goals`), last night sleep + HRV + recovery
  (reusing `readSleepRange`/`readHrvRange` + `gatherPeakStateInputs` +
  `computePeakState`), today's + last-7-days workouts (`listWorkouts`),
  today's macros + water + caffeine + supplements (`listMealsForDate`,
  `getWater`, new `listCaffeineForDate`, new supplement reads), recent
  body-weight trend (`readWeightRange`/`listBodyMeasurements`), and recent
  memories. Plus a `renderUserContext(ctx)` → string for prompt injection,
  mirroring `buildContextBlock`. Consumed by Phases 1 and 2.
- **`<ProgressRing>`** — `src/components/ui/progress-ring.tsx`. WHOOP-style
  glowing SVG ring built like the existing `score-ring.tsx`: large center
  value, sub-label, animated arc (`.ring-anim`), soft teal glow. Props
  `value`/`max`, `label`, `sublabel`, `color`, `size`. Teal accent already
  exists as `--mc-peak` (#5EEAD4) + `--mc-peak-soft` — no new token needed.

## Phase 1 — Mentor (`/mentor`)

- `src/app/mentor/page.tsx` chat UI + `src/components/mentor/*`. Streaming
  via new `src/app/api/mentor/route.ts` that builds `getUserContext`,
  injects it into a system prompt (new `MENTOR_SYSTEM` in `lib/prompts.ts`),
  and streams Gemini exactly like the overseer route.
- **Memory ("the void")**: new `memories` table (id, userId, content,
  kind enum[idea|reminder|goal|note], tags text[], createdAt). Data module
  `lib/data/memories.ts`, REST `api/data/memories` (+ `[id]` DELETE), SWR
  hook `use-memories.ts` — all copied from the behaviors quad. Recent
  memories injected into context (recency-ordered, capped). Quick-capture
  input + Memory panel with delete on the page.
- Optional `mentor_messages` table for thread persistence across reloads.
- Live stats ticker (sleep %, strain/load, workouts 7d, weight, goal) +
  4 quick-prompt buttons + context-confirmation line, all from
  `getUserContext` rendered server-side into the page.

## Phase 2 — Energy curve + planner (`/vitality`)

A new `/vitality` hub page holds Phases 2–5 as stacked cards.

- **`predictEnergyCurve(userId, date)`** — `src/lib/energy-curve.ts`,
  returns 24 hourly scores 0–100 from a transparent circadian template,
  modulated by last-night sleep/HRV/recovery (reusing `gatherPeakStateInputs`
  + `computePeakState`), with decaying caffeine bumps from Phase 3's
  `caffeine_logs`. Pure, commented heuristic; no ML. Served via
  `api/vitality/energy-curve`.
- UI: Recharts `AreaChart` (teal fill + glowing line), a "now" marker
  reusing `<ProgressRing>`, hover tooltips, 3-hour x-ticks.
- Mood check-in row (Foggy·Tired·Steady·Sharp·Peak) → new `energy_checkins`
  table (quad).
- Planner: NL input parsed via Gemini (`api/vitality/plan-parse`) into
  `{task,start,end,difficulty}` → new `plan_blocks` table (quad). Timeline
  render flags "hard" blocks landing in predicted troughs.

## Phase 3 — Caffeine tracker (`/vitality`)

- `caffeine_logs` table (quad). Daily total resets at 6 AM; cutoff default
  12 PM. Thresholds (sweet 250 / caution 300 / ceiling 400 mg), cutoff, and
  quick-log presets stored in `userSettings.settings.vitality.caffeine`.
- Zone bar + contextual banner, quick-log preset buttons (seeded common
  drinks), custom mg + label, timestamped list w/ delete. Feeds the curve.

## Phase 4 — Supplement stack (`/vitality`)

- `supplements` (id, userId, name, dose, window enum[morning|anytime|evening],
  note, order) + `supplement_logs` (id, userId, supplementId, date, takenAt);
  reset hour in `userSettings.settings.vitality.supplements.resetHour`.
- UI grouped by window, taken/total `<ProgressRing>`, check-off, add/remove,
  reorder. "Recommended for you" calls Gemini with `getUserContext`
  (`api/vitality/supplement-suggest`) — labeled suggestions, not medical
  advice.

## Phase 5 — Hydration (`/vitality`)

- Reuses existing `water_logs` (oz). **`computeHydrationTarget(userId)`** —
  `src/lib/hydration.ts` returns target + itemized breakdown: base
  (bodyweight kg × ml/kg), exercise add-on (weekly training volume),
  caffeine add-on (today's mg), user modifiers — each line with its
  contribution, summed to a bottle count. Weight from latest `weight_logs`/
  `body_measurements`; modifiers + ml/kg + bottle size in
  `userSettings.settings.vitality.hydration`.
- UI: `<ProgressRing>` "X of N bottles", pace message, +bottle / − buttons,
  expandable "why this target?" table.

## Final — polish

- `/mentor` + `/vitality` added to desktop `top-nav.tsx` and mobile
  `mobile-top-bar.tsx` (Journal/Body pattern). Clean typecheck/lint/build.
  README note on the new modules.

## Per-phase discipline

After every phase: `npm run typecheck && npm run lint && npm run build`,
fix regressions, `npm run db:push` when the schema changed, then
`git add -A && git commit && git push` (plain messages, no Co-Authored-By
trailer — it breaks the Hobby-plan build). One commit per phase.
