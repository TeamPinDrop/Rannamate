import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { Errors } from '../../common/errors';

/**
 * Private object storage for user photos (Tastory). Binaries never go into MySQL.
 * Objects are private: the only way to read one is a short-lived HMAC-signed URL issued
 * to its authenticated owner. Providers:
 *   local — files under STORAGE_LOCAL_DIR on this machine (development)
 *   s3    — reserved; not implemented yet (returns STORAGE_NOT_CONFIGURED)
 */
@Injectable()
export class StorageService {
  private readonly root: string;
  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {
    this.root = resolve(cfg.storage.localDir);
  }

  get provider() { return this.cfg.storage.provider || null; }

  private ensure() {
    if (this.cfg.storage.provider === 'local') return;
    if (this.cfg.storage.provider === 's3') throw Errors.unavailable('STORAGE_NOT_CONFIGURED', 'Cloud photo storage (s3) is not implemented yet. Use STORAGE_PROVIDER=local for development.');
    throw Errors.unavailable('STORAGE_NOT_CONFIGURED', 'Photo storage is not configured (set STORAGE_PROVIDER in backend/.env).');
  }

  private pathFor(key: string) {
    if (!/^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]+$/i.test(key) || key.includes('..')) throw Errors.badRequest('INVALID_KEY', 'Invalid storage key');
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root + sep)) throw Errors.badRequest('INVALID_KEY', 'Invalid storage key');
    return p;
  }

  newKey(ownerId: string, contentType: string) {
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    return `users/${ownerId.replace(/[^a-z0-9-]/gi, '')}/${randomUUID()}.${ext}`;
  }

  async put(key: string, body: Buffer) {
    this.ensure();
    const p = this.pathFor(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    this.ensure();
    try { return await readFile(this.pathFor(key)); } catch { throw Errors.notFound('Photo'); }
  }

  async delete(keys: string[]) {
    if (!keys.length) return;
    this.ensure();
    await Promise.all(keys.map((k) => rm(this.pathFor(k), { force: true })));
  }

  private sign(key: string, exp: number) {
    return createHmac('sha256', this.cfg.storage.signingSecret).update(`${key}\n${exp}`).digest('base64url');
  }

  /** A URL the browser can load for `ttlSeconds` (default 15 min). */
  signedUrl(key: string, ttlSeconds = 900) {
    this.ensure();
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return { url: `/api/v1/media/${key}?exp=${exp}&sig=${this.sign(key, exp)}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  verify(key: string, exp: string, sig: string) {
    this.ensure();
    const e = Number(exp);
    if (!Number.isFinite(e) || e < Date.now() / 1000) throw Errors.forbidden('This photo link has expired — reload the page to get a fresh one.');
    const want = Buffer.from(this.sign(key, e));
    const got = Buffer.from(String(sig));
    if (want.length !== got.length || !timingSafeEqual(want, got)) throw Errors.forbidden('Invalid photo link.');
  }
}
