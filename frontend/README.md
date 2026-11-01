# RANNAMATE — Frontend

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Framer Motion

```bash
npm install
npm run dev        # http://localhost:3000
```

## What works now (no backend needed)
- Cinematic preloader (once per browser session, skip button, Esc, reduced-motion aware, 9 s fail-safe)
- Scroll-story homepage (8 sections) with glassmorphism throughout
- **My Kitchen** — search/browse 60+ ingredients by category, quantities & units
- **Discover** — filters (mood, cuisine, time, diet, difficulty, equipment) + the rule-based
  recommender `R = 0.35I + 0.15M + 0.15C + 0.10W + 0.10T + 0.10P + 0.05H`
  (`src/lib/recommend.ts`). Allergies/diets/equipment are hard exclusions; components with
  no signal are dropped and weights renormalised — match % is the real share of essentials you own.
- **Recipe page**, **Cooking mode** (one step at a time, timers, checklist, keyboard shortcuts)
- **Cooking Mate** — chat + browser voice (Web Speech API: speech-to-text, text-to-speech,
  mute/pause, hands-free). Mic permission is requested only when you tap the mic.
- **Meal planner** with consolidated shopping list (subtracts your pantry)
- **Profile** — allergies & diets (saved in this browser)

All user data is stored in `localStorage` until the backend exists.

## Placeholders (clearly labelled in the UI)
| Feature | Status |
|---|---|
| Photo ingredient recognition | Calls `POST {API}/api/vision/detect`; shows an "unavailable" notice until backend + AI service run |
| Generative AI answers | Calls `POST {API}/api/assistant/chat`; falls back to an offline rule-based helper that labels itself |
| Login / accounts | Not built — Phase 3 (NestJS) |
| Food photography | Stylised gradient + emoji dish art; swap in real images later |
| Weather (W) | Not used yet — excluded from scoring |

## Config
Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).
No secrets live in the frontend.

## Structure
```
src/app/            routes: / kitchen discover recipes/[id] cook/[id] planner mate profile
src/components/     Navbar, Preloader, OrbitField, MatePanel, RecipeCard, FilterPanel, home/*
src/lib/            data/ (ingredients, recipes, options), recommend.ts, store.ts, api.ts, voice.ts, mate-local.ts
```
