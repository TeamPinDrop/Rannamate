/**
 * MySQL repositories for ACCOUNTS — mapped to the real `ranna_mate_updated` schema (schema.sql, MySQL 8.0.46).
 *
 *   users                     id, full_name, email (UNIQUE), password_hash (NULL for Google-only), auth_provider, is_active
 *   user_profiles             preferred_language                                  (one row per user)
 *   user_preferences          preference_settings JSON → $.matePersona            (one row per user, created on first use)
 *   user_allergies ⇄ allergens            allergen names ⇄ the app's allergy ids
 *   user_dietary_preferences ⇄ dietary_tags   tag names ⇄ the app's diet ids
 *   user_sessions             one row per sign-in; only the SHA-256 of the refresh token is stored
 *   <DB_PASSWORD_RESETS_TABLE>   optional — the schema has no reset-token table (see docs/DATABASE_MAPPING.md)
 *
 * Rules: parameterised queries only · never CREATE/ALTER/DROP/TRUNCATE · never inserts reference data
 * (allergens/dietary_tags rows) · rows the app can't represent (e.g. an allergen the UI doesn't list) are left untouched.
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AppConfig } from '../../config/configuration';
import { AppError, Errors } from '../../common/errors';
import { ALLERGENS, DIETS, LANGS, PERSONAS, type AuthSession, type PasswordReset, type Profile, type User } from '../../domain/types';
import type { AuthSessionsRepository, PasswordResetsRepository, UsersRepository } from '../repositories';
import { getPool } from './mysql.pool';

// ───────────────────────── helpers ─────────────────────────

/** "2026-11-06 17:53:27" (UTC, because the session time_zone is +00:00) → ISO */
export const iso = (v: string | null): string | null => (v ? `${v.replace(' ', 'T').slice(0, 19)}Z` : null);
/** ISO → "YYYY-MM-DD HH:MM:SS" (UTC) for DATETIME / TIMESTAMP parameters */
export const sqlTime = (d: string | Date) => new Date(d).toISOString().slice(0, 19).replace('T', ' ');
const nowSql = () => sqlTime(new Date());
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** How the app's ids may be spelled in the reference tables (compared without case, spaces or punctuation). */
const ALLERGEN_NAMES: Record<(typeof ALLERGENS)[number], string[]> = {
  gluten: ['gluten', 'wheat', 'wheat gluten', 'gluten wheat', 'cereals containing gluten'],
  dairy: ['dairy', 'milk', 'lactose', 'milk dairy', 'dairy milk'],
  egg: ['egg', 'eggs'],
  nuts: ['nuts', 'nut', 'tree nuts', 'tree nut', 'treenuts'],
  soy: ['soy', 'soya', 'soybean', 'soybeans'],
  shellfish: ['shellfish', 'crustaceans', 'crustacean shellfish', 'crustacean'],
  fish: ['fish'],
};
const DIET_NAMES: Record<(typeof DIETS)[number], string[]> = {
  vegetarian: ['vegetarian', 'veg'],
  vegan: ['vegan'],
  'gluten-free': ['gluten free', 'glutenfree', 'gluten-free'],
  'dairy-free': ['dairy free', 'dairyfree', 'lactose free'],
  'high-protein': ['high protein', 'protein rich'],
  'low-carb': ['low carb', 'low carbohydrate', 'keto'],
};

/** reference rows ⇄ app ids; rows that match nothing are simply not shown/changed by the app */
function matcher<K extends string>(names: Record<K, string[]>) {
  const index = new Map<string, K>();
  for (const [id, list] of Object.entries(names) as [K, string[]][]) for (const n of list) index.set(norm(n), id);
  return (dbName: string): K | null => index.get(norm(dbName)) ?? null;
}
const allergenOf = matcher(ALLERGEN_NAMES);
const dietOf = matcher(DIET_NAMES);

