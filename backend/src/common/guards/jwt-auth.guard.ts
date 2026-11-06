import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { IS_PUBLIC, OPTIONAL_AUTH } from '../decorators/auth.decorators';
import { Errors } from '../errors';
import { REPO, type AuthSessionsRepository } from '../../database/repositories';

/**
 * Global guard: every route needs a valid access token unless marked @Public or @OptionalAuth.
 * Expired and malformed tokens get distinct error codes so the client knows to refresh.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector, private readonly jwt: JwtService, @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(REPO.authSessions) private readonly sessions: AuthSessionsRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const flags = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, flags)) return true;
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, flags);
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const header = req.headers.authorization ?? '';
    const token = /^Bearer\s+(.+)$/i.exec(header)?.[1];
    if (!token) {
      if (optional) return true;
      throw Errors.unauthorized('UNAUTHORIZED', 'Sign in to use this feature.');
    }
    let p: { sub: string; email: string; sid?: string; typ?: string };
    try {
      p = await this.jwt.verifyAsync(token, { secret: this.cfg.jwt.secret, algorithms: ['HS256'] });
      if (p.typ !== 'access' || !p.sid) throw new Error('wrong token type');
    } catch (e) {
      throw e instanceof TokenExpiredError
        ? Errors.unauthorized('TOKEN_EXPIRED', 'Your session has expired — refresh your token.')
        : Errors.unauthorized('INVALID_TOKEN', 'The access token is invalid.');
    }
    // signed out (or every session revoked) → the access token stops working at once, not after it expires.
    // A session that was merely rotated (replacedBy set) keeps its last access token until expiry.
    const s = await this.sessions.findById(p.sid);
    if (!s || (s.revokedAt && !s.replacedBy)) throw Errors.unauthorized('SESSION_ENDED', 'You were signed out. Please sign in again.');
    req.user = { id: p.sub, email: p.email, sessionId: p.sid };
    return true;
  }
}
