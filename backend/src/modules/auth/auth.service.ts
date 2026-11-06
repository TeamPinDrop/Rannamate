import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { APP_CONFIG, ttlSeconds, type AppConfig } from '../../config/configuration';
import { AppError, Errors } from '../../common/errors';
import { REPO, type AuthSessionsRepository, type PasswordResetsRepository, type UsersRepository } from '../../database/repositories';
import type { User } from '../../domain/types';
import { GoogleOAuthClient, GoogleOAuthError } from '../../integrations/google/google-oauth.client';
import { MailService } from '../../integrations/mail/mail.service';
import { UsersService } from '../users/users.service';
import { resetEmail } from './reset-email';
import { safeReturnTo } from './auth.cookies';

const BCRYPT_COST = 12;
// compared against when the email doesn't exist, so response time doesn't reveal registered emails
let dummyHash: Promise<string> | null = null;
const dummy = () => (dummyHash ??= hash(randomUUID(), BCRYPT_COST));
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
/** a second refresh with the same cookie within this window is a race between tabs, not theft */
const REFRESH_RACE_MS = 15_000;
const RESET_RESEND_MS = 60_000;

/** what the controller turns into the httpOnly session cookie + JSON body */
export interface IssuedSession {
  accessToken: string; expiresIn: number;
  refreshToken: string; remember: boolean; refreshMaxAgeMs: number;
}

interface OAuthState { state: string; nonce: string; verifier: string; returnTo: string; remember: boolean; linkUserId?: string }

/**
 * Passwords: bcrypt (cost 12), never stored or returned in plain text.
 * Access tokens: short-lived JWT kept in the browser's memory only (JWT_SECRET).
 * Refresh tokens: JWT (JWT_REFRESH_SECRET) that only ever travels in an httpOnly cookie, bound to a
 * server-side session that stores only its SHA-256 hash. Each refresh rotates it; re-using an old one
 * (outside a short multi-tab race window) revokes every session of that user.
 * Password resets: random 256-bit token, only its SHA-256 stored, single use, expires.
 */
