import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { perMinute } from '../../common/utils/rate-limit';
import { CurrentUser, Public, type AuthUser } from '../../common/decorators/auth.decorators';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { UsersService } from '../users/users.service';
import { AUTH_COOKIE_PATH, COOKIE, CsrfGuard, OAUTH_COOKIE_PATH, cookieOptions, newCsrfToken, readCookie } from './auth.cookies';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, ResetTokenDto } from './auth.dto';
import { AuthService, type IssuedSession } from './auth.service';

const csrfHeader = { name: 'X-CSRF-Token', description: 'Value from GET /auth/csrf (double-submit check against the rm_csrf cookie)', required: true };

/**
 * Browser sessions: the refresh token lives ONLY in the httpOnly `rm_session` cookie (path /api/v1/auth).
 * The short-lived access token is returned in the body and kept in memory by the app (never localStorage).
 * Cookie-using endpoints require the CSRF header.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly users: UsersService, @Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  @Public() @Throttle(perMinute(60))
  @Get('csrf') @ApiOperation({ summary: 'Get the CSRF token for this browser (sets the httpOnly rm_csrf cookie) and whether a session cookie exists' })
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    let token = readCookie(req, COOKIE.csrf);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      token = newCsrfToken();
      res.cookie(COOKIE.csrf, token, cookieOptions(this.cfg, AUTH_COOKIE_PATH));
    }
    return { csrfToken: token, hasSession: !!readCookie(req, COOKIE.session) };
  }

  @Public()
  @Get('providers') @ApiOperation({ summary: 'Which sign-in options are configured on this server (Google button and password reset only show when true)' })
  providers() { return this.auth.providers(); }

  @Public() @Throttle(perMinute(10)) @UseGuards(CsrfGuard) @ApiHeader(csrfHeader)
  @Post('register') @ApiOperation({ summary: 'Create an account and sign in (sets the session cookie)' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.register(dto.email, dto.password, dto.displayName);
    return this.signedIn(res, r.user, r.session);
  }

  @Public() @Throttle(perMinute(10)) @UseGuards(CsrfGuard) @ApiHeader(csrfHeader)
  @Post('login') @HttpCode(200) @ApiOperation({ summary: 'Sign in with email and password (sets the session cookie)' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto.email, dto.password, dto.remember === true);
    return this.signedIn(res, r.user, r.session);
  }

  @Public() @Throttle(perMinute(30)) @UseGuards(CsrfGuard) @ApiHeader(csrfHeader)
  @Post('refresh') @HttpCode(200) @ApiOperation({ summary: 'Use the session cookie to get a new access token (rotates the cookie)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const r = await this.auth.refresh(readCookie(req, COOKIE.session));
      return this.signedIn(res, r.user, r.session, readCookie(req, COOKIE.csrf)!);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'REFRESH_RACE') res.clearCookie(COOKIE.session, cookieOptions(this.cfg, AUTH_COOKIE_PATH));
      throw e;
    }
  }

  @Public() @Throttle(perMinute(30)) @UseGuards(CsrfGuard) @ApiHeader(csrfHeader)
  @Post('logout') @HttpCode(204) @ApiOperation({ summary: 'End this sign-in session and clear the cookie' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readCookie(req, COOKIE.session));
    res.clearCookie(COOKIE.session, cookieOptions(this.cfg, AUTH_COOKIE_PATH));
  }

  @ApiBearerAuth() @Get('me') @ApiOperation({ summary: 'The signed-in user' })
  me(@CurrentUser() user: AuthUser) { return this.users.me(user.id); }

  // ── password reset ──
  @Public() @Throttle(perMinute(5)) @UseGuards(CsrfGuard) @ApiHeader(csrfHeader)
  @Post('password/forgot') @HttpCode(202) @ApiOperation({ summary: 'Email a single-use reset link (503 EMAIL_NOT_CONFIGURED if SMTP is not set up). Same answer whether or not the email is registered.' })
  forgot(@Body() dto: ForgotPasswordDto) { return this.auth.forgotPassword(dto.email); }

  @Public() @Throttle(perMinute(20))
  @Post('password/reset/check') @HttpCode(200) @ApiOperation({ summary: 'Is this reset link still usable?' })
  check(@Body() dto: ResetTokenDto) { return this.auth.checkResetToken(dto.token); }

  @Public() @Throttle(perMinute(10)) @UseGuards(CsrfGuard) @ApiHeader(csrfHeader)
  @Post('password/reset') @HttpCode(200) @ApiOperation({ summary: 'Set a new password with a reset token (single use). Signs out every device.' })
  async reset(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.resetPassword(dto.token, dto.password);
    res.clearCookie(COOKIE.session, cookieOptions(this.cfg, AUTH_COOKIE_PATH));
    return { email: r.email, message: 'Your password was changed. Sign in with your new password.' };
  }

  // ── Google (only when GOOGLE_CLIENT_ID/SECRET are set; otherwise 404 GOOGLE_NOT_CONFIGURED) ──
  @Public() @Throttle(perMinute(20))
  @Get('google/start') @ApiOperation({ summary: 'Redirect to Google (browser navigation). Query: returnTo, remember=1, link=<ticket>' })
  async googleStart(@Query('returnTo') returnTo: string, @Query('remember') remember: string, @Query('link') link: string, @Res() res: Response) {
    const r = await this.auth.googleStart(returnTo, remember !== '0', link || undefined);
    res.cookie(COOKIE.oauth, r.cookie, { ...cookieOptions(this.cfg, OAUTH_COOKIE_PATH, 600_000), sameSite: 'lax' });
    res.redirect(302, r.url);
  }

  @Public() @Throttle(perMinute(20))
  @Get('google/callback') @ApiOperation({ summary: 'Google redirects back here; validates state + ID token, then redirects to the app' })
  async googleCallback(@Query() q: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    const r = await this.auth.googleCallback({ code: q.code, state: q.state, error: q.error }, readCookie(req, COOKIE.oauth));
    res.clearCookie(COOKIE.oauth, { ...cookieOptions(this.cfg, OAUTH_COOKIE_PATH), sameSite: 'lax' });
    if (r.session) {
      res.cookie(COOKIE.session, r.session.refreshToken, cookieOptions(this.cfg, AUTH_COOKIE_PATH, r.session.remember ? r.session.refreshMaxAgeMs : null));
      res.cookie(COOKIE.csrf, newCsrfToken(), cookieOptions(this.cfg, AUTH_COOKIE_PATH));
    }
    res.redirect(302, r.redirect);
  }

  @ApiBearerAuth() @Throttle(perMinute(10))
  @Post('google/link-ticket') @HttpCode(200) @ApiOperation({ summary: 'Signed-in only: a 2-minute ticket to connect Google to this account via /auth/google/start?link=' })
  linkTicket(@CurrentUser() user: AuthUser) { return this.auth.googleLinkTicket(user.id); }

  /** sets the session cookie + a fresh CSRF token (rotated on sign-in), returns the safe body */
  private signedIn(res: Response, user: unknown, s: IssuedSession, keepCsrf?: string) {
    res.setHeader('Cache-Control', 'no-store');
    res.cookie(COOKIE.session, s.refreshToken, cookieOptions(this.cfg, AUTH_COOKIE_PATH, s.remember ? s.refreshMaxAgeMs : null));
    const csrfToken = keepCsrf ?? newCsrfToken();
    if (!keepCsrf) res.cookie(COOKIE.csrf, csrfToken, cookieOptions(this.cfg, AUTH_COOKIE_PATH));
    return { user, accessToken: s.accessToken, expiresIn: s.expiresIn, csrfToken };
  }
}
