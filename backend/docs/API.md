# RANNAMATE API reference — `/api/v1`

Interactive docs (OpenAPI / Swagger UI) are served by the running backend at **`/api/docs`**
(JSON at `/api/docs-json`). This file is generated from the same spec plus hand-written examples.

## Conventions

- **Base URL:** `http://localhost:4000/api/v1`
- **Success:** `{ "data": … }`; paginated lists add `"meta": { page, pageSize, total, totalPages }` (`?page=1&pageSize=20`, max 50).
- **Error:** `{ "error": { "code": "STABLE_CODE", "message": "Human readable", "details"?: … }, "statusCode", "path", "timestamp" }`.
- **Auth:** `Authorization: Bearer <accessToken>`. *public* = no token; *optional* = works without a token, uses your profile/kitchen when one is sent; *required* = 401 without one.
- **Browser sessions:** the refresh token is only ever in the httpOnly `rm_session` cookie (path `/api/v1/auth`). Endpoints marked *csrf* need the header `X-CSRF-Token` with the value from `GET /auth/csrf` (double-submit against the httpOnly `rm_csrf` cookie) and an allowed `Origin`. Browser calls to `/auth/*` must use `credentials: "include"`.
- **Validation:** unknown fields are rejected (400 `VALIDATION_FAILED`, with per-field `details`).
- **Rate limits** (per IP per minute): 120 default · register/login 10 · refresh/logout 30 · forgot-password 5 · reset 10 · scanner 10 · Mate / Cook & Chill 30 → 429 `RATE_LIMITED`.
- **Header** `X-Data-Source: memory|mysql` on every response.

### Common error codes

