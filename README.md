# Life OS

A personal life-OS dashboard. Single scrollable page, dark theme, integrated Gemini-powered AI assistant. Built to live on a phone.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui primitives (inlined)
- `@dnd-kit` for drag-to-reorder
- `@google/genai` (Gemini 2.5 Flash) — called from a server-side route
- All data in `localStorage` — no backend, no DB, no auth

## Setup

```bash
# 1. Install Node (skip if you already have it)
#    Easiest on macOS: install Homebrew (https://brew.sh) then:
#    brew install node

# 2. Install deps
cd life-os
npm install

# 3. Add your Gemini key
cp .env.local.example .env.local
# then edit .env.local and paste your key from https://aistudio.google.com/apikey

# 4. Run
npm run dev
# open http://localhost:3000 — or http://<your-mac-lan-ip>:3000 from your phone
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **New Project → Import** the repo. Framework auto-detects as Next.js.
3. Under **Environment Variables** add `GEMINI_API_KEY` with your key.
4. Deploy. Add the resulting `*.vercel.app` URL to your iPhone home screen via Safari's *Share → Add to Home Screen* for an app-feel.

## Project structure

```
src/
  app/
    api/overseer/route.ts   Gemini streaming endpoint
    layout.tsx              Root layout + metadata
    page.tsx                Single-page dashboard
    globals.css             Tailwind v4 + theme tokens
  components/
    ui/                     shadcn primitives (button, input, textarea, card)
    header.tsx              Date, day-type, completion ring, reminder
    goals.tsx               Drag-reorder checklist
    list-section.tsx        Shared list UI
    plan-tomorrow.tsx
    wins.tsx
    struggles.tsx
    export-import.tsx
    overseer.tsx            Floating button + slide-up chat panel
    completion-ring.tsx     SVG progress ring
  lib/
    types.ts                LifeOSData shape
    store.ts                useLifeOS hook (localStorage, SSR-safe)
    utils.ts                cn() helper
```

## Data

Everything lives at `localStorage["life-os:v1"]`. Use **Export** to back it up as JSON; **Import** restores it. The Overseer never persists chat — closing the panel resets it.
