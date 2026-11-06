import { GoogleOAuthClient, GoogleOAuthError } from './google-oauth.client';
import { safeReturnTo } from '../../modules/auth/auth.cookies';
import type { AppConfig } from '../../config/configuration';

const cfg = { google: { clientId: 'client-123.apps.googleusercontent.com', clientSecret: 's', redirectUri: 'http://localhost:4000/api/v1/auth/google/callback', configured: true } } as AppConfig;
const client = new GoogleOAuthClient(cfg);
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (claims: object) => `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`;
const good = { iss: 'https://accounts.google.com', aud: cfg.google.clientId, exp: Math.floor(Date.now() / 1000) + 600, nonce: 'n1', sub: '1234', email: 'Gita@Gmail.com', email_verified: true, name: 'Gita' };
const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as GoogleOAuthError).code; } return 'OK'; };

describe('GoogleOAuthClient.validateIdToken', () => {
  it('accepts a valid token and normalises the email', () => {
    expect(client.validateIdToken(token(good), 'n1')).toEqual({ sub: '1234', email: 'gita@gmail.com', emailVerified: true, name: 'Gita' });
  });
  it.each([
    ['wrong issuer', { iss: 'https://evil.example' }],
    ['wrong audience', { aud: 'someone-else' }],
    ['expired', { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ['wrong nonce', { nonce: 'other' }],
  ])('rejects %s', (_n, patch) => { expect(code(() => client.validateIdToken(token({ ...good, ...patch }), 'n1'))).toBe('GOOGLE_INVALID_TOKEN'); });
  it('rejects an unverified email', () => { expect(code(() => client.validateIdToken(token({ ...good, email_verified: false }), 'n1'))).toBe('GOOGLE_EMAIL_UNVERIFIED'); });
  it('rejects garbage', () => { expect(code(() => client.validateIdToken('nope', 'n1'))).toBe('GOOGLE_INVALID_TOKEN'); });
  it('builds an authorization URL with PKCE and nonce', () => {
    const u = new URL(client.authorizationUrl({ state: 's', nonce: 'n', codeChallenge: 'c' }));
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('scope')).toBe('openid email profile');
    expect(u.searchParams.get('redirect_uri')).toBe(cfg.google.redirectUri);
  });
});

describe('safeReturnTo', () => {
  it.each([['/profile', '/profile'], ['/tastory?x=1', '/tastory?x=1'], ['//evil.com', '/'], ['/\\evil.com', '/'], ['https://evil.com', '/'], [undefined, '/'], ['/a\r\nb', '/']])('%s → %s', (i, o) => {
    expect(safeReturnTo(i)).toBe(o);
  });
});
