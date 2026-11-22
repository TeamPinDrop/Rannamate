import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Minimal .env loader (no dependency). Real environment variables always win. */
export function loadDotEnv(customFile?: string) {
  const candidates = [
    customFile,
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'backend', '.env'),
    resolve(__dirname, '..', '..', '.env'),
    resolve(__dirname, '..', '.env'),
  ].filter(Boolean) as string[];

  const file = candidates.find((f) => existsSync(f));
  if (!file) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
