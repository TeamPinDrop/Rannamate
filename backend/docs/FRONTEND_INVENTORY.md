# RANNAMATE — frontend feature inventory (Phase 1)

Inspected: `frontend/` — Next.js 15.5 (App Router) · React 19 · TypeScript · Tailwind 3 · Framer Motion 11.
State lives in `localStorage` via a small external store (`src/lib/store.ts`), plus feature stores for
Cook & Chill (`lib/chill/store.ts`) and Tastory (`lib/tastory/store.ts` + IndexedDB for photos).
Sign In / Sign Up / Forgot & Reset password pages exist (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/auth/callback` for Google) and use the auth API with an httpOnly session cookie.

| Route | Feature | What the user does | Data it needs / shows | What would be saved | Backend API | Validation in UI | States already in UI | Connected now? |
|---|---|---|---|---|---|---|---|---|
| `/` | Home (scroll story, explore grid) | Browse, navigate | Static content | — | — | — | Preloader, animations | n/a |
| `/kitchen` | My Kitchen — manual | Search/browse 64 ingredients by category, set quantity & unit, remove | Ingredient catalogue (id, name, emoji, category, default unit, aliases) | Pantry items (ingredient, qty, unit) | `GET /ingredients`, `GET/POST/PATCH/DELETE /inventory` | qty > 0, unit list | Empty state, chips | Catalogue: frontend copy. Pantry: browser only (needs sign-in UI) |
| `/kitchen` | My Kitchen — photo scan | Upload/take a photo → review detections → tick to keep → add | Detected ingredient ids + confidence | Confirmed items go to pantry | `POST /scanner/ingredients` | file picker `image/*`; ≥80 % pre-ticked, rest unticked | idle / analysing / error / results | **Yes** (via `lib/api.ts`) |
| `/discover` | Discover | Filter by mood, cuisine, time, diet, difficulty, equipment; see ranked cards with match % | Recipes + recommender output | Filters (browser) | `GET /discovery`, `GET /recipes`, `POST /recommendations` | enum chips | Empty results, match rings | No — frontend runs the same recommender locally (identical weights & hard exclusions) |
| `/recipes/[id]` | Recipe detail | View ingredients (have/missing), steps, swaps; save favourite; start cooking | Full recipe, pantry match | Favourite | `GET /recipes/:id`, `POST/DELETE /favourites` | — | not-found | No (favourites: browser; needs sign-in) |
| `/cook/[id]` | Immersive Cooking Mode | Step through, timestamp timer, checklist, read aloud, Mate panel, finish | Recipe steps & timers | History on finish | `/cooking-sessions/*` | — | timer done alert, finish screen | Mate panel **yes**; sessions no (needs sign-in) |
| `/cook/[id]` | Cook & Chill (inside cook mode only) | 9 activities during safe waiting steps; voice; points | Recipe, step, remaining time | Points/achievements (browser) | `POST /cook-and-chill/activity` | safety classifier, wrap-up window | invite, paused, wrap-up, timer-done | Uses the existing Next route `/api/mate/chill` (backend endpoint ready; see below) |
| `/mate` | Cooking Mate studio | Chat/voice, personas, Hinglish, invented recipes, cook-along cards | Catalogue, pantry, profile | Chat (browser) | `POST /cooking-mate/chat` | — | typing, offline brain label, AI error banner | Uses the existing Next route `/api/mate` (richer: invents recipes) — kept |
| `/tastory` | Tastory food journal | Add/edit/delete memories with 1–12 photos, favourite, search, filter, sort, gallery/timeline, lightbox, download | Memories, photos | Memories + photos | `/memories/*`, `/media/*` | dish + ≥1 photo required, date ≤ today, caption ≤160, ≤12 photos ≤15 MB | skeleton, empty, empty-search, progress, toasts, undo | No — browser (IndexedDB); needs sign-in |
| `/profile` | Profile (sign-in required) | Account, sign out, connect Google, name, allergies, diets | — | Profile | `GET/PATCH /users/me` | enum chips | redirect to Sign In, account card | **Yes** — name, allergies, diets saved to the account |

**Not present in the approved frontend** (so no endpoints were built): shopping lists (removed with Meal Planner), reviews/ratings of recipes, profile photo, cooking experience level, measurement-unit preference, serving preference, meal-type field, nutrition data.

**Why kitchen, favourites, sessions and Tastory are not switched over yet:** sign-in exists now, but until MySQL is mapped the backend stores accounts in memory, so moving that data server-side would lose it on every backend restart. The typed client for all of them is ready in `frontend/src/services/endpoints.ts`.
