# RANNAMATE — backend (NestJS)

The main API for RANNAMATE: accounts, recipes, kitchen, recommendations, favourites, cooking sessions,
Tastory memories, and the gateway to the AI service.

```
Browser (Next.js frontend)  ──HTTPS──▶  NestJS backend  /api/v1  ──▶  MySQL  ranna_mate   (existing schema, never migrated)
                                              │
                                              └──X-Internal-Key──▶  FastAPI ai-service  (Mate, Cook & Chill, photo recognition)
```

- The frontend never talks to MySQL or the AI service and never holds a secret.
- The AI service has **no database access**; the backend sends it only the context it needs.
- Photos are never stored in MySQL — they go to private storage and are served through short-lived signed links.

> **Database status:** accounts (sign-up, sign-in, sessions, profile, allergies, diets) are mapped to the real
> `ranna_mate_updated` schema and tested against MySQL 8. Recipes, kitchen, favourites, cooking sessions and Tastory
> are not mapped yet (they answer `503 SCHEMA_NOT_VERIFIED` in MySQL mode). See [docs/DATABASE_MAPPING.md](docs/DATABASE_MAPPING.md).

## Quick start (local development)

Requires Node 20+.

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```bash
DATA_SOURCE=memory                         # temporary in-memory store (until MySQL is mapped)
JWT_SECRET=<paste: openssl rand -base64 48>
JWT_REFRESH_SECRET=<paste a different one>
STORAGE_PROVIDER=local                     # Tastory photos on this machine (./storage/private, git-ignored)
STORAGE_SIGNING_SECRET=<paste a third one>
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=<same value as in ai-service/.env>
```

```bash
npm run dev            # http://localhost:4000/api/v1   ·   docs: http://localhost:4000/api/docs
```

The startup log says which data source, AI service and storage are active. `GET /api/v1/health` reports the same (never any secret).

To use AI features, also start the AI service (see `../ai-service/README.md`). Without it, AI endpoints answer `503` with a clear code — nothing is faked.

## Folder structure

```
backend/
├─ src/
│  ├─ main.ts, setup.ts, app.module.ts   bootstrap · security middleware · Swagger · global guards/filters
│  ├─ config/                            typed, validated configuration (refuses unsafe config at startup) + .env loader
│  ├─ common/                            errors (stable codes), exception filter, response envelope, JWT guard,
│  │                                     @Public/@OptionalAuth decorators, request logger, pagination, id pipe, rate limits
│  ├─ domain/types.ts                    shared types — mirror the frontend's data structures
│  ├─ database/
│  │  ├─ repositories/                   repository INTERFACES (the only thing services depend on)
│  │  ├─ memory/                         in-memory implementations + dev fixtures (DATA_SOURCE=memory only)
│  │  ├─ mysql/                          connection pool + unmapped stubs (503 until the schema is verified)
│  │  ├─ schema/                         read-only schema parser/report used by `npm run schema:inspect`
│  │  └─ database.module.ts              picks one implementation at startup — no runtime fallback
│  ├─ integrations/
│  │  ├─ ai-service/ai.client.ts         the only code that calls the FastAPI service
│  │  └─ storage/                        private photo storage, signed URLs, byte-level image validation
│  ├─ modules/                           auth · users · recipes (+ingredients, discovery) · recommendations · inventory ·
│  │                                     favourites · scanner · cooking-sessions · cooking-mate · cook-and-chill · memories
│  └─ health/
├─ test/                                 e2e suites (supertest) + test-only fake AI service
├─ scripts/                              inspect-schema.ts (read-only) · sync-dev-fixtures.ts
└─ docs/                                 API.md · DATABASE_MAPPING.md · FRONTEND_INVENTORY.md
```

## Modules

