# RANNAMATE
**Your Kitchen. Your Mood. Your Mate.**

An AI-powered personal cooking companion: tell it what ingredients you have and what you're craving, get recipes you can actually cook, and let a talking Cooking Mate guide you step by step.

## Run it
```bash
npm run dev          # from this folder — installs dependencies on first run
```
Open http://localhost:3000.

## What's here
| Folder | Status |
|---|---|
| `frontend/` | Next.js 15 + TypeScript + Tailwind + Framer Motion — working |
| `backend/` (NestJS) | Planned — Phase 3 |
| `ai-service/` (FastAPI) | Planned — Phase 4–5 |
| `database/` (MySQL 8) | Planned — Phase 3 |

### Frontend features
- Cinematic intro + scroll-driven "empty bowl" home animation, glassmorphism UI (burgundy `#6C151E`, deep green `#0F3D3A`, cream `#F5DABF`)
- **My Kitchen** — add ingredients by search/category (photo recognition wired to the future AI service)
- **Discover** — filters + rule-based recommender `R = 0.35I + 0.15M + 0.15C + 0.10W + 0.10T + 0.10P + 0.05H`
- **Cooking Mate** — animated chef chatbot with voice in/out, Mild / Masala / Extra Chatpata personalities, English/Hinglish, recipe cards, cook-along steps and timers
- **Cooking mode**, **Meal planner** with merged shopping list, **Profile** (allergies & diets)

### Live AI (optional)
Create `frontend/.env.local` with `GEMINI_API_KEY=...` or `ANTHROPIC_API_KEY=...` (see `frontend/.env.example`). Without a key, Cooking Mate uses its built-in offline recipe brain.

See `frontend/README.md` for details.
