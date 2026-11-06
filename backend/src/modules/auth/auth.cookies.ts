import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Request } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { AppError } from '../../common/errors';

export const COOKIE = { session: 'rm_session', csrf: 'rm_csrf', oauth: 'rm_oauth' } as const;
/** auth cookies are only ever sent to the auth endpoints, never to the rest of the API */
export const AUTH_COOKIE_PATH = '/api/v1/auth';
export const OAUTH_COOKIE_PATH = '/api/v1/auth/google';
export const CSRF_HEADER = 'x-csrf-token';

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

/** httpOnly always; Secure + SameSite from config (Secure is forced on in production). */
export function cookieOptions(cfg: AppConfig, path: string, maxAgeMs?: number | null): CookieOptions {
  return {
    httpOnly: true, secure: cfg.cookies.secure, sameSite: cfg.cookies.sameSite, path,
    ...(cfg.cookies.domain ? { domain: cfg.cookies.domain } : {}),
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

export const newCsrfToken = () => randomBytes(32).toString('base64url');

function same(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * CSRF protection for every auth endpoint that relies on the session cookie (or sets one):
 *  1. a browser Origin, when present, must be one of CORS_ORIGINS, and
 *  2. double-submit token: the X-CSRF-Token header must equal the httpOnly rm_csrf cookie.
 * Another site can neither read the token (CORS) nor set the header, so forged requests fail.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;
    if (origin && origin !== this.cfg.web.apiPublicUrl && !this.cfg.corsOrigins.includes(origin)) throw csrfError();
    const cookie = readCookie(req, COOKIE.csrf);
    const header = req.headers[CSRF_HEADER];
    if (!cookie || typeof header !== 'string' || !same(cookie, header)) throw csrfError();
    return true;
  }
}

const csrfError = () => new AppError(403, 'CSRF_FAILED', 'Security check failed. Please refresh the page and try again.');

/** Only same-site paths: "/profile" yes; "//evil.com", "/\\evil.com", "https://…" no. */
export function safeReturnTo(v: unknown): string {
  if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.length > 300 || /[\r\n]/.test(v)) return '/';
  return v;
}
