import { ConfigError, loadConfig, ttlSeconds } from './configuration';

const good = { JWT_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40) };
describe('configuration', () => {
  it('refuses to start without strong JWT secrets', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ JWT_SECRET: 'short', JWT_REFRESH_SECRET: 'b'.repeat(40) })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ JWT_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'a'.repeat(40) })).toThrow(/different/);
  });
  it('defaults to MySQL and never invents database credentials', () => {
    const c = loadConfig(good);
    expect(c.dataSource).toBe('mysql');
    expect(c.db).toMatchObject({ host: '', username: '', password: '', database: 'ranna_mate', configured: false });
  });
  it('requires a signing secret for local photo storage', () => {
    expect(() => loadConfig({ ...good, STORAGE_PROVIDER: 'local' })).toThrow(/STORAGE_SIGNING_SECRET/);
  });
  it('auth: email, Google and cookies are off/safe by default and validated when set', () => {
    const c = loadConfig(good);
    expect(c.mail.configured).toBe(false);
    expect(c.google.configured).toBe(false);
    expect(c.cookies).toEqual({ secure: false, sameSite: 'lax', domain: '' });
    expect(c.web.appUrl).toBe('http://localhost:3000');
    expect(c.google.redirectUri).toBe('http://localhost:4000/api/v1/auth/google/callback');
    expect(loadConfig({ ...good, NODE_ENV: 'production' }).cookies.secure).toBe(true);
    expect(() => loadConfig({ ...good, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadConfig({ ...good, COOKIE_SAMESITE: 'none' })).toThrow(/COOKIE_SECURE=true/);
    expect(() => loadConfig({ ...good, SMTP_HOST: 'smtp.example.com' })).toThrow(/MAIL_FROM/);
    expect(() => loadConfig({ ...good, GOOGLE_CLIENT_ID: 'x' })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(loadConfig({ ...good, SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'R <a@b.c>' }).mail.configured).toBe(true);
  });
  it('parses durations', () => {
    expect(ttlSeconds('15m')).toBe(900);
    expect(ttlSeconds('7d')).toBe(604800);
  });
});
