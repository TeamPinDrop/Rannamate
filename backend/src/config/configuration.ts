/**
 * Typed, validated configuration. The app refuses to start with an unsafe configuration
 * (missing/short JWT secrets, unknown data source) rather than falling back silently.
 * No credentials have defaults — everything sensitive comes from the environment.
 */
export type DataSource = 'mysql' | 'memory';
export type StorageProvider = '' | 'local' | 's3';

export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  dataSource: DataSource;
  db: { host: string; port: number; username: string; password: string; database: string; configured: boolean };
  jwt: { secret: string; refreshSecret: string; accessTtl: string; refreshTtl: string; sessionTtl: string };
  /** where the browser app lives (reset links, Google redirects) and how auth cookies are set */
  web: { appUrl: string; apiPublicUrl: string };
  cookies: { secure: boolean; sameSite: 'lax' | 'strict' | 'none'; domain: string };
  mail: { host: string; port: number; secure: boolean; user: string; password: string; from: string; configured: boolean };
  google: { clientId: string; clientSecret: string; redirectUri: string; configured: boolean };
  passwordResetTtlMinutes: number;
  ai: { url: string; apiKey: string; configured: boolean; timeoutMs: number };
  storage: { provider: StorageProvider; localDir: string; signingSecret: string; accessKey: string; secretKey: string; bucket: string; region: string };
  recoWeights: Record<'I' | 'M' | 'C' | 'W' | 'T' | 'P' | 'H', number>;
}

export const DEFAULT_RECO_WEIGHTS = { I: 0.35, M: 0.15, C: 0.15, W: 0.1, T: 0.1, P: 0.1, H: 0.05 };

export class ConfigError extends Error {}