| Module | What it does | Auth |
|---|---|---|
| auth | register, login, cookie sessions (rotating), logout, CSRF, password reset by email, optional Google sign-in | public / cookie / required |
| users | profile: name, allergies, diets, Mate language & persona | required |
| recipes / ingredients / discovery | catalogue, search, filters, pagination, detail, Discover facets | public |
| recommendations | hybrid rule-based ranking with reasons; allergies/diets/equipment are hard exclusions | optional |
| inventory | your kitchen; add (upsert), update, delete, expiry | required |
| favourites | add / remove / list / status | required |
| scanner | photo → AI → catalogue ingredients with confidence; always needs user confirmation | optional |
| cooking-sessions | start/resume, move, complete steps, finish/cancel (frontend timer stays the source of truth) | required |
| cooking-mate | Mate answers for the current recipe & step | optional |
| cook-and-chill | one generated activity; **refuses** on unsafe steps, in the wrap-up window, or without enough time | optional |
| memories (Tastory) | CRUD, photos (add/remove/cover/reorder), search/filter/sort, timeline, statistics, signed media | required |

Not built because the approved frontend has no UI for them: shopping lists, reviews/ratings, profile photo.
Details: [docs/FRONTEND_INVENTORY.md](docs/FRONTEND_INVENTORY.md). Full endpoint list: [docs/API.md](docs/API.md).

## Authentication workflow

The website's Sign In / Sign Up / Forgot password pages use these endpoints (details: [docs/API.md](docs/API.md#auth)).

1. `GET /auth/csrf` → a CSRF token (and an httpOnly `rm_csrf` cookie). Every cookie-using auth call sends it back in `X-CSRF-Token`; foreign `Origin`s are refused.
2. `POST /auth/register` or `/auth/login` → `{ user, accessToken, expiresIn, csrfToken }` and the httpOnly **`rm_session`** cookie
   (path `/api/v1/auth` only; `Secure` in production). "Remember me" keeps it for `JWT_REFRESH_TTL` (30 days); otherwise it ends with the browser (server limit `SESSION_TTL`).
3. The app keeps the access token **in memory only** and sends `Authorization: Bearer …` (15 min).
4. On `401 TOKEN_EXPIRED`, or after a page reload, `POST /auth/refresh` (cookie) → new access token; the cookie rotates. A replayed old cookie revokes every session of that user (two tabs refreshing at the same moment get `REFRESH_RACE` and simply retry).
5. `POST /auth/logout` ends the session and clears the cookie; its access tokens stop working at once (`SESSION_ENDED`).
6. **Forgot password:** `POST /auth/password/forgot` emails a link to `APP_URL/reset-password?token=…` — a random 256-bit token, stored only as SHA-256, single use, expires in `PASSWORD_RESET_TTL_MINUTES` (30). Same answer whether or not the email is registered. Without SMTP it answers `503 EMAIL_NOT_CONFIGURED` (the app shows that honestly). A reset signs out every device.
7. **Google (optional):** only when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set. Authorization-code flow with state, nonce and PKCE; the backend exchanges the code with the client secret and checks the ID token (issuer, audience, expiry, nonce, verified email). An email that already has a password account is **never** taken over: the owner signs in with the password and uses *Connect Google* on the Profile page.

Passwords: bcrypt (cost 12). Login errors are identical for unknown email and wrong password, and take the same time.

## Security

