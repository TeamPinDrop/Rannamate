import { Logger } from '@nestjs/common';
import { createPool, type Pool } from 'mysql2/promise';
import type { AppConfig } from '../../config/configuration';

/**
 * Lazily-created MySQL connection pool for the EXISTING `ranna_mate` database.
 * Nothing connects at startup; the first query (or the health check) opens the pool.
 * This code never runs CREATE / ALTER / DROP / TRUNCATE and the app never migrates the schema.
 */
let pool: Pool | null = null;
export function getPool(cfg: AppConfig): Pool {
  if (!cfg.db.configured) throw new Error('MySQL is not configured');
  if (!pool) {
    new Logger('MySQL').log(`Creating pool for ${cfg.db.database}@${cfg.db.host}:${cfg.db.port}`);
    pool = createPool({
      host: cfg.db.host, port: cfg.db.port, user: cfg.db.username, password: cfg.db.password, database: cfg.db.database,
      charset: 'utf8mb4_unicode_ci', connectionLimit: 10, waitForConnections: true, namedPlaceholders: true,
      dateStrings: true, supportBigNumbers: true, bigNumberStrings: true,
    });
    // TIMESTAMP columns are read and written in UTC; DATETIME values are always passed in as UTC by the repositories
    pool.on('connection', (c) => { c.query("SET time_zone = '+00:00'"); });
  }
  return pool;
}

export async function pingDatabase(cfg: AppConfig): Promise<'ok' | 'unreachable'> {
  try { await getPool(cfg).query('SELECT 1'); return 'ok'; } catch { return 'unreachable'; }
}

export async function closePool() { await pool?.end(); pool = null; }