| HTTP | code | meaning |
|---|---|---|
| 400 | `VALIDATION_FAILED`, `INVALID_ID`, `STEP_OUT_OF_RANGE`, `PHOTO_REQUIRED`, `TOO_MANY_PHOTOS`, `DATE_IN_FUTURE`, `UNKNOWN_INGREDIENT`, `UNKNOWN_RECIPE`, `INVALID_IMAGE` | bad input |
| 400 | `RESET_TOKEN_INVALID` | reset link expired, already used or unknown |
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `SESSION_ENDED`, `INVALID_CREDENTIALS`, `NO_SESSION`, `INVALID_REFRESH_TOKEN`, `REFRESH_RACE`, `REFRESH_TOKEN_REUSED`, `REFRESH_TOKEN_EXPIRED`, `INVALID_LINK_TICKET` | sign-in problems (`TOKEN_EXPIRED` → call `/auth/refresh`; `REFRESH_RACE` → retry once) |
| 403 | `FORBIDDEN`, `CSRF_FAILED` | expired / forged photo link · missing or wrong CSRF token / foreign Origin |
| 404 | `GOOGLE_NOT_CONFIGURED` | Google sign-in isn't set up on this server |
| 404 | `NOT_FOUND` | doesn't exist **or isn't yours** (ownership is never revealed) |
| 409 | `EMAIL_TAKEN`, `SESSION_NOT_ACTIVE`, `LAST_PHOTO`, `COOKING_ATTENTION_REQUIRED`, `WRAP_UP`, `NOT_ENOUGH_TIME` | state conflicts |
| 413 / 415 | `FILE_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` | upload problems (type is checked from the file's bytes) |
| 429 | `RATE_LIMITED` | slow down |
| 502 | `EMAIL_DELIVERY_FAILED`, `AI_SERVICE_ERROR`, `AI_INVALID_OUTPUT`, `AI_SERVICE_AUTH_FAILED` | the AI answered badly — nothing is invented |
| 503 | `EMAIL_NOT_CONFIGURED`, `DATABASE_NOT_CONFIGURED`, `SCHEMA_NOT_VERIFIED`, `AI_SERVICE_NOT_CONFIGURED`, `AI_PROVIDER_NOT_CONFIGURED`, `AI_SERVICE_UNREACHABLE`, `AI_SERVICE_TIMEOUT`, `STORAGE_NOT_CONFIGURED` | a dependency isn't available |

## Endpoints

### Health

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/health` | public | What is running and what is configured (no secrets) |

### Auth

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/auth/csrf` | public | CSRF token for this browser (sets httpOnly `rm_csrf`) + `hasSession` (is there a session cookie?) |
| `GET` | `/auth/providers` | public | `{ password, google, passwordReset }` — which options are configured (the app hides what isn't) |
| `POST` | `/auth/register` | public · csrf | `{ displayName, email, password, acceptTerms: true }` → 201, sets `rm_session` (30-day), returns `{ user, accessToken, expiresIn, csrfToken }` |
| `POST` | `/auth/login` | public · csrf | `{ email, password, remember? }` → sets `rm_session` (persistent with `remember`, browser-session otherwise) |
| `POST` | `/auth/refresh` | cookie · csrf | New access token + user from the session cookie (rotates the cookie) |
| `POST` | `/auth/logout` | cookie · csrf | Ends this session, clears the cookie; its access tokens stop working immediately (204) |
| `GET` | `/auth/me` | required | The signed-in user (incl. `signIn: { password, google }`) |
| `POST` | `/auth/password/forgot` | public · csrf | `{ email }` → 202, same answer for every address; emails a single-use link. 503 `EMAIL_NOT_CONFIGURED` without SMTP |
| `POST` | `/auth/password/reset/check` | public | `{ token }` → `{ valid }` |
| `POST` | `/auth/password/reset` | public · csrf | `{ token, password }` → sets the password, burns the token, signs out every device |
| `GET` | `/auth/google/start` | public | Browser redirect to Google (`?returnTo=/path&remember=1`, or `&link=<ticket>` to connect). 404 when not configured |
| `GET` | `/auth/google/callback` | public | Google returns here; state + PKCE + ID-token checks; sets the cookie and redirects to `APP_URL/auth/callback` (or `/sign-in?error=CODE`) |
| `POST` | `/auth/google/link-ticket` | required | 2-minute ticket for connecting Google to the signed-in account |

### Users

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/users/me` | required | Your account and profile |
| `PATCH` | `/users/me` | required | Update your profile (name, allergies, diets, Mate language & persona) |

### Recipes

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/recipes` | public | List / search / filter recipes (paginated) |
| `GET` | `/recipes/{id}` | public | Recipe detail with ingredients, steps, dietary and allergen info |
| `GET` | `/recipes/{id}/ingredients` | public | Ingredients of a recipe |
| `GET` | `/recipes/{id}/steps` | public | Cooking steps of a recipe |
| `GET` | `/discovery` | public | Discover-page facets: cuisines, moods, diets, difficulty, categories with counts |

### Ingredients

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/ingredients` | public | Ingredient catalogue — search by name/alias, filter by category |
| `GET` | `/ingredients/categories` | public | Ingredient categories |
| `GET` | `/ingredients/{id}` | public | One ingredient |

### Recommendations

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/recommendations` | optional | Ranked recipe recommendations with reasons. Allergies/diets/equipment are hard exclusions. Signing in adds your profile, kitchen, favourites and history. |

### Inventory

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/inventory` | required | Your kitchen inventory |
| `POST` | `/inventory` | required | Add an ingredient (updates it if already present → 200) |
| `PATCH` | `/inventory/{id}` | required | Update quantity, unit or expiry |
| `DELETE` | `/inventory/{id}` | required | Remove an ingredient |

### Favourites

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/favourites` | required | Your favourite recipes |
| `POST` | `/favourites` | required | Add a favourite (201 new, 200 already there) |
| `GET` | `/favourites/{recipeId}` | required | Is this recipe a favourite? |
| `DELETE` | `/favourites/{recipeId}` | required | Remove a favourite |

### Scanner

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/scanner/ingredients` | optional | Detect ingredients in a photo (JPG/PNG/WebP, ≤ 8 MB). Results must be confirmed by the user. |

### Cooking sessions

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/cooking-sessions` | required | Start (or resume) cooking a recipe |
| `GET` | `/cooking-sessions/active` | required | Your active cooking session, or null |
| `GET` | `/cooking-sessions/{id}` | required | One cooking session |
| `PATCH` | `/cooking-sessions/{id}` | required | Move to a step |
| `POST` | `/cooking-sessions/{id}/steps/{step}/complete` | required | Mark a step (0-based) as done |
| `POST` | `/cooking-sessions/{id}/complete` | required | Finish the session |
| `POST` | `/cooking-sessions/{id}/cancel` | required | Cancel the session |

### Cooking Mate

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/cooking-mate/chat` | optional | Ask Cooking Mate about the recipe/step you are on. Never returns invented answers: errors are explicit. |

### Cook & Chill

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/cook-and-chill/activity` | optional | Generate one Cook & Chill item. 409 when the step is unsafe, the timer is nearly done, or there is not enough time. |

### Tastory memories

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/memories` | required | Your memories — search, filter, sort, paginate |
| `POST` | `/memories` | required | Create a memory with 1–12 photos (multipart: fields + "photos" files; first photo is the cover) |
| `GET` | `/memories/timeline` | required | Memories grouped by month and year (same filters as the list) |
| `GET` | `/memories/statistics` | required | Totals for the Tastory header, computed from your memories |
| `GET` | `/memories/{id}` | required | One memory |
| `PATCH` | `/memories/{id}` | required | Edit dish, date, caption, notes, rating, tags, favourite or linked recipe |
| `DELETE` | `/memories/{id}` | required | Delete a memory and its photos |
| `PATCH` | `/memories/{id}/favourite` | required | Set or toggle favourite |
| `POST` | `/memories/{id}/photos` | required | Add photos (up to 12 in total) |
| `DELETE` | `/memories/{id}/photos/{photoId}` | required | Remove a photo (a memory keeps at least one) |
| `PATCH` | `/memories/{id}/cover` | required | Choose the cover photo |
| `PATCH` | `/memories/{id}/photos/order` | required | Reorder photos (first = cover) |
| `GET` | `/media/{key}` | signed URL | Photo bytes for a signed URL issued by the memories API |
## Examples

### Browser sign-in (cookie session + CSRF)

```http
GET /api/v1/auth/csrf                       → { "data": { "csrfToken": "Xq…", "hasSession": false } }   (sets rm_csrf, httpOnly)
POST /api/v1/auth/register                  X-CSRF-Token: Xq…   (fetch with credentials: "include")
{ "displayName": "Alok Sen", "email": "alok@example.com", "password": "tadka2026", "acceptTerms": true }
```
```json
{ "data": {
  "user": { "id": "…", "email": "alok@example.com", "createdAt": "…", "signIn": { "password": true, "google": false },
            "profile": { "displayName": "Alok Sen", "allergies": [], "diets": [], "preferredLanguage": "en", "matePersona": "masala" } },
  "accessToken": "eyJ…", "expiresIn": 900, "csrfToken": "Bf…" } }
```
`Set-Cookie: rm_session=…; Path=/api/v1/auth; HttpOnly; SameSite=Lax` (+ `Secure` in production). The refresh token is never in a response body.
Keep `accessToken` in memory only. On `401 TOKEN_EXPIRED` (or after a page reload: `GET /auth/csrf` → `hasSession: true`) call
`POST /auth/refresh` with the CSRF header — you get a new access token and the cookie rotates. Replaying an old cookie later revokes every session of that user.

### Recommendations (anonymous)

(Real output from the development catalogue.)

```http
POST /api/v1/recommendations
{ "ingredientIds": ["egg", "onion", "tomato", "green-chilli"], "moods": ["quick"], "craving": "something spicy", "allergies": ["dairy"], "limit": 3 }
```
```json
{ "data": {
  "weights": { "I": 0.35, "M": 0.15, "C": 0.15, "W": 0.1, "T": 0.1, "P": 0.1, "H": 0.05 },
  "appliedRestrictions": { "allergies": ["dairy"], "diets": [], "equipment": [] },
  "results": [
    { "recipe": { "id": "masala-omelette", "name": "Masala Omelette", … }, "score": 0.769, "matchPct": 100,
      "components": { "I": 1, "M": 1, "C": 0 }, "reasons": ["You have every essential ingredient", "Fits your quick mood"], "missing": [] },
    { "recipe": { "id": "jhal-muri", … }, "score": 0.641, "matchPct": 33, "components": { "I": 0.33, "M": 1, "C": 1 },
      "reasons": ["Fits your quick mood", "Matches your craving for spicy"], "missing": [{ "id": "puffed-rice" }, { "id": "cucumber" }] },
    … ],
  "excludedCount": 5 } }
```
Allergies, diets and (when given) equipment are **hard exclusions** — those recipes are never in `results`.

### Ingredient scanner

```bash
curl -F image=@fridge.jpg http://localhost:4000/api/v1/scanner/ingredients
```
```json
{ "data": {
  "detections": [ { "ingredientId": "tomato", "name": "Tomato", "emoji": "🍅", "label": "tomatoes", "confidence": 0.93, "status": "likely" },
                  { "ingredientId": "onion", "name": "Onion", "emoji": "🧅", "label": "red onion", "confidence": 0.55, "status": "uncertain" } ],
  "unmatched": [ { "label": "dragon fruit", "confidence": 0.9 } ],
  "requiresConfirmation": true,
  "message": "Check the list and confirm what you actually have." } }
```

### Cook & Chill (server enforces cooking safety)

```http
POST /api/v1/cook-and-chill/activity
{ "activity": "trivia", "recipeId": "dal-tadka", "stepIndex": 0, "remainingSec": 600, "difficulty": "easy" }
```
→ `200 { "data": { "activity": "trivia", "source": "ai", "data": { "question": "…", "options": [4], "correct": 2, … }, "safety": { "level": "passive", "note": "Keep an ear out for the whistles." } } }`

Same request on a hot-oil step → `409 COOKING_ATTENTION_REQUIRED`; with `remainingSec < 45` → `409 WRAP_UP`.
Activities: `trivia, guess, wyr, wyr-react, jokes, riddles, chat, story, song`. Food Facts are served from the app's curated library and never generated.

### Tastory — create a memory (multipart)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  -F dish="Rajma Chawal" -F date=2026-10-30 -F caption="Rainy evening" -F rating=4 \
  -F 'tags=["comfort","weeknight"]' -F favourite=true \
  -F photos=@one.jpg -F photos=@two.png \
  http://localhost:4000/api/v1/memories
```
```json
{ "data": { "id": "…", "dish": "Rajma Chawal", "date": "2026-10-30", "rating": 4, "tags": ["comfort", "weeknight"], "favourite": true,
  "coverPhotoId": "p1",
  "photos": [ { "id": "p1", "contentType": "image/jpeg", "bytes": 182340, "alt": "Rajma Chawal — photo 1",
                "url": "/api/v1/media/users/…/….jpg?exp=1793600000&sig=…", "expiresAt": "…" } ] } }
```
Photos are private: the `url` is a signed link valid for 15 minutes (prefix it with the API origin). Fetch the memory again for fresh links.
