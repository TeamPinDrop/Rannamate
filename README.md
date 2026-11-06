# RANNAMATE
**Your Kitchen. Your Mood. Your Mate.**

An AI-powered personal cooking companion: tell it what ingredients you have and what you're craving, get recipes you can actually cook, and let a talking Cooking Mate guide you step by step.

## Run it
```bash
npm run dev          # frontend — from this folder; installs dependencies on first run
```
Open http://localhost:3000. The frontend works on its own; the backend and AI service add server-side features.

Optional — the backend and AI service (each in its own terminal; first-time setup is in their READMEs):
```bash
npm run dev:backend  # NestJS API  → http://localhost:4000/api/v1   (docs: /api/docs)
npm run dev:ai       # FastAPI AI  → http://127.0.0.1:8000           (only the backend calls it)
```

## What's here
| Folder | Status |
|---|---|
| `frontend/` | Next.js 15 + TypeScript + Tailwind + Framer Motion — working |
| `backend/` | NestJS REST API (`/api/v1`): auth, recipes, kitchen, recommendations, favourites, cooking sessions, Tastory, scanner, Mate, Cook & Chill — working with `DATA_SOURCE=memory`; MySQL repositories wait for the `ranna_mate` schema (see `backend/docs/DATABASE_MAPPING.md`) |
| `ai-service/` | FastAPI: Cooking Mate, Cook & Chill content, ingredient photo recognition — working (needs a Gemini or Claude key) |
| MySQL `ranna_mate` | Existing database (39 tables) — not connected yet; the backend never creates or alters tables |

```
Browser → frontend (Next.js) → backend (NestJS, /api/v1) → MySQL ranna_mate
                                        └→ ai-service (FastAPI, internal key)
```

### Frontend features
- Cinematic intro + scroll-driven "empty bowl" home animation, glassmorphism UI (burgundy `#6C151E`, deep green `#0F3D3A`, cream `#F5DABF`)
- **My Kitchen** — add ingredients by search/category, or scan a photo (via backend → AI service; you confirm every detection)
- **Discover** — filters + rule-based recommender `R = 0.35I + 0.15M + 0.15C + 0.10W + 0.10T + 0.10P + 0.05H`
- **Cooking Mate** — animated chef chatbot with voice in/out, Mild / Masala / Extra Chatpata personalities, English/Hinglish, recipe cards, cook-along steps and timers
- **Cooking mode** with **Cook & Chill** (entertainment while food cooks), **Tastory** food-memory journal, **Profile** (allergies & diets)
- **Accounts** — animated Sign In / Sign Up / Forgot & Reset password (`/sign-in`, `/sign-up`, …), httpOnly cookie sessions with CSRF protection, optional Google sign-in. Needs the backend running; Profile requires sign-in. Reset emails need SMTP and Google needs OAuth keys in `backend/.env` (see `backend/README.md` → Authentication).

### Live AI (optional)
Create `frontend/.env.local` with `GEMINI_API_KEY=...` or `ANTHROPIC_API_KEY=...` (see `frontend/.env.example`). Without a key, Cooking Mate uses its built-in offline recipe brain.

See `frontend/README.md` for details.
