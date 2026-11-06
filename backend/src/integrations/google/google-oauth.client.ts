import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

export interface GoogleIdentity { sub: string; email: string; emailVerified: boolean; name: string }

export class GoogleOAuthError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/**
 * Google sign-in (OpenID Connect, authorization-code flow with PKCE).
 * The code is exchanged server-to-server with the client secret, and the ID token that comes back
 * from Google's token endpoint over TLS is then checked: issuer, audience (our client id), expiry,
 * the nonce we generated, and a verified email (OpenID Connect Core §3.1.3.7).
 */
@Injectable()
export class GoogleOAuthClient {
  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  get configured() { return this.cfg.google.configured; }

  authorizationUrl(p: { state: string; nonce: string; codeChallenge: string }) {
    const q = new URLSearchParams({
      client_id: this.cfg.google.clientId, redirect_uri: this.cfg.google.redirectUri, response_type: 'code',
      scope: 'openid email profile', state: p.state, nonce: p.nonce, code_challenge: p.codeChallenge, code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `${AUTH_URL}?${q}`;
  }

  async exchange(code: string, codeVerifier: string, nonce: string): Promise<GoogleIdentity> {
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: this.cfg.google.clientId, client_secret: this.cfg.google.clientSecret, redirect_uri: this.cfg.google.redirectUri, grant_type: 'authorization_code', code_verifier: codeVerifier }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new GoogleOAuthError('GOOGLE_UNREACHABLE', "Couldn't reach Google. Please try again.");
    }
    const body = (await res.json().catch(() => ({}))) as { id_token?: string };
    if (!res.ok || !body.id_token) throw new GoogleOAuthError('GOOGLE_EXCHANGE_FAILED', 'Google sign-in could not be completed. Please try again.');
    return this.validateIdToken(body.id_token, nonce);
  }

  validateIdToken(idToken: string, nonce: string): GoogleIdentity {
    const parts = idToken.split('.');
    let c: Record<string, unknown>;
    try { c = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')); } catch { throw new GoogleOAuthError('GOOGLE_INVALID_TOKEN', 'Google returned an invalid response.'); }
    const now = Math.floor(Date.now() / 1000);
    if (parts.length !== 3 || !ISSUERS.has(String(c.iss))) throw new GoogleOAuthError('GOOGLE_INVALID_TOKEN', 'Google returned an invalid response.');
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!aud.includes(this.cfg.google.clientId)) throw new GoogleOAuthError('GOOGLE_INVALID_TOKEN', 'Google returned a token for a different app.');
    if (typeof c.exp !== 'number' || c.exp < now - 60) throw new GoogleOAuthError('GOOGLE_INVALID_TOKEN', 'Google sign-in expired. Please try again.');
    if (c.nonce !== nonce) throw new GoogleOAuthError('GOOGLE_INVALID_TOKEN', 'Google sign-in could not be verified. Please try again.');
    if (typeof c.sub !== 'string' || typeof c.email !== 'string') throw new GoogleOAuthError('GOOGLE_INVALID_TOKEN', 'Google did not share an email address.');
    const emailVerified = c.email_verified === true || c.email_verified === 'true';
    if (!emailVerified) throw new GoogleOAuthError('GOOGLE_EMAIL_UNVERIFIED', 'Your Google email address is not verified.');
    return { sub: c.sub, email: c.email.trim().toLowerCase(), emailVerified, name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 60) : c.email.split('@')[0].slice(0, 60) };
  }
}
