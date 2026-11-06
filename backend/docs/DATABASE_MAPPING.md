# Database mapping — `ranna_mate_updated`

**Status (from `schema.sql`, MySQL 8.0.46, 39 tables):** ACCOUNTS ARE MAPPED and tested against a copy of the real
schema. Recipes, ingredients, inventory, favourites, cooking sessions and Tastory are **not mapped yet** — in
`DATA_SOURCE=mysql` they answer `503 SCHEMA_NOT_VERIFIED` (never fake data). Full column list: `docs/SCHEMA.generated.md`.

## Accounts (mapped) — `src/database/mysql/accounts.repositories.ts`

| App concept | Table / column | Notes |
|---|---|---|
| user id | `users.user_id` | sent to the app as a string |
| name | `users.full_name` | |
| email (unique) | `users.email` (UNIQUE) | duplicate → `409 EMAIL_TAKEN` |
| password | `users.password_hash` | bcrypt cost 12; `NULL` for Google-created accounts |
| sign-in provider | `users.auth_provider` | `local` for email/password, `google` for Google-created accounts |
| deactivated | `users.is_active = 0` | can't sign in (same generic error); sessions end |
| language | `user_profiles.preferred_language` | `en` / `hinglish`; row created at sign-up |
| Mate persona | `user_preferences.preference_settings` → `$.matePersona` | row created on first save |
| allergies | `user_allergies` ⇄ `allergens.allergen_name` | names matched loosely (e.g. "Milk" = dairy, "Tree Nuts" = nuts). Rows the app doesn't list (e.g. Sesame) are never touched. A choice with no matching `allergens` row → `422 PROFILE_OPTION_NOT_IN_DATABASE`, nothing saved — the app never inserts reference data |
| diets | `user_dietary_preferences` ⇄ `dietary_tags.tag_name` | same rules |
| sign-in session | `user_sessions` | one row per sign-in; `refresh_token_hash` = SHA-256 of the cookie token; logout sets `revoked_at`; rotation sets `revoked_at` **and** `expires_at` to the same moment (there's no "replaced by" column — this is how a replayed old cookie is told apart from a signed-out one) |

**Not in the schema, so limited:**
- **Password reset tokens** — no table. Reset is reported as unavailable (`PASSWORD_RESET_NOT_AVAILABLE`, and the
  Forgot-password page says so). To enable: the DB owner runs [`docs/sql/password_resets.sql`](sql/password_resets.sql)
  and sets `DB_PASSWORD_RESETS_TABLE=password_resets` (plus SMTP). The backend itself never runs DDL.
- **Google account id** — no column. Google sign-in works for accounts *created* with Google (matched by the
  verified email + `auth_provider='google'`); connecting Google to an existing password account isn't possible until
  a column for the Google id exists.
- Unused here: `role`, `is_verified`, `profile_image_key`, `cooking_level`, `measurement_unit`, `preferred_servings`,
  device/IP columns of `user_sessions` (left NULL).

**App database user:** grant only `SELECT, INSERT, UPDATE, DELETE` on `ranna_mate_updated.*`.

---

_Earlier notes (before the schema was available) follow._

# `ranna_mate` database mapping

**Status: NOT VERIFIED.** No SQL export, Workbench model or connection details were available, so no column
of the 39-table schema is known. Nothing below is guessed into code: every MySQL repository raises
`503 SCHEMA_NOT_VERIFIED` (or `DATABASE_NOT_CONFIGURED`) until this document is completed from the real schema.

## 1. What is verified

From the database overview supplied with the brief:

| Item | Value | Source |
|---|---|---|
| Database name | `ranna_mate` | brief |
| Engine | MySQL | brief |
| Charset / collation | `utf8mb4` / `utf8mb4_unicode_ci` | brief |
| Table count | 39 (reported) | brief |
| Visible table names (13) | `users`, `user_profiles`, `recipes`, `recipe_ingredients`, `recipe_steps`, `favourites`, `recipe_dietary_tags`, `recipe_allergens`, `user_inventory`, `shopping_lists`, `shopping_list_items`, `cooking_sessions`, `cooking_step_progress` | diagram |

## 2. What is missing (needed before MySQL repositories can be written)

- Column names, types, nullability, defaults and keys of **all 39 tables**.
- Foreign keys and delete rules (the diagram shows lines, not columns).
- Names and purpose of the **26 tables not visible** in the diagram — likely candidates for: ingredient catalogue, ingredient categories/units, cuisines, moods, equipment, Tastory memories & photos, auth sessions/refresh tokens, cooking history, reviews. Unknown until seen.
- Primary-key type (auto-increment int vs UUID) — the API uses string ids, so either works.
- Whether recipes reference ingredients by id or by free-text name.

## 3. What each backend area needs (requirements, not assumptions about your columns)

| Backend area | Tables named in the diagram | Fields the API needs to read/write | Gaps to confirm |
|---|---|---|---|
| Auth | `users` | id, email (**unique index**), password hash (**nullable** for Google-only accounts), Google subject id (nullable, unique), created/updated | Whether `users` already has a Google/provider column or a separate social-login table; where sign-in sessions live (id, user, token SHA-256, expiry, revoked_at, replaced_by) and password-reset tokens (id, user, token SHA-256, expires_at, used_at, created_at) — no tables visible. If they don't exist, the database owners must add them; this backend never runs DDL and never creates a second user table |
| Profile | `user_profiles` | display name, allergies[], diets[], Mate language, Mate persona | How allergies/diets are stored (columns, JSON, or a link table) |
| Recipes | `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_dietary_tags`, `recipe_allergens` | name, tagline, emoji, cuisine, moods, difficulty, prep/cook minutes, servings, equipment options, weather; ingredient qty/unit/optional/note; step text/timer/tip; swaps | Moods, equipment, substitutions and display palette have no visible table |
| Ingredients | — (not visible) | id, name, emoji, category, default unit, staple flag, aliases | Catalogue table name |
| Inventory | `user_inventory` | user, ingredient, quantity, unit, expiry (optional) | Unique (user, ingredient)? |
| Favourites | `favourites` | user, recipe, created | — |
| Cooking sessions | `cooking_sessions`, `cooking_step_progress` | user, recipe, status (active/completed/cancelled/abandoned), current step, started/ended; per-step completed time | Status column values |
| Tastory | — (not visible) | user, dish, date, caption, notes, rating, tags[], favourite, recipe link; photos: storage key, type, size, order | Whether tables exist; photo binaries must NOT be stored in MySQL |
| Shopping lists | `shopping_lists`, `shopping_list_items` | — | No UI in the approved frontend → not implemented |
| Cook & Chill | — | nothing persisted server-side today | Points/achievements stay in the browser unless tables exist |

## 4. How to complete the mapping (read-only)

1. Get the structure, not the data — either:
   - MySQL Workbench → *Server → Data Export* → select `ranna_mate` → **Dump Structure Only** → save `schema.sql`, or
   - `mysqldump --no-data --routines=false ranna_mate > schema.sql`
2. Put `schema.sql` in the `rannamate/` folder and run:
   ```bash
   cd backend
   npm run schema:inspect -- --from-dump ../schema.sql
   ```
   or, once `DB_*` are in `backend/.env`:
   ```bash
   npm run schema:inspect -- --live --i-understand-read-only
   ```
   Both write `docs/SCHEMA.generated.md` (tables, columns, PKs, FKs, indexes, and which needed tables are missing). The live mode runs only `SELECT … FROM information_schema`.
3. Fill section 3 with the real column names.
4. Implement each repository interface in `src/database/repositories/index.ts` as a class under `src/database/mysql/` using `getPool(cfg)` and parameterised queries, and swap it in for the matching `unmapped(...)` entry in `src/database/database.module.ts`.
5. Run the same e2e suite against a **copy** of the database (never production) with `DATA_SOURCE=mysql`.

## 5. MySQL connection checklist (for later)

- [ ] Structure exported and `docs/SCHEMA.generated.md` reviewed (39 tables)
- [ ] A dedicated app user with only `SELECT, INSERT, UPDATE, DELETE` on `ranna_mate.*` — no `CREATE/ALTER/DROP`
- [ ] `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE=ranna_mate` in `backend/.env` (never committed)
- [ ] `GET /api/v1/health` shows `"status": "ok"` for the database
- [ ] Repositories implemented and e2e tests passing against a test copy
- [ ] Tables for refresh-token sessions and Tastory confirmed (or added by the database owners — this backend never runs DDL)
- [ ] `DATA_SOURCE=mysql` in production; `memory` never used outside development
