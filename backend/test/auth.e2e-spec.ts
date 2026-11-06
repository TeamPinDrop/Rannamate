import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailService, type OutgoingMail } from '../src/integrations/mail/mail.service';
import { GoogleOAuthClient, GoogleOAuthError, type GoogleIdentity } from '../src/integrations/google/google-oauth.client';
import { Errors } from '../src/common/errors';
import { bootApp, browserClient, registerUser } from './helpers';

const api = (p: string) => `/api/v1${p}`;
const cookies = (r: request.Response): string[] => ([] as string[]).concat(r.headers['set-cookie'] ?? []);
const cookie = (r: request.Response, name: string) => cookies(r).find((c) => c.startsWith(`${name}=`));
const cookieValue = (r: request.Response, name: string) => decodeURIComponent(cookie(r, name)!.split(';')[0].split('=').slice(1).join('='));
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
/** fake only Date — supertest keeps its real timers */
const shiftClock = (ms: number) => jest.useFakeTimers({ now: Date.now() + ms, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'clearImmediate', 'queueMicrotask', 'performance', 'hrtime'] });

describe('auth — cookie sessions & CSRF (email not configured, Google not configured)', () => {
  let app: INestApplication;
  const srv = () => app.getHttpServer();
  beforeAll(async () => { app = await bootApp({ DATA_SOURCE: 'memory' }); });
  afterAll(async () => { await app.close(); });
  afterEach(() => jest.useRealTimers());

  it('GET /auth/csrf sets an httpOnly CSRF cookie scoped to /api/v1/auth', async () => {
    const r = await request(srv()).get(api('/auth/csrf')).expect(200);
    expect(r.body.data).toEqual({ csrfToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), hasSession: false });
    const c = cookie(r, 'rm_csrf')!;
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/Path=\/api\/v1\/auth/);
    expect(c).toMatch(/SameSite=Lax/i);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('reports which sign-in options exist (no fake Google button, no fake email)', async () => {
    const r = await request(srv()).get(api('/auth/providers')).expect(200);
    expect(r.body.data).toEqual({ password: true, google: false, passwordReset: false });
  });

  it('registration: session only in an httpOnly cookie, no refresh token or hash in the body', async () => {
    const b = await browserClient(srv());
    const r = await b.post('/auth/register', { email: ' Asha@Example.com ', password: 'tadka2026', displayName: '  Asha   Sen ', acceptTerms: true }).expect(201);
    expect(r.body.data.user).toMatchObject({ email: 'asha@example.com', signIn: { password: true, google: false }, profile: { displayName: 'Asha Sen' } });
    expect(r.body.data.accessToken).toEqual(expect.any(String));
    expect(r.body.data).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2[aby]\$|tokens/);
    const s = cookie(r, 'rm_session')!;
    expect(s).toMatch(/HttpOnly/i);
    expect(s).toMatch(/Path=\/api\/v1\/auth/);
    expect(s).toMatch(/Max-Age=\d+/); // new accounts stay signed in
    expect(cookieValue(r, 'rm_session')).not.toBe(r.body.data.accessToken);
    expect(r.body.data.csrfToken).not.toBe(b.csrf); // CSRF token rotates on sign-in
  });

  it('duplicate email → 409 EMAIL_TAKEN', async () => {
    const b = await browserClient(srv());
    const r = await b.post('/auth/register', { email: 'asha@example.com', password: 'tadka2026', displayName: 'Asha', acceptTerms: true }).expect(409);
    expect(r.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates input: email format, password strength, name, terms, unknown fields, empty form', async () => {
    const b = await browserClient(srv());
    const bad = await b.post('/auth/register', { email: 'nope', password: 'short', displayName: '', acceptTerms: false }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    const msg = JSON.stringify(bad.body.error.details);
    expect(msg).toMatch(/valid email/); expect(msg).toMatch(/at least 8/); expect(msg).toMatch(/accept the Terms/);
    await b.post('/auth/register', { email: 'x@y.com', password: 'onlyletters', displayName: 'Xy', acceptTerms: true }).expect(400);
    await b.post('/auth/register', { email: 'x@y.com', password: 'longenough1', displayName: 'Xy', acceptTerms: true, role: 'admin' }).expect(400);
    expect((await b.post('/auth/login', {}).expect(400)).body.error.code).toBe('VALIDATION_FAILED');
    expect((await b.post('/auth/login', { email: 'not-an-email', password: 'x' }).expect(400)).body.error.code).toBe('VALIDATION_FAILED');
  });

  it('CSRF: missing token, wrong token or a foreign Origin is refused', async () => {
    const body = { email: 'asha@example.com', password: 'tadka2026' };
    const r1 = await request(srv()).post(api('/auth/login')).send(body).expect(403);
    expect(r1.body.error.code).toBe('CSRF_FAILED');
    const b = await browserClient(srv());
    await b.agent.post(api('/auth/login')).set('X-CSRF-Token', 'x'.repeat(43)).send(body).expect(403);
    await b.agent.post(api('/auth/login')).set('X-CSRF-Token', b.csrf).set('Origin', 'https://evil.example').send(body).expect(403);
    await b.agent.post(api('/auth/login')).set('X-CSRF-Token', b.csrf).set('Origin', 'http://localhost:3000').send(body).expect(200);
  });

  it('login: generic error for wrong password and unknown email', async () => {
    const b = await browserClient(srv());
    const wrong = await b.post('/auth/login', { email: 'asha@example.com', password: 'wrongpass1' }).expect(401);
    const nobody = await b.post('/auth/login', { email: 'ghost@example.com', password: 'wrongpass1' }).expect(401);
    expect(wrong.body.error).toEqual(nobody.body.error);
    expect(wrong.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' });
    expect(cookie(wrong, 'rm_session')).toBeUndefined();
  });

  it('remember me → persistent cookie; otherwise a browser-session cookie', async () => {
    const b = await browserClient(srv());
    const keep = await b.post('/auth/login', { email: 'asha@example.com', password: 'tadka2026', remember: true }).expect(200);
    expect(cookie(keep, 'rm_session')).toMatch(/Max-Age=2592000/); // 30 days
    const b2 = await browserClient(srv());
    const once = await b2.post('/auth/login', { email: 'asha@example.com', password: 'tadka2026', remember: false }).expect(200);
    expect(cookie(once, 'rm_session')).not.toMatch(/Max-Age|Expires/i);
  });

  it('session survives a page reload: csrf → refresh restores the user from the cookie alone', async () => {
    const { browser: b } = await registerUser(srv(), 'reload@example.com');
    const c = await b.agent.get(api('/auth/csrf')).expect(200);
    expect(c.body.data.hasSession).toBe(true);
    const r = await b.post('/auth/refresh').expect(200);
    expect(r.body.data.user.email).toBe('reload@example.com');
    const me = await request(srv()).get(api('/auth/me')).set(bearer(r.body.data.accessToken)).expect(200);
    expect(me.body.data.email).toBe('reload@example.com');
  });

  it('refresh without a cookie → 401 NO_SESSION', async () => {
    const b = await browserClient(srv());
    expect((await b.post('/auth/refresh').expect(401)).body.error.code).toBe('NO_SESSION');
  });

  it('rotation: a racing tab gets REFRESH_RACE (nothing revoked); a stale cookie replayed later revokes everything', async () => {
    const { browser: b, res } = await registerUser(srv(), 'rotate@example.com');
    const old = cookieValue(res, 'rm_session');
    const r1 = await b.post('/auth/refresh').expect(200);
    expect(cookieValue(r1, 'rm_session')).not.toBe(old);
    const replay = () => request(srv()).post(api('/auth/refresh')).set('Cookie', [`rm_session=${old}`, `rm_csrf=${b.csrf}`]).set('X-CSRF-Token', b.csrf);
    expect((await replay().expect(401)).body.error.code).toBe('REFRESH_RACE');
    await b.post('/auth/refresh').expect(200); // the current cookie still works
    shiftClock(20_000);
    expect((await replay().expect(401)).body.error.code).toBe('REFRESH_TOKEN_REUSED');
    expect((await b.post('/auth/refresh').expect(401)).body.error.code).toBe('SESSION_ENDED'); // whole family revoked
  });

  it('logout: clears the cookie, ends the session, and the access token stops working immediately', async () => {
    const { browser: b, token } = await registerUser(srv(), 'logout@example.com');
    await request(srv()).get(api('/auth/me')).set(bearer(token)).expect(200);
    const out = await b.post('/auth/logout').expect(204);
    expect(cookie(out, 'rm_session')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await b.post('/auth/refresh').expect(401)).body.error.code).toBe('NO_SESSION');
    expect((await request(srv()).get(api('/auth/me')).set(bearer(token)).expect(401)).body.error.code).toBe('SESSION_ENDED');
  });

  it('protected routes need a valid access token; a refresh token is not one', async () => {
    expect((await request(srv()).get(api('/auth/me')).expect(401)).body.error.code).toBe('UNAUTHORIZED');
    expect((await request(srv()).get(api('/users/me')).expect(401)).body.error.code).toBe('UNAUTHORIZED');
    expect((await request(srv()).get(api('/auth/me')).set(bearer('not.a.jwt')).expect(401)).body.error.code).toBe('INVALID_TOKEN');
    const { res } = await registerUser(srv(), 'swap@example.com');
    expect((await request(srv()).get(api('/auth/me')).set(bearer(cookieValue(res, 'rm_session'))).expect(401)).body.error.code).toBe('INVALID_TOKEN');
  });

  it('forgot password refuses honestly when email is not configured (same answer for every address)', async () => {
    const b = await browserClient(srv());
    const known = await b.post('/auth/password/forgot', { email: 'asha@example.com' }).expect(503);
    const unknown = await b.post('/auth/password/forgot', { email: 'ghost@example.com' }).expect(503);
    expect(known.body.error.code).toBe('EMAIL_NOT_CONFIGURED');
    expect(known.body.error).toEqual(unknown.body.error);
  });

  it('Google endpoints say not configured', async () => {
    const r = await request(srv()).get(api('/auth/google/start')).expect(404);
    expect(r.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
  });
});

describe('auth — password reset with an email service', () => {
  let app: INestApplication;
  const srv = () => app.getHttpServer();
  const outbox: OutgoingMail[] = [];
  let failNext = false;
  // TEST-ONLY stand-in for the SMTP sender: records what would be delivered
  const fakeMail = {
    configured: true,
    assertConfigured: () => undefined,
    send: async (m: OutgoingMail) => { if (failNext) { failNext = false; throw Errors.badGateway('EMAIL_DELIVERY_FAILED', 'x'); } outbox.push(m); },
  };
  const tokenFrom = (m: OutgoingMail) => decodeURIComponent(/reset-password\?token=([^"\s&]+)/.exec(m.text)![1]);

  beforeAll(async () => {
    app = await bootApp({ DATA_SOURCE: 'memory', APP_URL: 'http://localhost:3000' }, (b) => b.overrideProvider(MailService).useValue(fakeMail));
    await registerUser(srv(), 'mira@example.com', 'oldpass123');
  });
  afterAll(async () => { await app.close(); });
  afterEach(() => jest.useRealTimers());

  it('providers shows password reset is available', async () => {
    expect((await request(srv()).get(api('/auth/providers'))).body.data.passwordReset).toBe(true);
  });

  it('same 202 answer for known and unknown emails; only the real account gets mail', async () => {
    const b = await browserClient(srv());
    const unknown = await b.post('/auth/password/forgot', { email: 'nobody@example.com' }).expect(202);
    expect(outbox).toHaveLength(0);
    const known = await b.post('/auth/password/forgot', { email: 'Mira@Example.com' }).expect(202);
    expect(known.body.data).toEqual(unknown.body.data);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('mira@example.com');
    expect(outbox[0].text).toContain('http://localhost:3000/reset-password?token=');
    expect(outbox[0].html).toContain('Choose a new password');
  });

  it('a second request within a minute does not send another email', async () => {
    const b = await browserClient(srv());
    await b.post('/auth/password/forgot', { email: 'mira@example.com' }).expect(202);
    expect(outbox).toHaveLength(1);
  });

  it('reset: weak password refused, then success signs out every device; the link is single-use', async () => {
    const token = tokenFrom(outbox[0]);
    const { browser: other, token: access } = { ...(await (async () => { const b = await browserClient(srv()); const r = await b.post('/auth/login', { email: 'mira@example.com', password: 'oldpass123' }).expect(200); b.setCsrf(r.body.data.csrfToken); return { browser: b, token: r.body.data.accessToken as string }; })()) };
    expect((await request(srv()).post(api('/auth/password/reset/check')).send({ token })).body.data).toEqual({ valid: true });
    const b = await browserClient(srv());
    await b.post('/auth/password/reset', { token, password: 'weak' }).expect(400);
    await b.post('/auth/password/reset', { token, password: 'newpass456' }).expect(200);
    expect((await request(srv()).get(api('/auth/me')).set(bearer(access)).expect(401)).body.error.code).toBe('SESSION_ENDED');
    await other.post('/auth/refresh').expect(401);
    expect((await b.post('/auth/password/reset', { token, password: 'another789' }).expect(400)).body.error.code).toBe('RESET_TOKEN_INVALID');
    expect((await request(srv()).post(api('/auth/password/reset/check')).send({ token })).body.data).toEqual({ valid: false });
    await b.post('/auth/login', { email: 'mira@example.com', password: 'oldpass123' }).expect(401);
    await b.post('/auth/login', { email: 'mira@example.com', password: 'newpass456' }).expect(200);
  });

  it('an expired link is refused; requesting a new one invalidates the old one', async () => {
    shiftClock(61_000);
    const b = await browserClient(srv());
    await b.post('/auth/password/forgot', { email: 'mira@example.com' }).expect(202);
    const first = tokenFrom(outbox.at(-1)!);
    shiftClock(122_000);
    await b.post('/auth/password/forgot', { email: 'mira@example.com' }).expect(202);
    const second = tokenFrom(outbox.at(-1)!);
    expect((await b.post('/auth/password/reset', { token: first, password: 'newpass789' }).expect(400)).body.error.code).toBe('RESET_TOKEN_INVALID');
    shiftClock(122_000 + 31 * 60_000);
    expect((await b.post('/auth/password/reset', { token: second, password: 'newpass789' }).expect(400)).body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('a delivery failure is reported, never hidden', async () => {
    shiftClock(10 * 60_000 + 61 * 60_000);
    failNext = true;
    const b = await browserClient(srv());
    expect((await b.post('/auth/password/forgot', { email: 'mira@example.com' }).expect(502)).body.error.code).toBe('EMAIL_DELIVERY_FAILED');
  });

  it('a malformed token is a validation error', async () => {
    const b = await browserClient(srv());
    await b.post('/auth/password/reset', { token: 'short', password: 'newpass456' }).expect(400);
  });
});

describe('auth — Google sign-in (configured, with a test double for Google)', () => {
  let app: INestApplication;
  const srv = () => app.getHttpServer();
  let identity: GoogleIdentity | Error = { sub: 'g-1', email: 'gita@gmail.com', emailVerified: true, name: 'Gita' };
  const seen: { nonce?: string; verifier?: string } = {};
  // TEST-ONLY stand-in for Google's servers; the real client's token checks are unit-tested separately
  const fakeGoogle = {
    configured: true,
    authorizationUrl: (p: { state: string; nonce: string; codeChallenge: string }) => `https://accounts.google.test/auth?state=${p.state}&nonce=${p.nonce}&cc=${p.codeChallenge}`,
    exchange: async (code: string, verifier: string, nonce: string) => { seen.nonce = nonce; seen.verifier = verifier; if (identity instanceof Error) throw identity; return identity; },
  };

  beforeAll(async () => {
    app = await bootApp({ DATA_SOURCE: 'memory', APP_URL: 'http://localhost:3000' }, (b) => b.overrideProvider(GoogleOAuthClient).useValue(fakeGoogle));
    await registerUser(srv(), 'pass@example.com', 'secret123');
  });
  afterAll(async () => { await app.close(); });

  async function start(agent: ReturnType<typeof request.agent>, query = 'returnTo=%2Fprofile') {
    const r = await agent.get(api(`/auth/google/start?${query}`)).expect(302);
    const loc = new URL(r.headers.location);
    expect(loc.host).toBe('accounts.google.test');
    expect(cookie(r, 'rm_oauth')).toMatch(/HttpOnly/i);
    return { state: loc.searchParams.get('state')!, nonce: loc.searchParams.get('nonce')! };
  }

  it('providers shows Google', async () => {
    expect((await request(srv()).get(api('/auth/providers'))).body.data.google).toBe(true);
  });

  it('new Google user: account created, session cookie set, back to the app with returnTo', async () => {
    const b = await browserClient(srv());
    const { state, nonce } = await start(b.agent);
    const cb = await b.agent.get(api(`/auth/google/callback?code=abc&state=${state}`)).expect(302);
    expect(seen.nonce).toBe(nonce);
    expect(cb.headers.location).toBe('http://localhost:3000/auth/callback?returnTo=%2Fprofile');
    expect(cookie(cb, 'rm_session')).toMatch(/HttpOnly/i);
    const c = await b.agent.get(api('/auth/csrf')).expect(200);
    b.setCsrf(c.body.data.csrfToken);
    const r = await b.post('/auth/refresh').expect(200);
    expect(r.body.data.user).toMatchObject({ email: 'gita@gmail.com', signIn: { password: false, google: true }, profile: { displayName: 'Gita' } });
    // no password exists, so password sign-in fails the generic way
    expect((await b.post('/auth/login', { email: 'gita@gmail.com', password: 'anything1' }).expect(401)).body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('state mismatch or a missing state cookie is refused', async () => {
    const b = await browserClient(srv());
    await start(b.agent);
    const bad = await b.agent.get(api('/auth/google/callback?code=abc&state=forged')).expect(302);
    expect(bad.headers.location).toContain('/sign-in?error=GOOGLE_STATE_INVALID');
    expect(cookie(bad, 'rm_session')).toBeUndefined();
    const none = await request(srv()).get(api('/auth/google/callback?code=abc&state=x')).expect(302);
    expect(none.headers.location).toContain('error=GOOGLE_STATE_INVALID');
  });

  it('cancel and Google errors go back to sign-in with a code', async () => {
    const b = await browserClient(srv());
    const { state } = await start(b.agent);
    expect((await b.agent.get(api(`/auth/google/callback?error=access_denied&state=${state}`))).headers.location).toContain('error=GOOGLE_CANCELLED');
    identity = new GoogleOAuthError('GOOGLE_EMAIL_UNVERIFIED', 'x');
    const s2 = await start(b.agent);
    expect((await b.agent.get(api(`/auth/google/callback?code=c&state=${s2.state}`))).headers.location).toContain('error=GOOGLE_EMAIL_UNVERIFIED');
  });

  it('an email that already has a password account is NOT taken over', async () => {
    identity = { sub: 'g-2', email: 'pass@example.com', emailVerified: true, name: 'Imposter' };
    const b = await browserClient(srv());
    const { state } = await start(b.agent);
    const cb = await b.agent.get(api(`/auth/google/callback?code=c&state=${state}`)).expect(302);
    expect(cb.headers.location).toBe('http://localhost:3000/sign-in?error=GOOGLE_EMAIL_EXISTS&returnTo=%2Fprofile');
    expect(cookie(cb, 'rm_session')).toBeUndefined();
  });

  it('the account owner can connect Google from their profile, then sign in with it', async () => {
    const b = await browserClient(srv());
    const login = await b.post('/auth/login', { email: 'pass@example.com', password: 'secret123' }).expect(200);
    const t = await request(srv()).post(api('/auth/google/link-ticket')).set(bearer(login.body.data.accessToken)).expect(200);
    const { state } = await start(b.agent, `link=${encodeURIComponent(t.body.data.ticket)}`);
    const cb = await b.agent.get(api(`/auth/google/callback?code=c&state=${state}`)).expect(302);
    expect(cb.headers.location).toBe('http://localhost:3000/profile?google=linked');
    const me = await request(srv()).get(api('/auth/me')).set(bearer(login.body.data.accessToken)).expect(200);
    expect(me.body.data.signIn).toEqual({ password: true, google: true });
    // now Google signs in to the same account
    const b2 = await browserClient(srv());
    const s2 = await start(b2.agent);
    const cb2 = await b2.agent.get(api(`/auth/google/callback?code=c&state=${s2.state}`)).expect(302);
    expect(cb2.headers.location).toContain('/auth/callback');
    const c = await b2.agent.get(api('/auth/csrf')); b2.setCsrf(c.body.data.csrfToken);
    expect((await b2.post('/auth/refresh').expect(200)).body.data.user.email).toBe('pass@example.com');
  });

  it('a Google account already linked to someone else cannot be linked again', async () => {
    const other = await registerUser(srv(), 'second@example.com');
    const t = await request(srv()).post(api('/auth/google/link-ticket')).set(bearer(other.token)).expect(200);
    const { state } = await start(other.browser.agent, `link=${encodeURIComponent(t.body.data.ticket)}`); // identity g-2 belongs to pass@
    const cb = await other.browser.agent.get(api(`/auth/google/callback?code=c&state=${state}`)).expect(302);
    expect(cb.headers.location).toBe('http://localhost:3000/profile?google=GOOGLE_ALREADY_LINKED');
  });

  it('open-redirect attempts in returnTo are neutralised; forged link tickets refused', async () => {
    identity = { sub: 'g-9', email: 'nine@gmail.com', emailVerified: true, name: 'Nine' };
    const b = await browserClient(srv());
    const { state } = await start(b.agent, 'returnTo=%2F%2Fevil.example');
    const cb = await b.agent.get(api(`/auth/google/callback?code=c&state=${state}`)).expect(302);
    expect(cb.headers.location).toBe('http://localhost:3000/auth/callback?returnTo=%2F');
    expect((await request(srv()).get(api('/auth/google/start?link=forged')).expect(401)).body.error.code).toBe('INVALID_LINK_TICKET');
  });
});
