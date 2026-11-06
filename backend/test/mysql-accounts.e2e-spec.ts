import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createConnection, type Connection, type RowDataPacket } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { MailService, type OutgoingMail } from '../src/integrations/mail/mail.service';
import { closePool } from '../src/database/mysql/mysql.pool';
import { bootApp, browserClient, registerUser } from './helpers';

/**
 * Accounts against a REAL MySQL 8 database built from schema.sql (a test copy — never production).
 * Runs only when MYSQL_TEST_HOST is set, e.g.
 *   MYSQL_TEST_HOST=127.0.0.1 MYSQL_TEST_USER=rm_app MYSQL_TEST_PASSWORD=… MYSQL_TEST_DATABASE=ranna_mate_updated npm run test:e2e
 * The app user should have only SELECT/INSERT/UPDATE/DELETE. Reference rows (allergens, dietary_tags) are
 * seeded here for the test copy only. For the reset-flow block, set MYSQL_TEST_RESETS_TABLE to a table made from
 * the suggested definition in docs/DATABASE_MAPPING.md.
 */
const env = process.env;
const enabled = !!env.MYSQL_TEST_HOST;
const d = enabled ? describe : describe.skip;
const DOMAIN = '@rmtest.dev';
const api = (p: string) => `/api/v1${p}`;
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const cookieValue = (r: request.Response, name: string) => decodeURIComponent(([] as string[]).concat(r.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`))!.split(';')[0].split('=').slice(1).join('='));
const shiftClock = (ms: number) => jest.useFakeTimers({ now: Date.now() + ms, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'clearImmediate', 'queueMicrotask', 'performance', 'hrtime'] });
const dbEnv = () => ({ DATA_SOURCE: 'mysql', DB_HOST: env.MYSQL_TEST_HOST!, DB_PORT: env.MYSQL_TEST_PORT ?? '3306', DB_USERNAME: env.MYSQL_TEST_USER!, DB_PASSWORD: env.MYSQL_TEST_PASSWORD ?? '', DB_DATABASE: env.MYSQL_TEST_DATABASE ?? 'ranna_mate_updated' });

let db: Connection;
const q = async <T extends RowDataPacket>(sql: string, p: unknown[] = []) => (await db.query<T[]>(sql, p))[0];

async function openDb() {
  db = await createConnection({ host: env.MYSQL_TEST_HOST, port: Number(env.MYSQL_TEST_PORT ?? 3306), user: env.MYSQL_TEST_USER, password: env.MYSQL_TEST_PASSWORD, database: env.MYSQL_TEST_DATABASE ?? 'ranna_mate_updated', timezone: 'Z', dateStrings: true });
  await db.query("SET time_zone = '+00:00'");
  await db.query(`DELETE FROM users WHERE email LIKE ?`, [`%${DOMAIN}`]); // cascades to profiles, sessions, links
  // test-copy reference data, spelled the way a real catalogue might be ("Milk", "Tree Nuts", "Gluten Free" …)
  for (const n of ['Milk', 'Peanuts', 'Gluten', 'Egg', 'Tree Nuts', 'Sesame']) await db.query('INSERT IGNORE INTO allergens (allergen_name) VALUES (?)', [n]);
  for (const n of ['Vegetarian', 'Vegan', 'Gluten Free']) await db.query('INSERT IGNORE INTO dietary_tags (tag_name) VALUES (?)', [n]);
}

d('MySQL accounts (real schema)', () => {
  let app: INestApplication;
  const srv = () => app.getHttpServer();
  beforeAll(async () => { await openDb(); app = await bootApp(dbEnv()); });
  afterAll(async () => { await app?.close(); await closePool(); await db?.end(); });
  afterEach(() => jest.useRealTimers());

  it('health reports the database as reachable', async () => {
    const r = await request(srv()).get(api('/health')).expect(200);
    expect(r.body.data.dataSource).toMatchObject({ mode: 'mysql', status: 'ok' });
  });

  it('registration writes users + user_profiles; password is bcrypt; the session stores only a hash', async () => {
    const { res, token } = await registerUser(srv(), `asha${DOMAIN}`, 'tadka2026');
    expect(res.body.data.user).toMatchObject({ email: `asha${DOMAIN}`, signIn: { password: true, google: false }, profile: { displayName: `Chef asha` } });
    expect(res.body.data.user.id).toMatch(/^\d+$/);
    const [u] = await q('SELECT * FROM users WHERE email = ?', [`asha${DOMAIN}`]);
    expect(u).toMatchObject({ full_name: 'Chef asha', auth_provider: 'local', is_active: 1, role: 'user' });
    expect(u.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await q('SELECT * FROM user_profiles WHERE user_id = ?', [u.user_id])).toHaveLength(1);
    const sessions = await q('SELECT * FROM user_sessions WHERE user_id = ?', [u.user_id]);
    expect(sessions).toHaveLength(1);
    const cookie = cookieValue(res, 'rm_session');
    expect(sessions[0].refresh_token_hash).toBe(sha256(cookie));
    expect(JSON.stringify(sessions)).not.toContain(cookie);
    expect((await request(srv()).get(api('/auth/me')).set(bearer(token)).expect(200)).body.data.email).toBe(`asha${DOMAIN}`);
  });

  it('duplicate email → 409 (UNIQUE index)', async () => {
    const b = await browserClient(srv());
    const r = await b.post('/auth/register', { email: `ASHA${DOMAIN}`, password: 'tadka2026', displayName: 'Again', acceptTerms: true }).expect(409);
    expect(r.body.error.code).toBe('EMAIL_TAKEN');
    expect(await q('SELECT user_id FROM users WHERE email = ?', [`asha${DOMAIN}`])).toHaveLength(1);
  });

  it('login works; wrong password, unknown email and a deactivated account all get the same error', async () => {
    const b = await browserClient(srv());
    const ok = await b.post('/auth/login', { email: `asha${DOMAIN}`, password: 'tadka2026' }).expect(200);
    b.setCsrf(ok.body.data.csrfToken); // the CSRF token rotates on sign-in
    const wrong = await b.post('/auth/login', { email: `asha${DOMAIN}`, password: 'nope12345' }).expect(401);
    const ghost = await b.post('/auth/login', { email: `ghost${DOMAIN}`, password: 'nope12345' }).expect(401);
    expect(wrong.body.error).toEqual(ghost.body.error);
    await registerUser(srv(), `off${DOMAIN}`, 'tadka2026');
    await db.query('UPDATE users SET is_active = 0 WHERE email = ?', [`off${DOMAIN}`]);
    expect((await b.post('/auth/login', { email: `off${DOMAIN}`, password: 'tadka2026' }).expect(401)).body.error).toEqual(wrong.body.error);
  });

  it('reload: csrf → refresh restores the session from user_sessions and rotates it', async () => {
    const { browser: b, res } = await registerUser(srv(), `rot${DOMAIN}`);
    const old = cookieValue(res, 'rm_session');
    const r = await b.post('/auth/refresh').expect(200);
    expect(r.body.data.user.email).toBe(`rot${DOMAIN}`);
    const [oldRow] = await q('SELECT * FROM user_sessions WHERE refresh_token_hash = ?', [sha256(old)]);
    expect(oldRow.revoked_at).not.toBeNull();
    expect(oldRow.expires_at <= oldRow.revoked_at).toBe(true); // rotated = ended at the moment of rotation
    const [newRow] = await q('SELECT * FROM user_sessions WHERE refresh_token_hash = ?', [sha256(cookieValue(r, 'rm_session'))]);
    expect(newRow.revoked_at).toBeNull();
    // the new access token is bound to the new row
    await request(srv()).get(api('/auth/me')).set(bearer(r.body.data.accessToken)).expect(200);
    // replaying the rotated cookie: a race at first, then theft → every session of the user ends
    const replay = () => request(srv()).post(api('/auth/refresh')).set('Cookie', [`rm_session=${old}`, `rm_csrf=${b.csrf}`]).set('X-CSRF-Token', b.csrf);
    expect((await replay().expect(401)).body.error.code).toBe('REFRESH_RACE');
    shiftClock(20_000);
    expect((await replay().expect(401)).body.error.code).toBe('REFRESH_TOKEN_REUSED');
    expect(await q('SELECT * FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL', [newRow.user_id])).toHaveLength(0);
  });

  it('logout sets revoked_at (keeping the expiry) and the access token stops at once', async () => {
    const { browser: b, token, res } = await registerUser(srv(), `out${DOMAIN}`);
    await b.post('/auth/logout').expect(204);
    const [row] = await q('SELECT * FROM user_sessions WHERE refresh_token_hash = ?', [sha256(cookieValue(res, 'rm_session'))]);
    expect(row.revoked_at).not.toBeNull();
    expect(row.expires_at > row.revoked_at).toBe(true);
    expect((await request(srv()).get(api('/auth/me')).set(bearer(token)).expect(401)).body.error.code).toBe('SESSION_ENDED');
  });

  it('profile: name, allergies, diets, language and Mate persona go to the right tables', async () => {
    const { token, user } = await registerUser(srv(), `prof${DOMAIN}`);
    const [{ allergen_id: sesame }] = await q('SELECT allergen_id FROM allergens WHERE allergen_name = ?', ['Sesame']);
    await db.query('INSERT INTO user_allergies (user_id, allergen_id) VALUES (?, ?)', [user.id, sesame]); // something the app doesn't list
    const r = await request(srv()).patch(api('/users/me')).set(bearer(token))
      .send({ displayName: 'Priya Rao', allergies: ['dairy', 'nuts'], diets: ['vegetarian', 'gluten-free'], preferredLanguage: 'hinglish', matePersona: 'chatpata' }).expect(200);
    expect(r.body.data.profile).toMatchObject({ displayName: 'Priya Rao', allergies: expect.arrayContaining(['dairy', 'nuts']), diets: expect.arrayContaining(['vegetarian', 'gluten-free']), preferredLanguage: 'hinglish', matePersona: 'chatpata' });
    expect((await q('SELECT full_name FROM users WHERE user_id = ?', [user.id]))[0].full_name).toBe('Priya Rao');
    const names = (await q('SELECT a.allergen_name n FROM user_allergies ua JOIN allergens a USING (allergen_id) WHERE ua.user_id = ? ORDER BY n', [user.id])).map((x) => x.n);
    expect(names).toEqual(['Milk', 'Sesame', 'Tree Nuts']); // "dairy" → Milk, "nuts" → Tree Nuts; Sesame untouched
    expect((await q('SELECT t.tag_name n FROM user_dietary_preferences ud JOIN dietary_tags t USING (tag_id) WHERE ud.user_id = ? ORDER BY n', [user.id])).map((x) => x.n)).toEqual(['Gluten Free', 'Vegetarian']);
    expect((await q('SELECT preferred_language FROM user_profiles WHERE user_id = ?', [user.id]))[0].preferred_language).toBe('hinglish');
    expect((await q("SELECT JSON_UNQUOTE(JSON_EXTRACT(preference_settings, '$.matePersona')) p FROM user_preferences WHERE user_id = ?", [user.id]))[0].p).toBe('chatpata');
    // removing one keeps the rest (and still never touches Sesame)
    await request(srv()).patch(api('/users/me')).set(bearer(token)).send({ allergies: ['nuts'] }).expect(200);
    expect((await q('SELECT a.allergen_name n FROM user_allergies ua JOIN allergens a USING (allergen_id) WHERE ua.user_id = ? ORDER BY n', [user.id])).map((x) => x.n)).toEqual(['Sesame', 'Tree Nuts']);
    // something the reference table doesn't have → 422, nothing changed
    const bad = await request(srv()).patch(api('/users/me')).set(bearer(token)).send({ allergies: ['nuts', 'shellfish'], displayName: 'Changed?' }).expect(422);
    expect(bad.body.error).toMatchObject({ code: 'PROFILE_OPTION_NOT_IN_DATABASE', details: { missing: ['shellfish'] } });
    expect((await q('SELECT full_name FROM users WHERE user_id = ?', [user.id]))[0].full_name).toBe('Priya Rao'); // transaction rolled back
  });

  it('without a reset-token table, password reset is honestly unavailable', async () => {
    expect((await request(srv()).get(api('/auth/providers'))).body.data.passwordReset).toBe(false);
  });
});

const dr = enabled && env.MYSQL_TEST_RESETS_TABLE ? describe : describe.skip;
dr('MySQL password reset (with the optional reset table)', () => {
  let app: INestApplication;
  const srv = () => app.getHttpServer();
  const outbox: OutgoingMail[] = [];
  const fakeMail = { configured: true, assertConfigured: () => undefined, send: async (m: OutgoingMail) => { outbox.push(m); } }; // TEST-ONLY
  beforeAll(async () => {
    await openDb();
    app = await bootApp({ ...dbEnv(), DB_PASSWORD_RESETS_TABLE: env.MYSQL_TEST_RESETS_TABLE! }, (b) => b.overrideProvider(MailService).useValue(fakeMail));
  });
  afterAll(async () => { await app?.close(); await closePool(); await db?.end(); });

  it('stores only the hash, works once, signs out everywhere', async () => {
    const t = env.MYSQL_TEST_RESETS_TABLE!;
    const { token: access, user } = await registerUser(srv(), `reset${DOMAIN}`, 'oldpass123');
    expect((await request(srv()).get(api('/auth/providers'))).body.data.passwordReset).toBe(true);
    const b = await browserClient(srv());
    await b.post('/auth/password/forgot', { email: `reset${DOMAIN}` }).expect(202);
    const token = decodeURIComponent(/token=([^\s"&]+)/.exec(outbox[0].text)![1]);
    const rows = await q(`SELECT * FROM \`${t}\` WHERE user_id = ?`, [user.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(sha256(token));
    await b.post('/auth/password/reset', { token, password: 'newpass456' }).expect(200);
    expect((await q(`SELECT used_at FROM \`${t}\` WHERE user_id = ?`, [user.id]))[0].used_at).not.toBeNull();
    expect((await request(srv()).get(api('/auth/me')).set(bearer(access)).expect(401)).body.error.code).toBe('SESSION_ENDED');
    expect((await b.post('/auth/password/reset', { token, password: 'again7890' }).expect(400)).body.error.code).toBe('RESET_TOKEN_INVALID');
    await b.post('/auth/login', { email: `reset${DOMAIN}`, password: 'newpass456' }).expect(200);
  });
});
