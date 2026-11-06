/**
 * Schema description used to produce the verified database mapping. Built either from a
 * `mysqldump --no-data` file (parseDump) or from INFORMATION_SCHEMA (scripts/inspect-schema.ts).
 * Pure functions — nothing here touches a database.
 */
export interface Column { name: string; type: string; nullable: boolean; default: string | null; extra: string }
export interface ForeignKey { name: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }
export interface Index { name: string; columns: string[]; unique: boolean }
export interface Table { name: string; columns: Column[]; primaryKey: string[]; foreignKeys: ForeignKey[]; indexes: Index[]; engine?: string; charset?: string; collation?: string }

const unq = (s: string) => s.trim().replace(/^`|`$/g, '');
const cols = (s: string) => s.split(',').map((c) => unq(c.replace(/\(\d+\)$/, '')));

/** Parses CREATE TABLE statements from a MySQL dump. Only reads text; never executes SQL. */
export function parseDump(sql: string): Table[] {
  const tables: Table[] = [];
  const re = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?([\w$]+)`?\s*\(([\s\S]*?)\n\)\s*([^;]*);/gi;
  for (const m of sql.replace(/\r\n/g, '\n').matchAll(re)) {
    const t: Table = { name: m[1], columns: [], primaryKey: [], foreignKeys: [], indexes: [] };
    const tail = m[3];
    t.engine = /ENGINE=(\w+)/i.exec(tail)?.[1];
    t.charset = /CHARSET=(\w+)/i.exec(tail)?.[1];
    t.collation = /COLLATE=(\w+)/i.exec(tail)?.[1];
    for (const raw of m[2].split('\n')) {
      const line = raw.trim().replace(/,$/, '');
      if (!line) continue;
      let x: RegExpExecArray | null;
      if ((x = /^PRIMARY KEY\s*\((.+)\)/i.exec(line))) t.primaryKey = cols(x[1]);
      else if ((x = /^(UNIQUE\s+)?(?:KEY|INDEX)\s+`?([\w$]+)`?\s*\((.+?)\)/i.exec(line))) t.indexes.push({ name: x[2], columns: cols(x[3]), unique: !!x[1] });
      else if ((x = /^CONSTRAINT\s+`?([\w$]+)`?\s+FOREIGN KEY\s*\((.+?)\)\s+REFERENCES\s+`?([\w$]+)`?\s*\((.+?)\)(.*)$/i.exec(line))) {
        t.foreignKeys.push({ name: x[1], columns: cols(x[2]), refTable: x[3], refColumns: cols(x[4]), onDelete: /ON DELETE (CASCADE|SET NULL|RESTRICT|NO ACTION)/i.exec(x[5])?.[1], onUpdate: /ON UPDATE (CASCADE|SET NULL|RESTRICT|NO ACTION)/i.exec(x[5])?.[1] });
      } else if ((x = /^`([\w$]+)`\s+(.+)$/.exec(line))) {
        const def = x[2];
        const type = /^([a-z]+(?:\([^)]*\))?(?:\s+unsigned)?)/i.exec(def)?.[1] ?? def.split(' ')[0];
        t.columns.push({
          name: x[1], type, nullable: !/NOT NULL/i.test(def),
          default: /DEFAULT\s+('(?:[^']|'')*'|[^\s,]+)/i.exec(def)?.[1]?.replace(/^'|'$/g, '') ?? null,
          extra: [/AUTO_INCREMENT/i.test(def) && 'auto_increment', /ON UPDATE CURRENT_TIMESTAMP/i.test(def) && 'on update current_timestamp', /GENERATED/i.test(def) && 'generated'].filter(Boolean).join(', '),
        });
      }
    }
    tables.push(t);
  }
  return tables.sort((a, b) => a.name.localeCompare(b.name));
}

/** Tables each backend area needs. Names come from the supplied diagram; the rest is unknown until verified. */
export const EXPECTED: { area: string; tables: string[] }[] = [
  { area: 'Auth & profile', tables: ['users', 'user_profiles'] },
  { area: 'Recipes & discovery', tables: ['recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_dietary_tags', 'recipe_allergens'] },
  { area: 'Favourites', tables: ['favourites'] },
  { area: 'Kitchen inventory', tables: ['user_inventory'] },
  { area: 'Cooking sessions', tables: ['cooking_sessions', 'cooking_step_progress'] },
  { area: 'Shopping lists (no UI)', tables: ['shopping_lists', 'shopping_list_items'] },
];

export function toMarkdown(tables: Table[], source: string): string {
  const names = new Set(tables.map((t) => t.name));
  const out = [`# ranna_mate — verified schema`, '', `_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} from ${source}. ${tables.length} tables._`, '', '## Coverage of the tables the backend needs', '', '| Area | Table | Present |', '|---|---|---|'];
  for (const e of EXPECTED) for (const t of e.tables) out.push(`| ${e.area} | \`${t}\` | ${names.has(t) ? '✅' : '❌ missing'} |`);
  const unknown = tables.filter((t) => !EXPECTED.some((e) => e.tables.includes(t.name)));
  out.push('', `## Tables not yet assigned to a feature (${unknown.length})`, '', unknown.map((t) => `\`${t.name}\``).join(', ') || '—', '');
  for (const t of tables) {
    out.push(`## \`${t.name}\``, '', `Engine ${t.engine ?? '?'} · charset ${t.charset ?? '?'} · collation ${t.collation ?? '?'} · PK (${t.primaryKey.join(', ') || '—'})`, '', '| Column | Type | Null | Default | Extra |', '|---|---|---|---|---|');
    for (const c of t.columns) out.push(`| \`${c.name}\` | ${c.type} | ${c.nullable ? 'YES' : 'NO'} | ${c.default ?? ''} | ${c.extra} |`);
    if (t.foreignKeys.length) { out.push('', '**Foreign keys**', ''); for (const f of t.foreignKeys) out.push(`- \`${f.name}\`: (${f.columns.join(', ')}) → \`${f.refTable}\`(${f.refColumns.join(', ')})${f.onDelete ? ` ON DELETE ${f.onDelete}` : ''}`); }
    if (t.indexes.length) { out.push('', '**Indexes**', ''); for (const i of t.indexes) out.push(`- ${i.unique ? 'UNIQUE ' : ''}\`${i.name}\` (${i.columns.join(', ')})`); }
    out.push('');
  }
  return out.join('\n');
}
