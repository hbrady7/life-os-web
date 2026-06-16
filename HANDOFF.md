# Life OS — handoff for next session

> Snapshot taken 2026-05-20. Read this whole file before doing anything else, then ask the user what's next.

---

## TL;DR for the agent picking this up

- **Repo is clean.** `git status` empty, all changes pushed. Latest commit: `ff63005 fix: let vercel cron bypass auth middleware`.
- **Build is green.** Last `npm run build` + `npm run typecheck` passed.
- **Production (Vercel) deployed and verified.** All routes responding correctly; auth gate works; cron route returns the expected `503 cron_secret_unset` because the user hasn't set the secret yet.
- **The previous session was interrupted mid-task.** I was about to generate VAPID keys + a CRON_SECRET and write them to `.env.local`. The user typed "create a comprehensive handoff script…" before I finished. See **Pending immediate work** below.

---

## Persistent user rules (these beat any default behavior)

1. **Git author email is `hollisbrady2004@gmail.com`** for every commit. Set via `git -c user.email=hollisbrady2004@gmail.com commit …`. **Never** the system default.
2. **No `Co-Authored-By` trailer** in commits.
3. **Free stack only.** No new paid services, no new paid deps. Existing free stack: Neon (scale-to-zero), SWR, Drizzle, IndexedDB, Gemini (free tier), Vercel Hobby (1 daily cron max), Open Food Facts (free, no key), @zxing/library (MIT). Don't propose anything else without permission.
4. **Mobile-first, 375px viewport, 44px tap targets, 16px input fonts, safe-area-insets, 100dvh.**
5. **Work in parallel** whenever calls don't depend on each other — batch reads/greps/edits into a single message.
6. **No Co-Authored-By, no `--no-verify`, no destructive git ops** (no `--force`, no `reset --hard` to main, no amends unless explicitly requested).
7. **Match existing patterns before inventing new ones.** Grep the codebase first.
8. **Use SSH for git pushes** (`git@github.com:hbrady7/life-os.git`). The user's key `~/.ssh/id_ed25519` is already authorized.
9. **Don't create docs files unless asked.** This handoff is the one explicit exception.

Full code style + persistent rules live in `/Users/hollisbrady/life-os/CLAUDE.md` — read it once on start.

---

## What just shipped (in this session, newest first)

| Commit | What it does |
|---|---|
| `ff63005` | Whitelisted `/api/cron/*` in `src/middleware.ts` so Vercel's cron pings aren't 307'd to /signin. The route handler still enforces CRON_SECRET bearer auth, so this isn't an auth bypass. |
| `0b7de8c` | **Stage 6 — Barcode scanning.** `src/lib/barcode-scanner.ts` (native `BarcodeDetector` → @zxing/library fallback), `src/lib/open-food-facts.ts` (free OFF lookup), `src/components/today/barcode-scan-modal.tsx` (full-screen camera UI + review screen). "Scan" button in Today nutrition card. Graceful fallbacks for not-found / camera-denied. |
| `f342777` | **Stage 5 — Progressive overload coach.** `src/lib/gym-coach.ts` (PR detection, suggestion engine, prefill template). `GymSettings` in `src/lib/types.ts` + store actions `setGymSettings` / `setGymExerciseSettings`. Chart cards now show PR trophy, suggestion line, e1RM PR, per-exercise gear → override modal. PR pill on each exercise in expanded session view. "Use last session" button in new-session modal. |
| `39a836d` | **Stage 3 — Overseer memory layer.** `src/lib/data/user-facts.ts`, `/api/user-facts` (GET, POST), `/api/user-facts/[key]` (PATCH, DELETE), `/api/user-facts/extract` (Gemini structured-output extractor with substring dedup). Overseer route reads facts and injects them into the system prompt as a WHAT YOU REMEMBER ABOUT THIS USER block. Client fires the extractor fire-and-forget after each turn. Settings → MemoryCard for list/edit/delete. |
| `9792699` | SW cache version v1 → v2. `/signin` + `/api/auth/*` bypass the SW so they can't go stale. (Desktop users were stuck on old cached sign-in JS.) |
| `7ecb35d` | Replaced the JS-driven `form.submit()` sign-in flow with a real `<form method="POST" action="/api/auth/signin/github">` — top-level navigation that can't get stuck on iOS PWA. |
| `078b41d` | DB client falls back from `DATABASE_URL` → `DATABASE_URL_UNPOOLED`. `checkAuthConfig()` accepts either as valid. (User had only the unpooled URL on Vercel.) |
| `273bf7a` | **Body revamp Commit 5 — Push notifications.** `push_subscriptions` table, web-push library, `/api/push/{vapid-public-key,subscribe,unsubscribe,prefs}`, `/api/cron/reminders` (gated by CRON_SECRET), SW push + notificationclick handlers, Settings RemindersCard with iOS standalone caveat, `vercel.json` daily cron at `0 8 * * *` (Hobby tier max). |