@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');
  constructor(
    @Inject(REPO.users) private readonly users: UsersRepository,
    @Inject(REPO.authSessions) private readonly sessions: AuthSessionsRepository,
    @Inject(REPO.passwordResets) private readonly resets: PasswordResetsRepository,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly jwt: JwtService,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
    private readonly google: GoogleOAuthClient,
  ) {}

  providers() {
    return { password: true, google: this.google.configured, passwordReset: this.mail.configured };
  }

  // ───────────────────────── email + password ─────────────────────────

  async register(email: string, password: string, displayName: string) {
    if (await this.users.findByEmail(email)) throw Errors.conflict('EMAIL_TAKEN', 'An account with this email already exists. Try signing in instead.');
    const user = await this.users.create({ email, passwordHash: await hash(password, BCRYPT_COST), displayName });
    return { user: await this.usersService.me(user.id), session: await this.issue(user, true) };
  }

  async login(email: string, password: string, remember: boolean) {
    const user = await this.users.findByEmail(email);
    // Google-only accounts (no password) fail exactly like a wrong password
    const ok = await compare(password, user?.passwordHash ?? (await dummy()));
    if (!user || !user.passwordHash || !ok) throw Errors.unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password.');
    return { user: await this.usersService.me(user.id), session: await this.issue(user, remember) };
  }

  async refresh(refreshToken: string | null) {
    if (!refreshToken) throw Errors.unauthorized('NO_SESSION', 'Please sign in.');
    const p = await this.verifyRefresh(refreshToken);
    const session = await this.sessions.findById(p.jti);
    if (!session || session.userId !== p.sub || session.tokenHash !== sha256(refreshToken)) throw Errors.unauthorized('INVALID_REFRESH_TOKEN', 'Please sign in again.');
    if (session.revokedAt) {
      if (session.replacedBy && Date.now() - new Date(session.revokedAt).getTime() < REFRESH_RACE_MS) {
        // another tab rotated this cookie a moment ago; the browser already holds the new one
        throw Errors.unauthorized('REFRESH_RACE', 'Retry with the current session.');
      }
      if (session.replacedBy) {
        // a rotated-out token was used again: assume it was stolen and end every session
        await this.sessions.revokeAllForUser(session.userId);
        throw Errors.unauthorized('REFRESH_TOKEN_REUSED', 'This sign-in was ended for your security. Please sign in again.');
      }
      throw Errors.unauthorized('SESSION_ENDED', 'You were signed out. Please sign in again.');
    }
    if (new Date(session.expiresAt) < new Date()) throw Errors.unauthorized('REFRESH_TOKEN_EXPIRED', 'Your session expired. Please sign in again.');
    const user = await this.users.findById(session.userId);
    if (!user) throw Errors.unauthorized('INVALID_REFRESH_TOKEN', 'Please sign in again.');
    const issued = await this.issue(user, p.rem === true, (newId) => this.sessions.revoke(session.id, newId));
    return { user: await this.usersService.me(user.id), session: issued };
  }

  /** Ends the session the cookie belongs to. Always succeeds (no information leak). */
  async logout(refreshToken: string | null) {
    if (!refreshToken) return;
    try {
      const p = await this.verifyRefresh(refreshToken);
      const s = await this.sessions.findById(p.jti);
      if (s && s.tokenHash === sha256(refreshToken)) await this.sessions.revoke(s.id);
    } catch { /* already invalid */ }
  }

  // ───────────────────────── password reset ─────────────────────────

  /**
   * Same answer whether or not the email has an account (no enumeration). Refuses honestly when email
   * isn't configured, and never claims a message was sent unless the SMTP server accepted it.
   */
  async forgotPassword(email: string) {
    this.mail.assertConfigured();
    const user = await this.users.findByEmail(email);
    if (user) {
      const last = await this.resets.latestForUser(user.id);
      const recent = last && !last.usedAt && Date.now() - new Date(last.createdAt).getTime() < RESET_RESEND_MS;
      if (!recent) {
        await this.resets.invalidateAllForUser(user.id);
        const token = randomBytes(32).toString('base64url');
        const ttl = this.cfg.passwordResetTtlMinutes;
        await this.resets.create({ id: randomUUID(), userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttl * 60_000).toISOString() });
        const link = `${this.cfg.web.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const profile = await this.users.getProfile(user.id);
        await this.mail.send({ to: user.email, ...resetEmail({ name: profile?.displayName ?? '', link, minutes: ttl }) });
        this.log.log(`password reset email sent (user ${user.id})`);
      }
    }
    return { message: 'If an account exists for that email, a reset link is on its way. It expires in ' + this.cfg.passwordResetTtlMinutes + ' minutes.' };
  }

  async checkResetToken(token: string) {
    const r = await this.resets.findByTokenHash(sha256(token));
    return { valid: !!r && !r.usedAt && new Date(r.expiresAt) > new Date() };
  }

  async resetPassword(token: string, password: string) {
    const r = await this.resets.findByTokenHash(sha256(token));
    if (!r || r.usedAt || new Date(r.expiresAt) <= new Date()) throw Errors.badRequest('RESET_TOKEN_INVALID', 'This reset link has expired or was already used. Request a new one.');
    if (!(await this.resets.consume(r.id))) throw Errors.badRequest('RESET_TOKEN_INVALID', 'This reset link has expired or was already used. Request a new one.');
    const user = await this.users.findById(r.userId);
    if (!user) throw Errors.badRequest('RESET_TOKEN_INVALID', 'This reset link is no longer valid.');
    await this.users.setPasswordHash(user.id, await hash(password, BCRYPT_COST));
    await this.resets.invalidateAllForUser(user.id);
    await this.sessions.revokeAllForUser(user.id); // a reset signs out every device
    return { email: user.email };
  }

  // ───────────────────────── Google ─────────────────────────

  private assertGoogle() {
    if (!this.google.configured) throw new AppError(404, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not set up on this server.');
  }

  /** short-lived ticket so a signed-in user can link Google through a top-level redirect */
  async googleLinkTicket(userId: string) {
    this.assertGoogle();
    return { ticket: await this.jwt.signAsync({ sub: userId, typ: 'google-link' }, { secret: this.cfg.jwt.secret, expiresIn: 120, algorithm: 'HS256' }) };
  }

  async googleStart(returnTo: unknown, remember: boolean, linkTicket?: string) {
    this.assertGoogle();
    let linkUserId: string | undefined;
    if (linkTicket) {
      try {
        const p = await this.jwt.verifyAsync<{ sub: string; typ: string }>(linkTicket, { secret: this.cfg.jwt.secret, algorithms: ['HS256'] });
        if (p.typ !== 'google-link') throw new Error();
        linkUserId = p.sub;
      } catch { throw Errors.unauthorized('INVALID_LINK_TICKET', 'Please try connecting Google again.'); }
    }
    const verifier = randomBytes(32).toString('base64url');
    const st: OAuthState = { state: randomBytes(24).toString('base64url'), nonce: randomBytes(24).toString('base64url'), verifier, returnTo: safeReturnTo(returnTo), remember, linkUserId };
    const cookie = await this.jwt.signAsync({ ...st, typ: 'oauth' }, { secret: this.cfg.jwt.refreshSecret, expiresIn: 600, algorithm: 'HS256' });
    const url = this.google.authorizationUrl({ state: st.state, nonce: st.nonce, codeChallenge: createHash('sha256').update(verifier).digest('base64url') });
    return { url, cookie };
  }

  /**
   * Returns where to send the browser next. Account rules:
   *  - a Google account already linked → sign in to that user
   *  - linking from the profile → attach to the signed-in user (refused if that Google account belongs to someone else)
   *  - new email → create a passwordless account
   *  - email already registered with a password but not linked → refused (no silent takeover);
   *    the owner signs in with their password and connects Google from their profile.
   */
  async googleCallback(q: { code?: string; state?: string; error?: string }, cookie: string | null): Promise<{ redirect: string; session?: IssuedSession }> {
    const fail = (code: string, returnTo = '/') => ({ redirect: `${this.cfg.web.appUrl}/sign-in?error=${code}${returnTo !== '/' ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}` });
    if (!this.google.configured) return fail('GOOGLE_NOT_CONFIGURED');
    let st: OAuthState;
    try {
      st = await this.jwt.verifyAsync<OAuthState & { typ: string }>(cookie ?? '', { secret: this.cfg.jwt.refreshSecret, algorithms: ['HS256'] });
      if ((st as OAuthState & { typ: string }).typ !== 'oauth') throw new Error();
    } catch { return fail('GOOGLE_STATE_INVALID'); }
    if (!q.state || q.state !== st.state) return fail('GOOGLE_STATE_INVALID', st.returnTo);
    if (q.error || !q.code) return fail(q.error === 'access_denied' ? 'GOOGLE_CANCELLED' : 'GOOGLE_FAILED', st.returnTo);

    let id;
    try { id = await this.google.exchange(q.code, st.verifier, st.nonce); } catch (e) {
      return fail(e instanceof GoogleOAuthError ? e.code : 'GOOGLE_FAILED', st.returnTo);
    }

    const linked = await this.users.findByGoogleSub(id.sub);
    if (st.linkUserId) {
      if (linked && linked.id !== st.linkUserId) return { redirect: `${this.cfg.web.appUrl}/profile?google=GOOGLE_ALREADY_LINKED` };
      const me = await this.users.findById(st.linkUserId);
      if (!me) return fail('GOOGLE_FAILED');
      if (me.googleSub && me.googleSub !== id.sub) return { redirect: `${this.cfg.web.appUrl}/profile?google=GOOGLE_OTHER_ACCOUNT_LINKED` };
      await this.users.linkGoogle(me.id, id.sub);
      return { redirect: `${this.cfg.web.appUrl}/profile?google=linked` };
    }

    let user: User | null = linked;
    if (!user) {
      const byEmail = await this.users.findByEmail(id.email);
      if (byEmail) return fail('GOOGLE_EMAIL_EXISTS', st.returnTo);
      user = await this.users.create({ email: id.email, passwordHash: null, displayName: id.name, googleSub: id.sub });
    }
    const session = await this.issue(user, st.remember);
    return { redirect: `${this.cfg.web.appUrl}/auth/callback?returnTo=${encodeURIComponent(st.returnTo)}`, session };
  }

  // ───────────────────────── internals ─────────────────────────

  private async verifyRefresh(token: string) {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; jti: string; typ: string; rem?: boolean }>(token, { secret: this.cfg.jwt.refreshSecret, algorithms: ['HS256'] });
      if (p.typ !== 'refresh' || !p.jti) throw new Error();
      return p;
    } catch {
      throw Errors.unauthorized('INVALID_REFRESH_TOKEN', 'Please sign in again.');
    }
  }

  private async issue(user: User, remember: boolean, beforeCreate?: (newSessionId: string) => Promise<void>): Promise<IssuedSession> {
    const sid = randomUUID();
    const accessTtl = ttlSeconds(this.cfg.jwt.accessTtl);
    const refreshTtl = ttlSeconds(remember ? this.cfg.jwt.refreshTtl : this.cfg.jwt.sessionTtl);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, sid, typ: 'access' }, { secret: this.cfg.jwt.secret, expiresIn: accessTtl, algorithm: 'HS256' });
    const refreshToken = await this.jwt.signAsync({ sub: user.id, typ: 'refresh', rem: remember }, { secret: this.cfg.jwt.refreshSecret, expiresIn: refreshTtl, jwtid: sid, algorithm: 'HS256' });
    await beforeCreate?.(sid);
    await this.sessions.create({ id: sid, userId: user.id, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + refreshTtl * 1000).toISOString(), replacedBy: null });
    return { accessToken, expiresIn: accessTtl, refreshToken, remember, refreshMaxAgeMs: refreshTtl * 1000 };
  }
}