Helmet headers · httpOnly session cookie + CSRF double-submit token + Origin check on auth endpoints · CORS allow-list (`CORS_ORIGINS`) · global validation (unknown fields rejected) · JWT guard on every route unless marked public · ownership enforced in every user-owned query (another user's id → 404) · per-route rate limits · uploads checked by magic bytes and size before anything is stored or sent to AI · private photo storage with HMAC-signed, expiring links · request log without bodies, headers or tokens · one error format, no stack traces to clients · startup refuses weak or missing secrets.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | | 4000 | HTTP port |
| `CORS_ORIGINS` | | `http://localhost:3000,http://localhost:3001` | Allowed browser origins |
| `DATA_SOURCE` | | `mysql` | `mysql` or `memory` (development/tests only) |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` | for MySQL | port 3306 | Connection (left blank until provided) |
| `DB_DATABASE` | | `ranna_mate` | Existing database (yours: `ranna_mate_updated`) |
| `DB_PASSWORD_RESETS_TABLE` | | — | Set only after `docs/sql/password_resets.sql` was run by the DB owner |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | **yes** | — | ≥ 32 chars, different from each other |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `SESSION_TTL` | | `15m`, `30d`, `12h` | Access token · "remember me" session · browser-session limit |
| `APP_URL`, `API_PUBLIC_URL` | | first CORS origin, `http://localhost:PORT` | Website URL (reset links, Google return) · public API URL |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN` | | secure in production, `lax`, — | Session-cookie settings (always httpOnly) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | for reset emails | —, 587, false | Password-reset email. Unset → reset emails honestly unavailable |
| `PASSWORD_RESET_TTL_MINUTES` | | 30 | Reset-link lifetime (5–120) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | for Google | —, `API_PUBLIC_URL/api/v1/auth/google/callback` | Optional Google sign-in; button hidden until both are set |
| `AI_SERVICE_URL`, `AI_SERVICE_API_KEY` | for AI | — | Internal AI service + shared key |
| `AI_SERVICE_TIMEOUT_MS` | | 25000 | AI call timeout |
| `STORAGE_PROVIDER` | for photos | — | `local` (dev) · `s3` (reserved, not implemented) |
| `STORAGE_LOCAL_DIR` | | `./storage/private` | Where local photos go |
| `STORAGE_SIGNING_SECRET` | with `local` | — | ≥ 32 chars, signs photo links |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_REGION` | | — | Placeholders for a future cloud bucket |
| `RATE_LIMIT_PER_MINUTE` | | 120 | Default per-IP limit |
| `RECO_WEIGHTS` | | see below | JSON weights for the recommender |

Recommendation weights (configurable, not fixed truths): ingredient availability 0.35 · mood 0.15 · craving/cuisine 0.15 · weather 0.10 · time 0.10 · preferences 0.10 · history 0.05. Only signals the user actually gave are counted; the rest are renormalised.

## Testing

```bash
npm test            # unit: recommender, safety classifier, scanner matching, image validation, config, schema parser
npm run test:e2e    # HTTP end-to-end against the in-memory store + a test-only fake AI service
# against a TEST COPY of the real schema (never production):
MYSQL_TEST_HOST=127.0.0.1 MYSQL_TEST_USER=… MYSQL_TEST_PASSWORD=… MYSQL_TEST_DATABASE=… npm run test:e2e
npm run test:all
npm run typecheck
```

E2E covers: registration, duplicate email, validation, login, generic invalid-credential errors, CSRF & Origin checks, httpOnly cookie flags, remember-me, reload persistence, protected routes, token rotation, multi-tab race & reuse detection, logout (immediate token revocation), password reset (email off → 503; email on → single-use, expiry, sign-out everywhere, delivery failure), Google sign-in (new account, state/PKCE checks, no takeover of password accounts, linking, open-redirect protection), profile updates, recipe retrieval & filters, ingredient search, inventory CRUD, recommendation scoring & allergy exclusions, favourites, cooking-session progress, cross-user ownership, Tastory create/edit/delete, photo validation (type, size, forged links), timeline & statistics, scanner validation & AI errors, Cooking Mate errors, Cook & Chill safety refusals, rate limiting, and MySQL mode refusing to serve fake data. The fake AI service lives only in `test/helpers.ts`.

## Connecting MySQL later

Follow the checklist in [docs/DATABASE_MAPPING.md](docs/DATABASE_MAPPING.md#5-mysql-connection-checklist-for-later). In short:
export the **structure only**, run `npm run schema:inspect -- --from-dump ../schema.sql`, implement the repository
interfaces under `src/database/mysql/`, and run the e2e suite against a copy of the database. The backend never runs
`CREATE`, `ALTER`, `DROP` or `TRUNCATE`, and never migrates the schema.

## Other scripts

- `npm run fixtures:sync` — refresh the in-memory catalogue from `frontend/src/lib/data` (development only).
- `npm run build && npm start` — production build.