Stages that were already built and required no work this session: Stage 1 (weekly review), Stage 2 (pattern detection), Stage 4 (day navigation). See "What was already built" below.

---

## Pending immediate work (resume here)

The user said "do everything you haven't yet" then interrupted me while I was generating secrets. I'd already generated valid values; they were printed to my terminal but **not yet written to `.env.local`** and **never set on Vercel**. Re-generate them when the user is ready. The flow:

```bash
# 1. Generate VAPID keys (free, fast, no auth)
npx --yes web-push generate-vapid-keys --json

# 2. Generate a cron secret
openssl rand -base64 32

# 3. Append to .env.local (NOT committed — already in .gitignore)
#    VAPID_PUBLIC_KEY=<publicKey from step 1>
#    VAPID_PRIVATE_KEY=<privateKey from step 1>
#    VAPID_SUBJECT=mailto:hollisbrady2004@gmail.com
#    CRON_SECRET=<secret from step 2>
```

Then the user has to paste **the same four values** into Vercel:
- Project Settings → Environment Variables
- Each value needs the **Production** box checked
- After saving, click **Redeploy** on the latest deployment (env-var changes don't auto-rebuild)

After Vercel redeploys, the Settings → **Reminders** card will appear in the app, the cron will start firing daily at 08:00 UTC, and `/api/cron/reminders` should return `200 {ok:true, sent: N, ...}` when hit with the bearer token.

**Verify the cron** once secrets are set:
```bash
SECRET="<value of CRON_SECRET>"
curl -H "Authorization: Bearer $SECRET" https://life-os-two-rust.vercel.app/api/cron/reminders
# expect 200 with JSON body
```

**Until the env vars are set**, every push-notification entry point degrades cleanly:
- `/api/push/vapid-public-key` returns 404
- Settings RemindersCard hides itself (state `server_disabled`)
- `/api/cron/reminders` returns `503 cron_secret_unset`

So you can leave this pending without anything breaking.

---

## Production deployment state (verified this session)

```
HOST   life-os-two-rust.vercel.app
COMMIT ff63005 (cron middleware fix)

GET /signin                            → 200, contains <form method="POST" action="/api/auth/signin/github">
GET /api/auth/csrf                     → 200 with token
GET /api/auth/providers                → 200 lists GitHub
POST /api/auth/signin/github           → 302 to GitHub authorize (216ms)
GET /api/user-facts                    → 307 /signin (auth-gated, correct)
GET /api/push/vapid-public-key         → 404 (VAPID unset — expected)
GET /api/cron/reminders                → 503 cron_secret_unset (CRON_SECRET unset — expected)
GET https://world.openfoodfacts.org/api/v0/product/3017620422003.json
                                       → 200, Nutella, 539 kcal/100g
```

Vercel env vars currently present (from the live diagnostic at /signin/error):
- `AUTH_SECRET`
- `DATABASE_URL_UNPOOLED` (no `DATABASE_URL` set — db client falls back to this)
- `GITHUB_ID`, `GITHUB_SECRET`
- `NEXTAUTH_SECRET`
- (likely) `GEMINI_API_KEY`, `GOOGLE_HEALTH_*`

Missing on Vercel: `VAPID_*`, `CRON_SECRET`. See **Pending immediate work** above.

---

## Stack + architecture pointers

Read `/Users/hollisbrady/life-os/CLAUDE.md` for the full design system, token tables, conventions, and persistent rules.

### Tech stack (free tier everywhere)

- **Next.js 15 App Router** + **React 19** + **TypeScript strict**
- **Tailwind v4 CSS-first** (no `tailwind.config.js`; tokens live in `src/app/globals.css` under `@theme`)
- **Neon Postgres** + **Drizzle ORM** + **drizzle-kit** for migrations. `DATABASE_URL_UNPOOLED` for DDL, pooled URL preferred at runtime but unpooled works too.
- **Auth.js v5** (`next-auth@5.0.0-beta.25`) with GitHub provider + `@auth/drizzle-adapter`. **JWT** session strategy — middleware never touches the DB.
- **SWR** for client data; **Zustand 5** for UI/transient state (persisted to localStorage under `life-os:v2`)
- **Motion 12**, **@dnd-kit**, **Recharts 3**, **lucide-react**, **date-fns 4**
- **@google/genai** (Gemini 2.5 Flash) — **server-side only** under `src/app/api/`
- **idb** for IndexedDB blob stores (audio, photos, meal photos). Blobs never go to Neon.
- **web-push** + **@zxing/library** (this session)
- **Vercel Hobby**: 1 daily cron max, 10s function timeout default

### Key file pointers

- Drizzle schema: `src/lib/db/schema.ts`. Tables added recently: `bodyPhotoSessions`, `pushSubscriptions`. Existing memory table `userFacts` is now wired up (Stage 3).
- Auth: `src/auth.ts` (config + `checkAuthConfig()` diagnostic), `src/middleware.ts` (gate), `src/lib/auth-server.ts` (server helpers), `src/app/signin/page.tsx`, `src/app/signin/error/page.tsx` (custom NextAuth error page).
- Data layer: `src/lib/data/*.ts` (one file per domain — habits, goals, meals, body, push-subscriptions, user-facts, etc.)
- API helpers: `src/lib/api-helpers.ts` — `withUser()` and `withUserRequest()`. Every `/api/data/*` route must use one of these.
- Overseer: `src/app/api/overseer/route.ts` (streaming), `src/components/overseer/overseer.tsx`, `src/lib/prompts.ts` (PERSONA_SYSTEM + buildContextBlock).
- Gym coach: `src/lib/gym-coach.ts`, `src/app/gym/page.tsx`.
- Barcode: `src/lib/barcode-scanner.ts`, `src/lib/open-food-facts.ts`, `src/components/today/barcode-scan-modal.tsx`.
- Push: `src/lib/web-push.ts` (server), `src/lib/push-client.ts` (client), `src/app/api/push/*`, `src/app/api/cron/reminders/route.ts`, `vercel.json`.
- Service worker: `public/sw.js` (cache `life-os-v2`; `/signin` + `/api/auth/*` bypass the SW so they're never stale).

### Conventions to follow

- All API routes under `/api/data/*` go through `withUser` / `withUserRequest`. No queries that don't filter by `userId`.
- Drizzle migrations: edit schema → `npm run db:generate` → `npm run db:push` (uses `DATABASE_URL_UNPOOLED`).
- Persisted store changes need updates in **both** `partialize` and `merge` paths in `src/store/index.ts`. Older exports break otherwise.
- Selectors return **stable references** — if a derived view needs `.map`/`.filter`/`.sort`, do it in a `React.useMemo` inside the component, not in the selector.
- Never inline hex colors. Use `var(--color-*)`, `metricColors(m)`, or `metricHex(m)` (Recharts only — SVG can't resolve `var()`).
- Use the existing `<Button>`, `<Card>`, `<Modal>`, `<Input>` primitives. Don't rebuild inline.

---

## What was already built (don't re-implement these)

Before this session even started, the codebase already had:

- **Stage 1 — Weekly review automation**: `src/components/today/weekly-review-card.tsx`, `/api/weekly-review/route.ts`, `weeklyReviews` table, Sunday-7pm-local trigger via `settings.weeklyReview.{triggerDay,triggerHour}`, save-to-Journal as `weekly-review`-tagged entry, regenerate + dismiss buttons.
- **Stage 2 — Daily pattern detection**: `src/components/today/pattern-card.tsx`, `/api/patterns/route.ts`, `insights` + `dismissed_patterns` tables, 14-day-minimum gate, daily caching, "Tell me more" opens Overseer with the pattern as prefill.
- **Stage 4 — Day navigation**: `src/components/today/day-context.tsx` + `header.tsx`, swipe handler in `src/app/page.tsx` (80px or 400px/s velocity, rejects when `|dy| > |dx|`), past = fully editable + streaks recalc, future = goals + schedule only, `settings.dayNavigation` for back/forward ranges + swipe toggle, `useIsActualToday()` gates time-sensitive UI.

When the user asks for "Stage 1 / 2 / 4", confirm they're built and ask whether they want extensions rather than a rewrite.

---

## Known gotchas + things to watch for

1. **iOS standalone PWA**: GitHub OAuth redirect can land in mobile Safari (not the PWA window). The session cookie is set on the right origin, so reopening the PWA later finds them signed in. Don't depend on `window.opener` or popup flows on iOS.
2. **iOS standalone PWA + push**: Push notifications work **only** in standalone mode (>= iOS 16.4), never in in-tab Safari. `getPushSupport()` in `src/lib/push-client.ts` detects this and the Settings RemindersCard renders an "Add to Home Screen" message.
3. **Edge runtime vs Node runtime**: middleware is Edge — never import anything that uses node-only APIs there. The Drizzle adapter is Node-only, which is why we use JWT sessions and the middleware never queries Neon.
4. **Service worker caching**: After deploying any change to `/signin`, `/api/auth/*`, or fix-flow JS, the user might need to hard-refresh once because SW cache evicts on the **next** load after the new SW activates. `/signin` + `/api/auth/*` now bypass the SW (commit `9792699`), but other paths still cache.
5. **Vercel cron + middleware**: `/api/cron/*` is now whitelisted in `PUBLIC_PATHS`. If you add more cron routes, they automatically inherit the bypass — but the route handler must implement its own bearer-auth check.
6. **Selectors with array transforms**: known infinite-re-render bug if you return fresh `.map`/`.filter` results from a selector under `useShallow`. We hit this in `useUnifiedGymSessions` historically. Always memoize derivations inside components.
7. **`@neondatabase/serverless` works with both pooled and unpooled URLs at runtime** (HTTP-only driver). For drizzle-kit DDL, use the unpooled URL.
8. **OFF API user-agent**: `src/lib/open-food-facts.ts` identifies as `life-os/0.2 (https://github.com/hbrady7/life-os)` per OFF's community-app guideline. Keep that header if you touch the lookup code.

---

## Smoke test checklist for the user's phone

These are the on-device verifications the user is doing (and may report back on):

- **Sign-in**: `/signin` → "Continue with GitHub" → completes without spinner hang
- **Stage 3 — Memory**: Tell Overseer *"I'm training for a marathon in November."* → wait a few seconds → Settings → "What I remember about you" → fact should appear. Edit / forget icons work.
- **Stage 5 — Overload coach**: Gym → New session → paste a log with 8+ reps at the top set → save. Open progress chart for that exercise → coach line "Hit 8 reps at Xlb — try (X+2.5)lb next time" + trophy if PR. Gear → override target reps / increment.
- **Stage 6 — Barcode**: Today → Nutrition card → **Scan** → grant camera → point at a packaged food barcode → review with macros → save. Try an unknown barcode for the graceful fallback.

---

## How to resume

1. Run `git status` + `git log --oneline -5` to confirm the repo matches this handoff (last commit should be `ff63005`).
2. Read `/Users/hollisbrady/life-os/CLAUDE.md` for the full spec.
3. Ask the user what they want done. Likely candidates:
   - Finish the VAPID + CRON_SECRET work (see "Pending immediate work").
   - Bug reports from their phone testing.
   - New feature.
4. Don't auto-start anything destructive or large without explicit go-ahead. Reading is free.
