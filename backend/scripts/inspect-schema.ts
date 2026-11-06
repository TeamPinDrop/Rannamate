/**
 * READ-ONLY schema inspector for the existing `ranna_mate` database.
 *
 *   npm run schema:inspect -- --from-dump ../schema.sql     # parse a `mysqldump --no-data` file (no DB connection)
 *   npm run schema:inspect -- --live --i-understand-read-only   # read INFORMATION_SCHEMA using DB_* from .env
 *
 * Writes docs/SCHEMA.generated.md and docs/schema.generated.json.
 * Executes only SELECT statements against INFORMATION_SCHEMA — never CREATE/ALTER/DROP/TRUNCATE/INSERT.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { loadDotEnv } from '../src/config/dotenv';
import { parseDump, toMarkdown, type Table } from '../src/database/schema/schema';

async function live(): Promise<Table[]> {
  loadDotEnv();
  const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE } = process.env;
  if (!DB_HOST || !DB_USERNAME) throw new Error('Set DB_HOST, DB_USERNAME (and DB_PASSWORD) in backend/.env first.');
  const db = DB_DATABASE || 'ranna_mate';
  const c = await createConnection({ host: DB_HOST, port: Number(DB_PORT) || 3306, user: DB_USERNAME, password: DB_PASSWORD, database: db });
  try {
    const q = async <T>(sql: string) => (await c.query(sql, [db]))[0] as T[];
    const tables = await q<{ TABLE_NAME: string; ENGINE: string; TABLE_COLLATION: string }>('SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = "BASE TABLE"');
    const columns = await q<{ TABLE_NAME: string; COLUMN_NAME: string; COLUMN_TYPE: string; IS_NULLABLE: string; COLUMN_DEFAULT: string | null; EXTRA: string; COLUMN_KEY: string }>('SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION');
    const keys = await q<{ TABLE_NAME: string; CONSTRAINT_NAME: string; COLUMN_NAME: string; REFERENCED_TABLE_NAME: string | null; REFERENCED_COLUMN_NAME: string | null }>('SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION');
    const idx = await q<{ TABLE_NAME: string; INDEX_NAME: string; COLUMN_NAME: string; NON_UNIQUE: number }>('SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX');
    const rules = await q<{ CONSTRAINT_NAME: string; DELETE_RULE: string; UPDATE_RULE: string }>('SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ?');
    return tables.map((t) => {
      const fks = new Map<string, Table['foreignKeys'][number]>();
      for (const k of keys.filter((k) => k.TABLE_NAME === t.TABLE_NAME && k.REFERENCED_TABLE_NAME)) {
        const f = fks.get(k.CONSTRAINT_NAME) ?? { name: k.CONSTRAINT_NAME, columns: [], refTable: k.REFERENCED_TABLE_NAME!, refColumns: [], onDelete: rules.find((r) => r.CONSTRAINT_NAME === k.CONSTRAINT_NAME)?.DELETE_RULE, onUpdate: rules.find((r) => r.CONSTRAINT_NAME === k.CONSTRAINT_NAME)?.UPDATE_RULE };
        f.columns.push(k.COLUMN_NAME); f.refColumns.push(k.REFERENCED_COLUMN_NAME!); fks.set(k.CONSTRAINT_NAME, f);
      }
      const ix = new Map<string, Table['indexes'][number]>();
      for (const i of idx.filter((i) => i.TABLE_NAME === t.TABLE_NAME && i.INDEX_NAME !== 'PRIMARY')) {
        const e = ix.get(i.INDEX_NAME) ?? { name: i.INDEX_NAME, columns: [], unique: !i.NON_UNIQUE }; e.columns.push(i.COLUMN_NAME); ix.set(i.INDEX_NAME, e);
      }
      return {
        name: t.TABLE_NAME, engine: t.ENGINE, collation: t.TABLE_COLLATION, charset: t.TABLE_COLLATION?.split('_')[0],
        columns: columns.filter((c) => c.TABLE_NAME === t.TABLE_NAME).map((c) => ({ name: c.COLUMN_NAME, type: c.COLUMN_TYPE, nullable: c.IS_NULLABLE === 'YES', default: c.COLUMN_DEFAULT, extra: c.EXTRA })),
        primaryKey: idx.filter((i) => i.TABLE_NAME === t.TABLE_NAME && i.INDEX_NAME === 'PRIMARY').map((i) => i.COLUMN_NAME),
        foreignKeys: [...fks.values()], indexes: [...ix.values()],
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  } finally { await c.end(); }
}

async function main() {
  const args = process.argv.slice(2);
  const dumpAt = args.indexOf('--from-dump');
  let tables: Table[];
  let source: string;
  if (dumpAt >= 0 && args[dumpAt + 1]) {
    const file = resolve(args[dumpAt + 1]);
    tables = parseDump(readFileSync(file, 'utf8'));
    source = `dump file ${file.split(/[\\/]/).pop()}`;
  } else if (args.includes('--live') && args.includes('--i-understand-read-only')) {
    tables = await live();
    source = `INFORMATION_SCHEMA of ${process.env.DB_DATABASE || 'ranna_mate'} (read-only)`;
  } else {
    console.log('Usage:\n  npm run schema:inspect -- --from-dump <schema.sql>\n  npm run schema:inspect -- --live --i-understand-read-only');
    process.exit(1);
  }
  writeFileSync(resolve(__dirname, '../docs/SCHEMA.generated.md'), toMarkdown(tables, source));
  writeFileSync(resolve(__dirname, '../docs/schema.generated.json'), JSON.stringify({ source, generatedAt: new Date().toISOString(), tables }, null, 1));
  console.log(`✓ ${tables.length} tables → docs/SCHEMA.generated.md (expected 39)`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