async function tx<T>(pool: Pool, fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const r = await fn(c);
    await c.commit();
    return r;
  } catch (e) {
    await c.rollback().catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

const isDuplicate = (e: unknown) => (e as { code?: string })?.code === 'ER_DUP_ENTRY';

// ───────────────────────── users & profiles ─────────────────────────

interface UserRow extends RowDataPacket {
  user_id: string; full_name: string; email: string; password_hash: string | null; auth_provider: 'local' | 'google' | 'other';
  is_active: number; created_at: string; updated_at: string;
}
const USER_COLS = 'user_id, full_name, email, password_hash, auth_provider, is_active, created_at, updated_at';
const toUser = (r: UserRow): User => ({
  id: String(r.user_id), email: r.email, passwordHash: r.password_hash,
  // the schema records the sign-in provider, not a Google account id
  googleSub: r.auth_provider === 'google' ? 'google' : null,
  active: Number(r.is_active) === 1,
  createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
});

export class MysqlUsersRepository implements UsersRepository {
  constructor(private readonly cfg: AppConfig) {}
  private get pool() { return getPool(this.cfg); }

  async findById(id: string) {
    if (!/^\d+$/.test(id)) return null;
    const [rows] = await this.pool.execute<UserRow[]>(`SELECT ${USER_COLS} FROM users WHERE user_id = ?`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string) {
    const [rows] = await this.pool.execute<UserRow[]>(`SELECT ${USER_COLS} FROM users WHERE email = ?`, [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  /** No Google-id column exists: an account created with Google (auth_provider='google') is matched by its verified email. */
  async findByGoogle(_sub: string, email: string) {
    const [rows] = await this.pool.execute<UserRow[]>(`SELECT ${USER_COLS} FROM users WHERE email = ? AND auth_provider = 'google'`, [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async create(i: { email: string; passwordHash: string | null; displayName: string; googleSub?: string | null }) {
    try {
      const id = await tx(this.pool, async (c) => {
        const [r] = await c.execute<ResultSetHeader>(
          'INSERT INTO users (full_name, email, password_hash, auth_provider, is_verified) VALUES (?, ?, ?, ?, ?)',
          [i.displayName, i.email, i.passwordHash, i.googleSub ? 'google' : 'local', i.googleSub ? 1 : 0],
        );
        await c.execute('INSERT INTO user_profiles (user_id) VALUES (?)', [r.insertId]);
        return String(r.insertId);
      });
      return (await this.findById(id))!;
    } catch (e) {
      if (isDuplicate(e)) throw Errors.conflict('EMAIL_TAKEN', 'An account with this email already exists. Try signing in instead.');
      throw e;
    }
  }

  async setPasswordHash(userId: string, passwordHash: string) {
    await this.pool.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, userId]);
  }

  /** a password account can't be marked as Google without losing its provider, and there's no Google-id column */
  async linkGoogle() { return false; }

  async getProfile(userId: string): Promise<Profile | null> {
    if (!/^\d+$/.test(userId)) return null;
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT u.full_name, u.updated_at AS u_updated, p.preferred_language, p.updated_at AS p_updated,
              JSON_UNQUOTE(JSON_EXTRACT(pr.preference_settings, '$.matePersona')) AS persona, pr.updated_at AS pr_updated
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.user_id
         LEFT JOIN user_preferences pr ON pr.user_id = u.user_id
        WHERE u.user_id = ?`, [userId]);
    const r = rows[0];
    if (!r) return null;
    const [al] = await this.pool.execute<RowDataPacket[]>('SELECT a.allergen_name FROM user_allergies ua JOIN allergens a ON a.allergen_id = ua.allergen_id WHERE ua.user_id = ?', [userId]);
    const [dt] = await this.pool.execute<RowDataPacket[]>('SELECT t.tag_name FROM user_dietary_preferences ud JOIN dietary_tags t ON t.tag_id = ud.tag_id WHERE ud.user_id = ?', [userId]);
    const uniq = <T>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null))];
    const lang = LANGS.includes(r.preferred_language) ? r.preferred_language : 'en';
    const persona = PERSONAS.includes(r.persona) ? r.persona : 'masala';
    const updated = [r.u_updated, r.p_updated, r.pr_updated].filter(Boolean).sort().at(-1) as string;
    return {
      userId, displayName: r.full_name,
      allergies: uniq(al.map((x) => allergenOf(x.allergen_name))),
      diets: uniq(dt.map((x) => dietOf(x.tag_name))),
      preferredLanguage: lang, matePersona: persona, updatedAt: iso(updated)!,
    };
  }

  async updateProfile(userId: string, patch: Partial<Omit<Profile, 'userId' | 'updatedAt'>>) {
    await tx(this.pool, async (c) => {
      if (patch.displayName !== undefined) await c.execute('UPDATE users SET full_name = ? WHERE user_id = ?', [patch.displayName, userId]);
      if (patch.preferredLanguage !== undefined) {
        await c.execute('INSERT INTO user_profiles (user_id, preferred_language) VALUES (?, ?) ON DUPLICATE KEY UPDATE preferred_language = VALUES(preferred_language)', [userId, patch.preferredLanguage]);
      }
      if (patch.matePersona !== undefined) {
        await c.execute(
          `INSERT INTO user_preferences (user_id, preference_settings) VALUES (?, JSON_OBJECT('matePersona', ?))
           ON DUPLICATE KEY UPDATE preference_settings = JSON_SET(COALESCE(preference_settings, JSON_OBJECT()), '$.matePersona', ?)`,
          [userId, patch.matePersona, patch.matePersona],
        );
      }
      if (patch.allergies !== undefined) {
        await syncLinks(c, {
          wanted: patch.allergies, label: 'allergy', of: allergenOf,
          refSql: 'SELECT allergen_id AS id, allergen_name AS name FROM allergens',
          mineSql: 'SELECT allergen_id AS id FROM user_allergies WHERE user_id = ?',
          insertSql: 'INSERT INTO user_allergies (user_id, allergen_id) VALUES (?, ?)',
          deleteSql: 'DELETE FROM user_allergies WHERE user_id = ? AND allergen_id = ?',
        }, userId);
      }
      if (patch.diets !== undefined) {
        await syncLinks(c, {
          wanted: patch.diets, label: 'diet', of: dietOf,
          refSql: 'SELECT tag_id AS id, tag_name AS name FROM dietary_tags',
          mineSql: 'SELECT tag_id AS id FROM user_dietary_preferences WHERE user_id = ?',
          insertSql: 'INSERT INTO user_dietary_preferences (user_id, tag_id) VALUES (?, ?)',
          deleteSql: 'DELETE FROM user_dietary_preferences WHERE user_id = ? AND tag_id = ?',
        }, userId);
      }
    });
    return (await this.getProfile(userId))!;
  }
}

/**
 * Makes the user's links match `wanted`, touching only reference rows the app understands.
 * If the reference table has no row for something the user picked, nothing is saved and a clear 422 is returned
 * (reference data is never invented by the app).
 */
async function syncLinks<K extends string>(c: PoolConnection, o: { wanted: K[]; label: string; of: (name: string) => K | null; refSql: string; mineSql: string; insertSql: string; deleteSql: string }, userId: string) {
  const [ref] = await c.execute<RowDataPacket[]>(o.refSql);
  const idsFor = new Map<K, string[]>();
  for (const r of ref) { const k = o.of(r.name); if (k) idsFor.set(k, [...(idsFor.get(k) ?? []), String(r.id)]); }
  const missing = o.wanted.filter((k) => !idsFor.has(k));
  if (missing.length) {
    throw new AppError(422, 'PROFILE_OPTION_NOT_IN_DATABASE', `The database has no ${o.label} entry for: ${missing.join(', ')}. Ask the database owner to add it (nothing was saved).`, { missing });
  }
  const [mine] = await c.execute<RowDataPacket[]>(o.mineSql, [userId]);
  const have = new Set(mine.map((r) => String(r.id)));
  for (const [k, rows] of idsFor) {
    const linked = rows.filter((id) => have.has(id));
    if (o.wanted.includes(k)) { if (!linked.length) await c.execute(o.insertSql, [userId, rows[0]]); }
    else for (const id of linked) await c.execute(o.deleteSql, [userId, id]);
  }
}

// ───────────────────────── sign-in sessions (user_sessions) ─────────────────────────

interface SessionRow extends RowDataPacket {
  user_session_id: string; user_id: string; refresh_token_hash: string; expires_at: string; revoked_at: string | null; created_at: string;
}
/**
 * The table has no "replaced by" column. A rotated session is recorded as revoked with its expiry set to the
 * moment of rotation (it ended naturally); a signed-out session keeps its original expiry. That's what tells
 * "old cookie replayed after rotation" (possible theft) apart from "signed out".
 */
const toSession = (r: SessionRow): AuthSession => {
  const revoked = r.revoked_at;
  return {
    id: String(r.user_session_id), userId: String(r.user_id), tokenHash: r.refresh_token_hash,
    expiresAt: iso(r.expires_at)!, revokedAt: iso(revoked), createdAt: iso(r.created_at)!,
    replacedBy: revoked && r.expires_at <= revoked ? 'rotated' : null,
  };
};
const SESSION_COLS = 'user_session_id, user_id, refresh_token_hash, expires_at, revoked_at, created_at';

export class MysqlAuthSessionsRepository implements AuthSessionsRepository {
  constructor(private readonly cfg: AppConfig) {}
  private get pool() { return getPool(this.cfg); }

  async create(s: { userId: string; tokenHash: string; expiresAt: string }) {
    const [r] = await this.pool.execute<ResultSetHeader>('INSERT INTO user_sessions (user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?)', [s.userId, s.tokenHash, sqlTime(s.expiresAt)]);
    return (await this.findById(String(r.insertId)))!;
  }
  async findById(id: string) {
    if (!/^\d+$/.test(id)) return null;
    const [rows] = await this.pool.execute<SessionRow[]>(`SELECT ${SESSION_COLS} FROM user_sessions WHERE user_session_id = ?`, [id]);
    return rows[0] ? toSession(rows[0]) : null;
  }
  async findByTokenHash(h: string) {
    const [rows] = await this.pool.execute<SessionRow[]>(`SELECT ${SESSION_COLS} FROM user_sessions WHERE refresh_token_hash = ?`, [h]);
    return rows[0] ? toSession(rows[0]) : null;
  }
  async revoke(id: string, replacedBy: string | null = null) {
    const t = nowSql();
    if (replacedBy) await this.pool.execute('UPDATE user_sessions SET revoked_at = ?, expires_at = ? WHERE user_session_id = ? AND revoked_at IS NULL', [t, t, id]);
    else await this.pool.execute('UPDATE user_sessions SET revoked_at = ? WHERE user_session_id = ? AND revoked_at IS NULL', [t, id]);
  }
  async revokeAllForUser(userId: string) {
    await this.pool.execute('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [nowSql(), userId]);
  }
}

// ───────────────────────── password resets ─────────────────────────

/** The schema has no reset-token table → reset is honestly unavailable (503 PASSWORD_RESET_NOT_AVAILABLE). */
export class MysqlPasswordResetsUnavailable implements PasswordResetsRepository {
  readonly available = false;
  private no(): never { throw Errors.unavailable('PASSWORD_RESET_NOT_AVAILABLE', "Password reset isn't available: the database has no table for reset links."); }
  async create(): Promise<PasswordReset> { this.no(); }
  async findByTokenHash(): Promise<PasswordReset | null> { this.no(); }
  async consume(): Promise<boolean> { this.no(); }
  async invalidateAllForUser(): Promise<void> { this.no(); }
  async latestForUser(): Promise<PasswordReset | null> { this.no(); }
}

interface ResetRow extends RowDataPacket { id: string; user_id: string; token_hash: string; expires_at: string; used_at: string | null; created_at: string }
const toReset = (r: ResetRow): PasswordReset => ({ id: String(r.id), userId: String(r.user_id), tokenHash: r.token_hash, expiresAt: iso(r.expires_at)!, usedAt: iso(r.used_at), createdAt: iso(r.created_at)! });

/**
 * Used only when the database owner has added a reset table and set DB_PASSWORD_RESETS_TABLE
 * (suggested definition in docs/DATABASE_MAPPING.md). The table name is validated at startup.
 */
export class MysqlPasswordResetsRepository implements PasswordResetsRepository {
  readonly available = true;
  constructor(private readonly cfg: AppConfig) {}
  private get pool() { return getPool(this.cfg); }
  private get t() { return `\`${this.cfg.db.passwordResetsTable}\``; }
  private readonly cols = 'id, user_id, token_hash, expires_at, used_at, created_at';

  async create(r: Omit<PasswordReset, 'createdAt' | 'usedAt' | 'id'> & { id?: string }) {
    const [res] = await this.pool.execute<ResultSetHeader>(`INSERT INTO ${this.t} (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`, [r.userId, r.tokenHash, sqlTime(r.expiresAt), nowSql()]);
    const [rows] = await this.pool.execute<ResetRow[]>(`SELECT ${this.cols} FROM ${this.t} WHERE id = ?`, [res.insertId]);
    return toReset(rows[0]);
  }
  async findByTokenHash(h: string) {
    const [rows] = await this.pool.execute<ResetRow[]>(`SELECT ${this.cols} FROM ${this.t} WHERE token_hash = ?`, [h]);
    return rows[0] ? toReset(rows[0]) : null;
  }
  async consume(id: string) {
    const [r] = await this.pool.execute<ResultSetHeader>(`UPDATE ${this.t} SET used_at = ? WHERE id = ? AND used_at IS NULL`, [nowSql(), id]);
    return r.affectedRows === 1; // atomic: a second use finds used_at already set
  }
  async invalidateAllForUser(userId: string) {
    await this.pool.execute(`UPDATE ${this.t} SET used_at = ? WHERE user_id = ? AND used_at IS NULL`, [nowSql(), userId]);
  }
  async latestForUser(userId: string) {
    const [rows] = await this.pool.execute<ResetRow[]>(`SELECT ${this.cols} FROM ${this.t} WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`, [userId]);
    return rows[0] ? toReset(rows[0]) : null;
  }
}