const str = (v: string | undefined, d = '') => (v ?? d).trim();

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = [];

  const dataSource = str(env.DATA_SOURCE, 'mysql') as DataSource;
  if (!['mysql', 'memory'].includes(dataSource)) problems.push(`DATA_SOURCE must be "mysql" or "memory" (got "${dataSource}")`);

  const secret = str(env.JWT_SECRET);
  const refreshSecret = str(env.JWT_REFRESH_SECRET);
  if (secret.length < 32) problems.push('JWT_SECRET must be set to at least 32 random characters (e.g. `openssl rand -base64 48`)');
  if (refreshSecret.length < 32) problems.push('JWT_REFRESH_SECRET must be set to at least 32 random characters');
  if (secret && secret === refreshSecret) problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');

  const provider = str(env.STORAGE_PROVIDER) as StorageProvider;
  if (!['', 'local', 's3'].includes(provider)) problems.push(`STORAGE_PROVIDER must be empty, "local" or "s3" (got "${provider}")`);
  const signingSecret = str(env.STORAGE_SIGNING_SECRET);
  if (provider === 'local' && signingSecret.length < 32) problems.push('STORAGE_SIGNING_SECRET must be at least 32 characters when STORAGE_PROVIDER=local');

  let recoWeights = DEFAULT_RECO_WEIGHTS;
  if (str(env.RECO_WEIGHTS)) {
    try {
      const w = JSON.parse(env.RECO_WEIGHTS!);
      const keys = Object.keys(DEFAULT_RECO_WEIGHTS);
      if (!keys.every((k) => typeof w[k] === 'number' && w[k] >= 0)) throw new Error();
      recoWeights = w;
    } catch {
      problems.push('RECO_WEIGHTS must be JSON with non-negative numbers for I, M, C, W, T, P and H');
    }
  }

  const sameSite = str(env.COOKIE_SAMESITE, 'lax').toLowerCase() as AppConfig['cookies']['sameSite'];
  if (!['lax', 'strict', 'none'].includes(sameSite)) problems.push(`COOKIE_SAMESITE must be lax, strict or none (got "${sameSite}")`);
  const production = str(env.NODE_ENV) === 'production';
  const secureCookies = str(env.COOKIE_SECURE) ? str(env.COOKIE_SECURE) === 'true' : production;
  if (sameSite === 'none' && !secureCookies) problems.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  if (production && !secureCookies) problems.push('COOKIE_SECURE must not be false in production');

  // email: all-or-nothing, so a half-filled SMTP block is reported instead of silently "not configured"
  const smtp = { host: str(env.SMTP_HOST), user: str(env.SMTP_USER), password: env.SMTP_PASSWORD ?? '', from: str(env.MAIL_FROM) };
  if (smtp.host && !smtp.from) problems.push('MAIL_FROM is required when SMTP_HOST is set (e.g. "RANNAMATE <no-reply@yourdomain>")');
  if (!smtp.host && (smtp.user || smtp.from)) problems.push('SMTP_HOST is required when SMTP_USER or MAIL_FROM is set');

  const gId = str(env.GOOGLE_CLIENT_ID);
  const gSecret = str(env.GOOGLE_CLIENT_SECRET);
  if (!!gId !== !!gSecret) problems.push('Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither');

  if (problems.length) throw new ConfigError(`Invalid backend configuration:\n  - ${problems.join('\n  - ')}\nSee backend/.env.example.`);

  const host = str(env.DB_HOST);
  const username = str(env.DB_USERNAME);
  const aiUrl = str(env.AI_SERVICE_URL).replace(/\/+$/, '');
  const port = Number(env.PORT) || 4000;
  const corsOrigins = str(env.CORS_ORIGINS, 'http://localhost:3000,http://localhost:3001').split(',').map((s) => s.trim()).filter(Boolean);
  const appUrl = str(env.APP_URL, corsOrigins[0] ?? 'http://localhost:3000').replace(/\/+$/, '');
  const apiPublicUrl = str(env.API_PUBLIC_URL, `http://localhost:${port}`).replace(/\/+$/, '');
  return {
    env: str(env.NODE_ENV, 'development'),
    port,
    corsOrigins,
    dataSource,
    db: { host, port: Number(env.DB_PORT) || 3306, username, password: env.DB_PASSWORD ?? '', database: str(env.DB_DATABASE, 'ranna_mate'), configured: !!(host && username) },
    // refreshTtl = "Remember me" sessions; sessionTtl = sessions that end when the browser closes (server-side cap)
    jwt: { secret, refreshSecret, accessTtl: str(env.JWT_ACCESS_TTL, '15m'), refreshTtl: str(env.JWT_REFRESH_TTL, '30d'), sessionTtl: str(env.SESSION_TTL, '12h') },
    web: { appUrl, apiPublicUrl },
    cookies: { secure: secureCookies, sameSite, domain: str(env.COOKIE_DOMAIN) },
    mail: { host: smtp.host, port: Number(env.SMTP_PORT) || 587, secure: str(env.SMTP_SECURE) === 'true', user: smtp.user, password: smtp.password, from: smtp.from, configured: !!(smtp.host && smtp.from) },
    google: { clientId: gId, clientSecret: gSecret, redirectUri: str(env.GOOGLE_REDIRECT_URI, `${apiPublicUrl}/api/v1/auth/google/callback`), configured: !!(gId && gSecret) },
    passwordResetTtlMinutes: Math.min(120, Math.max(5, Number(env.PASSWORD_RESET_TTL_MINUTES) || 30)),
    ai: { url: aiUrl, apiKey: str(env.AI_SERVICE_API_KEY), configured: !!(aiUrl && str(env.AI_SERVICE_API_KEY)), timeoutMs: Number(env.AI_SERVICE_TIMEOUT_MS) || 25_000 },
    storage: {
      provider,
      localDir: str(env.STORAGE_LOCAL_DIR, './storage/private'),
      signingSecret,
      accessKey: str(env.STORAGE_ACCESS_KEY),
      secretKey: str(env.STORAGE_SECRET_KEY),
      bucket: str(env.STORAGE_BUCKET),
      region: str(env.STORAGE_REGION),
    },
    recoWeights,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

/** "15m" / "7d" / "3600" → seconds */
export function ttlSeconds(ttl: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(ttl.trim());
  if (!m) throw new ConfigError(`Invalid duration "${ttl}"`);
  const n = Number(m[1]);
  return n * ({ '': 1, s: 1, m: 60, h: 3600, d: 86400 } as Record<string, number>)[m[2]];
}
