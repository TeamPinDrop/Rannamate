/**
 * MySQL repositories for the existing `ranna_mate` schema.
 *
 * STATUS: NOT MAPPED. The table/column definitions of the 39-table schema have not been provided,
 * so no SQL is written here — guessing column names would silently corrupt data or fail at runtime.
 * Every method raises a 503 (SCHEMA_NOT_VERIFIED, or DATABASE_NOT_CONFIGURED when DB_* are blank)
 * instead of returning anything.
 *
 * To implement: run `npm run schema:inspect` against the database (read-only), review
 * docs/DATABASE_MAPPING.md, then replace each `unmapped(...)` with a class implementing the
 * repository interface using parameterised queries via getPool(cfg).
 */
import type { AppConfig } from '../../config/configuration';
import { DatabaseUnavailableError } from '../../common/errors';

export function unmapped<T extends object>(area: string, cfg: AppConfig): T {
  return new Proxy({} as T, {
    get: (_t, prop) => {
      // framework probes (promise check, Nest lifecycle hooks, inspection) must not look like repository calls
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'constructor' || prop === 'toJSON' || /^(on|before)[A-Z]/.test(prop)) return undefined;
      return async () => { throw new DatabaseUnavailableError(cfg.db.configured ? 'SCHEMA_NOT_VERIFIED' : 'DATABASE_NOT_CONFIGURED', area); };
    },
  });
}
